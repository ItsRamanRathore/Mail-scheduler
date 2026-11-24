import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

interface SessionPayload {
  sub: 'admin';
  exp: number;
}

interface LoginAttempts {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
}

const loginAttempts = new Map<string, LoginAttempts>();

function authIsConfigured() {
  return config.auth.password.length >= 16 && config.auth.sessionSecret.length >= 32;
}

function issueSessionToken() {
  const payload: SessionPayload = {
    sub: 'admin',
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', config.auth.sessionSecret)
    .update(encodedPayload)
    .digest('base64url');

  return { token: `${encodedPayload}.${signature}`, expiresAt: payload.exp };
}

function isValidSessionToken(token: string) {
  const [encodedPayload, providedSignature, extra] = token.split('.');
  if (!encodedPayload || !providedSignature || extra !== undefined) return false;

  const expectedSignature = createHmac('sha256', config.auth.sessionSecret)
    .update(encodedPayload)
    .digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(providedSignature, 'base64url');
  } catch {
    return false;
  }
  if (actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as SessionPayload;
    return payload.sub === 'admin' && Number.isFinite(payload.exp) && payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

function passwordMatches(password: string) {
  const supplied = createHash('sha256').update(password).digest();
  const expected = createHash('sha256').update(config.auth.password).digest();
  return timingSafeEqual(supplied, expected);
}

export function loginWithPassword(req: Request, res: Response) {
  if (!authIsConfigured()) {
    res.status(503).json({ success: false, error: 'Password sign-in is not configured.' });
    return;
  }

  const now = Date.now();
  const ip = req.ip || 'unknown';
  const attempts = loginAttempts.get(ip);
  if (attempts?.blockedUntil && attempts.blockedUntil > now) {
    res.status(429).json({ success: false, error: 'Too many sign-in attempts. Try again later.' });
    return;
  }

  const current = !attempts || now - attempts.windowStartedAt >= LOGIN_WINDOW_MS
    ? { count: 0, windowStartedAt: now, blockedUntil: 0 }
    : attempts;
  const password = req.body?.password;

  if (typeof password === 'string' && passwordMatches(password)) {
    loginAttempts.delete(ip);
    res.json({ success: true, ...issueSessionToken() });
    return;
  }

  current.count += 1;
  if (current.count >= MAX_LOGIN_ATTEMPTS) {
    current.blockedUntil = now + LOGIN_WINDOW_MS;
  }
  loginAttempts.set(ip, current);
  res.status(401).json({ success: false, error: 'The password is incorrect.' });
}

export function verifySession(req: Request, res: Response, next: NextFunction) {
  if (!authIsConfigured()) {
    res.status(503).json({ success: false, error: 'Password sign-in is not configured.' });
    return;
  }

  const match = (req.header('authorization') || '').match(/^Bearer (.+)$/i);
  if (!match || !isValidSessionToken(match[1])) {
    res.status(401).json({ success: false, error: 'Sign in is required.' });
    return;
  }

  next();
}
