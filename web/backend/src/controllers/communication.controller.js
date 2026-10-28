import { pool } from "../lib/db.js";
import { createSign } from "node:crypto";

const base64Url = (value) => Buffer.from(value).toString("base64url");
const createJaasToken = ({ appId, apiKeyId, privateKey, user, roomId }) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid: `${appId}/${apiKeyId.replace(`${appId}/`, "")}`, typ: "JWT" };
  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: appId,
    room: roomId,
    exp: now + 600,
    nbf: now - 5,
    context: {
      user: { id: user.id, name: user.name || user.email, email: user.email, moderator: "true" },
      features: { livestreaming: false, recording: false, transcription: false, "outbound-call": false },
      room: { regex: false },
    },
  };
  const content = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(content);
  signer.end();
  const key = privateKey.replace(/\\n/g, "\n");
  return `${content}.${signer.sign(key, "base64url")}`;
};

const identity = (user) => user.role === "hr"
  ? { role: "hr", id: user.hr_id }
  : { role: "client", id: user.client_id };

const pairAccess = async (user, clientId, hrId) => {
  const me = identity(user);
  if (!me.id || (me.role === "hr" && me.id !== hrId) || (me.role === "client" && me.id !== clientId)) return false;
  const result = await pool.query(
    `SELECT 1 FROM client_hr_connections WHERE client_id = $1 AND hr_id = $2 AND status = 'connected'`,
    [clientId, hrId],
  );
  return result.rowCount > 0;
};

export const getPartners = async (req, res) => {
  try {
    const me = identity(req.user);
    const query = me.role === "hr"
      ? `SELECT c.client_id, c.name, c.company_name, c.profile_picture, conn.hr_id, conn.updated_at,
           (SELECT body FROM hr_client_messages m WHERE m.client_id = c.client_id AND m.hr_id = conn.hr_id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
           (SELECT created_at FROM hr_client_messages m WHERE m.client_id = c.client_id AND m.hr_id = conn.hr_id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
           (SELECT count(*)::int FROM hr_client_messages m WHERE m.client_id = c.client_id AND m.hr_id = conn.hr_id AND m.sender_role = 'client' AND m.read_at IS NULL) AS unread_count
         FROM client_hr_connections conn JOIN client c USING (client_id)
         WHERE conn.hr_id = $1 AND conn.status = 'connected' ORDER BY c.name`
      : `SELECT h.hr_id, h.name, h.company_name, h.profile_picture, conn.client_id, conn.updated_at,
           (SELECT body FROM hr_client_messages m WHERE m.client_id = conn.client_id AND m.hr_id = h.hr_id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
           (SELECT created_at FROM hr_client_messages m WHERE m.client_id = conn.client_id AND m.hr_id = h.hr_id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
           (SELECT count(*)::int FROM hr_client_messages m WHERE m.client_id = conn.client_id AND m.hr_id = h.hr_id AND m.sender_role = 'hr' AND m.read_at IS NULL) AS unread_count
         FROM client_hr_connections conn JOIN hr h USING (hr_id)
         WHERE conn.client_id = $1 AND conn.status = 'connected' ORDER BY h.name`;
    const { rows } = await pool.query(query, [me.id]);
    res.json({ partners: rows });
  } catch (error) {
    console.error("getPartners:", error.message);
    res.status(500).json({ message: "Could not load contacts" });
  }
};

