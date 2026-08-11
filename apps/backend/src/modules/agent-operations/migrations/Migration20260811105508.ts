import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811105508 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_ai_provider_credential" drop constraint if exists "agent_ai_provider_credential_unique";`);
    this.addSql(`create table if not exists "agent_ai_provider_credential" ("id" text not null, "provider" text check ("provider" in ('OPENAI', 'GEMINI')) not null, "tenant_id" text not null default 'default', "encrypted_secret" text not null, "encryption_iv" text not null, "encryption_tag" text not null, "key_version" text not null default 'v1', "secret_hint" text not null, "embedding_enabled" boolean not null default false, "embedding_model" text not null, "embedding_dimensions" integer null, "generation_enabled" boolean not null default false, "generation_model" text not null, "updated_by_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_ai_provider_credential_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_ai_provider_credential_deleted_at" ON "agent_ai_provider_credential" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_ai_provider_credential_unique" ON "agent_ai_provider_credential" ("tenant_id", "provider") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_ai_provider_credential" cascade;`);
  }

}
