import { randomBytes, timingSafeEqual } from 'node:crypto';

const sessions = new Map();

function ownerPassword() {
  const fromEnv = process.env.OWNER_PASSWORD;
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'admin';
}

export function usingDefaultPassword() {
  return !(process.env.OWNER_PASSWORD && process.env.OWNER_PASSWORD.length > 0);
}

export function checkPassword(input) {
  const expected = Buffer.from(ownerPassword());
  const given = Buffer.from(String(input ?? ''));
  if (given.length !== expected.length) {
    timingSafeEqual(expected, Buffer.alloc(expected.length));
    return false;
  }
  return timingSafeEqual(expected, given);
}

export function createSession() {
  const token = randomBytes(24).toString('hex');
  sessions.set(token, Date.now());
  return token;
}

export function validSession(token) {
  return typeof token === 'string' && sessions.has(token);
}

export function destroySession(token) {
  if (token) sessions.delete(token);
}
