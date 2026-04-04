import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../lib/db.js";

const PATHWAY_URL = (process.env.PATHWAY_URL || "http://localhost:8000").replace(
  /\/$/,
  ""
);
const PATHWAY_TICKET_URL = (
  process.env.PATHWAY_TICKET_URL || "http://localhost:8001"
).replace(/\/$/, "");
const PATHWAY_DASHBOARD_URL = (
  process.env.PATHWAY_DASHBOARD_URL ||
  process.env.PATHWAY_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");
const PATHWAY_TIMEOUT_MS = Number.parseInt(
  process.env.PATHWAY_TIMEOUT_MS || "120000",
  10
);
const TICKET_TIME_ZONE = "Asia/Kolkata";
const CONTROLLER_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_UPLOADS_DIR = path.resolve(CONTROLLER_DIR, "../../uploads");
const PATHWAY_CLIENT_DIR = path.resolve(
  CONTROLLER_DIR,
  "../../../../rag_model/pathway/client",
);
const PATHWAY_DATA_DIR = path.resolve(
  CONTROLLER_DIR,
  "../../../../rag_model/pathway/data",
);

const PATHWAY_ENDPOINTS = [
  {
    path: "/v1/pw_ai_answer",
    buildPayload: (prompt, options) => ({
      prompt,
      return_context_docs: options.returnContextDocs ?? true,
    }),
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

const pickFirstString = (values) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0) ||
  "";

const toPublicPath = (segments) =>
  segments
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const getEntryMetadata = (entry) =>
  entry &&
  typeof entry === "object" &&
  entry.metadata &&
  typeof entry.metadata === "object" &&
  !Array.isArray(entry.metadata)
    ? entry.metadata
    : {};

const getSourcePath = (entry) => {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  const metadata = getEntryMetadata(entry);

  return pickFirstString([
    entry.path,
    entry.filepath,
    metadata.path,
    metadata.filepath,
    entry.url,
    metadata.url,
    entry.title,
    metadata.title,
    entry.source,
    metadata.source,
    entry.name,
    metadata.name,
  ]);
};

const getSourceText = (entry) => {
  if (!entry || typeof entry !== "object") {
    return "";
  }

  const metadata = getEntryMetadata(entry);

  return pickFirstString([
    entry.text,
    entry.content,
    metadata.text,
    metadata.content,
  ]);
};

const resolveRelativePublicPath = (normalizedPath, fromDir, publicBasePath) => {
  const candidate = path.resolve(normalizedPath);
  if (!fs.existsSync(candidate)) {
    return "";
  }

  const relativePath = path.relative(fromDir, candidate).replace(/\\/g, "/");
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return "";
  }

  return `${publicBasePath}/${toPublicPath(relativePath)}`;
};

const resolvePublicDocumentUrl = (sourcePath) => {
  if (typeof sourcePath !== "string" || !sourcePath.trim()) {
    return "";
  }

  const normalizedPath = sourcePath.replace(/\\/g, "/").trim();
  if (!/\.pdf(?:$|[?#])/i.test(normalizedPath)) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/uploads/")) {
    return `/uploads/${toPublicPath(normalizedPath.slice("/uploads/".length))}`;
  }

  if (normalizedPath.startsWith("uploads/")) {
    return `/uploads/${toPublicPath(normalizedPath.slice("uploads/".length))}`;
  }

  if (normalizedPath.startsWith("/assistant-documents/")) {
    return `/assistant-documents/${toPublicPath(
      normalizedPath.slice("/assistant-documents/".length),
    )}`;
  }

  if (normalizedPath.startsWith("assistant-documents/")) {
    return `/assistant-documents/${toPublicPath(
      normalizedPath.slice("assistant-documents/".length),
    )}`;
  }

  if (normalizedPath.startsWith("client/")) {
    return `/assistant-documents/${toPublicPath(
      normalizedPath.slice("client/".length),
    )}`;
  }

  if (normalizedPath.startsWith("data/")) {
    return `/assistant-data/${toPublicPath(
      normalizedPath.slice("data/".length),
    )}`;
  }

  const uploadsMarker = "/uploads/";
  const uploadsIndex = normalizedPath.lastIndexOf(uploadsMarker);
  if (uploadsIndex >= 0) {
    return `/uploads/${toPublicPath(
      normalizedPath.slice(uploadsIndex + uploadsMarker.length),
    )}`;
  }

  const pathwayMarker = "/rag_model/pathway/client/";
  const pathwayIndex = normalizedPath.lastIndexOf(pathwayMarker);
  if (pathwayIndex >= 0) {
    return `/assistant-documents/${toPublicPath(
      normalizedPath.slice(pathwayIndex + pathwayMarker.length),
    )}`;
  }

  const uploadAbsoluteMatch = resolveRelativePublicPath(
    normalizedPath,
    BACKEND_UPLOADS_DIR,
    "/uploads",
  );
  if (uploadAbsoluteMatch) {
    return uploadAbsoluteMatch;
  }

  const pathwayAbsoluteMatch = resolveRelativePublicPath(
    normalizedPath,
    PATHWAY_CLIENT_DIR,
    "/assistant-documents",
  );
  if (pathwayAbsoluteMatch) {
    return pathwayAbsoluteMatch;
  }

  const pathwayDataAbsoluteMatch = resolveRelativePublicPath(
    normalizedPath,
    PATHWAY_DATA_DIR,
    "/assistant-data",
  );
  if (pathwayDataAbsoluteMatch) {
    return pathwayDataAbsoluteMatch;
  }

  const basename = path.posix.basename(normalizedPath);
  if (!basename) {
    return "";
  }

  if (fs.existsSync(path.join(BACKEND_UPLOADS_DIR, basename))) {
    return `/uploads/${encodeURIComponent(basename)}`;
  }

  if (fs.existsSync(path.join(PATHWAY_CLIENT_DIR, basename))) {
    return `/assistant-documents/${encodeURIComponent(basename)}`;
  }

  if (fs.existsSync(path.join(PATHWAY_DATA_DIR, basename))) {
    return `/assistant-data/${encodeURIComponent(basename)}`;
  }

  return "";
};

const normalizeStoredContextDocs = (contextDocs) =>
  pickArray(contextDocs)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      ...entry,
      preview_url:
        typeof entry.preview_url === "string" && entry.preview_url.trim()
          ? entry.preview_url
          : resolvePublicDocumentUrl(entry.path),
    }));

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

