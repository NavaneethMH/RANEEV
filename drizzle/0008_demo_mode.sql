ALTER TABLE `incidents` ADD `isDemo` boolean NOT NULL DEFAULT false;--> statement-breakpoint
CREATE INDEX `incidents_demo_status_idx` ON `incidents` (`isDemo`,`status`);--> statement-breakpoint
CREATE TABLE `demoRuns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `runKey` varchar(40) NOT NULL,
  `status` enum('idle','running','paused','completed') NOT NULL DEFAULT 'idle',
  `stage` enum('new_emergency','responder_detected','responder_accepted','responder_moving','responder_arrived','incident_resolved') NOT NULL DEFAULT 'new_emergency',
  `incidentId` int,
  `startedAt` timestamp,
  `pausedAt` timestamp,
  `accumulatedPausedMs` int NOT NULL DEFAULT 0,
  `completedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `demoRuns_id` PRIMARY KEY(`id`),
  CONSTRAINT `demoRuns_runKey_unique` UNIQUE(`runKey`),
  CONSTRAINT `demoRuns_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);--> statement-breakpoint
CREATE INDEX `demo_runs_status_idx` ON `demoRuns` (`status`);--> statement-breakpoint
CREATE INDEX `demo_runs_incident_idx` ON `demoRuns` (`incidentId`);
