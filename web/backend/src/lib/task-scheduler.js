import cron from "node-cron";
import { pool } from "./db.js";
import { sendTaskDueReminderEmail } from "./mailer.js";

let schedulerActive = false;

const sendRemindersForType = async (reminderType) => {
  try {
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
      WHERE t.assignee_emp_id IS NOT NULL
        AND t.status <> 'done'
        AND ${datePredicate}
      ORDER BY e.emp_id, t.due_date, t.task_key`,
    );

    if (!result.rows.length) {
      console.log(
        `[Task Scheduler] No tasks ${reminderType} for reminder notification`,
      );
      return { notified: 0, tasks: 0 };
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

      try {
        await sendTaskDueReminderEmail({
          to: employee.email,
          employeeName: employee.name,
          tasks: employee.tasks,
          reminderText,
        });
        employeesNotified += 1;
      } catch (emailError) {
        console.error(
          `[Task Scheduler] Error sending email to ${employee.email}:`,
          emailError.message,
        );
      }
    }

    console.log(
      `[Task Scheduler] Sent ${reminderType} reminders to ${employeesNotified} employees (${result.rows.length} tasks)`,
    );
    return { notified: employeesNotified, tasks: result.rows.length };
  } catch (error) {
    console.error(
      `[Task Scheduler] Error processing ${reminderType} reminders:`,
      error.message,
    );
    return { notified: 0, tasks: 0, error: error.message };
  }
};

export const initializeTaskScheduler = () => {
  if (schedulerActive) {
    console.log("[Task Scheduler] Already initialized");
    return;
  }

  // Run daily at 8 AM
  cron.schedule("0 8 * * *", async () => {
    console.log("[Task Scheduler] Running daily reminder check at 8 AM");
    await sendRemindersForType("upcoming");
    await sendRemindersForType("overdue");
  });

  schedulerActive = true;
  console.log("[Task Scheduler] Initialized - will run daily at 8 AM");
};

export const sendRemindersForUpdatedTask = async (oldDueDate, newDueDate) => {
  if (!oldDueDate || !newDueDate) {
    return;
  }

  const oldDate = new Date(oldDueDate);
  const newDate = new Date(newDueDate);

  if (oldDate.toDateString() === newDate.toDateString()) {
    return;
  }

  console.log(
    `[Task Scheduler] Task due date changed from ${oldDate.toDateString()} to ${newDate.toDateString()}, checking reminders...`,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const newDateCalc = new Date(newDate);
  newDateCalc.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.floor(
    (newDateCalc - today) / (1000 * 60 * 60 * 24),
  );

  // If now within the 2-day window, send reminders
  if (daysUntilDue === 2) {
    console.log(
      "[Task Scheduler] Task now in 2-day window, sending upcoming reminders",
    );
    await sendRemindersForType("upcoming");
  } else if (daysUntilDue === -1) {
    console.log(
      "[Task Scheduler] Task now in overdue window, sending overdue reminders",
    );
    await sendRemindersForType("overdue");
  }
};
