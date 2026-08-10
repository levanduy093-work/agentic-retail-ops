import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260810073306 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_action_request" add column if not exists "correlation_id" text null, add column if not exists "tenant_id" text not null default 'default', add column if not exists "permission" text null, add column if not exists "policy_key" text null, add column if not exists "policy_version" text null;`);
    this.addSql(`update "agent_action_request" as "action" set "correlation_id" = coalesce((select "incident"."correlation_id" from "agent_incident" as "incident" where "incident"."id" = "action"."incident_id"), "action"."idempotency_key"), "permission" = case when "action"."tool_name" = 'inventory.execute-transfer' then 'agent_inventory:transfer' else 'agent_action:execute' end, "policy_key" = coalesce((select "approval"."policy_key" from "agent_approval" as "approval" where "approval"."id" = "action"."approval_id"), 'legacy.action.gateway'), "policy_version" = coalesce((select "approval"."policy_version" from "agent_approval" as "approval" where "approval"."id" = "action"."approval_id"), '1.0.0') where "action"."correlation_id" is null or "action"."permission" is null or "action"."policy_key" is null or "action"."policy_version" is null;`);
    this.addSql(`alter table if exists "agent_action_request" alter column "correlation_id" set not null, alter column "permission" set not null, alter column "policy_key" set not null, alter column "policy_version" set not null;`);
    this.addSql(`alter table if exists "agent_action_request" alter column "incident_id" type text using ("incident_id"::text);`);
    this.addSql(`alter table if exists "agent_action_request" alter column "incident_id" drop not null;`);
    this.addSql(`alter table if exists "agent_action_request" alter column "recommendation_id" type text using ("recommendation_id"::text);`);
    this.addSql(`alter table if exists "agent_action_request" alter column "recommendation_id" drop not null;`);
    this.addSql(`alter table if exists "agent_action_request" alter column "approval_id" type text using ("approval_id"::text);`);
    this.addSql(`alter table if exists "agent_action_request" alter column "approval_id" drop not null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_action_request_correlation_id" ON "agent_action_request" ("correlation_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "agent_task" add column if not exists "escalation_reason" text null, add column if not exists "escalated_at" timestamptz null, add column if not exists "escalated_by_id" text null;`);

    this.addSql(`alter table if exists "agent_tool_call" alter column "incident_id" type text using ("incident_id"::text);`);
    this.addSql(`alter table if exists "agent_tool_call" alter column "incident_id" drop not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_agent_action_request_correlation_id";`);
    this.addSql(`alter table if exists "agent_action_request" drop column if exists "correlation_id", drop column if exists "tenant_id", drop column if exists "permission", drop column if exists "policy_key", drop column if exists "policy_version";`);

    this.addSql(`alter table if exists "agent_action_request" alter column "incident_id" type text using ("incident_id"::text);`);
    this.addSql(`alter table if exists "agent_action_request" alter column "incident_id" set not null;`);
    this.addSql(`alter table if exists "agent_action_request" alter column "recommendation_id" type text using ("recommendation_id"::text);`);
    this.addSql(`alter table if exists "agent_action_request" alter column "recommendation_id" set not null;`);
    this.addSql(`alter table if exists "agent_action_request" alter column "approval_id" type text using ("approval_id"::text);`);
    this.addSql(`alter table if exists "agent_action_request" alter column "approval_id" set not null;`);

    this.addSql(`alter table if exists "agent_task" drop column if exists "escalation_reason", drop column if exists "escalated_at", drop column if exists "escalated_by_id";`);

    this.addSql(`alter table if exists "agent_tool_call" alter column "incident_id" type text using ("incident_id"::text);`);
    this.addSql(`alter table if exists "agent_tool_call" alter column "incident_id" set not null;`);
  }

}
