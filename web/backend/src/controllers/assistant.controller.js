import axios from "axios";

const PATHWAY_URL = (process.env.PATHWAY_URL || "http://localhost:8000").replace(
  /\/$/,
  ""
);
const PATHWAY_TIMEOUT_MS = Number.parseInt(
  process.env.PATHWAY_TIMEOUT_MS || "120000",
  10
);

const PATHWAY_ENDPOINTS = [
  {
    path: "/v1/pw_ai_answer",
    buildPayload: (prompt) => ({ prompt }),
  },
  {
    path: "/v2/answer",
    buildPayload: (prompt, options) => ({
      prompt,
      filters: options.filters ?? null,
      model: options.model ?? null,
      return_context_docs: options.returnContextDocs ?? true,
    }),
  },
];

const cleanAnswer = (value) =>
  value
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

const extractAnswer = (value) => {
  if (typeof value === "string") {
    return cleanAnswer(value);
  }

  if (Array.isArray(value)) {
    const joinedValue = value
      .map((entry) => extractAnswer(entry))
      .filter(Boolean)
      .join("\n\n");

    return joinedValue ? cleanAnswer(joinedValue) : "";
  }

  if (value && typeof value === "object") {
    const record = value;

    for (const key of ["response", "answer", "message", "content", "result"]) {
      const candidate = extractAnswer(record[key]);
      if (candidate) return candidate;
    }
  }

  return "";
};

const pickArray = (value) => (Array.isArray(value) ? value : []);

const extractSourceBuckets = (payload) => {
  if (!payload || typeof payload !== "object") {
    return {
      context_docs: [],
      docs: [],
      sources: [],
    };
  }

  return {
    context_docs: pickArray(payload.context_docs),
    docs: pickArray(payload.docs),
    sources: pickArray(payload.sources),
  };
};

const requestPathwayAnswer = async (prompt, options) => {
  let lastEndpointError = null;

  for (const endpoint of PATHWAY_ENDPOINTS) {
    try {
      const response = await axios.post(
        `${PATHWAY_URL}${endpoint.path}`,
        endpoint.buildPayload(prompt, options),
        {
          timeout: PATHWAY_TIMEOUT_MS,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      const status = error.response?.status;

      if (status === 404 || status === 405) {
        lastEndpointError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastEndpointError || new Error("No supported Pathway assistant endpoint is available");
};

export const askAssistant = async (req, res) => {
  const prompt = req.body?.prompt?.trim() || req.body?.query?.trim() || "";

  if (!prompt) {
    return res.status(400).json({ message: "Prompt is required" });
  }

  try {
    const rawData = await requestPathwayAnswer(prompt, {
      filters: req.body?.filters,
      model: req.body?.model,
      returnContextDocs: req.body?.returnContextDocs,
    });
    const answer = extractAnswer(rawData) || "No response received from the assistant.";
    const sourceBuckets = extractSourceBuckets(rawData);

    return res.status(200).json({
      answer,
      response: answer,
      ...sourceBuckets,
    });
  } catch (error) {
    console.error("Error in askAssistant:", error.message);

    const isConnectionIssue =
      error.code === "ECONNREFUSED" ||
      error.code === "ECONNRESET" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT";
    const message = isConnectionIssue
      ? `Assistant backend could not reach Pathway at ${PATHWAY_URL}. Make sure the Python app is running and reachable from the web backend.`
      : error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to get response from Pathway";

    return res.status(502).json({ message });
  }
};

export const getAssistantStatistics = async (_req, res) => {
  try {
    const response = await axios.get(`${PATHWAY_URL}/v1/statistics`, {
      timeout: 10000,
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Error in getAssistantStatistics:", error.message);

    const isConnectionIssue =
      error.code === "ECONNREFUSED" ||
      error.code === "ECONNRESET" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT";
    const message = isConnectionIssue
      ? `Assistant backend could not reach Pathway at ${PATHWAY_URL}. Make sure the Python app is running and reachable from the web backend.`
      : error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch assistant statistics";

    return res.status(502).json({ message });
  }
};
