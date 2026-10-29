import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const pathwayPort = 39876;
process.env.PATHWAY_URL = `http://127.0.0.1:${pathwayPort}`;
process.env.PATHWAY_TICKET_URL = `http://127.0.0.1:${pathwayPort}`;
process.env.PATHWAY_DASHBOARD_URL = `http://127.0.0.1:${pathwayPort}`;

const { app } = await import("../src/index.js");
const { pool } = await import("../src/lib/db.js");
const { ensureWorkflowSchema } = await import("../src/lib/schema.js");

const id = () => crypto.randomUUID();
const suffix = crypto.randomBytes(8).toString("hex");
const fixtures = {
  hrA: id(), hrB: id(), clientA: id(), clientB: id(), empA: id(), empB: id(),
  uploadA: id(), uploadB: id(), taskA: id(), taskB: id(), threadA: id(), threadB: id(),
};
const fileA = path.resolve("uploads", "clients", fixtures.clientA, "hrs", fixtures.hrA, fixtures.uploadA, "rbac-a.pdf");
const fileB = path.resolve("uploads", "clients", fixtures.clientB, "hrs", fixtures.hrB, fixtures.uploadB, "rbac-b.pdf");
const pathwayRequests = [];
let newlyUploadedFile = null;
let apiServer;
let pathwayServer;
let apiBase;

const insertUpload = async ({ uploadId, clientId, hrId, filePath, name }) => {
  await pool.query(
    `INSERT INTO client_project_uploads
      (upload_id, client_id, hr_id, original_name, stored_name, file_path, project_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [uploadId, clientId, hrId, `${name}.pdf`, `${name}.pdf`, filePath, name],
  );
};

const cookieFor = (userId) =>
  `jwt=${jwt.sign({ userid: userId }, process.env.JWT_SECRET, { expiresIn: "5m" })}`;

const api = async (route, userId, options = {}) => {
  const response = await fetch(`${apiBase}${route}`, {
    ...options,
    headers: {
      Cookie: cookieFor(userId),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  return response;
};

before(async () => {
  assert.ok(process.env.JWT_SECRET, "backend JWT_SECRET must be configured");
  await ensureWorkflowSchema();
  await pool.query(
    `INSERT INTO hr (hr_id, name, phone, email, password_hash, company_name, logo)
     VALUES ($1, 'RBAC HR A', '000', $2, 'x', 'RBAC Company A', 'logo-a'),
            ($3, 'RBAC HR B', '000', $4, 'x', 'RBAC Company B', 'logo-b')`,
    [fixtures.hrA, `rbac-a-${suffix}@example.invalid`, fixtures.hrB, `rbac-b-${suffix}@example.invalid`],
  );
  await pool.query(
    `INSERT INTO client (client_id, name, phone, email, password_hash, company_name)
     VALUES ($1, 'RBAC Client A', '000', $2, 'x', 'RBAC Client Company A'),
            ($3, 'RBAC Client B', '000', $4, 'x', 'RBAC Client Company B')`,
    [fixtures.clientA, `rbac-ca-${suffix}@example.invalid`, fixtures.clientB, `rbac-cb-${suffix}@example.invalid`],
  );
  await pool.query(
    `INSERT INTO employee (emp_id, hr_id, name, phone, email, password_hash, role)
     VALUES ($1, $2, 'RBAC Employee A', '000', $3, 'x', 'Engineer'),
            ($4, $5, 'RBAC Employee B', '000', $6, 'x', 'Engineer')`,
    [fixtures.empA, fixtures.hrA, `rbac-ea-${suffix}@example.invalid`, fixtures.empB, fixtures.hrB, `rbac-eb-${suffix}@example.invalid`],
  );
  await pool.query(
    `INSERT INTO client_hr_connections (client_id, hr_id, status)
     VALUES ($1, $2, 'connected'), ($3, $4, 'connected')`,
    [fixtures.clientA, fixtures.hrA, fixtures.clientB, fixtures.hrB],
  );

  fs.mkdirSync(path.dirname(fileA), { recursive: true });
  fs.mkdirSync(path.dirname(fileB), { recursive: true });
  fs.writeFileSync(fileA, "company A test document");
  fs.writeFileSync(fileB, "company B test document");
  await insertUpload({ uploadId: fixtures.uploadA, clientId: fixtures.clientA, hrId: fixtures.hrA, filePath: fileA, name: "rbac-a" });
  await insertUpload({ uploadId: fixtures.uploadB, clientId: fixtures.clientB, hrId: fixtures.hrB, filePath: fileB, name: "rbac-b" });

  await pool.query(
    `INSERT INTO project_tasks
      (task_id, upload_id, client_id, hr_id, assignee_emp_id, task_key, title, difficulty, field, confidence_flag)
     VALUES ($1, $2, $3, $4, $5, $6, 'RBAC task A', 'Easy', 'Engineering', 'High'),
            ($7, $8, $9, $10, $11, $12, 'RBAC task B', 'Easy', 'Engineering', 'High')`,
    [fixtures.taskA, fixtures.uploadA, fixtures.clientA, fixtures.hrA, fixtures.empA, `RBAC-A-${suffix}`,
      fixtures.taskB, fixtures.uploadB, fixtures.clientB, fixtures.hrB, fixtures.empB, `RBAC-B-${suffix}`],
  );
  await pool.query(
    `INSERT INTO assistant_threads (thread_id, user_role, user_id, title)
     VALUES ($1, 'client', $2, 'Company A test thread'), ($3, 'client', $4, 'Company B test thread')`,
    [fixtures.threadA, fixtures.clientA, fixtures.threadB, fixtures.clientB],
  );
  await pool.query(
    `INSERT INTO assistant_questions
      (thread_id, user_role, user_id, query, response, evidence, context_docs, status)
     VALUES ($1, 'client', $2, 'old question', 'Company B secret', $3::jsonb, $4::jsonb, 'answered')`,
    [fixtures.threadA, fixtures.clientA, JSON.stringify([fileB]), JSON.stringify([{ path: fileB, text: "Company B secret" }])],
  );

  pathwayServer = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body || "{}");
    pathwayRequests.push(request);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      response: "RBAC scoped answer",
      context_docs: [
        { path: fileA, text: "Company A context" },
        { path: fileB, text: "Company B context" },
      ],
    }));
  });
  await new Promise((resolve) => pathwayServer.listen(pathwayPort, "127.0.0.1", resolve));

  apiServer = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => apiServer.once("listening", resolve));
  apiBase = `http://127.0.0.1:${apiServer.address().port}`;
});

