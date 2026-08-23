CREATE TABLE `incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(40) NOT NULL,
	`createdByUserId` int NOT NULL,
	`assignedVolunteerId` int,
	`status` enum('active','searching','accepted','en_route','arrived','resolved','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `incidents_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(96) NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(32),
	`passwordHash` varchar(255) NOT NULL,
	`loginMethod` varchar(32) NOT NULL DEFAULT 'credentials',
	`role` enum('citizen','volunteer','coordinator','admin') NOT NULL DEFAULT 'citizen',
	`profileStatus` enum('active','pending_verification','suspended') NOT NULL DEFAULT 'active',
	`sessionVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `incidents` ADD CONSTRAINT `incidents_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incidents` ADD CONSTRAINT `incidents_assignedVolunteerId_users_id_fk` FOREIGN KEY (`assignedVolunteerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `incidents_creator_idx` ON `incidents` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `incidents_volunteer_idx` ON `incidents` (`assignedVolunteerId`);--> statement-breakpoint
CREATE INDEX `incidents_status_idx` ON `incidents` (`status`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`profileStatus`);