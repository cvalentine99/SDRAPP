ALTER TABLE `recordings` MODIFY COLUMN `frequency` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` MODIFY COLUMN `sampleRate` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` MODIFY COLUMN `fileSize` bigint NOT NULL;