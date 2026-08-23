ALTER TABLE `incidentEvents` MODIFY COLUMN `eventType` enum('created','search_started','responder_accepted','en_route','arrived','assistance_started','resolved') NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` MODIFY COLUMN `status` enum('active','searching','accepted','en_route','arrived','assisting','resolved','cancelled') NOT NULL DEFAULT 'searching';--> statement-breakpoint
ALTER TABLE `incidentEvents` MODIFY COLUMN `eventType` enum('created','search_started','responder_accepted','en_route','arrived','assistance_started','resolved') NOT NULL;--> statement-breakpoint
ALTER TABLE `incidents` ADD `assistanceStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `volunteerAvailability` enum('offline','available','busy') DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `volunteerLatitudeE6` int;--> statement-breakpoint
ALTER TABLE `users` ADD `volunteerLongitudeE6` int;--> statement-breakpoint
ALTER TABLE `users` ADD `volunteerLocationUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `verifiedAt` timestamp;
