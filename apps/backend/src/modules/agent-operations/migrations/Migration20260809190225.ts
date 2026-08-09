import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260809190225 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "agent_action_request" ("id" text not null, "incident_id" text not null, "recommendation_id" text not null, "approval_id" text not null, "action_type" text not null, "tool_name" text not null, "tool_version" text not null, "risk_level" text check ("risk_level" in ('READ_ONLY', 'LOW', 'MEDIUM', 'HIGH', 'PROHIBITED')) not null, "status" text check ("status" in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'CONFLICT', 'FAILED', 'DEAD', 'CANCELLED')) not null default 'PENDING', "idempotency_key" text not null, "input" jsonb not null, "result" jsonb null, "requested_by_type" text not null, "requested_by_id" text not null, "requested_at" timestamptz not null, "available_at" timestamptz not null, "attempt_count" integer not null default 0, "locked_by" text null, "locked_at" timestamptz null, "lock_expires_at" timestamptz null, "completed_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_action_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_action_request_deleted_at" ON "agent_action_request" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_action_request_idempotency_key" ON "agent_action_request" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_action_request_status_available_at" ON "agent_action_request" ("status", "available_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_action_request_incident_id" ON "agent_action_request" ("incident_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_action_request_approval_id" ON "agent_action_request" ("approval_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_tool_call" ("id" text not null, "action_request_id" text not null, "incident_id" text not null, "tool_name" text not null, "tool_version" text not null, "kind" text check ("kind" in ('READ', 'COMMAND')) not null, "status" text check ("status" in ('RUNNING', 'SUCCEEDED', 'CONFLICT', 'FAILED')) not null default 'RUNNING', "idempotency_key" text not null, "input" jsonb not null, "output" jsonb null, "error" text null, "started_at" timestamptz not null, "completed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_tool_call_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_tool_call_deleted_at" ON "agent_tool_call" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_tool_call_idempotency_key" ON "agent_tool_call" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_tool_call_action_request_id" ON "agent_tool_call" ("action_request_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_tool_call_incident_id_started_at" ON "agent_tool_call" ("incident_id", "started_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_action_request" cascade;`);

    this.addSql(`drop table if exists "agent_tool_call" cascade;`);
  }

}
