CREATE TABLE `notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `dedupeKey` varchar(180) NOT NULL,
  `recipientUserId` int NOT NULL,
  `incidentId` int,
  `type` enum('emergency_confirmation','nearby_emergency','responder_assigned','responder_en_route','responder_arrived','incident_resolved','coordinator_critical','coordinator_no_responder','coordinator_escalated','assignment_cancelled','reassignment_required') NOT NULL,
  `priority` enum('critical','high','normal','low') NOT NULL DEFAULT 'normal',
  `channel` enum('in_app','sms') NOT NULL DEFAULT 'in_app',
  `status` enum('pending','delivered_demo','sent','failed') NOT NULL DEFAULT 'pending',
  `provider` enum('demo','twilio','fallback') NOT NULL DEFAULT 'demo',
  `title` varchar(180) NOT NULL,
  `message` varchar(500) NOT NULL,
  `providerMessageId` varchar(120),
  `errorMessage` varchar(500),
  `sentAt` timestamp,
  `readAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
  CONSTRAINT `notifications_dedupeKey_unique` UNIQUE(`dedupeKey`),
  CONSTRAINT `notifications_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `notifications_incidentId_incidents_id_fk` FOREIGN KEY (`incidentId`) REFERENCES `incidents`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);--> statement-breakpoint
CREATE INDEX `notifications_recipient_unread_idx` ON `notifications` (`recipientUserId`,`readAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_incident_created_idx` ON `notifications` (`incidentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_status_created_idx` ON `notifications` (`status`,`createdAt`);--> statement-breakpoint
CREATE TABLE `notificationPreferences` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `inAppEnabled` boolean NOT NULL DEFAULT true,
  `smsEnabled` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `notificationPreferences_id` PRIMARY KEY(`id`),
  CONSTRAINT `notificationPreferences_userId_unique` UNIQUE(`userId`),
  CONSTRAINT `notificationPreferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);
