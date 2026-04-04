import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  AssistantAnswer,
  AssistantContextDoc,
  AssistantMessage,
  AssistantThread,
  assistantAPI,
} from "@/services/assistantApi";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import AssistantMessageContent, {
  normalizePreview,
} from "@/components/assistant/AssistantMessageContent";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  Clock3,
  ExternalLink,
  History,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  PanelLeft,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  FileText,
} from "lucide-react";
const MAX_THREADS = 20;
const MAX_MESSAGES = 40;

type PendingConfirmation =
  | { type: "delete-thread"; threadId: string; threadTitle: string }
  | { type: "clear-history"; count: number }
  | null;

const starterPrompts = [
  "Summarize the latest indexed document",
  "List the most important action items",
  "What client requirements are repeated the most?",
  "Extract deadlines and delivery dates",
];
const API_ROOT = (
  import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"
).replace(/\/api\/v1\/?$/, "");

const nowIso = () => new Date().toISOString();

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (...values: unknown[]) => {
  const match = values.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

  return typeof match === "string" ? match.trim() : "";
};

const toPathSegments = (value: string) =>
  value
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const getContextDocPath = (entry: Record<string, unknown>) => {
  const metadata = isRecord(entry.metadata) ? entry.metadata : null;

  return readString(
    entry.path,
    entry.filepath,
    metadata?.path,
    metadata?.filepath,
    entry.url,
    metadata?.url,
    entry.title,
    metadata?.title,
    entry.source,
    metadata?.source,
    entry.name,
    metadata?.name,
  );
};

const toContextDoc = (entry: unknown): AssistantContextDoc | null => {
  if (typeof entry === "string" && entry.trim().length > 0) {
    return { path: entry.trim() };
  }

  if (!isRecord(entry)) {
    return null;
  }

  const metadata = isRecord(entry.metadata) ? entry.metadata : null;
  const path = getContextDocPath(entry);
  const text = readString(
    entry.text,
    entry.content,
    metadata?.text,
    metadata?.content,
  );
  const previewUrl = readString(
    entry.previewUrl,
    entry.preview_url,
    metadata?.previewUrl,
    metadata?.preview_url,
  );

  if (!path) {
    return null;
  }

  const doc: AssistantContextDoc = { path };
  if (text) {
    doc.text = text;
  }
  if (previewUrl) {
    doc.previewUrl = previewUrl;
  }

  return doc;
};

