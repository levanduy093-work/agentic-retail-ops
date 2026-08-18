import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260818133723 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "payment_provider_connection" ("id" text not null, "code" text not null, "name" text not null, "provider_id" text not null, "environment" text check ("environment" in ('SANDBOX', 'PRODUCTION')) not null default 'SANDBOX', "is_enabled" boolean not null default false, "configuration" jsonb not null, "encrypted_secret" text null, "encryption_iv" text null, "encryption_tag" text null, "key_version" text null, "secret_hint" text null, "encrypted_checksum" text null, "checksum_iv" text null, "checksum_tag" text null, "checksum_hint" text null, "last_verified_at" timestamptz null, "last_verification" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_provider_connection_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_provider_connection_deleted_at" ON "payment_provider_connection" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_provider_connection_code" ON "payment_provider_connection" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_provider_connection_provider" ON "payment_provider_connection" ("provider_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_provider_connection" cascade;`);
  }

}
