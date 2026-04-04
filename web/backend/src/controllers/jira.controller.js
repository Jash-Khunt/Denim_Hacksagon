import axios from "axios";

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
