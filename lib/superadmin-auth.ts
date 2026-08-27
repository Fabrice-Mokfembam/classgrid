import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { SUPERADMIN_EMAIL } from "@/lib/superadmin-config";

const COOKIE_NAME = "classgrid-superadmin";

function sessionSecret() {
  return process.env.SUPERADMIN_SESSION_SECRET || process.env.SUPERADMIN_PASSWORD || "";
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function isValidSuperadminLogin(email: string, password: string) {
  const expectedPassword = process.env.SUPERADMIN_PASSWORD;
  return Boolean(expectedPassword) && email.trim().toLowerCase() === SUPERADMIN_EMAIL.toLowerCase() && password === expectedPassword;
}

export async function createSuperadminSession() {
  const issuedAt = Date.now();
  const value = `${SUPERADMIN_EMAIL}|${issuedAt}`;
  const token = `${value}|${sign(value)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/superadmin",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSuperadminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/superadmin",
    maxAge: 0,
  });
}

export async function getSuperadminSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split("|");
  if (parts.length !== 3) return null;

  const [email, issuedAt, signature] = parts;
  if (email.toLowerCase() !== SUPERADMIN_EMAIL.toLowerCase()) return null;

  const value = `${email}|${issuedAt}`;
  const expected = sign(value);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) return null;

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age > 1000 * 60 * 60 * 8) return null;
  return { email };
}
