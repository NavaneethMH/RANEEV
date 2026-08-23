/* RANEEV procedure guards — every protected path verifies a current session and required server-side role. */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { AppRole } from "../../drizzle/schema";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login (10001)" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);
export const roleProcedure = (roles: readonly AppRole[]) => protectedProcedure.use(({ ctx, next }) => {
  if (!roles.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have required permission (10002)" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const adminProcedure = roleProcedure(["admin"]);
