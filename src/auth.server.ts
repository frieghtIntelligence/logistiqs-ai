// Server-only auth implementation — imported dynamically by auth.ts handlers.
// Do NOT import this file from client code.
import { getRequest, getCookie, deleteCookie } from "@tanstack/react-start/server";
import { getDb, type UserRow } from "~/db";

const COOKIE_NAME = "logistiqs_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function setSessionCookie(userId: string): string {
  const db = getDb();
  const token = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  db.prepare("INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)").run(
    sessionId, userId, token, expiresAt,
  );
  return token;
}

function clearSessionToken(token: string): void {
  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getSessionUser(): { id: string; email: string; name: string; role: "shipper" | "carrier"; company_name: string } | null {
  try {
    const token = getCookie(COOKIE_NAME);
    if (!token) return null;

    const row = getDb().prepare(`
      SELECT u.id, u.email, u.name, u.role, u.company_name
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token) as Pick<UserRow, "id" | "email" | "name" | "role" | "company_name"> | undefined;

    return row ?? null;
  } catch {
    return null;
  }
}

export function loginImpl(data: { email: string; password: string }) {
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(data.email) as UserRow | undefined;
  if (!user) return { success: false, error: "Invalid email or password." } as const;

  let valid = false;
  try { valid = (Bun as any).password.verifySync(data.password, user.password_hash); } catch { /* noop */ }
  if (!valid) return { success: false, error: "Invalid email or password." } as const;

  const token = setSessionCookie(user.id);
  return {
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, company_name: user.company_name },
  } as const;
}

export function signupImpl(data: { email: string; password: string; name: string; role: "shipper" | "carrier"; company_name: string }) {
  const db = getDb();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(data.email)) {
    return { success: false, error: "An account with this email already exists." } as const;
  }

  let passwordHash: string;
  try { passwordHash = (Bun as any).password.hashSync(data.password); } catch { passwordHash = data.password; }

  const userId = `u-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, company_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(userId, data.email, passwordHash, data.name, data.role, data.company_name, now);

  const token = setSessionCookie(userId);
  return {
    success: true,
    token,
    user: { id: userId, email: data.email, name: data.name, role: data.role, company_name: data.company_name },
  } as const;
}

export function logoutImpl() {
  try {
    const token = getCookie(COOKIE_NAME);
    if (token) clearSessionToken(token);
  } catch { /* ignore */ }
  return { success: true };
}
