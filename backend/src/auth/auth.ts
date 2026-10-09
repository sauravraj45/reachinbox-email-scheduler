import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db/pool';

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const AUTH_COOKIE = 'rb_session';
const SESSION_TTL_S = 7 * 24 * 3600;

export const signSession = (userId: string) =>
  jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: SESSION_TTL_S });

export function setSessionCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.BACKEND_URL.startsWith('https'),
    maxAge: SESSION_TTL_S * 1000,
    path: '/',
  });
}

/** Short-lived signed token used as OAuth `state` (CSRF protection + carries the user id). */
export const signState = (payload: object) => jwt.sign(payload, config.JWT_SECRET, { expiresIn: '10m' });
export const verifyState = <T>(state: string) => jwt.verify(state, config.JWT_SECRET) as T;

export async function upsertGoogleUser(p: { googleId: string; email: string; name: string; avatar: string | null }) {
  const { rows } = await pool.query<User>(
    `INSERT INTO users (google_id, email, name, avatar_url) VALUES ($1,$2,$3,$4)
     ON CONFLICT (google_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
     RETURNING *`,
    [p.googleId, p.email, p.name, p.avatar],
  );
  return rows[0];
}

/** Accepts the session cookie (browser) or `Authorization: Bearer <jwt>` (Postman/API clients). */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.[AUTH_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { sub } = jwt.verify(token, config.JWT_SECRET) as { sub: string };
    const { rows } = await pool.query<User>('SELECT * FROM users WHERE id = $1', [sub]);
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }
}
