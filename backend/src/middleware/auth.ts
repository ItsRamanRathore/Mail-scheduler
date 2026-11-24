import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { db } from '../db';

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

interface SessionPayload {
  sub: 'admin';
  email: string;
  name: string;
  picture: string;
  exp: number;
}

interface LoginAttempts {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
}

const loginAttempts = new Map<string, LoginAttempts>();

function authIsConfigured(): boolean {
  return config.auth.sessionSecret.length >= 32 &&
    (config.publicDemo || config.auth.password.length >= 16);
}

function issueSessionToken(email: string, name: string) {
  const payload: SessionPayload = {
    sub: 'admin',
    email,
    name,
    picture: '',
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
  if (!encodedPayload || !providedSignature || extra !== undefined) return null;

  const expectedSignature = createHmac('sha256', config.auth.sessionSecret)
    .update(encodedPayload)
    .digest();
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(providedSignature, 'base64url');
  } catch {
    return null;
  }
  if (actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as SessionPayload;
    return payload.sub === 'admin' &&
      typeof payload.email === 'string' &&
      typeof payload.name === 'string' &&
      typeof payload.picture === 'string' &&
      Number.isFinite(payload.exp) &&
      payload.exp > Date.now() / 1000
      ? payload
      : null;
  } catch {
    return null;
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
  const profileEmail = req.body?.profileEmail;
  const profile = typeof profileEmail === 'string'
    ? db.prepare('SELECT email, display_name FROM senders WHERE email = ?').get(profileEmail) as
      { email: string; display_name: string } | undefined
    : undefined;

  const validCredentials = config.publicDemo
    ? typeof profileEmail === 'string' && !password
    : typeof password === 'string' && passwordMatches(password);

  if (validCredentials && profile) {
    loginAttempts.delete(ip);
    const user = {
      name: profile.display_name,
      email: profile.email,
      avatar: '',
      tenantId: profile.email,
    };
    res.json({
      success: true,
      ...issueSessionToken(user.email, user.name),
      user,
    });
    return;
  }

  current.count += 1;
  if (current.count >= MAX_LOGIN_ATTEMPTS) {
    current.blockedUntil = now + LOGIN_WINDOW_MS;
  }
  loginAttempts.set(ip, current);
  res.status(401).json({
    success: false,
    error: config.publicDemo
      ? 'Select one of the configured sender profiles.'
      : 'The password or selected profile is incorrect.',
  });
}

export function verifySession(req: Request, res: Response, next: NextFunction) {
  if (!authIsConfigured()) {
    res.status(503).json({ success: false, error: 'Password sign-in is not configured.' });
    return;
  }

  const match = (req.header('authorization') || '').match(/^Bearer (.+)$/i);
  const payload = match ? isValidSessionToken(match[1]) : null;
  if (!payload) {
    res.status(401).json({ success: false, error: 'Sign in is required.' });
    return;
  }

  res.locals.user = {
    name: payload.name,
    email: payload.email,
    avatar: payload.picture,
    tenantId: payload.email,
  };
  next();
}
