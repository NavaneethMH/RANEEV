ALTER TABLE `users` ADD `volunteerSkills` varchar(500) NOT NULL DEFAULT '[]';--> statement-breakpoint
CREATE TABLE `aiAnalysisJobs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `incidentId` int NOT NULL,
  `status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  `attemptCount` int NOT NULL DEFAULT 0,
  `lastErrorCode` varchar(120),
  `scheduledAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lockedAt` timestamp,
  `completedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `aiAnalysisJobs_id` PRIMARY KEY(`id`),
  CONSTRAINT `aiAnalysisJobs_incidentId_unique` UNIQUE(`incidentId`),
  CONSTRAINT `aiAnalysisJobs_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);--> statement-breakpoint
CREATE INDEX `ai_jobs_status_schedule_idx` ON `aiAnalysisJobs` (`status`,`scheduledAt`);--> statement-breakpoint
CREATE TABLE `aiIncidentAudits` (
  `id` int AUTO_INCREMENT NOT NULL,
  `incidentId` int,
  `actorUserId` int,
  `operation` enum('incident_enrichment','coordinator_assistant') NOT NULL,
  `status` enum('succeeded','failed','fallback') NOT NULL,
  `modelIdentifier` varchar(120),
  `inputMetadata` varchar(500) NOT NULL,
  `outputJson` varchar(6000),
  `confidencePercent` int,
  `failureCode` varchar(120),
  `durationMs` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `aiIncidentAudits_id` PRIMARY KEY(`id`),
  CONSTRAINT `aiIncidentAudits_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `aiIncidentAudits_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);--> statement-breakpoint
CREATE INDEX `ai_audits_incident_created_idx` ON `aiIncidentAudits` (`incidentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_audits_operation_created_idx` ON `aiIncidentAudits` (`operation`,`createdAt`);
