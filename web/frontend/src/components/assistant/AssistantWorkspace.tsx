import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { assistantAPI } from "@/services/assistantApi";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock3,
  History,
  Loader2,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  sources?: string[];
  error?: boolean;
}

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const CHAT_STORAGE_PREFIX = "hacksagon_ai_chat_threads";
const MAX_THREADS = 20;
const MAX_MESSAGES = 40;

const starterPrompts = [
  "Summarize the latest indexed document",
  "List the most important action items",
  "What client requirements are repeated the most?",
  "Extract deadlines and delivery dates",
];

const nowIso = () => new Date().toISOString();

const createId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getStorageKey = (userId?: string) => `${CHAT_STORAGE_PREFIX}:${userId || "guest"}`;

const loadThreads = (storageKey: string): ChatThread[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistThreads = (storageKey: string, threads: ChatThread[]) => {
  localStorage.setItem(storageKey, JSON.stringify(threads.slice(0, MAX_THREADS)));
};

const normalizeAnswer = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.response === "string") return record.response;
    if (typeof record.answer === "string") return record.answer;
    if (typeof record.message === "string") return record.message;
    return JSON.stringify(record, null, 2);
  }

  return "No response received from the assistant.";
};

const extractSources = (payload: Record<string, unknown>) => {
  const sourceBuckets = [payload.context_docs, payload.docs, payload.sources].flatMap((bucket) =>
    Array.isArray(bucket) ? bucket : [],
  );

  return sourceBuckets
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      const record = entry as Record<string, unknown>;
      const labels = [
        record.path,
        record.filepath,
        record.url,
        record.title,
        record.source,
        record.name,
      ];

      const label = labels.find((item) => typeof item === "string" && item.trim().length > 0);
      return label ? String(label) : null;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
};

