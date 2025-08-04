CREATE TABLE `rss_entries` (
	`id` int NOT NULL AUTO_INCREMENT,
	`feed_id` int NOT NULL,
	`guid` varchar(255) NOT NULL,
	`title` varchar(1000),
	`link` varchar(512) NOT NULL,
	`description` text,
	`pub_date` varchar(100) NOT NULL,
	`image` varchar(1024),
	`created_at` timestamp NULL DEFAULT current_timestamp(),
	`updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
	`media_type` varchar(50),
	PRIMARY KEY (`id`),
	UNIQUE KEY `unique_entry` (`feed_id`, `guid`),
	KEY `idx_guid` (`guid`),
	KEY `idx_pub_date` (`pub_date`),
	KEY `idx_feed_id` (`feed_id`)
) ENGINE InnoDB,
  CHARSET utf8mb4,
  COLLATE utf8mb4_0900_ai_ci;

rss_feeds
160.0 KB
CREATE TABLE `rss_feeds` (
	`id` int NOT NULL AUTO_INCREMENT,
	`feed_url` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`created_at` timestamp NULL DEFAULT current_timestamp(),
	`updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
	`last_fetched` bigint NOT NULL DEFAULT '0',
	`media_type` varchar(50),
	PRIMARY KEY (`id`),
	UNIQUE KEY `feed_url` (`feed_url`),
	KEY `idx_last_fetched` (`last_fetched`),
	KEY `idx_title` (`title`)
) ENGINE InnoDB,
  CHARSET utf8mb4,
  COLLATE utf8mb4_0900_ai_ci;

rss_locks
112.0 KB
CREATE TABLE `rss_locks` (
	`lock_key` varchar(255) NOT NULL,
	`expires_at` bigint NOT NULL,
	`created_at` datetime NOT NULL,
	PRIMARY KEY (`lock_key`)
) ENGINE InnoDB,
  CHARSET utf8mb4,
  COLLATE utf8mb4_0900_ai_ci;