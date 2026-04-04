const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "An error occurred");
  }

  return response.json();
}

export interface AssistantAnswer {
  answer?: string;
  context_docs?: Array<Record<string, unknown>>;
  docs?: Array<Record<string, unknown>>;
  sources?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export const assistantAPI = {
  ask: async (
    prompt: string,
    options?: {
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