export const getMessages = async (req, res) => {
  const { clientId, hrId } = req.params;
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  const cursor = typeof req.query.before === "string" ? req.query.before.split("|") : [];
  const beforeCreatedAt = cursor.length === 2 ? cursor[0] : null;
  const beforeMessageId = cursor.length === 2 ? cursor[1] : null;
  if (req.query.before && (cursor.length !== 2 || Number.isNaN(new Date(beforeCreatedAt).getTime()) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(beforeMessageId))) {
    return res.status(400).json({ message: "Invalid message cursor" });
  }
  try {
    if (!(await pairAccess(req.user, clientId, hrId))) return res.status(403).json({ message: "An approved HR connection is required" });
    const me = identity(req.user);
    await pool.query(
      `UPDATE hr_client_messages SET read_at = now() WHERE client_id = $1 AND hr_id = $2 AND sender_role <> $3 AND read_at IS NULL`,
      [clientId, hrId, me.role],
    );
    const { rows } = await pool.query(
      `SELECT message_id, sender_role, sender_id, body, read_at, created_at
       FROM hr_client_messages
       WHERE client_id = $1 AND hr_id = $2
         AND ($3::timestamp IS NULL OR (created_at, message_id) < ($3::timestamp, $4::uuid))
       ORDER BY created_at DESC, message_id DESC LIMIT $5`,
      [clientId, hrId, beforeCreatedAt, beforeMessageId, limit],
    );
    res.json({ messages: rows.reverse(), has_more: rows.length === limit });
  } catch (error) {
    console.error("getMessages:", error.message);
    res.status(500).json({ message: "Could not load messages" });
  }
};

export const sendMessage = async (req, res) => {
  const { clientId, hrId } = req.params;
  const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
  try {
    if (!(await pairAccess(req.user, clientId, hrId))) return res.status(403).json({ message: "An approved HR connection is required" });
    if (!body || body.length > 5000) return res.status(400).json({ message: "Message must be between 1 and 5000 characters" });
    const me = identity(req.user);
    const { rows } = await pool.query(
      `INSERT INTO hr_client_messages (client_id, hr_id, sender_role, sender_id, body) VALUES ($1, $2, $3, $4, $5) RETURNING message_id, sender_role, sender_id, body, read_at, created_at`,
      [clientId, hrId, me.role, me.id, body],
    );
    res.status(201).json({ message: rows[0] });
  } catch (error) {
    console.error("sendMessage:", error.message);
    res.status(500).json({ message: "Could not send message" });
  }
};

export const getMeetings = async (req, res) => {
  const { clientId, hrId } = req.params;
  try {
    if (!(await pairAccess(req.user, clientId, hrId))) return res.status(403).json({ message: "An approved HR connection is required" });
    const { rows } = await pool.query(
      `SELECT m.*, h.name AS hr_name, c.name AS client_name FROM hr_client_meetings m JOIN hr h USING (hr_id) JOIN client c USING (client_id) WHERE m.client_id = $1 AND m.hr_id = $2 ORDER BY m.starts_at`,
      [clientId, hrId],
    );
    res.json({ meetings: rows });
  } catch (error) {
    console.error("getMeetings:", error.message);
    res.status(500).json({ message: "Could not load meetings" });
  }
};

export const getMyMeetings = async (req, res) => {
  try {
    const me = identity(req.user);
    const ownerColumn = me.role === "hr" ? "m.hr_id" : "m.client_id";
    const { rows } = await pool.query(
      `SELECT m.*, h.name AS hr_name, c.name AS client_name
       FROM hr_client_meetings m
       JOIN hr h USING (hr_id)
       JOIN client c USING (client_id)
       WHERE ${ownerColumn} = $1
       ORDER BY m.starts_at ASC`,
      [me.id],
    );
    res.json({ meetings: rows });
  } catch (error) {
    console.error("getMyMeetings:", error.message);
    res.status(500).json({ message: "Could not load your meetings" });
  }
};