after(async () => {
  apiServer?.close();
  pathwayServer?.close();
  await pool.query(`DELETE FROM assistant_threads WHERE thread_id = ANY($1::uuid[])`, [[fixtures.threadA, fixtures.threadB]]);
  await pool.query(`DELETE FROM client WHERE client_id = ANY($1::uuid[])`, [[fixtures.clientA, fixtures.clientB]]);
  await pool.query(`DELETE FROM employee WHERE emp_id = ANY($1::uuid[])`, [[fixtures.empA, fixtures.empB]]);
  await pool.query(`DELETE FROM hr WHERE hr_id = ANY($1::uuid[])`, [[fixtures.hrA, fixtures.hrB]]);
  fs.rmSync(path.dirname(fileA), { recursive: true, force: true });
  fs.rmSync(path.dirname(fileB), { recursive: true, force: true });
  if (newlyUploadedFile) fs.rmSync(path.dirname(newlyUploadedFile), { recursive: true, force: true });
  await pool.end();
});

test("clients can list and download only their own project PDFs", async () => {
  const ownList = await api("/api/v1/client/projects", fixtures.clientA);
  assert.equal(ownList.status, 200);
  assert.deepEqual((await ownList.json()).uploads.map((item) => item.upload_id), [fixtures.uploadA]);
  assert.equal((await api(`/api/v1/project-files/${fixtures.uploadA}`, fixtures.clientA)).status, 200);
  assert.equal((await api(`/api/v1/project-files/${fixtures.uploadB}`, fixtures.clientA)).status, 404);
});

test("HR can download an actively connected client PDF but not an unrelated client's PDF", async () => {
  assert.equal((await api(`/api/v1/project-files/${fixtures.uploadA}`, fixtures.hrA)).status, 200);
  assert.equal((await api(`/api/v1/project-files/${fixtures.uploadB}`, fixtures.hrA)).status, 404);
});

test("employees can download only PDFs attached to assigned tasks", async () => {
  assert.equal((await api(`/api/v1/project-files/${fixtures.uploadA}`, fixtures.empA)).status, 200);
  assert.equal((await api(`/api/v1/project-files/${fixtures.uploadB}`, fixtures.empA)).status, 404);
});

test("direct upload URLs and altered identifiers do not bypass authorization", async () => {
  assert.equal((await fetch(`${apiBase}/uploads/${path.basename(fileA)}`)).status, 404);
  assert.equal((await fetch(`${apiBase}/assistant-documents/rbac-a.pdf`)).status, 404);
  assert.equal((await api("/api/v1/project-files/not-a-real-upload", fixtures.clientA)).status, 404);
  assert.equal((await api(`/api/v1/up/${fixtures.clientB}`, fixtures.clientA)).status, 404);
});

