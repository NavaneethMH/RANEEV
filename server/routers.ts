/* RANEEV tRPC contract — credential endpoints and protected role/ownership procedures with safe public user projections. */
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { AppRole, User } from "../drizzle/schema";
import { appRoles } from "../drizzle/schema";
import { canChangeRole, canReadIncident } from "./auth/authorization";
import { clearCredentialSession, establishCredentialSession, hashPassword, validatePassword, verifyPassword } from "./auth/credentials";
import * as db from "./db";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, roleProcedure, router } from "./_core/trpc";

function publicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, profileStatus: user.profileStatus, createdAt: user.createdAt, updatedAt: user.updatedAt };
}

const passwordSchema = z.string().min(12).max(128);
const publicRegistrationRole = z.enum(["citizen", "volunteer"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ? publicUser(ctx.user) : null),
    register: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320), phone: z.string().trim().max(32).optional(), password: passwordSchema, role: publicRegistrationRole.default("citizen") })).mutation(async ({ ctx, input }) => {
      const validationError = validatePassword(input.password);
      if (validationError) throw new TRPCError({ code: "BAD_REQUEST", message: validationError });
      const existing = await db.getUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An account already exists for this email." });
      const user = await db.createCredentialUser({
        openId: `credential:${randomUUID()}`,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        profileStatus: input.role === "volunteer" ? "pending_verification" : "active",
      });
      await establishCredentialSession(ctx.req, ctx.res, user);
      return publicUser(user);
    }),
    login: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const user = await db.getUserByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash)) || user.profileStatus === "suspended") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }
      const refreshed = await db.markSignedIn(user.id);
      if (!refreshed) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to restore this account." });
      await establishCredentialSession(ctx.req, ctx.res, refreshed);
      return publicUser(refreshed);
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearCredentialSession(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  profile: router({
    get: protectedProcedure.query(({ ctx }) => publicUser(ctx.user)),
    update: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().max(32).nullable() })).mutation(async ({ ctx, input }) => {
      const updated = await db.updateProfile(ctx.user.id, input);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });
      return publicUser(updated);
    }),
  }),
  incidents: router({
    create: protectedProcedure.input(z.object({})).mutation(async ({ ctx }) => {
      if (ctx.user.role !== "citizen") throw new TRPCError({ code: "FORBIDDEN", message: "Only citizen accounts can create an emergency incident." });
      return db.createIncident({ publicId: `ERN-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`, createdByUserId: ctx.user.id });
    }),
    mine: protectedProcedure.query(({ ctx }) => db.listIncidentsVisibleTo(ctx.user)),
    byPublicId: protectedProcedure.input(z.object({ publicId: z.string().min(3).max(40) })).query(async ({ ctx, input }) => {
      const incident = await db.getIncidentByPublicId(input.publicId);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." });
      if (!canReadIncident(ctx.user, incident)) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to access this incident." });
      return incident;
    }),
  }),
  volunteer: router({
    eligibleIncidents: roleProcedure(["volunteer"]).query(({ ctx }) => db.listIncidentsVisibleTo(ctx.user)),
  }),
  coordinator: router({
    activeIncidents: roleProcedure(["coordinator", "admin"]).query(({ ctx }) => db.listIncidentsVisibleTo(ctx.user)),
  }),
  admin: router({
    users: adminProcedure.query(() => db.listUsersForAdmin()),
    updateRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: z.enum(appRoles) })).mutation(async ({ ctx, input }) => {
      if (!canChangeRole(ctx.user, input.userId)) throw new TRPCError({ code: "FORBIDDEN", message: "Administrators cannot change their own role in an active session." });
      const updated = await db.updateUserRole(input.userId, input.role as AppRole);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      return publicUser(updated);
    }),
  }),
});

export type AppRouter = typeof appRouter;
