import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811060537 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_knowledge_source" drop constraint if exists "agent_knowledge_source_unique";`);
    this.addSql(`create table if not exists "agent_knowledge_source" ("id" text not null, "name" text not null, "source_type" text check ("source_type" in ('HTTPS_TEXT')) not null default 'HTTPS_TEXT', "source_url" text not null, "status" text check ("status" in ('ACTIVE', 'DISABLED')) not null default 'ACTIVE', "owner_id" text not null, "tenant_id" text not null default 'default', "scope" text not null default 'customer_support', "locale" text not null default 'vi', "last_sync_status" text check ("last_sync_status" in ('NEVER', 'SUCCEEDED', 'FAILED', 'UNCHANGED')) not null default 'NEVER', "last_checked_at" timestamptz null, "last_synced_at" timestamptz null, "last_error" text null, "last_etag" text null, "last_checksum" text null, "last_document_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_knowledge_source_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_knowledge_source_deleted_at" ON "agent_knowledge_source" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_knowledge_source_unique" ON "agent_knowledge_source" ("tenant_id", "source_url", "scope", "locale") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_knowledge_source_status" ON "agent_knowledge_source" ("status", "last_sync_status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_knowledge_source" cascade;`);
  }

}
