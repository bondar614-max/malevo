import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function ensurePaymentsSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS balance_payments (
      id varchar(36) NOT NULL,
      user_id varchar(36) NOT NULL,
      yookassa_payment_id varchar(255) NULL,
      status varchar(50) NOT NULL DEFAULT 'pending',
      amount decimal(10,2) NOT NULL,
      currency varchar(3) NOT NULL DEFAULT 'RUB',
      confirmation_url text NULL,
      description varchar(255) NOT NULL DEFAULT 'Пополнение баланса',
      credited_at timestamp NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY balance_payments_yookassa_payment_id_unique (yookassa_payment_id),
      KEY balance_payments_user_id_idx (user_id),
      CONSTRAINT balance_payments_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  logger.info("Payments schema is ready");
}