const normalizeAssistantMode = (value) =>
  value === "ticket" || value === "dashboard" ? value : "default";

const getPathwayUrl = (mode) =>
  mode === "ticket"
    ? PATHWAY_TICKET_URL
    : mode === "dashboard"
      ? PATHWAY_DASHBOARD_URL
      : PATHWAY_URL;

const getPathwayUnavailableMessage = (mode, pathwayUrl) =>
  mode === "ticket"
    ? `Assistant backend could not reach the ticket Pathway service at ${pathwayUrl}. Make sure the Python app is running with ticket.yaml and reachable from the web backend.`
    : mode === "dashboard"
      ? `Assistant backend could not reach the dashboard Pathway service at ${pathwayUrl}. Make sure the Python app is running with dashboard.yaml and reachable from the web backend.`
    : `Assistant backend could not reach Pathway at ${pathwayUrl}. Make sure the Python app is running and reachable from the web backend.`;

const formatTicketReferenceDate = () => {
  const currentDate = new Date();
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: TICKET_TIME_ZONE,
  }).format(currentDate);
  const longDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TICKET_TIME_ZONE,
  }).format(currentDate);

  return `${isoDate} (${longDate}, ${TICKET_TIME_ZONE} / IST)`;
};

const buildPathwayPrompt = (prompt, mode) => {
  if (mode !== "ticket") {
    return prompt;
  }

  return [
    prompt,
    `Reference date for relative deadline calculation: ${formatTicketReferenceDate()}.`,
  ].join("\n\n");
};

const normalizeWhitespace = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const truncateText = (value, maxLength = 180) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
};

const normalizeDashboardTask = (task) => {
  if (!task || typeof task !== "object") {
    return null;
  }

  return {
    title: truncateText(task.title, 100),
    description: truncateText(task.description, 160) || null,
    status: normalizeWhitespace(task.status || "todo").toLowerCase(),
    priority: truncateText(task.priority, 24) || "Medium",
    field: truncateText(task.field, 48) || "General",
    difficulty: truncateText(task.difficulty, 24) || "Medium",
    due_date: truncateText(task.due_date, 32) || null,
    updated_at: truncateText(task.updated_at, 40) || null,
    project_name: truncateText(task.project_name, 80) || null,
    assignee_name: truncateText(task.assignee_name, 80) || null,
  };
};