const AssistantWorkspace = () => {
  const { user } = useAuth();
  const userStorageId = useMemo(
    () => user?.id || user?.hr_id || user?.emp_id || user?.client_id || user?.email,
    [user?.client_id, user?.email, user?.emp_id, user?.hr_id, user?.id],
  );
  const storageKey = useMemo(() => getStorageKey(userStorageId), [userStorageId]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedThreads = loadThreads(storageKey);
    setThreads(storedThreads);
    setActiveThreadId(storedThreads[0]?.id ?? null);
  }, [storageKey]);

  useEffect(() => {
    persistThreads(storageKey, threads);
  }, [storageKey, threads]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeThreadId, threads, isSending]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;
  const activeMessages = activeThread?.messages ?? [];

  const createThread = () => {
    const nextThread: ChatThread = {
      id: createId(),
      title: "New conversation",
      messages: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    setThreads((current) => [nextThread, ...current].slice(0, MAX_THREADS));
    setActiveThreadId(nextThread.id);
    setErrorMessage(null);
  };

  const updateThread = (threadId: string, updater: (thread: ChatThread) => ChatThread) => {
    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? updater(thread) : thread)).slice(0, MAX_THREADS),
    );
  };

  const submitQuestion = async (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) return;

    setErrorMessage(null);

    let threadId = activeThreadId;
    if (!threadId) {
      const nextThread: ChatThread = {
        id: createId(),
        title: trimmedQuestion.slice(0, 42),
        messages: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      threadId = nextThread.id;
      setThreads((current) => [nextThread, ...current].slice(0, MAX_THREADS));
      setActiveThreadId(threadId);
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmedQuestion,
      createdAt: nowIso(),
    };

    updateThread(threadId, (thread) => {
      const messages = [...thread.messages, userMessage].slice(-MAX_MESSAGES);
      return {
        ...thread,
        title: thread.title === "New conversation" ? trimmedQuestion.slice(0, 42) : thread.title,
        messages,
        updatedAt: nowIso(),
      };
    });

    setInput("");
    setIsSending(true);

    try {
      const response = await assistantAPI.ask(trimmedQuestion, {
        returnContextDocs: true,
      });

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: normalizeAnswer(response),
        createdAt: nowIso(),
        sources: extractSources(response),
      };

      updateThread(threadId, (thread) => ({
        ...thread,
        messages: [...thread.messages, assistantMessage].slice(-MAX_MESSAGES),
        updatedAt: nowIso(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reach the assistant";
      setErrorMessage(message);

      const assistantMessage: ChatMessage = {
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

  const removeThread = (threadId: string) => {
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    setActiveThreadId((current) => (current === threadId ? null : current));
  };

  const clearHistory = () => {
    setThreads([]);
    setActiveThreadId(null);
    setErrorMessage(null);
  };

  return (
    <Card className="border-border/70 bg-card/90 backdrop-blur-md shadow-card overflow-hidden">
      <CardContent className="relative p-0">
        <div className="flex min-h-[700px] flex-col">
          <div className="border-b border-border/70 bg-muted/20 px-5 py-4">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsHistoryVisible((current) => !current)}
                className="gap-2 text-muted-foreground"
              >
                {isHistoryVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                Show History
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {activeMessages.length === 0 ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
                <h3 className="text-2xl font-bold">Hey there!</h3>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                  What do you want to ask?
                </p>
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

              return (
                <div key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser ? (
                    <Avatar className="mt-1 h-9 w-9 border border-primary/15 bg-primary/10">
                      <AvatarFallback className="bg-transparent text-primary">AI</AvatarFallback>
                    </Avatar>
                  ) : null}

                  <div
                    className={`max-w-[min(38rem,100%)] rounded-3xl px-4 py-3 shadow-sm ${isUser
                      ? "rounded-tr-md bg-primary text-primary-foreground"
                      : message.error
                        ? "rounded-tl-md border border-destructive/20 bg-destructive/5 text-foreground"
                        : "rounded-tl-md border border-border/70 bg-background/80 text-foreground"
                      }`}
                  >
                    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-p:my-3 prose-ul:my-3 prose-li:my-1 prose-strong:text-inherit prose-a:text-primary dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>

                    <div className={`mt-3 flex items-center gap-2 text-[11px] ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      <span>{isUser ? "You" : "Assistant"}</span>
                      <span className="text-border">•</span>
                      <span>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</span>
                      {message.error ? (
                        <Badge variant="destructive" className="ml-1 rounded-full px-2 py-0 text-[10px]">
                          Error
                        </Badge>
                      ) : null}
                    </div>

                    {message.sources && message.sources.length > 0 ? (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {message.sources.map((source) => (
                            <Badge key={source} variant="outline" className="max-w-full truncate rounded-full px-3 py-1 text-[11px]">
                              {source}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {isUser ? (
                    <Avatar className="mt-1 h-9 w-9 border border-border/70 bg-muted/40">
                      <AvatarFallback className="bg-transparent text-muted-foreground">
                        {user?.firstName?.[0] || user?.lastName?.[0] || user?.email?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                  ) : null}
                </div>
              );
            })}

            {isSending ? (
              <div className="flex gap-3">
                <Avatar className="mt-1 h-9 w-9 border border-primary/15 bg-primary/10">
                  <AvatarFallback className="bg-transparent text-primary">AI</AvatarFallback>
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

          <div className="border-t border-border/70 bg-muted/20 px-5 py-4">
            <div className="rounded-3xl border border-border/70 bg-background/90 p-3 shadow-sm">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitQuestion(input);
                  }
                }}
                placeholder={isSending ? "Waiting for the assistant..." : "Ask the assistant about the indexed documents..."}
                className="min-h-[60px] resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
                disabled={isSending}
              />

              <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Enter to send
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Shift+Enter for new line.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {errorMessage ? (
                    <span className="mr-2 hidden text-xs text-destructive sm:inline">{errorMessage}</span>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => setInput("")} disabled={!input || isSending}>
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

        {isHistoryVisible ? (
          <>
            <button
              type="button"
              aria-label="Close history"
              className="absolute inset-0 z-20 bg-background/35 backdrop-blur-[2px]"
              onClick={() => setIsHistoryVisible(false)}
            />

            <aside className="absolute inset-y-0 left-0 z-30 flex w-[220px] flex-col border-r border-border/70 bg-card/95 shadow-xl backdrop-blur-md">
              <div className="border-b border-border/70 bg-muted/30 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">History</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => setIsHistoryVisible(false)}
                      aria-label="Hide history"
                      title="Hide history"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                    {threads.length > 0 ? (
                      <Button variant="ghost" size="sm" onClick={clearHistory} className="text-muted-foreground">
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col p-3">
                <Button
                  onClick={createThread}
                  className="mb-3 w-full justify-start rounded-xl bg-primary/10 text-primary hover:bg-primary/15"
                  variant="ghost"
                >
                  <Plus className="h-4 w-4" />
                  New chat
                </Button>

                <div className="flex min-h-0 flex-1 flex-col space-y-2">
                  {threads.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold">No conversations yet</p>
                    </div>
                  ) : (
                    <ScrollArea className="min-h-0 flex-1 pr-2">
                      <div className="space-y-2">
                        {threads.map((thread) => {
                          const isActive = thread.id === activeThreadId;

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
                              className={`group w-full rounded-2xl border p-3 text-left transition-all duration-200 ${isActive
                                ? "border-primary/30 bg-primary/10 shadow-sm"
                                : "border-border/60 bg-background/60 hover:border-primary/20 hover:bg-accent/40"
                                }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">{thread.title}</p>
                                  <p className="mt-1 truncate text-xs text-muted-foreground">
                                    {thread.messages[thread.messages.length - 1]?.content || "Empty thread"}
                                  </p>
                                </div>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeThread(thread.id);
                                  }}
                                  className="rounded-full p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                                  aria-label="Delete conversation"
                                  type="button"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Clock3 className="h-3 w-3" />
                                <span>{formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}</span>
                                <span className="text-border">•</span>
                                <span>{thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}</span>
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
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default AssistantWorkspace;
