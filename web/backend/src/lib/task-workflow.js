const DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);
const FLAGS = new Set(["High", "Low"]);

const normalizeSpaces = (value = "") =>
  value
    .toString()
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (value = "") => {
  const normalized = normalizeSpaces(value).toLowerCase();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const cleanJsonString = (value = "") =>
  value
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/\[GRAPH_CONFIG\]/gi, "")
    .replace(/\[TICKET_CONFIG\]/gi, "")
    .trim();

const buildDescription = (task) => {
  const summary = normalizeSpaces(task.task || task.title || task.description);
  const field = normalizeSpaces(task.field || task.domain || "Full-stack");
  return normalizeSpaces(task.description || summary || `Work item for ${field}`);
};

const getDifficulty = (task) => {
  const value = titleCase(task.Difficulty || task.difficulty || "Medium");
  return DIFFICULTIES.has(value) ? value : "Medium";
};

const getFlag = (task) => {
  const value = titleCase(task.flag || task.confidence_flag || "Low");
  return FLAGS.has(value) ? value : "Low";
};

const getHumanIntervention = (task, flag) => {
  if (typeof task.human_intervention === "boolean") {
    return task.human_intervention;
  }

  if (typeof task.human_intervention === "string") {
    return task.human_intervention.toLowerCase() === "true";
  }

  return flag === "Low";
};

const getPriorityForDifficulty = (difficulty) => {
  if (difficulty === "Hard") return "High";
  if (difficulty === "Easy") return "Low";
  return "Medium";
};

const getDueDateForDifficulty = (difficulty) => {
  const dueDate = new Date();
  const leadDays = difficulty === "Hard" ? 14 : difficulty === "Medium" ? 7 : 3;
  dueDate.setDate(dueDate.getDate() + leadDays);
  return dueDate.toISOString().slice(0, 10);
};

const tokenize = (value = "") =>
  normalizeSpaces(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

const scoreEmployeeForField = (employee, field) => {
  const tokens = tokenize(field);
  const haystack = tokenize(
    `${employee.employee_role || ""} ${employee.department || ""} ${employee.name || ""}`,
  );

  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += 2;
    }
    if ((employee.employee_role || "").toLowerCase().includes(token)) {
      score += 3;
    }
    if ((employee.department || "").toLowerCase().includes(token)) {
      score += 1;
    }
  });

  return score;
};

export const parseBotTasks = (input) => {
  if (Array.isArray(input)) {
    return input;
  }

  if (!input || typeof input !== "string") {
    return [];
  }

  const cleaned = cleanJsonString(input);

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      return [parsed];
    }
  } catch (error) {
    const arrayStart = cleaned.indexOf("[");
    const arrayEnd = cleaned.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      const fallback = cleaned.slice(arrayStart, arrayEnd + 1);
      const parsed = JSON.parse(fallback);
      return Array.isArray(parsed) ? parsed : [];
    }
  }

  throw new Error("Could not parse chatbot ticket output");
};

export const normalizeBotTask = (task) => {
  const difficulty = getDifficulty(task);
  const flag = getFlag(task);
  const title = normalizeSpaces(task.task || task.title);
  const field = normalizeSpaces(task.field || task.domain || "Full-stack");

  if (!title) {
    throw new Error("Each task must include a task or title field");
  }

  return {
    title,
    description: buildDescription(task),
    difficulty,
    field,
    confidenceFlag: flag,
    humanIntervention: getHumanIntervention(task, flag),
    dueDate: task.due_date || getDueDateForDifficulty(difficulty),
    priority: titleCase(task.priority) || getPriorityForDifficulty(difficulty),
  };
};

export const pickAssignee = (employees, field) => {
  if (!employees.length) {
    return null;
  }

  const ranked = [...employees].sort((a, b) => {
    const scoreDiff = scoreEmployeeForField(b, field) - scoreEmployeeForField(a, field);
    if (scoreDiff !== 0) return scoreDiff;

    const taskLoadDiff = (a.open_task_count || 0) - (b.open_task_count || 0);
    if (taskLoadDiff !== 0) return taskLoadDiff;

    return (b.experience || 0) - (a.experience || 0);
  });

  return ranked[0];
};

export const createTasksFromBotOutput = async ({
  db,
  uploadId,
  clientId,
  hrId,
  createdByRole = "client",
  rawResponse,
  tasks,
}) => {
  const parsedTasks = (Array.isArray(tasks) ? tasks : parseBotTasks(rawResponse)).map(
    normalizeBotTask,
  );

  if (!parsedTasks.length) {
    throw new Error("No tasks found in chatbot output");
  }

  const existingTaskResult = await db.query(
    `SELECT COUNT(*)::INT AS task_count
    FROM project_tasks
    WHERE upload_id = $1`,
    [uploadId],
  );

  if (existingTaskResult.rows[0].task_count > 0) {
    throw new Error("Tickets have already been created for this upload");
  }

  const employeesResult = await db.query(
    `SELECT
      e.emp_id,
      e.name,
      e.role AS employee_role,
      e.experience,
      p.department,
      COALESCE(open_tasks.open_task_count, 0)::INT AS open_task_count
    FROM employee e
    LEFT JOIN profile_info p
      ON p.emp_id = e.emp_id
    LEFT JOIN (
      SELECT assignee_emp_id, COUNT(*) AS open_task_count
      FROM project_tasks
      WHERE status <> 'done'
      GROUP BY assignee_emp_id
    ) open_tasks
      ON open_tasks.assignee_emp_id = e.emp_id
    WHERE e.hr_id = $1`,
    [hrId],
  );

  const employees = employeesResult.rows;
  const createdTasks = [];
  let reviewRequired = false;

  for (const task of parsedTasks) {
    let assignmentMode = "unassigned";
    let assigneeId = null;

    if (task.confidenceFlag === "High" && !task.humanIntervention) {
      const assignee = pickAssignee(employees, task.field);
      if (assignee) {
        assigneeId = assignee.emp_id;
        assignmentMode = "auto";
      }
    } else {
      reviewRequired = true;
    }

    const ticketNumberResult = await db.query(
      "SELECT nextval('project_task_ticket_seq') AS ticket_number",
    );
    const ticketNumber = ticketNumberResult.rows[0].ticket_number;
    const taskKey = `SCRUM-${ticketNumber}`;

    const insertResult = await db.query(
      `INSERT INTO project_tasks (
        upload_id,
        client_id,
        hr_id,
        assignee_emp_id,
        ticket_number,
        task_key,
        title,
        description,
        difficulty,
        field,
        confidence_flag,
        human_intervention,
        status,
        assignment_mode,
        priority,
        due_date,
        created_by_role
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'todo', $13, $14, $15, $16
      )
      RETURNING *`,
      [
        uploadId,
        clientId,
        hrId,
        assigneeId,
        ticketNumber,
        taskKey,
        task.title,
        task.description,
        task.difficulty,
        task.field,
        task.confidenceFlag,
        task.humanIntervention,
        assignmentMode,
        task.priority,
        task.dueDate,
        createdByRole,
      ],
    );

    createdTasks.push(insertResult.rows[0]);
  }

  await db.query(
    `UPDATE client_project_uploads
    SET
      processing_status = $2,
      confidence_flag = $3,
      bot_raw_response = COALESCE($4, bot_raw_response),
      processed_at = NOW(),
      updated_at = NOW()
    WHERE upload_id = $1`,
    [
      uploadId,
      reviewRequired ? "needs_hr_review" : "assigned",
      reviewRequired ? "low" : "high",
      typeof rawResponse === "string" ? rawResponse : null,
    ],
  );

  return createdTasks;
};
