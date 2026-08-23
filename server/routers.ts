/* RANEEV tRPC contract — credential endpoints and protected role/ownership procedures with safe public user projections. */
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { AppRole, User } from "../drizzle/schema";
import { appRoles, emergencyTypes } from "../drizzle/schema";
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
const incidentInput = z.object({ emergencyType: z.enum(emergencyTypes), locationLabel: z.string().trim().min(3).max(255), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracyMeters: z.number().int().min(0).max(100_000), description: z.string().trim().max(500).optional() });

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
    create: protectedProcedure.input(incidentInput).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "citizen") throw new TRPCError({ code: "FORBIDDEN", message: "Only citizen accounts can create an emergency incident." });
      return db.createIncident({ publicId: `ERN-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`, createdByUserId: ctx.user.id, emergencyType: input.emergencyType, locationLabel: input.locationLabel, latitudeE6: Math.round(input.latitude * 1_000_000), longitudeE6: Math.round(input.longitude * 1_000_000), accuracyMeters: input.accuracyMeters, description: input.description || null });
    }),
    active: roleProcedure(["citizen"]).query(({ ctx }) => db.getActiveIncidentForCitizen(ctx.user.id)),
    mine: protectedProcedure.query(({ ctx }) => db.listIncidentsVisibleTo(ctx.user)),
    byPublicId: protectedProcedure.input(z.object({ publicId: z.string().min(3).max(40) })).query(async ({ ctx, input }) => {
      const incident = await db.getIncidentWithResponder(input.publicId);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." });
      if (!canReadIncident(ctx.user, incident)) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to access this incident." });
      return incident;
    }),
    timeline: protectedProcedure.input(z.object({ publicId: z.string().min(3).max(40) })).query(async ({ ctx, input }) => {
      const incident = await db.getIncidentByPublicId(input.publicId);
      if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." });
      if (!canReadIncident(ctx.user, incident)) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to access this incident." });
      return db.listIncidentEvents(incident.id);
    }),
    resolve: roleProcedure(["citizen"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { const incident = await db.resolveIncident(input.publicId, ctx.user.id); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Incident could not be resolved." }); }
    }),
    simulateProgress: roleProcedure(["citizen"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { const incident = await db.advanceDevelopmentSimulation(input.publicId, ctx.user.id); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Simulation could not progress." }); }
    }),
  }),
  volunteer: router({
    eligibleIncidents: roleProcedure(["volunteer"]).query(({ ctx }) => db.listIncidentsVisibleTo(ctx.user)),
    accept: roleProcedure(["volunteer"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { const incident = await db.acceptIncident(input.publicId, ctx.user.id); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "Incident is not available." }); }
    }),
    startRoute: roleProcedure(["volunteer"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { const incident = await db.volunteerAdvance(input.publicId, ctx.user.id, "en_route"); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Response could not start." }); }
    }),
    arrive: roleProcedure(["volunteer"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { const incident = await db.volunteerAdvance(input.publicId, ctx.user.id, "arrived"); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Arrival could not be confirmed." }); }
    }),
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
