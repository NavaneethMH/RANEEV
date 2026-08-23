/* RANEEV credentials — salted scrypt password storage and signed, HttpOnly credential sessions. */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";

export const RANEEV_SESSION_COOKIE = "raneev_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function validatePassword(password: string) {
  if (password.length < 12) return "Password must contain at least 12 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must include upper-case, lower-case, and numeric characters.";
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const validationError = validatePassword(password);
  if (validationError) throw new Error(validationError);
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return ["scrypt", "v1", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, version, n, r, p, saltEncoded, keyEncoded] = storedHash.split("$");
  if (algorithm !== "scrypt" || version !== "v1" || !saltEncoded || !keyEncoded || Number(n) !== SCRYPT_N || Number(r) !== SCRYPT_R || Number(p) !== SCRYPT_P) return false;
  try {
    const expected = Buffer.from(keyEncoded, "base64url");
    const actual = await deriveKey(password, Buffer.from(saltEncoded, "base64url"));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function createCredentialSession(user: User): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: user.role, sessionVersion: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuer("raneev")
    .setAudience("raneev-web")
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(getSessionSecret());
}

export async function readCredentialSession(req: Request): Promise<{ userId: number; sessionVersion: number } | null> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const token = cookies[RANEEV_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), { algorithms: ["HS256"], issuer: "raneev", audience: "raneev-web" });
    const userId = Number(payload.sub);
    const sessionVersion = Number(payload.sessionVersion);
    return Number.isSafeInteger(userId) && userId > 0 && Number.isSafeInteger(sessionVersion) ? { userId, sessionVersion } : null;
  } catch {
    return null;
  }
}

export async function establishCredentialSession(req: Request, res: Response, user: User) {
  const token = await createCredentialSession(user);
  res.cookie(RANEEV_SESSION_COOKIE, token, { ...getSessionCookieOptions(req), maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearCredentialSession(req: Request, res: Response) {
  res.clearCookie(RANEEV_SESSION_COOKIE, getSessionCookieOptions(req));
}
