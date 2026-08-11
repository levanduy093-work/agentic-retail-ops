import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811080525 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_connector_credential" drop constraint if exists "agent_connector_credential_unique";`);
    this.addSql(`create table if not exists "agent_connector_credential" ("id" text not null, "connector_type" text check ("connector_type" in ('GOOGLE_DRIVE')) not null, "tenant_id" text not null default 'default', "account_email" text not null, "encrypted_secret" text not null, "encryption_iv" text not null, "encryption_tag" text not null, "key_version" text not null default 'v1', "scopes" jsonb not null, "updated_by_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_connector_credential_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_connector_credential_deleted_at" ON "agent_connector_credential" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_connector_credential_unique" ON "agent_connector_credential" ("tenant_id", "connector_type") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_connector_credential" cascade;`);
  }

}
