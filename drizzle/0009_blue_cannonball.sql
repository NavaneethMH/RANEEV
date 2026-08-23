ALTER TABLE `incidentEvents`
  MODIFY COLUMN `eventType` enum('created','search_started','responder_accepted','coordinator_assigned','responder_reassigned','en_route','arrived','assistance_started','severity_assessed','facility_selected','escalated','cancelled','resolved') NOT NULL;
--> statement-breakpoint
ALTER TABLE `incidents`
  MODIFY COLUMN `emergencyType` enum('medical','road_accident','injury','fire','unconscious','missing_person','violence','natural_disaster','other') NOT NULL DEFAULT 'other';
--> statement-breakpoint
ALTER TABLE `incidents`
  ADD COLUMN `cancelledAt` timestamp NULL,
  ADD COLUMN `cancellationReason` varchar(500) NULL;
