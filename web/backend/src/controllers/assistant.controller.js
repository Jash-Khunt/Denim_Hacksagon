import axios from "axios";
import { pool } from "../lib/db.js";

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

const getAssistantOwner = (user) => {
  if (user.role === "hr") {
    return { userRole: "hr", userId: user.hr_id };
  }

  if (user.role === "employee") {
    return { userRole: "employee", userId: user.emp_id };
  }

  return { userRole: "client", userId: user.client_id };
};

const getTitleFromPrompt = (prompt) => prompt.trim().slice(0, 42) || "New conversation";

const extractEvidence = (payload) => {
  const buckets = extractSourceBuckets(payload);

  return [...buckets.context_docs, ...buckets.docs, ...buckets.sources]
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      const record = entry;
      const label = [
        record.path,
        record.filepath,
        record.url,
        record.title,
        record.source,
        record.name,
      ].find((value) => typeof value === "string" && value.trim().length > 0);

      return label ? String(label) : null;
    })
    .filter(Boolean)
    .slice(0, 10);
};

const normalizeContextDocs = (payload) => {
  const buckets = extractSourceBuckets(payload);

  return [...buckets.context_docs, ...buckets.docs, ...buckets.sources]
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const record = entry;

      return {
        text:
          typeof record.text === "string"
            ? record.text
            : typeof record.content === "string"
              ? record.content
              : "",
        path:
          typeof record.path === "string"
            ? record.path
            : typeof record.filepath === "string"
              ? record.filepath
              : typeof record.url === "string"
                ? record.url
                : typeof record.title === "string"
                  ? record.title
                  : typeof record.source === "string"
                    ? record.source
                    : typeof record.name === "string"
                      ? record.name
                      : "",
      };
    })
    .filter((entry) => entry.text || entry.path)
    .slice(0, 10);
};

