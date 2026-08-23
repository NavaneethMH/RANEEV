CREATE TABLE `incidentEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentId` int NOT NULL,
	`actorUserId` int,
	`eventType` enum('created','search_started','responder_accepted','en_route','arrived','resolved') NOT NULL,
	`note` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incidentEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `incidents` ADD `emergencyType` enum('medical','road_accident','injury','fire','unconscious','other') DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `locationLabel` varchar(255) DEFAULT 'Location pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `latitudeE6` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `longitudeE6` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `accuracyMeters` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `description` varchar(500);--> statement-breakpoint
ALTER TABLE `incidents` ADD `responderEtaMinutes` int;--> statement-breakpoint
ALTER TABLE `incidents` ADD `acceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `incidents` ADD `arrivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `incidents` ADD `resolvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `incidentEvents` ADD CONSTRAINT `incidentEvents_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incidentEvents` ADD CONSTRAINT `incidentEvents_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `incident_events_incident_idx` ON `incidentEvents` (`incidentId`);--> statement-breakpoint
CREATE INDEX `incident_events_created_idx` ON `incidentEvents` (`createdAt`);