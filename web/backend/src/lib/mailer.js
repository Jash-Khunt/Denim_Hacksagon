import nodemailer from "nodemailer";

let transporter;

const getSmtpConfig = () => {
  const user = process.env.SMTP_USER || process.env.HR_GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.HR_GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST || (user ? "smtp.gmail.com" : undefined);
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    from,
  };
};

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const config = getSmtpConfig();
  if (!config) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  return transporter;
};

export const isMailConfigured = () => Boolean(getSmtpConfig());

export const sendTaskDueReminderEmail = async ({
  to,
  employeeName,
  tasks,
  reminderText = "due in 2 days",
}) => {
  const config = getSmtpConfig();
  const smtpTransporter = getTransporter();

  if (!config || !smtpTransporter) {
    throw new Error("SMTP is not configured");
  }

  const subject = `Task reminder: ${tasks.length} ${reminderText}`;
  const listHtml = tasks
    .map(
      (task) =>
        `<li><strong>${task.task_key}</strong> - ${task.title} (Due ${task.due_date})</li>`,
    )
    .join("");

  const textLines = tasks.map(
    (task) => `- ${task.task_key}: ${task.title} (Due ${task.due_date})`,
  );

  await smtpTransporter.sendMail({
    from: config.from,
    to,
    subject,
    text: `Hi ${employeeName},\n\nThe following tasks are ${reminderText}:\n${textLines.join("\n")}\n\nPlease update progress in the task board.`,
    html: `<p>Hi ${employeeName},</p><p>The following tasks are <strong>${reminderText}</strong>:</p><ul>${listHtml}</ul><p>Please update progress in the task board.</p>`,
  });
};