export const createMeeting = async (req, res) => {
  const { clientId, hrId } = req.params;
  const { title, starts_at, location } = req.body;
  const date = new Date(starts_at);
  if (typeof title !== "string" || !title.trim() || title.trim().length > 255 || !starts_at || Number.isNaN(date.getTime())) return res.status(400).json({ message: "A title and valid date/time are required" });
  if (date <= new Date()) return res.status(400).json({ message: "Meeting time must be in the future" });
  if (typeof location === "string" && location.length > 1000) return res.status(400).json({ message: "Meeting location or link is too long" });
  try {
    if (!(await pairAccess(req.user, clientId, hrId))) return res.status(403).json({ message: "An approved HR connection is required" });
    const me = identity(req.user);
    const { rows } = await pool.query(
      `INSERT INTO hr_client_meetings (client_id, hr_id, created_by_role, created_by_id, title, starts_at, location) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [clientId, hrId, me.role, me.id, title.trim(), date.toISOString(), typeof location === "string" ? location.trim() || null : null],
    );
    res.status(201).json({ meeting: rows[0] });
  } catch (error) {
    console.error("createMeeting:", error.message);
    res.status(500).json({ message: "Could not schedule meeting" });
  }
};

export const updateMeeting = async (req, res) => {
  const { meetingId } = req.params;
  const { title, starts_at, location, status } = req.body;
  try {
    const found = await pool.query(`SELECT * FROM hr_client_meetings WHERE meeting_id = $1`, [meetingId]);
    const meeting = found.rows[0];
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (!(await pairAccess(req.user, meeting.client_id, meeting.hr_id))) return res.status(403).json({ message: "An approved HR connection is required" });
    if (status !== undefined && !["scheduled", "cancelled"].includes(status)) return res.status(400).json({ message: "Invalid meeting status" });
    if (title !== undefined && (typeof title !== "string" || !title.trim() || title.trim().length > 255)) return res.status(400).json({ message: "Meeting title is invalid" });
    const date = starts_at === undefined ? null : new Date(starts_at);
    if (starts_at !== undefined && Number.isNaN(date.getTime())) return res.status(400).json({ message: "Meeting date/time is invalid" });
    if (date && date <= new Date()) return res.status(400).json({ message: "Meeting time must be in the future" });
    if (location !== undefined && (typeof location !== "string" || location.length > 1000)) return res.status(400).json({ message: "Meeting location or link is invalid" });
    const { rows } = await pool.query(
      `UPDATE hr_client_meetings SET title = COALESCE($2, title), starts_at = COALESCE($3, starts_at), location = CASE WHEN $4 THEN $5 ELSE location END, status = COALESCE($6, status), updated_at = now() WHERE meeting_id = $1 RETURNING *`,
      [meetingId, title === undefined ? null : title.trim(), date?.toISOString() || null, location !== undefined, location?.trim() || null, status || null],
    );
    res.json({ meeting: rows[0] });
  } catch (error) {
    console.error("updateMeeting:", error.message);
    res.status(500).json({ message: "Could not update meeting" });
  }
};

export const getMeetingJoinToken = async (req, res) => {
  const { meetingId } = req.params;
  const appId = process.env.JAAS_APP_ID?.trim();
  const apiKeyId = process.env.JAAS_API_KEY_ID?.trim();
  const privateKey = process.env.JAAS_PRIVATE_KEY?.trim();
  if (!appId || !apiKeyId || !privateKey) {
    return res.status(503).json({ message: "Video meetings need JAAS_APP_ID, JAAS_API_KEY_ID, and JAAS_PRIVATE_KEY configured on the backend" });
  }
  try {
    const result = await pool.query(
      `SELECT m.meeting_id, m.client_id, m.hr_id, m.room_id, m.status, m.title, m.starts_at, h.name AS hr_name, c.name AS client_name
       FROM hr_client_meetings m JOIN hr h USING (hr_id) JOIN client c USING (client_id)
       WHERE m.meeting_id = $1`,
      [meetingId],
    );
    const meeting = result.rows[0];
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (!(await pairAccess(req.user, meeting.client_id, meeting.hr_id))) return res.status(403).json({ message: "An approved HR connection is required" });
    if (meeting.status !== "scheduled") return res.status(409).json({ message: "This meeting has been cancelled" });
    const me = identity(req.user);
    const token = createJaasToken({
      appId,
      apiKeyId,
      privateKey,
      roomId: meeting.room_id,
      user: { id: me.id, name: req.user.name, email: req.user.email },
    });
    res.json({
      token,
      app_id: appId,
      room_id: meeting.room_id,
      room_name: `${appId}/${meeting.room_id}`,
      participant_names: [meeting.hr_name, meeting.client_name],
      participant_name: req.user.name || req.user.email,
      title: meeting.title,
      starts_at: meeting.starts_at,
    });
  } catch (error) {
    console.error("getMeetingJoinToken:", error.message);
    res.status(500).json({ message: "Could not authorize meeting access" });
  }
};
