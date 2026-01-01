CREATE TABLE `frequencyBookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`frequency` bigint NOT NULL,
	`sampleRate` bigint NOT NULL,
	`gain` int NOT NULL,
	`description` text,
	`color` varchar(7) DEFAULT '#00d4ff',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `frequencyBookmarks_id` PRIMARY KEY(`id`)
);
