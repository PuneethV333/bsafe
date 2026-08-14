-- Rename models to snake_case table names (Prisma 7 default was PascalCase).
-- Column names are already snake_case via @map, so only table renames are needed.
-- Renaming a table cascades to its foreign keys and indexes automatically.
ALTER TABLE "Alert" RENAME TO "alerts";
ALTER TABLE "AlertLocation" RENAME TO "alert_locations";
ALTER TABLE "ActivityLog" RENAME TO "activity_logs";
ALTER TABLE "EmergencyContact" RENAME TO "emergency_contacts";
ALTER TABLE "NotificationDelivery" RENAME TO "notification_deliveries";
ALTER TABLE "User" RENAME TO "users";