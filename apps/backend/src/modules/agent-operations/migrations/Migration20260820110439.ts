import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820110439 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_tool_call" add column if not exists "agent_id" text null, add column if not exists "conversation_id" text null;`);
    this.addSql(`alter table if exists "agent_tool_call" alter column "action_request_id" type text using ("action_request_id"::text);`);
    this.addSql(`alter table if exists "agent_tool_call" alter column "action_request_id" drop not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "agent_tool_call" drop column if exists "agent_id", drop column if exists "conversation_id";`);

    this.addSql(`alter table if exists "agent_tool_call" alter column "action_request_id" type text using ("action_request_id"::text);`);
    this.addSql(`alter table if exists "agent_tool_call" alter column "action_request_id" set not null;`);
  }

}