const mapThreadRow = (row) => ({
  id: row.thread_id,
  title: row.title,
  messages: [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapQuestionRowsToMessages = (rows) =>
  rows.flatMap((row) => {
    const messages = [
      {
        id: `${row.question_id}:user`,
        role: "user",
        content: row.query,
        createdAt: row.created_at,
      },
    ];

    if (row.status === "pending") {
      return messages;
    }

    messages.push({
      id: `${row.question_id}:assistant`,
      role: "assistant",
      content:
        row.status === "error"
          ? row.error_message || "Failed to reach the assistant"
          : row.response || "No response received from the assistant.",
      createdAt: row.updated_at,
      sources: Array.isArray(row.evidence) ? row.evidence : [],
      error: row.status === "error",
    });

    return messages;
  });

const buildThreadsFromRows = (threadRows, questionRows) => {
  const threadsById = new Map(
    threadRows.map((row) => [row.thread_id, mapThreadRow(row)]),
  );

  for (const row of questionRows) {
    const thread = threadsById.get(row.thread_id);
    if (!thread) continue;

    thread.messages.push(...mapQuestionRowsToMessages([row]));
  }

  return [...threadsById.values()];
};

const getOwnedThread = async (threadId, owner) => {
  const result = await pool.query(
    `SELECT thread_id, title, created_at, updated_at
    FROM assistant_threads
    WHERE thread_id = $1 AND user_role = $2 AND user_id = $3`,
    [threadId, owner.userRole, owner.userId],
  );

  return result.rows[0] ? mapThreadRow(result.rows[0]) : null;
};

const createThreadRecord = async (owner, title = "New conversation") => {
  const result = await pool.query(
    `INSERT INTO assistant_threads (user_role, user_id, title)
    VALUES ($1, $2, $3)
    RETURNING thread_id, title, created_at, updated_at`,
    [owner.userRole, owner.userId, title],
  );

  return mapThreadRow(result.rows[0]);
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

export const getAssistantThreads = async (req, res) => {
  const owner = getAssistantOwner(req.user);

  try {
    const [threadResult, questionResult] = await Promise.all([
      pool.query(
        `SELECT thread_id, title, created_at, updated_at
        FROM assistant_threads
        WHERE user_role = $1 AND user_id = $2
        ORDER BY updated_at DESC`,
        [owner.userRole, owner.userId],
      ),
      pool.query(
        `SELECT
          q.question_id,
          q.thread_id,
          q.query,
          q.response,
          q.evidence,
          q.context_docs,
          q.status,
          q.error_message,
          q.created_at,
          q.updated_at
        FROM assistant_questions q
        JOIN assistant_threads t
          ON t.thread_id = q.thread_id
        WHERE t.user_role = $1 AND t.user_id = $2
        ORDER BY q.created_at ASC`,
        [owner.userRole, owner.userId],
      ),
    ]);

    return res.status(200).json({
      threads: buildThreadsFromRows(threadResult.rows, questionResult.rows),
    });
  } catch (error) {
    console.error("Error in getAssistantThreads:", error.message);
    return res.status(500).json({ message: "Failed to fetch assistant history" });
  }
};

export const createAssistantThread = async (req, res) => {
  const owner = getAssistantOwner(req.user);

  try {
    const thread = await createThreadRecord(owner);
    return res.status(201).json({ thread });
  } catch (error) {
    console.error("Error in createAssistantThread:", error.message);
    return res.status(500).json({ message: "Failed to create conversation" });
  }
};

export const askAssistant = async (req, res) => {
  const prompt = req.body?.prompt?.trim() || req.body?.query?.trim() || "";

  if (!prompt) {
    return res.status(400).json({ message: "Prompt is required" });
  }

  const owner = getAssistantOwner(req.user);
  let thread = null;
  let question = null;

  try {
    if (req.body?.threadId) {
      thread = await getOwnedThread(req.body.threadId, owner);

      if (!thread) {
        return res.status(404).json({ message: "Conversation not found" });
      }
    } else {
      thread = await createThreadRecord(owner, getTitleFromPrompt(prompt));
    }

    if (thread.title === "New conversation") {
      const title = getTitleFromPrompt(prompt);
      const titleResult = await pool.query(
        `UPDATE assistant_threads
        SET title = $2, updated_at = NOW()
        WHERE thread_id = $1
        RETURNING thread_id, title, created_at, updated_at`,
        [thread.id, title],
      );
      thread = mapThreadRow(titleResult.rows[0]);
    }

    const insertedQuestion = await pool.query(
      `INSERT INTO assistant_questions (
        thread_id,
        user_role,
        user_id,
        query,
        status
      )
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING question_id, created_at, updated_at`,
      [thread.id, owner.userRole, owner.userId, prompt],
    );
    question = insertedQuestion.rows[0];

    await pool.query(
      `UPDATE assistant_threads
      SET updated_at = NOW()
      WHERE thread_id = $1`,
      [thread.id],
    );

    const rawData = await requestPathwayAnswer(prompt, {
      filters: req.body?.filters,
      model: req.body?.model,
      returnContextDocs: req.body?.returnContextDocs,
    });
    const answer = extractAnswer(rawData) || "No response received from the assistant.";
    const sourceBuckets = extractSourceBuckets(rawData);
    const evidence = extractEvidence(rawData);
    const contextDocs = normalizeContextDocs(rawData);

    await pool.query(
      `UPDATE assistant_questions
      SET
        response = $2,
        evidence = $3::jsonb,
        context_docs = $4::jsonb,
        status = 'answered',
        error_message = NULL,
        updated_at = NOW()
      WHERE question_id = $1`,
      [
        question.question_id,
        answer,
        JSON.stringify(evidence),
        JSON.stringify(contextDocs),
      ],
    );

    await pool.query(
      `UPDATE assistant_threads
      SET updated_at = NOW()
      WHERE thread_id = $1`,
      [thread.id],
    );

    return res.status(200).json({
      threadId: thread.id,
      questionId: question.question_id,
      createdAt: question.created_at,
      answer,
      response: answer,
      evidence,
      contextDocs,
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

    if (question?.question_id) {
      try {
        await pool.query(
          `UPDATE assistant_questions
          SET
            status = 'error',
            error_message = $2,
            updated_at = NOW()
          WHERE question_id = $1`,
          [question.question_id, message],
        );

        await pool.query(
          `UPDATE assistant_threads
          SET updated_at = NOW()
          WHERE thread_id = $1`,
          [thread.id],
        );
      } catch (dbError) {
        console.error("Error while saving assistant failure:", dbError.message);
      }
    }

    return res.status(502).json({
      message,
      threadId: thread?.id || null,
      questionId: question?.question_id || null,
    });
  }
};

export const deleteAssistantThread = async (req, res) => {
  const owner = getAssistantOwner(req.user);

  try {
    const result = await pool.query(
      `DELETE FROM assistant_threads
      WHERE thread_id = $1 AND user_role = $2 AND user_id = $3
      RETURNING thread_id`,
      [req.params.threadId, owner.userRole, owner.userId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    return res.status(200).json({ message: "Conversation deleted" });
  } catch (error) {
    console.error("Error in deleteAssistantThread:", error.message);
    return res.status(500).json({ message: "Failed to delete conversation" });
  }
};

export const clearAssistantThreads = async (req, res) => {
  const owner = getAssistantOwner(req.user);

  try {
    await pool.query(
      `DELETE FROM assistant_threads
      WHERE user_role = $1 AND user_id = $2`,
      [owner.userRole, owner.userId],
    );

    return res.status(200).json({ message: "Assistant history cleared" });
  } catch (error) {
    console.error("Error in clearAssistantThreads:", error.message);
    return res.status(500).json({ message: "Failed to clear assistant history" });
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