const buildDashboardTaskSnapshot = (tasks) => {
  const normalizedTasks = pickArray(tasks)
    .map((task) => normalizeDashboardTask(task))
    .filter((task) => task && task.title);

  const completedTasks = normalizedTasks.filter((task) => task.status === "done");
  const remainingTasks = normalizedTasks.filter((task) => task.status !== "done");
  const statusBreakdown = normalizedTasks.reduce(
    (summary, task) => {
      if (task.status === "done") {
        summary.done += 1;
      } else if (task.status === "review") {
        summary.review += 1;
      } else if (task.status === "in_progress") {
        summary.in_progress += 1;
      } else {
        summary.todo += 1;
      }

      return summary;
    },
    {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    },
  );

  const summarizeTask = (task) => ({
    title: task.title,
    status: task.status,
    priority: task.priority,
    field: task.field,
    difficulty: task.difficulty,
    due_date: task.due_date,
    project_name: task.project_name,
    assignee_name: task.assignee_name,
    description: task.description,
  });

  return {
    total_tasks: normalizedTasks.length,
    completed_tasks: completedTasks.length,
    remaining_tasks: remainingTasks.length,
    status_breakdown: statusBreakdown,
    recently_completed: completedTasks.slice(0, 6).map(summarizeTask),
    remaining_focus: remainingTasks.slice(0, 6).map(summarizeTask),
  };
};

const buildDashboardSummaryPrompt = (tasks) => {
  const snapshot = buildDashboardTaskSnapshot(tasks);

  return [
    "Create a very short delivery dashboard summary.",
    "Write 2-3 sentences in plain prose.",
    "Mention exact completed and remaining counts from the task snapshot.",
    "Briefly highlight the main completed work and the next remaining focus.",
    "If there are no tasks, say that clearly in one short sentence.",
    "",
    "TASK SNAPSHOT:",
    JSON.stringify(snapshot, null, 2),
  ].join("\n");
};

const extractEvidence = (payload) => {
  const buckets = extractSourceBuckets(payload);

  return [...buckets.context_docs, ...buckets.docs, ...buckets.sources]
    .map((entry) => getSourcePath(entry) || null)
    .filter(Boolean)
    .slice(0, 10);
};

const normalizeContextDocs = (payload) => {
  const buckets = extractSourceBuckets(payload);

  return [...buckets.context_docs, ...buckets.docs, ...buckets.sources]
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      return {
        text: getSourceText(entry),
        path: getSourcePath(entry),
        preview_url: resolvePublicDocumentUrl(getSourcePath(entry)),
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
      contextDocs: normalizeStoredContextDocs(row.context_docs),
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
  const pathwayUrl = getPathwayUrl(normalizeAssistantMode(options?.mode));
  let lastEndpointError = null;

  for (const endpoint of PATHWAY_ENDPOINTS) {
    try {
      const response = await axios.post(
        `${pathwayUrl}${endpoint.path}`,
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
  const mode = normalizeAssistantMode(req.body?.mode);

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

    const rawData = await requestPathwayAnswer(buildPathwayPrompt(prompt, mode), {
      filters: req.body?.filters,
      model: req.body?.model,
      returnContextDocs: req.body?.returnContextDocs,
      mode,
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

    const pathwayUrl = getPathwayUrl(mode);
    const isConnectionIssue =
      error.code === "ECONNREFUSED" ||
      error.code === "ECONNRESET" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT";
    const message = isConnectionIssue
      ? getPathwayUnavailableMessage(mode, pathwayUrl)
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

export const getAssistantDashboardSummary = async (req, res) => {
  try {
    const rawData = await requestPathwayAnswer(
      buildDashboardSummaryPrompt(req.body?.tasks),
      {
        mode: "dashboard",
        returnContextDocs: false,
      },
    );

    const summary =
      extractAnswer(rawData) ||
      "No tasks are available yet, so there is no delivery summary to share.";

    return res.status(200).json({ summary });
  } catch (error) {
    console.error("Error in getAssistantDashboardSummary:", error.message);

    const pathwayUrl = getPathwayUrl("dashboard");
    const isConnectionIssue =
      error.code === "ECONNREFUSED" ||
      error.code === "ECONNRESET" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT";
    const message = isConnectionIssue
      ? getPathwayUnavailableMessage("dashboard", pathwayUrl)
      : error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to generate dashboard summary";

    return res.status(502).json({ message });
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
      ? getPathwayUnavailableMessage("default", PATHWAY_URL)
      : error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch assistant statistics";

    return res.status(502).json({ message });
  }
};
