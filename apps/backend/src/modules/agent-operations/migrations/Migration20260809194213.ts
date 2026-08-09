import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260809194213 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "agent_conversation" ("id" text not null, "channel" text check ("channel" in ('IN_APP')) not null default 'IN_APP', "external_thread_id" text null, "topic_type" text not null, "topic_id" text not null, "incident_id" text null, "tenant_id" text not null default 'default', "title" text not null, "status" text check ("status" in ('OPEN', 'CLOSED')) not null default 'OPEN', "opened_at" timestamptz not null, "last_message_at" timestamptz not null, "closed_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_conversation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_conversation_deleted_at" ON "agent_conversation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_conversation_channel_topic" ON "agent_conversation" ("channel", "topic_type", "topic_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_conversation_status_last_message_at" ON "agent_conversation" ("status", "last_message_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_conversation_incident_id" ON "agent_conversation" ("incident_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_message" ("id" text not null, "conversation_id" text not null, "channel" text check ("channel" in ('IN_APP')) not null default 'IN_APP', "direction" text check ("direction" in ('INBOUND', 'OUTBOUND')) not null, "message_type" text check ("message_type" in ('NOTIFICATION', 'COMMAND', 'COMMAND_RESULT', 'TEXT')) not null, "status" text check ("status" in ('RECEIVED', 'AVAILABLE', 'PROCESSED', 'REJECTED')) not null, "sender_type" text not null, "sender_id" text not null, "body" text not null, "structured_content" jsonb null, "command_name" text null, "idempotency_key" text not null, "external_message_id" text null, "occurred_at" timestamptz not null, "processed_at" timestamptz null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_message_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_message_deleted_at" ON "agent_message" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_message_idempotency_key" ON "agent_message" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_message_conversation_occurred_at" ON "agent_message" ("conversation_id", "occurred_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_message_status_occurred_at" ON "agent_message" ("status", "occurred_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_conversation" cascade;`);

    this.addSql(`drop table if exists "agent_message" cascade;`);
  }

}
