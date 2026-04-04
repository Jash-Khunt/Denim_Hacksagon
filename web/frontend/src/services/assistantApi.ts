const PATHWAY_API_BASE_URL =
  import.meta.env.VITE_PATHWAY_API_URL ||
  import.meta.env.VITE_AI_CHAT_URL ||
  "http://localhost:8000";

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
    const response = await fetch(`${PATHWAY_API_BASE_URL}/v2/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        filters: options?.filters || null,
        model: options?.model || null,
        return_context_docs: options?.returnContextDocs ?? true,
      }),
    });

    return handleResponse<AssistantAnswer>(response);
  },

  getStatistics: async () => {
    const response = await fetch(`${PATHWAY_API_BASE_URL}/v1/statistics`);
    return handleResponse<{ file_count: number; last_modified: number; last_indexed: number }>(response);
  },
};

export default assistantAPI;