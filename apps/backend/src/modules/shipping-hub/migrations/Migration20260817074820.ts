import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260817074820 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "shipping_carrier_connection" ("id" text not null, "code" text not null, "name" text not null, "provider_id" text not null, "environment" text check ("environment" in ('SANDBOX', 'PRODUCTION')) not null default 'SANDBOX', "is_enabled" boolean not null default false, "configuration" jsonb not null, "encrypted_secret" text null, "encryption_iv" text null, "encryption_tag" text null, "key_version" text null, "secret_hint" text null, "last_verified_at" timestamptz null, "last_verification" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipping_carrier_connection_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipping_carrier_connection_deleted_at" ON "shipping_carrier_connection" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipping_carrier_connection_code" ON "shipping_carrier_connection" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipping_carrier_connection_provider" ON "shipping_carrier_connection" ("provider_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "shipping_webhook_event" ("id" text not null, "carrier_code" text not null, "external_event_id" text not null, "tracking_number" text null, "status" text check ("status" in ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED')) not null default 'RECEIVED', "payload" jsonb not null, "occurred_at" timestamptz null, "received_at" timestamptz not null, "processed_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipping_webhook_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipping_webhook_event_deleted_at" ON "shipping_webhook_event" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipping_webhook_event_carrier_external_id" ON "shipping_webhook_event" ("carrier_code", "external_event_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shipping_webhook_event_tracking_number" ON "shipping_webhook_event" ("carrier_code", "tracking_number") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "shipping_carrier_connection" cascade;`);

    this.addSql(`drop table if exists "shipping_webhook_event" cascade;`);
  }

}
