import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260809200756 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "agent_channel_connection" ("id" text not null, "channel" text check ("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'SLACK', 'TEAMS')) not null, "status" text check ("status" in ('ACTIVE', 'PAUSED', 'DISABLED')) not null default 'DISABLED', "tenant_id" text not null default 'default', "account_ref" text not null, "secret_ref" text null, "config" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_channel_connection_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_channel_connection_deleted_at" ON "agent_channel_connection" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_channel_tenant_channel_account" ON "agent_channel_connection" ("tenant_id", "channel", "account_ref") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_channel_status" ON "agent_channel_connection" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_delivery" ("id" text not null, "message_id" text not null, "connection_id" text not null, "channel" text check ("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'SLACK', 'TEAMS')) not null, "status" text check ("status" in ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD')) not null default 'PENDING', "idempotency_key" text not null, "attempt_count" integer not null default 0, "available_at" timestamptz not null, "locked_by" text null, "locked_at" timestamptz null, "lock_expires_at" timestamptz null, "delivered_at" timestamptz null, "external_message_id" text null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_delivery_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_delivery_deleted_at" ON "agent_delivery" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_delivery_idempotency_key" ON "agent_delivery" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_delivery_status_available_at" ON "agent_delivery" ("status", "available_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_evaluation_run" ("id" text not null, "scenario_id" text not null, "model_run_id" text null, "status" text check ("status" in ('RUNNING', 'PASSED', 'FAILED', 'ERROR')) not null default 'RUNNING', "idempotency_key" text not null, "observed" jsonb not null, "assertion_results" jsonb not null, "score" integer not null, "started_at" timestamptz not null, "completed_at" timestamptz null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_evaluation_run_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_evaluation_run_deleted_at" ON "agent_evaluation_run" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_eval_run_idempotency_key" ON "agent_evaluation_run" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_eval_run_scenario_started_at" ON "agent_evaluation_run" ("scenario_id", "started_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_evaluation_scenario" ("id" text not null, "scenario_key" text not null, "version" text not null, "agent_id" text not null, "name" text not null, "description" text null, "status" text check ("status" in ('DRAFT', 'ACTIVE', 'RETIRED')) not null default 'DRAFT', "initial_state" jsonb not null, "event" jsonb not null, "expected_assertions" jsonb not null, "forbidden_assertions" jsonb not null, "tags" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_evaluation_scenario_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_evaluation_scenario_deleted_at" ON "agent_evaluation_scenario" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_eval_scenario_key_version" ON "agent_evaluation_scenario" ("scenario_key", "version") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_eval_scenario_agent_status" ON "agent_evaluation_scenario" ("agent_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_knowledge_document" ("id" text not null, "document_key" text not null, "version" text not null, "title" text not null, "content" text not null, "checksum" text not null, "status" text check ("status" in ('DRAFT', 'APPROVED', 'RETIRED')) not null default 'DRAFT', "owner_id" text not null, "tenant_id" text not null default 'default', "scope" text not null default 'operations', "locale" text not null default 'vi', "citation_locator" text not null, "effective_at" timestamptz not null, "expires_at" timestamptz null, "approved_by" text null, "approved_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_knowledge_document_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_knowledge_document_deleted_at" ON "agent_knowledge_document" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_knowledge_key_version" ON "agent_knowledge_document" ("document_key", "version") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_knowledge_status_effective_at" ON "agent_knowledge_document" ("status", "effective_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_model_run" ("id" text not null, "incident_id" text null, "run_id" text null, "agent_id" text not null, "agent_version" text not null, "provider" text not null, "model" text not null, "prompt_key" text not null, "prompt_version" text not null, "status" text check ("status" in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'REJECTED')) not null default 'PENDING', "idempotency_key" text not null, "input" jsonb not null, "output" jsonb null, "input_tokens" integer null, "output_tokens" integer null, "cost_micros" integer null, "latency_ms" integer null, "redacted" boolean not null default true, "started_at" timestamptz null, "completed_at" timestamptz null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_model_run_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_model_run_deleted_at" ON "agent_model_run" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_model_run_idempotency_key" ON "agent_model_run" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_model_run_agent_status" ON "agent_model_run" ("agent_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_policy_definition" ("id" text not null, "policy_key" text not null, "version" text not null, "name" text not null, "description" text null, "status" text check ("status" in ('DRAFT', 'ACTIVE', 'RETIRED')) not null default 'DRAFT', "action_type" text not null, "risk_level" text check ("risk_level" in ('READ_ONLY', 'LOW', 'MEDIUM', 'HIGH', 'PROHIBITED')) not null, "requires_approval" boolean not null default false, "required_role" text null, "conditions" jsonb not null, "tenant_id" text not null default 'default', "effective_at" timestamptz not null, "expires_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_policy_definition_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_policy_definition_deleted_at" ON "agent_policy_definition" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_policy_key_version" ON "agent_policy_definition" ("policy_key", "version") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_policy_action_status" ON "agent_policy_definition" ("action_type", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_prompt_template" ("id" text not null, "prompt_key" text not null, "version" text not null, "agent_id" text not null, "status" text check ("status" in ('DRAFT', 'ACTIVE', 'RETIRED')) not null default 'DRAFT', "system_prompt" text not null, "input_schema" jsonb not null, "output_schema" jsonb not null, "max_tokens" integer not null default 1024, "approved_by" text null, "approved_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_prompt_template_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_prompt_template_deleted_at" ON "agent_prompt_template" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_prompt_key_version" ON "agent_prompt_template" ("prompt_key", "version") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_prompt_agent_status" ON "agent_prompt_template" ("agent_id", "status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_task" ("id" text not null, "incident_id" text null, "task_type" text not null, "title" text not null, "description" text null, "priority" text check ("priority" in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) not null, "status" text check ("status" in ('TODO', 'CLAIMED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED', 'FAILED', 'DEAD')) not null default 'TODO', "tenant_id" text not null default 'default', "assigned_to_type" text null, "assigned_to_id" text null, "created_by_type" text not null, "created_by_id" text not null, "idempotency_key" text not null, "input" jsonb null, "result" jsonb null, "due_at" timestamptz null, "claimed_at" timestamptz null, "started_at" timestamptz null, "completed_at" timestamptz null, "failure" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_task_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_task_deleted_at" ON "agent_task" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_task_idempotency_key" ON "agent_task" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_task_status_priority_due_at" ON "agent_task" ("status", "priority", "due_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_task_incident_id" ON "agent_task" ("incident_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "agent_conversation" drop constraint if exists "agent_conversation_channel_check";`);

    this.addSql(`alter table if exists "agent_message" drop constraint if exists "agent_message_channel_check";`);

    this.addSql(`alter table if exists "agent_conversation" add constraint "agent_conversation_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'SLACK', 'TEAMS'));`);

    this.addSql(`alter table if exists "agent_message" add constraint "agent_message_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'SLACK', 'TEAMS'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_channel_connection" cascade;`);

    this.addSql(`drop table if exists "agent_delivery" cascade;`);

    this.addSql(`drop table if exists "agent_evaluation_run" cascade;`);

    this.addSql(`drop table if exists "agent_evaluation_scenario" cascade;`);

    this.addSql(`drop table if exists "agent_knowledge_document" cascade;`);

    this.addSql(`drop table if exists "agent_model_run" cascade;`);

    this.addSql(`drop table if exists "agent_policy_definition" cascade;`);

    this.addSql(`drop table if exists "agent_prompt_template" cascade;`);

    this.addSql(`drop table if exists "agent_task" cascade;`);

    this.addSql(`alter table if exists "agent_conversation" drop constraint if exists "agent_conversation_channel_check";`);

    this.addSql(`alter table if exists "agent_message" drop constraint if exists "agent_message_channel_check";`);

    this.addSql(`alter table if exists "agent_conversation" add constraint "agent_conversation_channel_check" check("channel" in ('IN_APP'));`);

    this.addSql(`alter table if exists "agent_message" add constraint "agent_message_channel_check" check("channel" in ('IN_APP'));`);
  }

}
