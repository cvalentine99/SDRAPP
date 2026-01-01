CREATE TABLE `spectrumSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`frequency` bigint NOT NULL,
	`sampleRate` bigint NOT NULL,
	`gain` int NOT NULL,
	`signalType` varchar(100),
	`peakPower` int,
	`noiseFloor` int,
	`snr` int,
	`bandwidth` bigint,
	`confidence` int,
	`metadata` text,
	`source` enum('manual','auto','scan') DEFAULT 'auto',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spectrumSnapshots_id` PRIMARY KEY(`id`)
);
