import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260809174339 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "agent_approval" ("id" text not null, "incident_id" text not null, "recommendation_id" text not null, "status" text check ("status" in ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')) not null default 'PENDING', "required_role" text not null, "policy_key" text not null, "policy_version" text not null, "requested_by_type" text not null, "requested_by_id" text not null, "requested_at" timestamptz not null, "expires_at" timestamptz not null, "decision_by_type" text null, "decision_by_id" text null, "decision_reason" text null, "decided_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_approval_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_approval_deleted_at" ON "agent_approval" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_approval_recommendation_id" ON "agent_approval" ("recommendation_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_approval_status_expires_at" ON "agent_approval" ("status", "expires_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_approval_incident_id" ON "agent_approval" ("incident_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_audit_event" ("id" text not null, "incident_id" text null, "run_id" text null, "event_type" text not null, "actor_type" text not null, "actor_id" text not null, "action" text not null, "resource_type" text not null, "resource_id" text not null, "correlation_id" text not null, "data" jsonb null, "recorded_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_audit_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_audit_event_deleted_at" ON "agent_audit_event" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_audit_incident_id_recorded_at" ON "agent_audit_event" ("incident_id", "recorded_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_audit_correlation_id" ON "agent_audit_event" ("correlation_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_event" ("id" text not null, "event_id" text not null, "event_type" text not null, "event_version" integer not null default 1, "occurred_at" timestamptz not null, "received_at" timestamptz not null, "source" text not null, "tenant_id" text not null default 'default', "correlation_id" text not null, "causation_id" text null, "subject_type" text not null, "subject_id" text not null, "payload" jsonb not null, "status" text check ("status" in ('RECEIVED', 'PROCESSED', 'FAILED')) not null default 'RECEIVED', "processed_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_event_deleted_at" ON "agent_event" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_event_source_event_id" ON "agent_event" ("source", "event_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_event_status_received_at" ON "agent_event" ("status", "received_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_event_correlation_id" ON "agent_event" ("correlation_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_incident" ("id" text not null, "trigger_event_id" text not null, "incident_type" text not null, "title" text not null, "summary" text null, "priority" text check ("priority" in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) not null default 'MEDIUM', "status" text check ("status" in ('RECEIVED', 'INVESTIGATING', 'OPTIONS_READY', 'AWAITING_APPROVAL', 'EXECUTING', 'MONITORING', 'RESOLVED', 'REJECTED', 'CANCELLED', 'FAILED', 'ESCALATED')) not null default 'RECEIVED', "tenant_id" text not null default 'default', "correlation_id" text not null, "subject_type" text not null, "subject_id" text not null, "owner_id" text null, "context" jsonb null, "resolution" jsonb null, "resolved_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_incident_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_incident_deleted_at" ON "agent_incident" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_incident_trigger_event_id" ON "agent_incident" ("trigger_event_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_incident_status_priority" ON "agent_incident" ("status", "priority") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_incident_correlation_id" ON "agent_incident" ("correlation_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_outbox_event" ("id" text not null, "aggregate_type" text not null, "aggregate_id" text not null, "event_type" text not null, "event_version" integer not null default 1, "payload" jsonb not null, "status" text check ("status" in ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD')) not null default 'PENDING', "idempotency_key" text not null, "attempt_count" integer not null default 0, "available_at" timestamptz not null, "locked_by" text null, "locked_at" timestamptz null, "delivered_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_outbox_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_outbox_event_deleted_at" ON "agent_outbox_event" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_outbox_idempotency_key" ON "agent_outbox_event" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_outbox_status_available_at" ON "agent_outbox_event" ("status", "available_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_recommendation" ("id" text not null, "incident_id" text not null, "run_id" text not null, "action_type" text not null, "risk_level" text check ("risk_level" in ('READ_ONLY', 'LOW', 'MEDIUM', 'HIGH', 'PROHIBITED')) not null, "status" text check ("status" in ('PROPOSED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'FAILED')) not null default 'PROPOSED', "summary" text not null, "rationale" text not null, "evidence" jsonb not null, "proposal" jsonb not null, "expires_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_recommendation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_recommendation_deleted_at" ON "agent_recommendation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_recommendation_incident_id" ON "agent_recommendation" ("incident_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_recommendation_run_id" ON "agent_recommendation" ("run_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_run" ("id" text not null, "incident_id" text not null, "trigger_event_id" text not null, "agent_id" text not null, "agent_version" text not null, "status" text check ("status" in ('RECEIVED', 'INVESTIGATING', 'OPTIONS_READY', 'AWAITING_APPROVAL', 'EXECUTING', 'MONITORING', 'RESOLVED', 'REJECTED', 'CANCELLED', 'FAILED', 'ESCALATED')) not null default 'RECEIVED', "input" jsonb not null, "output" jsonb null, "started_at" timestamptz not null, "completed_at" timestamptz null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_run_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_run_deleted_at" ON "agent_run" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_run_incident_id" ON "agent_run" ("incident_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_run_trigger_event_id_agent_id" ON "agent_run" ("trigger_event_id", "agent_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_approval" cascade;`);

    this.addSql(`drop table if exists "agent_audit_event" cascade;`);

    this.addSql(`drop table if exists "agent_event" cascade;`);

    this.addSql(`drop table if exists "agent_incident" cascade;`);

    this.addSql(`drop table if exists "agent_outbox_event" cascade;`);

    this.addSql(`drop table if exists "agent_recommendation" cascade;`);

    this.addSql(`drop table if exists "agent_run" cascade;`);
  }

}
