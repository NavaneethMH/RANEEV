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

function requireVerifiedVolunteer(user: User) {
  if (user.role !== "volunteer" || user.profileStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "Volunteer verification is required before this response action." });
}

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
    mapSnapshot: protectedProcedure.input(z.object({ publicId: z.string().min(3).max(40) })).query(async ({ ctx, input }) => {
      const snapshot = await db.getIncidentMapSnapshot(input.publicId);
      if (!snapshot) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." });
      if (!canReadIncident(ctx.user, snapshot.incident)) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to access this incident map." });
      return snapshot;
    }),
    resolve: roleProcedure(["citizen"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { const incident = await db.resolveIncident(input.publicId, ctx.user.id); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Incident could not be resolved." }); }
    }),
    simulateProgress: roleProcedure(["citizen"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { const incident = await db.advanceDevelopmentSimulation(input.publicId, ctx.user.id); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Simulation could not progress." }); }
    }),
    simulateResponderMovement: roleProcedure(["citizen"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { const incident = await db.advanceDevelopmentResponderMovement(input.publicId, ctx.user.id); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Responder movement could not be updated." }); }
    }),
  }),
  volunteer: router({
    readiness: roleProcedure(["volunteer"]).query(({ ctx }) => db.getVolunteerReadiness(ctx.user.id)),
    completeDevelopmentVerification: roleProcedure(["volunteer"]).mutation(async ({ ctx }) => {
      if (process.env.NODE_ENV === "production") throw new TRPCError({ code: "FORBIDDEN", message: "Volunteer verification requires coordinator review in production." });
      const readiness = await db.verifyVolunteer(ctx.user.id);
      if (!readiness) throw new TRPCError({ code: "NOT_FOUND", message: "Volunteer profile not found." });
      return readiness;
    }),
    setAvailability: roleProcedure(["volunteer"]).input(z.object({ availability: z.enum(["offline", "available", "busy"]), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() })).mutation(async ({ ctx, input }) => {
      requireVerifiedVolunteer(ctx.user);
      if (input.availability === "available" && (input.latitude === undefined || input.longitude === undefined)) throw new TRPCError({ code: "BAD_REQUEST", message: "Current location is required to become available." });
      const readiness = await db.setVolunteerAvailability(ctx.user.id, { availability: input.availability, latitudeE6: input.latitude === undefined ? undefined : Math.round(input.latitude * 1_000_000), longitudeE6: input.longitude === undefined ? undefined : Math.round(input.longitude * 1_000_000) });
      if (!readiness) throw new TRPCError({ code: "NOT_FOUND", message: "Volunteer profile not found." });
      return readiness;
    }),
    nearbyIncidents: roleProcedure(["volunteer"]).query(async ({ ctx }) => {
      requireVerifiedVolunteer(ctx.user);
      const readiness = await db.getVolunteerReadiness(ctx.user.id);
      if (readiness?.availability !== "available") throw new TRPCError({ code: "FORBIDDEN", message: "Go available before viewing nearby emergency requests." });
      const nearby = await db.listNearbyOpenIncidents(ctx.user.id);
      return nearby.map(incident => ({ publicId: incident.publicId, emergencyType: incident.emergencyType, distanceMeters: incident.distanceMeters, createdAt: incident.createdAt, responseArea: "Approximate incident area available before acceptance" }));
    }),
    activeIncident: roleProcedure(["volunteer"]).query(({ ctx }) => db.getActiveIncidentForVolunteer(ctx.user.id)),
    accept: roleProcedure(["volunteer"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { requireVerifiedVolunteer(ctx.user); const readiness = await db.getVolunteerReadiness(ctx.user.id); if (readiness?.availability !== "available") throw new Error("Go available before accepting an emergency request."); const incident = await db.acceptIncident(input.publicId, ctx.user.id); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); await db.setVolunteerAvailability(ctx.user.id, { availability: "busy" }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "Incident is not available." }); }
    }),
    startRoute: roleProcedure(["volunteer"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { requireVerifiedVolunteer(ctx.user); const incident = await db.volunteerAdvance(input.publicId, ctx.user.id, "en_route"); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Response could not start." }); }
    }),
    arrive: roleProcedure(["volunteer"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { requireVerifiedVolunteer(ctx.user); const incident = await db.volunteerAdvance(input.publicId, ctx.user.id, "arrived"); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Arrival could not be confirmed." }); }
    }),
    beginAssistance: roleProcedure(["volunteer"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { requireVerifiedVolunteer(ctx.user); const incident = await db.volunteerBeginAssistance(input.publicId, ctx.user.id); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Assistance could not be started." }); }
    }),
    resolve: roleProcedure(["volunteer"]).input(z.object({ publicId: z.string().min(3).max(40) })).mutation(async ({ ctx, input }) => {
      try { requireVerifiedVolunteer(ctx.user); const incident = await db.resolveIncidentByVolunteer(input.publicId, ctx.user.id); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); await db.setVolunteerAvailability(ctx.user.id, { availability: "offline" }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Incident could not be resolved." }); }
    }),
    updateLocation: roleProcedure(["volunteer"]).input(z.object({ publicId: z.string().min(3).max(40), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })).mutation(async ({ ctx, input }) => {
      try { requireVerifiedVolunteer(ctx.user); const incident = await db.updateResponderPosition(input.publicId, ctx.user.id, Math.round(input.latitude * 1_000_000), Math.round(input.longitude * 1_000_000)); if (!incident) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found." }); return incident; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Responder location could not be updated." }); }
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
