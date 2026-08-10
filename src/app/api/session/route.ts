import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  getDemoAuthConfigStatus,
  verifyPassword,
} from "@/lib/auth/session";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Logs in: checks the password against DEMO_PASSWORD and sets the HTTP-only session cookie. */
export async function POST(request: Request) {
  const status = getDemoAuthConfigStatus();
  if (!status.configured) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!verifyPassword(body.password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, cookieOptions(SESSION_MAX_AGE_SECONDS));
  return response;
}

/** Logs out: clears the session cookie ("Lock demo"). */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", cookieOptions(0));
  return response;
}
