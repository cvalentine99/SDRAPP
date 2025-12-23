CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `device_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`center_frequency` varchar(50) NOT NULL,
	`sample_rate` varchar(50) NOT NULL,
	`gain` int NOT NULL,
	`lna_gain` int,
	`tia_gain` int,
	`pga_gain` int,
	`agc_mode` enum('auto','manual') NOT NULL DEFAULT 'manual',
	`dc_offset_correction` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
	`iq_balance_correction` enum('enabled','disabled') NOT NULL DEFAULT 'enabled',
	`master_clock_rate` varchar(50),
	`clock_source` varchar(50),
	`antenna` varchar(50),
	`fft_size` int DEFAULT 2048,
	`window_function` varchar(50) DEFAULT 'hann',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `frequency_bookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`frequency` varchar(50) NOT NULL,
	`description` text,
	`category` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `frequency_bookmarks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recordings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`s3_key` varchar(512) NOT NULL,
	`s3_url` varchar(1024) NOT NULL,
	`center_frequency` varchar(50) NOT NULL,
	`sample_rate` varchar(50) NOT NULL,
	`gain` int NOT NULL,
	`duration` int NOT NULL,
	`file_size` varchar(50) NOT NULL,
	`author` varchar(255),
	`description` text,
	`license` varchar(100),
	`hardware` varchar(255),
	`location` varchar(255),
	`tags` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recordings_id` PRIMARY KEY(`id`)
);
