import { pool } from "../lib/db.js";
import {
  createTasksFromBotOutput,
  parseBotTasks,
} from "../lib/task-workflow.js";
import { isMailConfigured, sendTaskDueReminderEmail } from "../lib/mailer.js";
import { sendRemindersForUpdatedTask } from "../lib/task-scheduler.js";

const getRoleScope = (user) => {
  if (user.role === "hr") {
    return {
      clause: "t.hr_id = $1",
      params: [user.hr_id],
    };
  }

  if (user.role === "employee") {
    return {
      clause: "t.assignee_emp_id = $1",
      params: [user.emp_id],
    };
  }

  return {
    clause: "t.client_id = $1",
    params: [user.client_id],
  };
};

const getScopedTaskCondition = (user, startingIndex = 1) => {
  if (user.role === "hr") {
    return {
      clause: `t.hr_id = $${startingIndex}`,
      params: [user.hr_id],
    };
  }

  if (user.role === "employee") {
    return {
      clause: `t.assignee_emp_id = $${startingIndex}`,
      params: [user.emp_id],
    };
  }

  return {
    clause: `t.client_id = $${startingIndex}`,
    params: [user.client_id],
  };
};

const mapTaskRow = (row) => ({
  ...row,
  comments: row.comments || [],
});

export const getTasks = async (req, res) => {
  const status = req.query.status;
  const scope = getRoleScope(req.user);

  const filters = [scope.clause];
  const params = [...scope.params];

  if (status) {
    params.push(status);
    filters.push(`t.status = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `SELECT
        t.task_id,
        t.upload_id,
        t.client_id,
        t.hr_id,
        t.assignee_emp_id,
        t.task_key,
        t.title,
        t.description,
        t.difficulty,
        t.field,
        t.confidence_flag,
        t.human_intervention,
        t.status,
        t.assignment_mode,
        t.priority,
        t.due_date,
        t.created_at,
        t.updated_at,
        c.name AS client_name,
        c.company_name AS client_company_name,
        u.project_name,
        u.original_name,
        e.name AS assignee_name,
        e.role AS assignee_role
      FROM project_tasks t
      JOIN client c
        ON c.client_id = t.client_id
      LEFT JOIN client_project_uploads u
        ON u.upload_id = t.upload_id
      LEFT JOIN employee e
        ON e.emp_id = t.assignee_emp_id
      WHERE ${filters.join(" AND ")}
      ORDER BY
        CASE t.status
          WHEN 'todo' THEN 0
          WHEN 'in_progress' THEN 1
          WHEN 'review' THEN 2
          ELSE 3
        END,
        t.updated_at DESC`,
      params,
    );

    res.status(200).json({ tasks: result.rows.map(mapTaskRow) });
  } catch (error) {
    console.error("Error in getTasks:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getTaskById = async (req, res) => {
  const { taskId } = req.params;
  const scope = getScopedTaskCondition(req.user, 2);

  try {
    const taskResult = await pool.query(
      `SELECT
        t.*,
        c.name AS client_name,
        c.company_name AS client_company_name,
        c.email AS client_email,
        c.phone AS client_phone,
        c.address AS client_address,
        u.project_name,
        u.original_name,
        e.name AS assignee_name,
        e.role AS assignee_role
      FROM project_tasks t
      JOIN client c
        ON c.client_id = t.client_id
      LEFT JOIN client_project_uploads u
        ON u.upload_id = t.upload_id
      LEFT JOIN employee e
        ON e.emp_id = t.assignee_emp_id
      WHERE t.task_id = $1 AND ${scope.clause}`,
      [taskId, ...scope.params],
    );

    if (!taskResult.rows.length) {
      return res.status(404).json({ message: "Task not found" });
    }

    const commentResult = await pool.query(
      `SELECT
        comment_id,
        task_id,
        author_role,
        author_name,
        content,
        created_at
      FROM project_task_comments
      WHERE task_id = $1
      ORDER BY created_at DESC`,
      [taskId],
    );

    res.status(200).json({
      task: {
        ...taskResult.rows[0],
        comments: commentResult.rows,
      },
    });
  } catch (error) {
    console.error("Error in getTaskById:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateTask = async (req, res) => {
  const { taskId } = req.params;
  const {
    status,
    assignee_emp_id,
    due_date,
    title,
    description,
    field,
    difficulty,
  } = req.body;
  const hasAssigneeField = Object.prototype.hasOwnProperty.call(
    req.body,
    "assignee_emp_id",
  );

  try {
    const existingResult = await pool.query(
      `SELECT *
      FROM project_tasks
      WHERE task_id = $1`,
      [taskId],
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({ message: "Task not found" });
    }

    const existingTask = existingResult.rows[0];

    if (req.user.role === "employee") {
      if (existingTask.assignee_emp_id !== req.user.emp_id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = await pool.query(
        `UPDATE project_tasks
        SET status = COALESCE($2, status), updated_at = NOW()
        WHERE task_id = $1
        RETURNING *`,
        [taskId, status || null],
      );
      return res.status(200).json({ task: result.rows[0] });
    }

    if (req.user.role !== "hr" || existingTask.hr_id !== req.user.hr_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    let nextAssigneeId = assignee_emp_id;
    if (typeof nextAssigneeId === "string" && nextAssigneeId.trim() === "") {
      nextAssigneeId = null;
    }

    if (nextAssigneeId) {
      const assigneeResult = await pool.query(
        `SELECT emp_id
        FROM employee
        WHERE emp_id = $1 AND hr_id = $2`,
        [nextAssigneeId, req.user.hr_id],
      );

      if (!assigneeResult.rows.length) {
        return res.status(400).json({ message: "Invalid employee assignee" });
      }
    }

    const result = await pool.query(
      `UPDATE project_tasks
      SET
        status = COALESCE($2, status),
        assignee_emp_id = CASE
          WHEN $9 THEN $3
          ELSE assignee_emp_id
        END,
        due_date = COALESCE($4, due_date),
        title = COALESCE($5, title),
        description = COALESCE($6, description),
        field = COALESCE($7, field),
        difficulty = COALESCE($8, difficulty),
        assignment_mode = CASE
          WHEN NOT $9 THEN assignment_mode
          WHEN $3 IS NULL THEN 'unassigned'
          WHEN $3 IS DISTINCT FROM assignee_emp_id THEN 'manual'
          ELSE assignment_mode
        END,
        updated_at = NOW()
      WHERE task_id = $1
      RETURNING *`,
      [
        taskId,
        status || null,
        nextAssigneeId,
        due_date || null,
        title || null,
        description || null,
        field || null,
        difficulty || null,
        hasAssigneeField,
      ],
    );

    // Check if due_date changed and trigger reminders asynchronously
    if (due_date && existingTask.due_date) {
      sendRemindersForUpdatedTask(existingTask.due_date, due_date).catch(
        (err) =>
          console.error(
            "Error checking reminders for updated task:",
            err.message,
          ),
      );
    }

    res.status(200).json({ task: result.rows[0] });
  } catch (error) {
    console.error("Error in updateTask:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const addTaskComment = async (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Comment content is required" });
  }

  try {
    const scope = getScopedTaskCondition(req.user, 2);
    const taskResult = await pool.query(
      `SELECT task_id
      FROM project_tasks t
      WHERE t.task_id = $1 AND ${scope.clause}`,
      [taskId, ...scope.params],
    );

    if (!taskResult.rows.length) {
      return res.status(404).json({ message: "Task not found" });
    }

    const commentResult = await pool.query(
      `INSERT INTO project_task_comments (
        task_id,
        author_role,
        author_name,
        content
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [taskId, req.user.role, req.user.name || req.user.email, content.trim()],
    );

    res.status(201).json({ comment: commentResult.rows[0] });
  } catch (error) {
    console.error("Error in addTaskComment:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const importTasksFromBot = async (req, res) => {
  const { upload_id, raw_response, tasks } = req.body;

  if (!upload_id) {
    return res.status(400).json({ message: "upload_id is required" });
  }

  try {
    const uploadResult = await pool.query(
      `SELECT upload_id, client_id, hr_id
      FROM client_project_uploads
      WHERE upload_id = $1`,
      [upload_id],
    );

    if (!uploadResult.rows.length) {
      return res.status(404).json({ message: "Upload not found" });
    }

    const upload = uploadResult.rows[0];

    if (req.user.role === "client" && upload.client_id !== req.user.client_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user.role === "hr" && upload.hr_id !== req.user.hr_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!upload.hr_id) {
      return res.status(400).json({
        message:
          "This upload must be connected to an HR partner before task creation",
      });
    }

    const parsedTasks = Array.isArray(tasks)
      ? tasks
      : parseBotTasks(raw_response);
    const db = await pool.connect();

    try {
      await db.query("BEGIN");
      const createdTasks = await createTasksFromBotOutput({
        db,
        uploadId: upload.upload_id,
        clientId: upload.client_id,
        hrId: upload.hr_id,
        createdByRole: req.user.role,
        rawResponse: raw_response,
        tasks: parsedTasks,
      });
      await db.query("COMMIT");

      res.status(201).json({
        message: `Created ${createdTasks.length} workflow tickets`,
        tasks: createdTasks,
      });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  } catch (error) {
    console.error("Error in importTasksFromBot:", error.message);
    const statusCode =
      error.message?.includes("Tickets have already been created") ||
      error.message?.includes("Could not parse") ||
      error.message?.includes("No tasks found")
        ? 400
        : 500;
    res
      .status(statusCode)
      .json({ message: error.message || "Internal Server Error" });
  }
};

export const sendDueSoonTaskReminders = async (req, res) => {
  if (req.user.role !== "hr") {
    return res.status(403).json({ message: "Access denied" });
  }

  if (!isMailConfigured()) {
    return res.status(400).json({
      message:
        "SMTP is not configured. Set SMTP_* vars or HR_GMAIL_USER and HR_GMAIL_APP_PASSWORD (optionally SMTP_FROM).",
    });
  }

  try {
    const reminderType = req.body?.type === "overdue" ? "overdue" : "upcoming";
    const datePredicate =
      reminderType === "overdue"
        ? `t.due_date >= CURRENT_DATE - INTERVAL '2 day'
        AND t.due_date < CURRENT_DATE - INTERVAL '1 day'`
        : `t.due_date >= CURRENT_DATE + INTERVAL '2 day'
        AND t.due_date < CURRENT_DATE + INTERVAL '3 day'`;
    const reminderText =
      reminderType === "overdue" ? "overdue by 2 days" : "due in 2 days";

    const result = await pool.query(
      `SELECT
        e.emp_id,
        e.name AS employee_name,
        e.email AS employee_email,
        t.task_id,
        t.task_key,
        t.title,
        TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date
      FROM project_tasks t
      JOIN employee e
        ON e.emp_id = t.assignee_emp_id
      WHERE t.hr_id = $1
        AND t.assignee_emp_id IS NOT NULL
        AND t.status <> 'done'
        AND ${datePredicate}
      ORDER BY e.emp_id, t.due_date, t.task_key`,
      [req.user.hr_id],
    );

    if (!result.rows.length) {
      const emptyMessage =
        reminderType === "overdue"
          ? "No assigned tasks overdue by 2 days."
          : "No assigned tasks due in 2 days.";
      return res.status(200).json({
        message: emptyMessage,
        employeesNotified: 0,
        tasksIncluded: 0,
      });
    }

    const tasksByEmployee = new Map();
    for (const row of result.rows) {
      if (!tasksByEmployee.has(row.emp_id)) {
        tasksByEmployee.set(row.emp_id, {
          email: row.employee_email,
          name: row.employee_name || "Employee",
          tasks: [],
        });
      }
      tasksByEmployee.get(row.emp_id).tasks.push({
        task_id: row.task_id,
        task_key: row.task_key,
        title: row.title,
        due_date: row.due_date,
      });
    }

    let employeesNotified = 0;

    for (const employee of tasksByEmployee.values()) {
      if (!employee.email) {
        continue;
      }

      await sendTaskDueReminderEmail({
        to: employee.email,
        employeeName: employee.name,
        tasks: employee.tasks,
        reminderText,
      });

      employeesNotified += 1;
    }

    return res.status(200).json({
      message: "Due-date reminder emails sent.",
      type: reminderType,
      employeesNotified,
      tasksIncluded: result.rows.length,
    });
  } catch (error) {
    console.error("Error in sendDueSoonTaskReminders:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
