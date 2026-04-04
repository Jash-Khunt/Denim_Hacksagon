import type { ProjectTask } from "@/types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "An error occurred");
  }

  return response.json();
}

export type AssistantMode = "default" | "ticket";

export interface AssistantAnswer {
  threadId?: string;
  questionId?: string;
  createdAt?: string;
  answer?: string;
  response?: string;
  evidence?: string[];
  contextDocs?: AssistantContextDoc[];
  context_docs?: Array<Record<string, unknown>>;
  docs?: Array<Record<string, unknown>>;
  sources?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface AssistantContextDoc {
  path: string;
  text?: string;
  preview_url?: string;
  previewUrl?: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: string[];
  contextDocs?: AssistantContextDoc[];
  error?: boolean;
}

export interface AssistantThread {
  id: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

export const assistantAPI = {
  getThreads: async () => {
    const response = await fetch(`${API_BASE_URL}/assistant/threads`, {
      credentials: "include",
    });

    return handleResponse<{ threads: AssistantThread[] }>(response);
  },

  createThread: async () => {
    const response = await fetch(`${API_BASE_URL}/assistant/threads`, {
      method: "POST",
      credentials: "include",
    });

    return handleResponse<{ thread: AssistantThread }>(response);
  },

  deleteThread: async (threadId: string) => {
    const response = await fetch(`${API_BASE_URL}/assistant/threads/${threadId}`, {
      method: "DELETE",
      credentials: "include",
    });

    return handleResponse<{ message: string }>(response);
  },

  clearThreads: async () => {
    const response = await fetch(`${API_BASE_URL}/assistant/threads`, {
      method: "DELETE",
      credentials: "include",
    });

    return handleResponse<{ message: string }>(response);
  },

  ask: async (
    prompt: string,
    options?: {
      threadId?: string;
      filters?: string;
      model?: string;
      returnContextDocs?: boolean;
      mode?: AssistantMode;
    },
  ) => {
    const response = await fetch(`${API_BASE_URL}/assistant/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        prompt,
        threadId: options?.threadId || null,
        filters: options?.filters || null,
        model: options?.model || null,
        returnContextDocs: options?.returnContextDocs ?? true,
        mode: options?.mode || "default",
      }),
    });

    return handleResponse<AssistantAnswer>(response);
  },

  getStatistics: async () => {
    const response = await fetch(`${API_BASE_URL}/assistant/statistics`, {
      credentials: "include",
    });
    return handleResponse<{ file_count: number; last_modified: number; last_indexed: number }>(response);
  },

  getDashboardSummary: async (tasks: ProjectTask[]) => {
    const response = await fetch(`${API_BASE_URL}/assistant/dashboard-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tasks }),
    });

    return handleResponse<{ summary: string }>(response);
  },
};

export default assistantAPI;