const dedupeContextDocs = (docs: AssistantContextDoc[]) => {
  const seen = new Set<string>();

  return docs.filter((doc) => {
    const key = doc.path.trim();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getContextDocLabel = (doc: AssistantContextDoc) => {
  const normalizedPath = doc.path.replace(/\\/g, "/");
  return normalizedPath.split("/").filter(Boolean).at(-1) || doc.path;
};

const resolvePreviewUrl = (doc: AssistantContextDoc | null) => {
  if (!doc) {
    return null;
  }

  const explicitPreviewUrl = readString(doc.previewUrl, doc.preview_url);
  if (explicitPreviewUrl) {
    if (/^https?:\/\//i.test(explicitPreviewUrl)) {
      return explicitPreviewUrl;
    }

    return explicitPreviewUrl.startsWith("/")
      ? `${API_ROOT}${explicitPreviewUrl}`
      : `${API_ROOT}/${explicitPreviewUrl}`;
  }

  const normalizedPath = doc.path.replace(/\\/g, "/").trim();
  if (!/\.pdf(?:$|[?#])/i.test(normalizedPath)) {
    return null;
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/uploads/")) {
    return `${API_ROOT}${normalizedPath}`;
  }

  if (normalizedPath.startsWith("uploads/")) {
    return `${API_ROOT}/${normalizedPath}`;
  }

  const uploadsIndex = normalizedPath.indexOf("/uploads/");
  if (uploadsIndex >= 0) {
    return `${API_ROOT}/${normalizedPath.slice(uploadsIndex + 1)}`;
  }

  if (normalizedPath.startsWith("/assistant-documents/")) {
    return `${API_ROOT}${normalizedPath}`;
  }

  if (normalizedPath.startsWith("assistant-documents/")) {
    return `${API_ROOT}/${normalizedPath}`;
  }

  if (normalizedPath.startsWith("client/")) {
    return `${API_ROOT}/assistant-documents/${toPathSegments(
      normalizedPath.slice("client/".length),
    )}`;
  }

  if (normalizedPath.startsWith("data/")) {
    return `${API_ROOT}/assistant-data/${toPathSegments(
      normalizedPath.slice("data/".length),
    )}`;
  }

  const pathwayClientToken = "/rag_model/pathway/client/";
  const pathwayClientIndex = normalizedPath.indexOf(pathwayClientToken);
  if (pathwayClientIndex >= 0) {
    return `${API_ROOT}/assistant-documents/${toPathSegments(
      normalizedPath.slice(pathwayClientIndex + pathwayClientToken.length),
    )}`;
  }

  return `${API_ROOT}/assistant-documents/${toPathSegments(
    getContextDocLabel({ path: normalizedPath }),
  )}`;
};

const normalizeAnswer = (value: unknown): string => {
  // Already a plain string
  if (typeof value === "string") {
    return value.trim() || "No response received from the assistant.";
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    // The backend always sends { answer, response } — check these first
    for (const key of [
      "answer",
      "response",
      "message",
      "text",
      "content",
      "result",
      "output",
    ]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    // Recurse one level for nested shapes like { data: { answer: "..." } }
    for (const val of Object.values(record)) {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const nested = normalizeAnswer(val);
        if (nested !== "No response received from the assistant.")
          return nested;
      }
    }
  }

  // Never show raw JSON — just return a clean fallback
  return "No response received from the assistant.";
};

const extractContextDocs = (payload: AssistantAnswer) => {
  const buckets = [
    payload.contextDocs,
    payload.context_docs,
    payload.docs,
    payload.sources,
  ].flatMap((bucket) => (Array.isArray(bucket) ? bucket : []));

  return dedupeContextDocs(
    buckets
      .map((entry) => toContextDoc(entry))
      .filter((doc): doc is AssistantContextDoc => Boolean(doc)),
  );
};

const extractSources = (payload: Record<string, unknown>) => {
  return extractContextDocs(payload as AssistantAnswer)
    .map((doc) => doc.path)
    .slice(0, 4);
};

const getMessageContextDocs = (message: AssistantMessage) =>
  dedupeContextDocs([
    ...(message.contextDocs ?? []),
    ...((message.sources ?? []).map((path) => ({ path }))),
  ]);

const getPreviewableContextDocs = (messages: AssistantMessage[]) => {
  const docs: AssistantContextDoc[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") {
      continue;
    }

    for (const doc of getMessageContextDocs(message)) {
      if (resolvePreviewUrl(doc)) {
        docs.push(doc);
      }
    }
  }

  return dedupeContextDocs(docs);
};

type AssistantWorkspaceProps = {
  isFullscreen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
};

const AssistantWorkspace = ({
  isFullscreen: isFullscreenProp,
  onFullscreenChange,
}: AssistantWorkspaceProps) => {
  const { user, isAuthenticated } = useAuth();
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [localIsFullscreen, setLocalIsFullscreen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPreviewPath, setSelectedPreviewPath] = useState<string | null>(
    null,
  );
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previousThreadIdRef = useRef<string | null>(null);

  const isFullscreen = isFullscreenProp ?? localIsFullscreen;
  const setIsFullscreen = useCallback(
    (nextValue: boolean | ((current: boolean) => boolean)) => {
      const resolvedValue =
        typeof nextValue === "function" ? nextValue(isFullscreen) : nextValue;

      if (isFullscreenProp === undefined) {
        setLocalIsFullscreen(resolvedValue);
      }

      onFullscreenChange?.(resolvedValue);
    },
    [isFullscreen, isFullscreenProp, onFullscreenChange],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setThreads([]);
      setActiveThreadId(null);
      setIsLoadingHistory(false);
      return;
    }

    let ignore = false;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const response = await assistantAPI.getThreads();
        if (ignore) return;

        setThreads(response.threads.slice(0, MAX_THREADS));
        setActiveThreadId((current) => {
          if (
            current &&
            response.threads.some((thread) => thread.id === current)
          ) {
            return current;
          }

          return response.threads[0]?.id ?? null;
        });
        setErrorMessage(null);
      } catch (error) {
        if (ignore) return;

        const message =
          error instanceof Error
            ? error.message
            : "Failed to load assistant history";
        setThreads([]);
        setActiveThreadId(null);
        setErrorMessage(message);
      } finally {
        if (!ignore) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      ignore = true;
    };
  }, [
    isAuthenticated,
    user?.client_id,
    user?.email,
    user?.emp_id,
    user?.hr_id,
    user?.id,
  ]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeThreadId, threads, isSending]);

  const activeThread =
    threads.find((thread) => thread.id === activeThreadId) ?? null;
  const activeMessages = activeThread?.messages ?? [];
  const previewableContextDocs = getPreviewableContextDocs(activeMessages);
  const selectedPreviewDoc =
    previewableContextDocs.find((doc) => doc.path === selectedPreviewPath) ??
    previewableContextDocs[0] ??
    null;
  const selectedPreviewUrl = resolvePreviewUrl(selectedPreviewDoc);
  const selectedPreviewLabel = selectedPreviewDoc
    ? getContextDocLabel(selectedPreviewDoc)
    : "";
  const isActiveThreadFresh =
    Boolean(activeThread) &&
    activeMessages.length === 0 &&
    activeThread?.title === "New conversation";
  const historyCountLabel = `${threads.length} chat${threads.length === 1 ? "" : "s"}`;
  const isHistoryPanelVisible = isHistoryVisible;

  useEffect(() => {
    const hasThreadChanged = previousThreadIdRef.current !== activeThreadId;
    previousThreadIdRef.current = activeThreadId;

    if (previewableContextDocs.length === 0) {
      setSelectedPreviewPath(null);
      return;
    }

    setSelectedPreviewPath((current) => {
      if (hasThreadChanged) {
        return previewableContextDocs[0].path;
      }

      if (
        current &&
        previewableContextDocs.some((doc) => doc.path === current)
      ) {
        return current;
      }

      return previewableContextDocs[0].path;
    });
  }, [activeThreadId, previewableContextDocs]);

  const createThread = useCallback(async () => {
    try {
      setErrorMessage(null);
      const response = await assistantAPI.createThread();
      const nextThread = response.thread;

      setThreads((current) => [nextThread, ...current].slice(0, MAX_THREADS));
      setActiveThreadId(nextThread.id);

      return nextThread;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create conversation";
      setErrorMessage(message);
      return null;
    }
  }, []);

  const updateThread = (
    threadId: string,
    updater: (thread: AssistantThread) => AssistantThread,
  ) => {
    setThreads((current) =>
      current
        .map((thread) => (thread.id === threadId ? updater(thread) : thread))
        .slice(0, MAX_THREADS),
    );
  };

  const submitQuestion = async (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) return;

    setErrorMessage(null);

    let threadId = activeThreadId;
    if (!threadId) {
      const createdThread = await createThread();
      if (!createdThread) return;
      threadId = createdThread.id;
    }

    const userMessage: AssistantMessage = {
      id: createId(),
      role: "user",
      content: trimmedQuestion,
      createdAt: nowIso(),
    };

    updateThread(threadId, (thread) => {
      const messages = [...thread.messages, userMessage].slice(-MAX_MESSAGES);
      return {
        ...thread,
        title:
          thread.title === "New conversation"
            ? trimmedQuestion.slice(0, 42)
            : thread.title,
        messages,
        updatedAt: nowIso(),
      };
    });

    setInput("");
    setIsSending(true);

    try {
      const response = await assistantAPI.ask(trimmedQuestion, {
        threadId,
        returnContextDocs: true,
      });
      const contextDocs = extractContextDocs(response);
      const nextPreviewDoc = contextDocs.find((doc) => resolvePreviewUrl(doc));

      const assistantMessage: AssistantMessage = {
        id: createId(),
        role: "assistant",
        content: normalizeAnswer(response),
        createdAt: nowIso(),
        contextDocs,
        sources:
          Array.isArray(response.evidence) && response.evidence.length
            ? response.evidence
            : extractSources(response),
      };

      updateThread(threadId, (thread) => ({
        ...thread,
        title:
          thread.title === "New conversation"
            ? trimmedQuestion.slice(0, 42)
            : thread.title,
        messages: [...thread.messages, assistantMessage].slice(-MAX_MESSAGES),
        updatedAt: nowIso(),
      }));

      if (nextPreviewDoc) {
        setSelectedPreviewPath(nextPreviewDoc.path);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to reach the assistant";
      setErrorMessage(message);

      const assistantMessage: AssistantMessage = {
        id: createId(),
        role: "assistant",
        content: message,
        createdAt: nowIso(),
        error: true,
      };

      updateThread(threadId, (thread) => ({
        ...thread,
        messages: [...thread.messages, assistantMessage].slice(-MAX_MESSAGES),
        updatedAt: nowIso(),
      }));
    } finally {
      setIsSending(false);
    }
  };

  const removeThread = async (threadId: string) => {
    const targetThread = threads.find((thread) => thread.id === threadId);
    if (!targetThread) {
      return;
    }

    setPendingConfirmation({
      type: "delete-thread",
      threadId,
      threadTitle: targetThread.title,
    });
  };

  const deleteThread = async (threadId: string) => {
    try {
      await assistantAPI.deleteThread(threadId);
      const remainingThreads = threads.filter((thread) => thread.id !== threadId);
      setThreads(remainingThreads);
      setActiveThreadId((current) => (current === threadId ? remainingThreads[0]?.id ?? null : current));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete conversation";
      setErrorMessage(message);
    }
  };

  const clearHistory = async () => {
    if (threads.length === 0) {
      return;
    }

    setPendingConfirmation({
      type: "clear-history",
      count: threads.length,
    });
  };

  const clearAllThreads = async () => {
    try {
      await assistantAPI.clearThreads();
      setThreads([]);
      setActiveThreadId(null);
      setErrorMessage(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to clear conversation history";
      setErrorMessage(message);
    }
  };

  const handleConfirmAction = async () => {
    const action = pendingConfirmation;
    if (!action) {
      return;
    }

    setPendingConfirmation(null);

    if (action.type === "delete-thread") {
      await deleteThread(action.threadId);
      return;
    }

    await clearAllThreads();
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.shiftKey)) {
        const isAlphabet = /^[a-z]$/i.test(event.key);
        if (!isAlphabet || event.metaKey || event.altKey || isSending) {
          return;
        }

        const target = event.target as HTMLElement | null;
        const isTypingTarget =
          Boolean(target) &&
          (target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            target.isContentEditable);

        if (isTypingTarget) {
          return;
        }

        event.preventDefault();
        textareaRef.current?.focus();
        setInput((current) => `${current}${event.key}`);
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "k") {
        event.preventDefault();
        if (!isSending && !isActiveThreadFresh) {
          void createThread();
        }
        return;
      }

      if (key === "l") {
        event.preventDefault();
        setIsHistoryVisible((current) => !current);
        return;
      }

      if (key === "f") {
        event.preventDefault();
        setIsFullscreen((current) => !current);
        return;
      }

      if (key === "escape" && isFullscreen) {
        event.preventDefault();
        setIsFullscreen(false);
      }
    };

    globalThis.addEventListener("keydown", handleKeydown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeydown);
    };
  }, [
    createThread,
    isActiveThreadFresh,
    isAuthenticated,
    isFullscreen,
    isSending,
    setIsFullscreen,
  ]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-background/50 backdrop-blur-sm transition-opacity duration-500 ease-out",
          isFullscreen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <Card
        className={cn(
          "overflow-hidden border-border/70 bg-card/90 backdrop-blur-md transition-[height,box-shadow,border-radius,transform] duration-500 ease-out motion-safe:transform-gpu",
          isFullscreen
            ? "fixed inset-4 z-40 h-[calc(100vh-2rem)] rounded-[2rem] shadow-[0_36px_120px_-45px_rgba(15,23,42,0.7)]"
            : "relative h-[760px] shadow-card",
        )}
      >
        <CardContent className="relative h-full p-0">
          <div className="relative flex h-full min-h-0 overflow-hidden">
            <div
              className={cn(
                "grid min-h-0 min-w-0 flex-1",
                isFullscreen
                  ? "grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(280px,38vh)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-1"
                  : "grid-cols-1",
              )}
            >
              <div className="flex min-h-0 min-w-0 flex-col">
                <div className="border-b border-border/70 bg-muted/20 px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsHistoryVisible((current) => !current)}
                      className="gap-2 text-muted-foreground"
                    >
                      {isHistoryVisible ? (
                        <PanelLeftClose className="h-4 w-4" />
                      ) : (
                        <PanelLeft className="h-4 w-4" />
                      )}
                      {isHistoryVisible ? "Hide History" : "Show History"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFullscreen((current) => !current)}
                      className="gap-2 text-muted-foreground"
                    >
                      {isFullscreen ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                      {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    </Button>
                  </div>
                </div>

                <div
                  ref={scrollRef}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5"
                >
                  {activeMessages.length === 0 ? (
                    <div className="flex h-full min-h-full flex-col items-center justify-center text-center">
                      <h3 className="text-2xl font-bold">Hey there!</h3>
                      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                        What do you want to ask?
                      </p>
                      <div className="mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-full px-3 py-1 text-[11px]"
                        >
                          Ctrl+Shift+K New chat
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-full px-3 py-1 text-[11px]"
                        >
                          Ctrl+Shift+L Toggle history
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-full px-3 py-1 text-[11px]"
                        >
                          Ctrl+Shift+F Fullscreen
                        </Badge>
                      </div>
                      <div className="mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2">
                        {starterPrompts.map((prompt) => (
                          <Button
                            key={prompt}
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => void submitQuestion(prompt)}
                            disabled={isSending}
                          >
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {activeMessages.map((message) => {
                    const isUser = message.role === "user";
                    const messageContextDocs = getMessageContextDocs(message);

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        {!isUser ? (
                          <Avatar className="mt-1 h-9 w-9 border border-primary/15 bg-primary/10">
                            <AvatarFallback className="bg-transparent text-primary">
                              AI
                            </AvatarFallback>
                          </Avatar>
                        ) : null}

                        <div
                          className={`overflow-hidden rounded-3xl px-4 py-3 shadow-sm ${
                            isUser
                              ? isFullscreen
                                ? "max-w-[min(32rem,100%)]"
                                : "max-w-[min(38rem,100%)]"
                              : isFullscreen
                                ? "max-w-[min(46rem,100%)]"
                                : "max-w-[min(52rem,100%)]"
                          } ${
                            isUser
                              ? "rounded-tr-md bg-primary text-primary-foreground"
                              : message.error
                                ? "rounded-tl-md border border-destructive/20 bg-destructive/5 text-foreground"
                                : "rounded-tl-md border border-border/70 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)/0.96)),radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_38%)] text-foreground shadow-[0_14px_36px_-22px_rgba(153,95,52,0.35)]"
                          }`}
                        >
                          {isUser ? (
                            <div className="whitespace-pre-wrap text-[15px] leading-7 text-primary-foreground">
                              {message.content}
                            </div>
                          ) : (
                            <AssistantMessageContent content={message.content} />
                          )}

                          <div
                            className={`mt-3 flex items-center gap-2 text-[11px] ${
                              isUser
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            <span>{isUser ? "You" : "Assistant"}</span>
                            <span className="text-border">•</span>
                            <span>
                              {formatDistanceToNow(new Date(message.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                            {message.error ? (
                              <Badge
                                variant="destructive"
                                className="ml-1 rounded-full px-2 py-0 text-[10px]"
                              >
                                Error
                              </Badge>
                            ) : null}
                          </div>

                          {messageContextDocs.length > 0 ? (
                            <div className="mt-3 border-t border-border/60 pt-3">
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Sources
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {messageContextDocs.map((doc) => {
                                  const previewUrl = resolvePreviewUrl(doc);
                                  const isSelected =
                                    previewUrl &&
                                    selectedPreviewDoc?.path === doc.path;

                                  return previewUrl ? (
                                    <Button
                                      key={doc.path}
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      title={doc.path}
                                      onClick={() =>
                                        setSelectedPreviewPath(doc.path)
                                      }
                                      className={cn(
                                        "h-auto max-w-full rounded-full px-3 py-1 text-[11px]",
                                        isSelected
                                          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                                          : "",
                                      )}
                                    >
                                      {getContextDocLabel(doc)}
                                    </Button>
                                  ) : (
                                    <Badge
                                      key={doc.path}
                                      variant="outline"
                                      className="max-w-full truncate rounded-full px-3 py-1 text-[11px]"
                                      title={doc.path}
                                    >
                                      {getContextDocLabel(doc)}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {isUser ? (
                          <Avatar className="mt-1 h-9 w-9 border border-border/70 bg-muted/40">
                            <AvatarFallback className="bg-transparent text-muted-foreground">
                              {user?.firstName?.[0] ||
                                user?.lastName?.[0] ||
                                user?.email?.[0] ||
                                "U"}
                            </AvatarFallback>
                          </Avatar>
                        ) : null}
                      </div>
                    );
                  })}

                  {isSending ? (
                    <div className="flex gap-3">
                      <Avatar className="mt-1 h-9 w-9 border border-primary/15 bg-primary/10">
                        <AvatarFallback className="bg-transparent text-primary">
                          AI
                        </AvatarFallback>
                      </Avatar>
                      <div className="rounded-3xl rounded-tl-md border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          Thinking with Pathway RAG...
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-border/70 bg-muted/20 px-5 py-4">
                  <div className="rounded-3xl border border-border/70 bg-background/90 p-3 shadow-sm">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void submitQuestion(input);
                        }
                      }}
                      placeholder={
                        isSending
                          ? "Waiting for the assistant..."
                          : "Ask the assistant about the indexed documents..."
                      }
                      className="min-h-[60px] resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
                      disabled={isSending}
                    />

                    <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        Enter to send. Shift+Enter adds a new line.
                      </p>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {errorMessage ? (
                          <span className="mr-2 hidden text-xs text-destructive sm:inline">
                            {errorMessage}
                          </span>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInput("")}
                          disabled={!input || isSending}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Clear
                        </Button>
                        <Button
                          onClick={() => void submitQuestion(input)}
                          disabled={!input.trim() || isSending}
                          className="button-premium rounded-xl"
                        >
                          {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isFullscreen ? (
                <aside className="flex min-h-0 min-w-0 flex-col border-t border-border/70 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)/0.96))] lg:border-l lg:border-t-0">
                  <div className="border-b border-border/70 bg-muted/20 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          PDF Preview
                        </p>
                        <p className="mt-2 truncate text-sm font-semibold text-foreground">
                          {selectedPreviewDoc
                            ? selectedPreviewLabel
                            : "Retrieved document will appear here"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {selectedPreviewDoc?.path ||
                            "The first PDF retrieved with an assistant answer opens here for quick confirmation."}
                        </p>
                      </div>
                      {selectedPreviewUrl ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="shrink-0 rounded-full"
                        >
                          <a
                            href={selectedPreviewUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden bg-muted/10">
                    {selectedPreviewUrl ? (
                      <iframe
                        key={selectedPreviewUrl}
                        title={`PDF preview: ${selectedPreviewLabel}`}
                        src={`${selectedPreviewUrl}#toolbar=1&navpanes=0&view=FitH`}
                        className="h-full w-full border-0 bg-background"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-6">
                        <div className="max-w-md rounded-[1.75rem] border border-dashed border-border/70 bg-background/70 p-6 text-center shadow-sm">
                          <p className="text-sm font-semibold text-foreground">
                            No retrieved PDF selected
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Ask a question against the indexed documents and the
                            top cited PDF will load here. You can switch
                            documents from the source chips under each answer.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </aside>
              ) : null}
            </div>

          <button
            type="button"
            aria-label="Close history"
            className={cn(
              "absolute inset-0 z-20 bg-background/35 backdrop-blur-[2px] transition-opacity duration-300",
              isHistoryPanelVisible ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            onClick={() => setIsHistoryVisible(false)}
          />

          <aside
            className={cn(
              "absolute inset-y-0 left-0 z-30 flex h-full min-h-0 w-[280px] flex-col border-r border-border/70 bg-card/95 shadow-xl backdrop-blur-md transition-transform duration-300 ease-out sm:w-[320px] lg:w-[340px]",
              isHistoryPanelVisible
                ? "translate-x-0"
                : "-translate-x-full pointer-events-none",
            )}
          >
            <div className="border-b border-border/70 bg-muted/30 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="my-auto flex items-center gap-2 py-1">
                    <History className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm font-semibold leading-none text-foreground">History</p>
                    <Badge
                      variant="secondary"
                      className="my-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
                    >
                      {historyCountLabel}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    disabled={threads.length === 0}
                    className="text-muted-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    Clear all
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-4">
              <Button
                onClick={createThread}
                className="mb-4 w-full justify-start rounded-2xl bg-primary/10 px-4 text-primary hover:bg-primary/15"
                variant="ghost"
              >
                <Plus className="h-4 w-4" />
                New chat
              </Button>

              <div className="flex min-h-0 flex-1 flex-col">
                {threads.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <div className="w-full rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold">No conversations yet</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Your recent chats will appear here once you start asking questions.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="min-h-0 flex-1 pr-2">
                    <div className="space-y-3">
                      {threads.map((thread) => {
                        const isActive = thread.id === activeThreadId;
                        const latestMessage =
                          normalizePreview(
                            thread.messages[thread.messages.length - 1]?.content || "Empty thread",
                          ) || "Empty thread";

                        return (
                          <div
                            key={thread.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setActiveThreadId(thread.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setActiveThreadId(thread.id);
                              }
                            }}
                            className={`group w-[239px] rounded-2xl border p-4 text-left transition-all duration-200 sm:w-[279px] lg:w-[299px] ${isActive
                              ? "border-primary/30 bg-primary/10 shadow-sm"
                              : "border-border/60 bg-background/70 hover:border-primary/20 hover:bg-accent/40"
                              }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {thread.title}
                                </p>
                                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                  {latestMessage}
                                </p>
                              </div>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeThread(thread.id);
                                }}
                                className="rounded-full p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus:opacity-100"
                                aria-label="Delete conversation"
                                type="button"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Clock3 className="h-3 w-3" />
                                <span>{formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}</span>
                              </div>
                              <span>{thread.messages.length} msg</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </aside>
        </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingConfirmation !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPendingConfirmation(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConfirmation?.type === "delete-thread"
                ? "Delete conversation?"
                : "Clear all conversations?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirmation?.type === "delete-thread"
                ? `This will permanently remove "${pendingConfirmation.threadTitle}".`
                : `This will permanently remove ${pendingConfirmation?.count ?? 0} conversation${(pendingConfirmation?.count ?? 0) === 1 ? "" : "s"}.`}
              {" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleConfirmAction()}
            >
              {pendingConfirmation?.type === "delete-thread"
                ? "Delete"
                : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AssistantWorkspace;
