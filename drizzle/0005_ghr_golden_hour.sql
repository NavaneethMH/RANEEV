ALTER TABLE `incidents` ADD `ghrSeverity` enum('unassessed','standard','urgent','critical') NOT NULL DEFAULT 'unassessed';--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrEscalation` enum('not_escalated','monitoring','facility_contacted','professional_services_contacted') NOT NULL DEFAULT 'not_escalated';--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrEscalationNote` varchar(500);--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrEscalatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrFacilityName` varchar(255);--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrFacilityPlaceId` varchar(255);--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrFacilityLatitudeE6` int;--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrFacilityLongitudeE6` int;--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrFacilityDistanceMeters` int;--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrFacilityEtaMinutes` int;--> statement-breakpoint
ALTER TABLE `incidents` ADD `ghrFacilitySelectedAt` timestamp;--> statement-breakpoint
ALTER TABLE `incidentEvents` MODIFY COLUMN `eventType` enum('created','search_started','responder_accepted','en_route','arrived','assistance_started','severity_assessed','facility_selected','escalated','resolved') NOT NULL;
