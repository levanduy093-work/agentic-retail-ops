import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260902100228 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "agent_skill_definition" ("id" text not null, "key" text not null, "version" text not null, "tenant_id" text null, "owner" text check ("owner" in ('PLATFORM', 'TENANT')) not null default 'PLATFORM', "name" text not null, "description" text not null, "instructions" text not null, "status" text check ("status" in ('DRAFT', 'ACTIVE', 'RETIRED')) not null default 'DRAFT', "configuration_schema" jsonb not null, "eligible_tool_names" jsonb not null, "required_evidence" jsonb not null, "evaluation_scenario_keys" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_skill_definition_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_skill_definition_deleted_at" ON "agent_skill_definition" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_skill_definition_key_version_tenant" ON "agent_skill_definition" ("key", "version", "tenant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_skill_definition_owner_status" ON "agent_skill_definition" ("owner", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_tenant_skill" ("id" text not null, "tenant_id" text not null, "skill_key" text not null, "skill_version" text not null, "definition_id" text null, "status" text check ("status" in ('DRAFT', 'SHADOW', 'ACTIVE', 'PAUSED', 'RETIRED')) not null default 'DRAFT', "configuration" jsonb not null, "enabled_tool_names" jsonb not null, "installed_by" text not null, "activated_by" text null, "activated_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_tenant_skill_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_tenant_skill_deleted_at" ON "agent_tenant_skill" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_tenant_skill_key_version" ON "agent_tenant_skill" ("tenant_id", "skill_key", "skill_version") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_tenant_skill_tenant_status" ON "agent_tenant_skill" ("tenant_id", "status") WHERE deleted_at IS NULL;`);

  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_skill_definition" cascade;`);

    this.addSql(`drop table if exists "agent_tenant_skill" cascade;`);

  }

}