test("assistant history and requested thread IDs remain isolated by owner", async () => {
  const ownThreads = await api("/api/v1/assistant/threads", fixtures.clientA);
  const ownHistory = await ownThreads.json();
  assert.deepEqual(ownHistory.threads.map((thread) => thread.id), [fixtures.threadA]);
  assert.equal(JSON.stringify(ownHistory).includes("Company B secret"), false);
  const foreignThread = await api("/api/v1/assistant/ask", fixtures.clientA, {
    method: "POST",
    body: JSON.stringify({ prompt: "read other conversation", threadId: fixtures.threadB }),
  });
  assert.equal(foreignThread.status, 404);
});

test("assistant uses a server-derived Pathway scope and returns only authorized citations", async () => {
  pathwayRequests.length = 0;
  const response = await api("/api/v1/assistant/ask", fixtures.clientA, {
    method: "POST",
    body: JSON.stringify({ prompt: "summarize my project", filters: "true", model: "untrusted" }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.answer, /withheld/i);
  assert.deepEqual(body.evidence, [`/api/v1/project-files/${fixtures.uploadA}`]);
  assert.equal(body.contextDocs.some((doc) => doc.text === "Company B context"), false);
  assert.equal(pathwayRequests.length, 1);
  assert.match(pathwayRequests[0].filters, new RegExp(fixtures.uploadA));
  assert.doesNotMatch(pathwayRequests[0].filters, new RegExp(fixtures.uploadB));
});

test("ticket assistant uses the same server-derived company scope", async () => {
  pathwayRequests.length = 0;
  const response = await api("/api/v1/assistant/ask", fixtures.hrA, {
    method: "POST",
    body: JSON.stringify({ prompt: "extract tickets", mode: "ticket", filters: "true" }),
  });
  assert.equal(response.status, 200);
  assert.match(pathwayRequests[0].filters, new RegExp(fixtures.uploadA));
  assert.doesNotMatch(pathwayRequests[0].filters, new RegExp(fixtures.uploadB));
});

test("dashboard assistant and summary use scoped data, not frontend-supplied task snapshots", async () => {
  pathwayRequests.length = 0;
  const assistantResponse = await api("/api/v1/assistant/ask", fixtures.clientA, {
    method: "POST",
    body: JSON.stringify({ prompt: "summarize project", mode: "dashboard" }),
  });
  assert.equal(assistantResponse.status, 200);
  assert.match(pathwayRequests[0].filters, new RegExp(fixtures.uploadA));
  assert.doesNotMatch(pathwayRequests[0].filters, new RegExp(fixtures.uploadB));

  const summaryResponse = await api("/api/v1/assistant/dashboard-summary", fixtures.clientA, {
    method: "POST",
    body: JSON.stringify({ tasks: [{ title: "Company B secret task", status: "done" }] }),
  });
  const summary = await summaryResponse.json();
  assert.equal(summaryResponse.status, 200);
  assert.equal(summary.summary.includes("Company B secret task"), false);
  assert.match(summary.summary, /0 completed and 1 remaining/);
});

test("new project PDFs are stored beneath the selected client, HR, and upload IDs", async () => {
  const form = new FormData();
  form.append("project_name", "RBAC upload test");
  form.append("overview", "Scoped upload");
  form.append("hr_id", fixtures.hrA);
  form.append("pdf", new Blob(["%PDF-1.4 test"], { type: "application/pdf" }), "new-project.pdf");
  const response = await fetch(`${apiBase}/api/v1/client/projects/upload`, {
    method: "POST",
    headers: { Cookie: cookieFor(fixtures.clientA) },
    body: form,
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  newlyUploadedFile = body.upload.file_path;
  assert.match(newlyUploadedFile, new RegExp(`/clients/${fixtures.clientA}/hrs/${fixtures.hrA}/${body.upload.upload_id}/`));
  assert.equal((await api(`/api/v1/project-files/${body.upload.upload_id}`, fixtures.hrA)).status, 200);
});

test("task listings are scoped to the active client relationship or employee assignment", async () => {
  const hrTasks = await api("/api/v1/tasks", fixtures.hrA);
  assert.deepEqual((await hrTasks.json()).tasks.map((task) => task.task_id), [fixtures.taskA]);
  const employeeTasks = await api("/api/v1/tasks", fixtures.empA);
  assert.deepEqual((await employeeTasks.json()).tasks.map((task) => task.task_id), [fixtures.taskA]);
  const clientTasks = await api("/api/v1/tasks", fixtures.clientA);
  assert.deepEqual((await clientTasks.json()).tasks.map((task) => task.task_id), [fixtures.taskA]);
});
