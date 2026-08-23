/* RANEEV request context — resolves only a verified credential session before a protected procedure receives a user. */
import type { User } from "../../drizzle/schema";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { readCredentialSession } from "../auth/credentials";
import * as db from "../db";

export type TrpcContext = { req: CreateExpressContextOptions["req"]; res: CreateExpressContextOptions["res"]; user: User | null };

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const session = await readCredentialSession(opts.req);
  let user: User | null = null;
  if (session) {
    const candidate = await db.getUserById(session.userId);
    if (candidate && candidate.sessionVersion === session.sessionVersion && candidate.profileStatus !== "suspended") user = candidate;
  }
  return { req: opts.req, res: opts.res, user };
}
