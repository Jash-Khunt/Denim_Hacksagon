import axios from "axios";
import { pool } from "../lib/db.js";
import { createTasksFromBotOutput, parseBotTasks } from "../lib/task-workflow.js";

const CHATBOT_SYNC_SECRET_HEADER = "x-chatbot-sync-secret";
const DEFAULT_PROJECT_NAME = "Chatbot Jira Intake";

const getJiraConfig = () => {
  let cleanDomain = process.env.JIRA_DOMAIN;

  if (
    cleanDomain &&
    (cleanDomain.startsWith("http://") || cleanDomain.startsWith("https://"))
  ) {
    cleanDomain = new URL(cleanDomain).host;
  }

  const JIRA_DOMAIN = cleanDomain;
  const JIRA_EMAIL = process.env.JIRA_EMAIL;
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
  const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

  if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
    return null;
  }

  return {
    jiraDomain: JIRA_DOMAIN,
    projectKey: JIRA_PROJECT_KEY,
    authHeader: `Basic ${Buffer.from(
      `${JIRA_EMAIL}:${JIRA_API_TOKEN}`
    ).toString("base64")}`,
  };
};

const getChatbotSyncSecret = () => process.env.CHATBOT_SYNC_SECRET?.trim() || "";

const ensureChatbotSyncAuthorized = (req) => {
  const expectedSecret = getChatbotSyncSecret();
  if (!expectedSecret) {
    return;
  }

  const incomingSecret = req.get(CHATBOT_SYNC_SECRET_HEADER) || "";
  if (incomingSecret !== expectedSecret) {
    const error = new Error("Invalid chatbot sync credentials");
    error.statusCode = 401;
    throw error;
  }
};

const normalizeTaskInput = ({ tasks, rawResponse }) => {
  if (Array.isArray(tasks) && tasks.length > 0) {
    return tasks;
  }

  return parseBotTasks(rawResponse);
};

const buildAssistantUploadSeed = (projectName) => {
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = (projectName || DEFAULT_PROJECT_NAME)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const filename = `${safeName || "chatbot-jira-intake"}-${safeDate}.json`;

  return {
    originalName: filename,
    storedName: filename,
    filePath: `assistant/${filename}`,
  };
};

const getClientContextForChatbot = async ({ clientEmail, preferredHrId }) => {
  const clientResult = await pool.query(
    `SELECT client_id, name, company_name, email
    FROM client
    WHERE LOWER(email) = LOWER($1)`,
    [clientEmail],
  );

  if (!clientResult.rows.length) {
    const error = new Error(
      "No matching client account was found in the web app for this chatbot email",
    );
    error.statusCode = 404;
    throw error;
  }

  const client = clientResult.rows[0];
  const connectionResult = await pool.query(
    `SELECT
      conn.hr_id,
      h.name,
      h.company_name
    FROM client_hr_connections conn
    JOIN hr h
      ON h.hr_id = conn.hr_id
    WHERE conn.client_id = $1
      AND conn.status = 'connected'
    ORDER BY conn.updated_at DESC`,
    [client.client_id],
  );

  if (!connectionResult.rows.length) {
    const error = new Error(
      "The matching client account does not have an approved HR connection yet",
    );
    error.statusCode = 400;
    throw error;
  }

  const connectedHrs = connectionResult.rows;

  if (preferredHrId) {
    const matchedHr = connectedHrs.find((item) => item.hr_id === preferredHrId);
    if (!matchedHr) {
      const error = new Error("The selected HR partner is not connected to this client");
      error.statusCode = 400;
      throw error;
    }

    return {
      client,
      hr: matchedHr,
    };
  }

  return {
    client,
    hr: connectedHrs[0],
  };
};

const createAssistantUpload = async ({
  db,
  clientId,
  hrId,
  projectName,
  overview,
  rawResponse,
}) => {
  const seed = buildAssistantUploadSeed(projectName);
  const result = await db.query(
    `INSERT INTO client_project_uploads (
      client_id,
      hr_id,
      original_name,
      stored_name,
      file_path,
      project_name,
      overview,
      upload_source,
      processing_status,
      bot_raw_response
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'assistant', 'processing', $8)
    RETURNING *`,
    [
      clientId,
      hrId,
      seed.originalName,
      seed.storedName,
      seed.filePath,
      projectName || DEFAULT_PROJECT_NAME,
      overview || "Generated from the standalone chatbot Jira action.",
      typeof rawResponse === "string" ? rawResponse : null,
    ],
  );

  return result.rows[0];
};

