const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "An error occurred");
  }

  return response.json();
}

export interface AssistantAnswer {
  threadId?: string;
  questionId?: string;
  createdAt?: string;
  answer?: string;
  response?: string;
  evidence?: string[];
  contextDocs?: Array<Record<string, unknown>>;
  context_docs?: Array<Record<string, unknown>>;
  docs?: Array<Record<string, unknown>>;
  sources?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: string[];
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
};

export default assistantAPI;
