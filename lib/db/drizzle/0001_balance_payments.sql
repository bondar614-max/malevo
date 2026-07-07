CREATE TABLE IF NOT EXISTS `balance_payments` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`yookassa_payment_id` varchar(255),
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'RUB',
	`confirmation_url` text,
	`description` varchar(255) NOT NULL DEFAULT 'Пополнение баланса',
	`credited_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `balance_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `balance_payments_yookassa_payment_id_unique` UNIQUE(`yookassa_payment_id`)
);
--> statement-breakpoint
ALTER TABLE `balance_payments` ADD CONSTRAINT `balance_payments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
