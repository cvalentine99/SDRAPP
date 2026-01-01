CREATE TABLE `deviceSelections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serial` varchar(64) NOT NULL,
	`driver` varchar(32),
	`hardware` varchar(64),
	`args` varchar(256),
	`backend` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deviceSelections_id` PRIMARY KEY(`id`),
	CONSTRAINT `deviceSelections_userId_unique` UNIQUE(`userId`)
);
