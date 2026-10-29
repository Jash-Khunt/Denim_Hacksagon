import axios from "axios";
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

const PATHWAY_ENDPOINTS = [
  {
    path: "/v2/answer",
    buildPayload: (prompt, options) => {
      const payload = {
        prompt,
        filters: options.filters ?? null,
        return_context_docs: options.returnContextDocs ?? true,
      };
      // Omit model when unset so Pathway uses the model configured in its YAML.
      if (options.model) payload.model = options.model;
      return payload;
    },
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

const getAuthorizedAssistantDocuments = async (user) => {
  if (user.role === "client") {
    const { rows } = await pool.query(
      `SELECT u.upload_id, u.client_id, u.hr_id, u.file_path, u.stored_name, u.original_name
       FROM client_project_uploads u
       WHERE u.client_id = $1
         AND u.file_path LIKE '%/clients/' || u.client_id::text || '/hrs/' || u.hr_id::text || '/' || u.upload_id::text || '/%'`,
      [user.client_id],
    );
    return rows;
  }
  if (user.role === "hr") {
    const { rows: projectFiles } = await pool.query(
      `SELECT u.upload_id, u.client_id, u.hr_id, u.file_path, u.stored_name, u.original_name
       FROM client_project_uploads u
       JOIN client_hr_connections conn
         ON conn.client_id = u.client_id AND conn.hr_id = u.hr_id
        AND conn.status = 'connected'
       WHERE u.hr_id = $1
         AND u.file_path LIKE '%/clients/' || u.client_id::text || '/hrs/' || u.hr_id::text || '/' || u.upload_id::text || '/%'`,
      [user.hr_id],
    );
    const { rows: companyFiles } = await pool.query(
      `SELECT file_id, hr_id, file_path, stored_name, original_name
       FROM hr_company_files
       WHERE hr_id = $1
         AND file_path LIKE '%/hr-companies/' || hr_id::text || '/' || file_id::text || '/%'`,
      [user.hr_id],
    );
    return [
      ...projectFiles.map((document) => ({ ...document, source_type: "project" })),
      ...companyFiles.map((document) => ({
        ...document,
        upload_id: document.file_id,
        client_id: null,
        source_type: "company",
      })),
    ];
  }
  const { rows } = await pool.query(
    `SELECT DISTINCT u.upload_id, u.client_id, u.hr_id, u.file_path, u.stored_name, u.original_name
     FROM project_tasks t
     JOIN client_project_uploads u ON u.upload_id = t.upload_id
     WHERE t.assignee_emp_id = $1
       AND u.file_path LIKE '%/clients/' || u.client_id::text || '/hrs/' || u.hr_id::text || '/' || u.upload_id::text || '/%'`,
    [user.emp_id],
  );
  return rows;
};

const getScopedPathwayFilter = (documents) => {
  if (!documents.length) return null;
  return documents.map((document) => {
    const ids = document.source_type === "company"
      ? [document.hr_id, document.file_id]
      : [document.client_id, document.hr_id, document.upload_id];
    return ids
      .map((id) => 'contains(path, `' + '"' + id + '"' + '`)')
      .join(" && ");
  }).join(" || ");
};

const findAuthorizedDocument = (entry, documents) => {
  const source = getSourcePath(entry).replace(/\\/g, "/");
  const routeId = source.match(/\/(?:project-files|company-files)\/([0-9a-f-]{36})/i)?.[1];
  if (routeId) return documents.find((document) => document.upload_id === routeId);
  const basename = source.split("/").pop();
  return documents.find(
    (document) => document.stored_name === basename && (
      document.source_type === "company"
        ? source.includes(`/hr-companies/${document.hr_id}/${document.file_id}/`)
        : source.includes(`/clients/${document.client_id}/hrs/${document.hr_id}/${document.upload_id}/`)
    ),
  );
};

const filterPathwayResponse = (payload, documents) => {
  const buckets = extractSourceBuckets(payload);
  const originalEntries = [...buckets.context_docs, ...buckets.docs, ...buckets.sources];
  const allowedEntries = originalEntries
    .filter((entry) => findAuthorizedDocument(entry, documents));
  const safeContext = allowedEntries.map((entry) => {
    const document = findAuthorizedDocument(entry, documents);
    return {
      text: getSourceText(entry),
      name: document.original_name,
      path: document.source_type === "company"
        ? `/api/v1/company-files/${document.file_id}/${document.original_name.toLowerCase().endsWith(".pdf") ? "view" : "download"}`
        : `/api/v1/project-files/${document.upload_id}`,
      ...(document.source_type === "company" && !document.original_name.toLowerCase().endsWith(".pdf")
        ? {}
        : {
            preview_url: document.source_type === "company"
              ? `/api/v1/company-files/${document.file_id}/view`
              : `/api/v1/project-files/${document.upload_id}`,
          }),
    };
  });
  const result = {
    ...payload,
    context_docs: safeContext,
    docs: [],
    sources: [],
  };
  if (
    (documents.length && (!originalEntries.length || safeContext.length !== originalEntries.length)) ||
    (!documents.length && originalEntries.length > 0)
  ) {
    result.response = "I could not verify an authorized project source for this answer, so I have withheld it.";
    result.answer = result.response;
  }
  return result;
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

const extractEvidence = (payload) =>
  pickArray(payload?.context_docs)
    .map((entry) => entry?.path)
    .filter(Boolean)
    .slice(0, 10);

const normalizeContextDocs = (payload) => pickArray(payload?.context_docs).slice(0, 10);

const mapThreadRow = (row) => ({
  id: row.thread_id,
  title: row.title,
  messages: [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapQuestionRowsToMessages = (rows, authorizedDocuments) =>
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

    const storedContext = pickArray(row.context_docs);
    const authorizedContext = storedContext
      .filter((entry) => findAuthorizedDocument(entry, authorizedDocuments))
      .map((entry) => {
        const document = findAuthorizedDocument(entry, authorizedDocuments);
        return {
          ...entry,
          name: document.original_name,
          path: document.source_type === "company"
            ? `/api/v1/company-files/${document.file_id}/${document.original_name.toLowerCase().endsWith(".pdf") ? "view" : "download"}`
            : `/api/v1/project-files/${document.upload_id}`,
          ...(document.source_type === "company" && !document.original_name.toLowerCase().endsWith(".pdf")
            ? { preview_url: undefined }
            : {
                preview_url: document.source_type === "company"
                  ? `/api/v1/company-files/${document.file_id}/view`
                  : `/api/v1/project-files/${document.upload_id}`,
              }),
        };
      });
    const hasVerifiedSources =
      storedContext.length > 0 && authorizedContext.length === storedContext.length;
    const safeNoDocumentAnswer = [
      "No project documents are currently available to your account.",
      "No documents are currently available to your account.",
    ].includes(row.response);
    const hideUnverifiedAnswer = !hasVerifiedSources && !safeNoDocumentAnswer;
    messages.push({
      id: `${row.question_id}:assistant`,
      role: "assistant",
      content:
        row.status === "error"
          ? row.error_message || "Failed to reach the assistant"
          : !hideUnverifiedAnswer
            ? row.response || "No response received from the assistant."
            : "This earlier response is hidden because its document access could not be verified.",
      createdAt: row.updated_at,
      sources: authorizedContext.map((entry) => entry.path),
      contextDocs: authorizedContext,
      error: row.status === "error" || hideUnverifiedAnswer,
    });

    return messages;
  });

const buildThreadsFromRows = (threadRows, questionRows, authorizedDocuments) => {
  const threadsById = new Map(
    threadRows.map((row) => [row.thread_id, mapThreadRow(row)]),
  );

  for (const row of questionRows) {
    const thread = threadsById.get(row.thread_id);
    if (!thread) continue;

    thread.messages.push(...mapQuestionRowsToMessages([row], authorizedDocuments));
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
    const [threadResult, questionResult, authorizedDocuments] = await Promise.all([
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
      getAuthorizedAssistantDocuments(req.user),
    ]);

    return res.status(200).json({
      threads: buildThreadsFromRows(threadResult.rows, questionResult.rows, authorizedDocuments),
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

    const authorizedDocuments = await getAuthorizedAssistantDocuments(req.user);
    const pathwayData = authorizedDocuments.length
      ? await requestPathwayAnswer(buildPathwayPrompt(prompt, mode), {
          filters: getScopedPathwayFilter(authorizedDocuments),
          returnContextDocs: true,
          mode,
        })
      : {
          response: "No documents are currently available to your account.",
          context_docs: [],
        };
    const verifiedDocuments = authorizedDocuments.length
      ? await getAuthorizedAssistantDocuments(req.user)
      : [];
    const rawData = filterPathwayResponse(pathwayData, verifiedDocuments);
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
    const taskQuery = req.user.role === "hr"
      ? `SELECT t.title, t.status FROM project_tasks t
         WHERE t.hr_id = $1 AND EXISTS (
           SELECT 1 FROM client_hr_connections conn
           WHERE conn.client_id = t.client_id AND conn.hr_id = t.hr_id
             AND conn.status = 'connected'
         ) ORDER BY t.updated_at DESC LIMIT 50`
      : req.user.role === "employee"
        ? `SELECT title, status FROM project_tasks WHERE assignee_emp_id = $1 ORDER BY updated_at DESC LIMIT 50`
        : `SELECT title, status FROM project_tasks WHERE client_id = $1 ORDER BY updated_at DESC LIMIT 50`;
    const taskId = req.user.hr_id || req.user.emp_id || req.user.client_id;
    const { rows } = await pool.query(taskQuery, [taskId]);
    const documents = await getAuthorizedAssistantDocuments(req.user);
    let summary = "No tasks are available yet, so there is no delivery summary to share.";
    if (rows.length) {
      if (documents.length) {
        const pathwayData = await requestPathwayAnswer(buildDashboardSummaryPrompt(rows), {
            mode: "dashboard",
            filters: getScopedPathwayFilter(documents),
            returnContextDocs: true,
          });
        const verifiedDocuments = await getAuthorizedAssistantDocuments(req.user);
        const rawData = filterPathwayResponse(pathwayData, verifiedDocuments);
        const generatedSummary = extractAnswer(rawData);
        if (generatedSummary && !generatedSummary.includes("withheld")) {
          summary = generatedSummary;
        } else {
          summary = buildLocalDashboardSummary(rows);
        }
      } else {
        summary = buildLocalDashboardSummary(rows);
      }
    }

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

const buildLocalDashboardSummary = (tasks) => {
  const completed = tasks.filter((task) => task.status === "done");
  const remaining = tasks.filter((task) => task.status !== "done");
  const highlights = (remaining.length ? remaining : completed)
    .slice(0, 2)
    .map((task) => task.title);
  return `${completed.length} completed and ${remaining.length} remaining tasks.${highlights.length ? ` Current focus: ${highlights.join("; ")}.` : ""}`;
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
    const documents = await getAuthorizedAssistantDocuments(_req.user);
    return res.status(200).json({ file_count: documents.length });
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
