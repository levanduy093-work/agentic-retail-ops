import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260813070429 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_conversation_memory" drop constraint if exists "agent_conversation_memory_conversation_unique";`);
    this.addSql(`create table if not exists "agent_conversation_memory" ("id" text not null, "conversation_id" text not null, "tenant_id" text not null default 'default', "summary" text not null, "customer_facts" jsonb not null, "open_questions" jsonb not null, "resolved_topics" jsonb not null, "last_message_id" text not null, "source_message_count" integer not null default 0, "version" integer not null default 1, "summarized_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_conversation_memory_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_conversation_memory_deleted_at" ON "agent_conversation_memory" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_conversation_memory_conversation_unique" ON "agent_conversation_memory" ("conversation_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_conversation_memory_tenant_updated" ON "agent_conversation_memory" ("tenant_id", "summarized_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_conversation_memory" cascade;`);
  }

}