const getUploadById = async (db, uploadId) => {
  const result = await db.query(
    `SELECT *
    FROM client_project_uploads
    WHERE upload_id = $1`,
    [uploadId],
  );

  return result.rows[0] || null;
};

const loadCreatedTaskDetails = async (taskIds) => {
  if (!taskIds.length) {
    return [];
  }

  const result = await pool.query(
    `SELECT
      t.*,
      e.name AS assignee_name,
      e.email AS assignee_email
    FROM project_tasks t
    LEFT JOIN employee e
      ON e.emp_id = t.assignee_emp_id
    WHERE t.task_id = ANY($1::uuid[])
    ORDER BY t.created_at ASC`,
    [taskIds],
  );

  return result.rows;
};

const getOrFindJiraAccountId = async ({ config, emailAddress, cache }) => {
  if (!emailAddress) {
    return null;
  }

  const normalizedEmail = emailAddress.toLowerCase();
  if (cache.has(normalizedEmail)) {
    return cache.get(normalizedEmail);
  }

  try {
    const response = await axios.get(
      `https://${config.jiraDomain}/rest/api/3/user/search`,
      {
        params: { query: emailAddress, maxResults: 10 },
        headers: {
          Authorization: config.authHeader,
          Accept: "application/json",
        },
      },
    );

    const match = (response.data || []).find((candidate) =>
      [candidate.emailAddress, candidate.displayName]
        .filter(Boolean)
        .some((value) => value.toLowerCase() === normalizedEmail),
    );

    const accountId = match?.accountId || null;
    cache.set(normalizedEmail, accountId);
    return accountId;
  } catch (error) {
    cache.set(normalizedEmail, null);
    return null;
  }
};

