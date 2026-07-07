CREATE TABLE `styles` (
	`id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`short_description` text NOT NULL,
	`full_description` text NOT NULL,
	`prompt` text NOT NULL DEFAULT (''),
	`negative_prompt` text NOT NULL DEFAULT (''),
	`price` decimal(10,2) NOT NULL DEFAULT '0',
	`preview_image_url` varchar(500) NOT NULL,
	`reference_photo_url` varchar(500) NOT NULL DEFAULT '',
	`example_images` json NOT NULL DEFAULT ('[]'),
	`generation_time` int NOT NULL DEFAULT 60,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`orders_count` int NOT NULL DEFAULT 0,
	`photos_required` int NOT NULL DEFAULT 1,
	`category` varchar(100) NOT NULL,
	`rating` decimal(3,2) NOT NULL DEFAULT '4.9',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `styles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(255),
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(50) NOT NULL DEFAULT 'user',
	`is_blocked` boolean NOT NULL DEFAULT false,
	`balance` decimal(10,2) NOT NULL DEFAULT '0',
	`total_spent` decimal(10,2) NOT NULL DEFAULT '0',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_login` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`style_id` varchar(36),
	`service_key` varchar(64),
	`location_id` varchar(36),
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`amount` decimal(10,2) NOT NULL DEFAULT '0',
	`source_photo_url` varchar(500),
	`source_photos` json NOT NULL DEFAULT ('[]'),
	`result_photos` json NOT NULL DEFAULT ('[]'),
	`kie_task_id` varchar(255),
	`kie_task_ids` json NOT NULL DEFAULT ('[]'),
	`payment_id` varchar(255),
	`error_message` text,
	`item` varchar(255),
	`gender` varchar(32),
	`age` varchar(32),
	`sets` int,
	`expected_photos` int NOT NULL DEFAULT 0,
	`received_photo_numbers` json NOT NULL DEFAULT ('[]'),
	`approval_mode` varchar(32),
	`anchor_photo_url` varchar(500),
	`approval_comment` text,
	`revision_count` int NOT NULL DEFAULT 0,
	`photoshoot_prompt` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`avatar_color` varchar(32) NOT NULL DEFAULT '#7C3AED',
	`rating` int NOT NULL DEFAULT 5,
	`text` text NOT NULL,
	`style_tag` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gallery` (
	`id` varchar(36) NOT NULL,
	`image_url` varchar(500) NOT NULL,
	`style_id` varchar(36) NOT NULL,
	`style_title` varchar(255) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gallery_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tariffs` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL DEFAULT (''),
	`price` decimal(10,2) NOT NULL DEFAULT '0',
	`generations_included` int NOT NULL DEFAULT 1,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tariffs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` varchar(36) NOT NULL,
	`service_key` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`preview_image_url` varchar(500) NOT NULL DEFAULT '',
	`prompt_fragment` text NOT NULL DEFAULT (''),
	`prompts` json NOT NULL DEFAULT ('[]'),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`key` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`short_description` text NOT NULL DEFAULT (''),
	`full_description` text NOT NULL DEFAULT (''),
	`prompt` text NOT NULL DEFAULT (''),
	`preview_image_url` varchar(500) NOT NULL DEFAULT '',
	`price` decimal(10,2) NOT NULL DEFAULT '0',
	`photos_min` int NOT NULL DEFAULT 1,
	`photos_max` int NOT NULL DEFAULT 1,
	`generation_time` int NOT NULL DEFAULT 60,
	`is_active` boolean NOT NULL DEFAULT true,
	`accent_from` varchar(32) NOT NULL DEFAULT '#7C3AED',
	`accent_to` varchar(32) NOT NULL DEFAULT '#EC4899',
	`badge` varchar(64) NOT NULL DEFAULT '',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `services_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` varchar(128) NOT NULL,
	`value` text NOT NULL DEFAULT (''),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `balance_payments` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`yookassa_payment_id` varchar(255),
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'RUB',
	`confirmation_url` text,
	`description` varchar(255) NOT NULL DEFAULT ('Пополнение баланса'),
	`credited_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `balance_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `balance_payments_yookassa_payment_id_unique` UNIQUE(`yookassa_payment_id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'collecting',
	`topic` varchar(255) NOT NULL DEFAULT 'Новое обращение',
	`summary` text NOT NULL DEFAULT (''),
	`messages` json NOT NULL DEFAULT ('[]'),
	`is_unread` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_style_id_styles_id_fk` FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_service_key_services_key_fk` FOREIGN KEY (`service_key`) REFERENCES `services`(`key`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `gallery` ADD CONSTRAINT `gallery_style_id_styles_id_fk` FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `locations` ADD CONSTRAINT `locations_service_key_services_key_fk` FOREIGN KEY (`service_key`) REFERENCES `services`(`key`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `balance_payments` ADD CONSTRAINT `balance_payments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