const createJiraIssuesForTasks = async (tasks) => {
  const config = getJiraConfig();

  if (!config) {
    const error = new Error("Jira configuration is missing on the server");
    error.statusCode = 500;
    throw error;
  }

  const jiraUrl = `https://${config.jiraDomain}/rest/api/2/issue`;
  const accountIdCache = new Map();
  const results = [];
  const errors = [];
  const issueKeys = [];

  for (const task of tasks) {
    const descriptionText = [
      task.task_key ? `Internal Task: ${task.task_key}` : "",
      task.difficulty ? `Difficulty: ${task.difficulty}` : "",
      task.field ? `Field: ${task.field}` : "",
      task.confidence_flag ? `Flag: ${task.confidence_flag}` : "",
      typeof task.human_intervention === "boolean"
        ? `Requires Human Intervention: ${task.human_intervention}`
        : "",
      task.assignee_name ? `Suggested Assignee: ${task.assignee_name}` : "",
      "",
      task.description || task.title,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const payload = {
        fields: {
          project: {
            key: config.projectKey,
          },
          summary: task.title,
          description: descriptionText,
          issuetype: {
            name: "Task",
          },
        },
      };

      const response = await axios.post(jiraUrl, payload, {
        headers: {
          Authorization: config.authHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      issueKeys.push(response.data.key);

      let assignmentStatus = "not_attempted";
      if (
        task.assignee_email &&
        task.confidence_flag === "High" &&
        !task.human_intervention
      ) {
        const accountId = await getOrFindJiraAccountId({
          config,
          emailAddress: task.assignee_email,
          cache: accountIdCache,
        });

        if (accountId) {
          try {
            await axios.put(
              `https://${config.jiraDomain}/rest/api/3/issue/${response.data.key}/assignee`,
              { accountId },
              {
                headers: {
                  Authorization: config.authHeader,
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
              },
            );
            assignmentStatus = "assigned";
          } catch (assignmentError) {
            assignmentStatus = "assignment_failed";
          }
        } else {
          assignmentStatus = "account_not_found";
        }
      }

      results.push({
        task_key: task.task_key,
        title: task.title,
        key: response.data.key,
        url: `https://${config.jiraDomain}/browse/${response.data.key}`,
        assignmentStatus,
      });
    } catch (error) {
      errors.push({
        task_key: task.task_key,
        title: task.title,
        error: error?.response?.data?.errorMessages || error.message,
      });
    }
  }

  let sprintAssignmentStatus = "Not attempted";
  if (issueKeys.length > 0) {
    try {
      const agileUrl = `https://${config.jiraDomain}/rest/agile/1.0`;
      const boardRes = await axios.get(
        `${agileUrl}/board?projectKeyOrId=${config.projectKey}`,
        {
          headers: {
            Authorization: config.authHeader,
            Accept: "application/json",
          },
        },
      );

      if (boardRes.data.values && boardRes.data.values.length > 0) {
        const boardId = boardRes.data.values[0].id;
        const sprintRes = await axios.get(
          `${agileUrl}/board/${boardId}/sprint?state=active`,
          {
            headers: {
              Authorization: config.authHeader,
              Accept: "application/json",
            },
          },
        );

        if (sprintRes.data.values && sprintRes.data.values.length > 0) {
          const activeSprintId = sprintRes.data.values[0].id;
          await axios.post(
            `${agileUrl}/sprint/${activeSprintId}/issue`,
            { issues: issueKeys },
            {
              headers: {
                Authorization: config.authHeader,
                Accept: "application/json",
                "Content-Type": "application/json",
              },
            },
          );

          sprintAssignmentStatus = "Success (Assigned to active sprint)";
        } else {
          sprintAssignmentStatus = "No active sprint found on board";
        }
      } else {
        sprintAssignmentStatus = "No agile board found for project";
      }
    } catch (error) {
      sprintAssignmentStatus = "Failed to assign to sprint";
    }
  }

  return {
    results,
    errors,
    sprintStatus: sprintAssignmentStatus,
  };
};

const syncChatbotTickets = async ({
  clientEmail,
  preferredHrId,
  rawResponse,
  tasks,
  projectName,
  overview,
  createdByRole = "client",
}) => {
  const parsedTasks = normalizeTaskInput({ tasks, rawResponse });
  if (!parsedTasks.length) {
    const error = new Error("No tasks were provided for Jira creation");
    error.statusCode = 400;
    throw error;
  }

  const { client, hr } = await getClientContextForChatbot({
    clientEmail,
    preferredHrId,
  });

  const db = await pool.connect();

  try {
    await db.query("BEGIN");

    const upload = await createAssistantUpload({
      db,
      clientId: client.client_id,
      hrId: hr.hr_id,
      projectName,
      overview,
      rawResponse,
    });

    const createdTasks = await createTasksFromBotOutput({
      db,
      uploadId: upload.upload_id,
      clientId: client.client_id,
      hrId: hr.hr_id,
      createdByRole,
      rawResponse,
      tasks: parsedTasks,
    });
    const refreshedUpload = await getUploadById(db, upload.upload_id);

    await db.query("COMMIT");

    const hydratedTasks = await loadCreatedTaskDetails(
      createdTasks.map((task) => task.task_id),
    );
    const jiraOutcome = await createJiraIssuesForTasks(hydratedTasks);

    return {
      upload: refreshedUpload || upload,
      client,
      hr,
      tasks: hydratedTasks,
      jiraOutcome,
    };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
};

const buildSummary = (issues) => {
  const summary = {
    total: issues.length,
    done: 0,
    inProgress: 0,
    remaining: 0,
  };

  issues.forEach((issue) => {
    const normalizedStatus = (issue.fields?.status?.name || "").toLowerCase();

    if (["done", "closed", "resolved", "completed"].includes(normalizedStatus)) {
      summary.done += 1;
      return;
    }

    if (
      ["in progress", "review", "testing", "qa", "development"].includes(
        normalizedStatus
      )
    ) {
      summary.inProgress += 1;
      return;
    }

    summary.remaining += 1;
  });

  return summary;
};

const mapIssue = (issue, jiraDomain) => ({
  id: issue.id,
  key: issue.key,
  url: `https://${jiraDomain}/browse/${issue.key}`,
  summary: issue.fields?.summary || "",
  status: issue.fields?.status?.name || "Unknown",
  priority: issue.fields?.priority?.name || "Unspecified",
  assignee: issue.fields?.assignee
    ? {
        displayName: issue.fields.assignee.displayName || "",
        emailAddress: issue.fields.assignee.emailAddress || "",
        accountId: issue.fields.assignee.accountId || "",
      }
    : null,
  createdAt: issue.fields?.created || null,
  updatedAt: issue.fields?.updated || null,
});

const filterIssuesForEmployee = (issues, user) => {
  const normalizedEmail = (user.email || "").toLowerCase();
  const normalizedName = (user.name || "").toLowerCase();

  return issues.filter((issue) => {
    const assignee = issue.fields?.assignee;

    if (!assignee) {
      return false;
    }

    const candidateValues = [
      assignee.emailAddress,
      assignee.displayName,
      assignee.accountId,
    ]
      .filter(Boolean)
      .map((value) => value.toLowerCase());

    return (
      (normalizedEmail && candidateValues.includes(normalizedEmail)) ||
      (normalizedName && candidateValues.includes(normalizedName))
    );
  });
};

const fetchIssues = async ({ startAt, maxResults, status, user }) => {
  const config = getJiraConfig();

  if (!config) {
    const error = new Error("Jira configuration is missing on the server");
    error.statusCode = 500;
    throw error;
  }

  let jql = `project = "${config.projectKey}"`;

  if (status) {
    jql += ` AND status = "${status}"`;
  }

  jql += " ORDER BY updated DESC";

  const response = await axios.post(
    `https://${config.jiraDomain}/rest/api/3/search`,
    {
      jql,
      startAt,
      maxResults,
      fields: ["summary", "status", "priority", "assignee", "created", "updated"],
    },
    {
      headers: {
        Authorization: config.authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );

  const baseIssues = response.data.issues || [];
  const filteredIssues =
    user.role === "employee" ? filterIssuesForEmployee(baseIssues, user) : baseIssues;

  return {
    config,
    issues: filteredIssues,
    total: user.role === "employee" ? filteredIssues.length : response.data.total || filteredIssues.length,
  };
};

export const getJiraTickets = async (req, res) => {
  const startAt = Number.parseInt(req.query.startAt || "0", 10);
  const maxResults = Number.parseInt(req.query.limit || "25", 10);
  const status = req.query.status;

  try {
    const { config, issues, total } = await fetchIssues({
      startAt,
      maxResults,
      status,
      user: req.user,
    });

    res.status(200).json({
      tickets: issues.map((issue) => mapIssue(issue, config.jiraDomain)),
      summary: buildSummary(issues),
      total,
    });
  } catch (error) {
    console.error("Error in getJiraTickets:", error.message);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Internal Server Error" });
  }
};

export const createChatbotJiraTickets = async (req, res) => {
  const {
    client_email,
    hr_id,
    raw_response,
    tasks,
    project_name,
    overview,
  } = req.body || {};

  if (!client_email || typeof client_email !== "string") {
    return res.status(400).json({ message: "client_email is required" });
  }

  try {
    ensureChatbotSyncAuthorized(req);

    const {
      upload,
      client,
      hr,
      tasks: createdTasks,
      jiraOutcome,
    } = await syncChatbotTickets({
      clientEmail: client_email,
      preferredHrId: hr_id,
      rawResponse: raw_response,
      tasks,
      projectName: project_name,
      overview,
      createdByRole: "client",
    });

    const autoAssignedCount = createdTasks.filter(
      (task) => task.assignment_mode === "auto",
    ).length;
    const reviewCount = createdTasks.filter(
      (task) => task.human_intervention,
    ).length;

    return res.status(201).json({
      message: `Created ${jiraOutcome.results.length} Jira tickets and synced ${createdTasks.length} workflow tasks`,
      client: {
        client_id: client.client_id,
        name: client.name,
        company_name: client.company_name,
        email: client.email,
      },
      hr: {
        hr_id: hr.hr_id,
        name: hr.name,
        company_name: hr.company_name,
      },
      upload: {
        upload_id: upload.upload_id,
        project_name: upload.project_name,
        processing_status: upload.processing_status,
        upload_source: upload.upload_source,
      },
      workflow: {
        total: createdTasks.length,
        autoAssigned: autoAssignedCount,
        needsReview: reviewCount,
        tasks: createdTasks,
      },
      sprintStatus: jiraOutcome.sprintStatus,
      results: jiraOutcome.results,
      errors: jiraOutcome.errors.length ? jiraOutcome.errors : undefined,
    });
  } catch (error) {
    console.error("Error in createChatbotJiraTickets:", error.message);
    return res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Failed to create Jira tickets" });
  }
};

export const getHrProjectUploads = async (req, res) => {
  if (req.user?.role !== "hr") {
    return res.status(403).json({ message: "Access denied" });
  }

  try {
    const result = await pool.query(
      `SELECT
        u.upload_id,
        u.project_name,
        u.overview,
        u.original_name,
        u.file_path,
        u.upload_source,
        u.processing_status,
        u.confidence_flag,
        u.created_at,
        u.updated_at,
        u.client_id,
        c.name AS client_name,
        c.company_name AS client_company_name,
        COALESCE(task_summary.task_count, 0)::INT AS task_count
      FROM client_project_uploads u
      JOIN client c
        ON c.client_id = u.client_id
      LEFT JOIN (
        SELECT upload_id, COUNT(*) AS task_count
        FROM project_tasks
        GROUP BY upload_id
      ) task_summary
        ON task_summary.upload_id = u.upload_id
      WHERE u.hr_id = $1
        AND u.upload_source = 'local'
      ORDER BY u.created_at DESC`,
      [req.user.hr_id],
    );

    return res.status(200).json({ uploads: result.rows });
  } catch (error) {
    console.error("Error in getHrProjectUploads:", error.message);
    return res.status(500).json({ message: "Failed to fetch project uploads" });
  }
};

export const createJiraTicketsForHr = async (req, res) => {
  const { upload_id, raw_response, tasks } = req.body || {};

  if (req.user?.role !== "hr") {
    return res
      .status(403)
      .json({ message: "Only HR can create Jira tickets from assistant chat" });
  }

  if (!upload_id) {
    return res.status(400).json({ message: "upload_id is required" });
  }

  try {
    const uploadResult = await pool.query(
      `SELECT
        u.upload_id,
        u.project_name,
        u.overview,
        u.client_id,
        u.hr_id,
        c.name AS client_name,
        c.company_name AS client_company_name,
        c.email AS client_email
      FROM client_project_uploads u
      JOIN client c
        ON c.client_id = u.client_id
      WHERE u.upload_id = $1 AND u.hr_id = $2`,
      [upload_id, req.user.hr_id],
    );

    if (!uploadResult.rows.length) {
      return res.status(404).json({ message: "Project upload not found" });
    }

    const upload = uploadResult.rows[0];
    const parsedTasks = normalizeTaskInput({ tasks, rawResponse: raw_response });
    if (!parsedTasks.length) {
      return res.status(400).json({ message: "No tasks were provided for Jira creation" });
    }

    const db = await pool.connect();

    let createdTasks;
    try {
      await db.query("BEGIN");
      createdTasks = await createTasksFromBotOutput({
        db,
        uploadId: upload.upload_id,
        clientId: upload.client_id,
        hrId: upload.hr_id,
        createdByRole: "hr",
        rawResponse: raw_response,
        tasks: parsedTasks,
      });
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }

    const hydratedTasks = await loadCreatedTaskDetails(
      createdTasks.map((task) => task.task_id),
    );
    const jiraOutcome = await createJiraIssuesForTasks(hydratedTasks);

    const autoAssignedCount = createdTasks.filter(
      (task) => task.assignment_mode === "auto",
    ).length;
    const reviewCount = createdTasks.filter(
      (task) => task.human_intervention,
    ).length;

    return res.status(201).json({
      message: `Created ${jiraOutcome.results.length} Jira tickets and synced ${createdTasks.length} workflow tasks`,
      client: {
        client_id: upload.client_id,
        name: upload.client_name,
        company_name: upload.client_company_name,
        email: upload.client_email,
      },
      hr: { hr_id: req.user.hr_id, name: req.user.name, company_name: req.user.company_name },
      upload: {
        upload_id: upload.upload_id,
        project_name: upload.project_name,
        processing_status: hydratedTasks.some((task) => task.human_intervention)
          ? "needs_hr_review"
          : "assigned",
      },
      workflow: {
        total: createdTasks.length,
        autoAssigned: autoAssignedCount,
        needsReview: reviewCount,
        tasks: createdTasks,
      },
      sprintStatus: jiraOutcome.sprintStatus,
      results: jiraOutcome.results,
      errors: jiraOutcome.errors.length ? jiraOutcome.errors : undefined,
    });
  } catch (error) {
    console.error("Error in createJiraTicketsForHr:", error.message);
    return res
      .status(
        error.message?.includes("Tickets have already been created") ||
          error.message?.includes("Could not parse") ||
          error.message?.includes("No tasks found")
          ? 400
          : error.statusCode || 500,
      )
      .json({ message: error.message || "Failed to create Jira tickets" });
  }
};

export const getJiraTicketSummary = async (req, res) => {
  const status = req.query.status;

  try {
    const { issues, total } = await fetchIssues({
      startAt: 0,
      maxResults: 100,
      status,
      user: req.user,
    });

    res.status(200).json({
      total,
      summary: buildSummary(issues),
    });
  } catch (error) {
    console.error("Error in getJiraTicketSummary:", error.message);
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Internal Server Error" });
  }
};
