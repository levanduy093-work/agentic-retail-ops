import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260812152823 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_task" add column if not exists "conversation_id" text null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_task_conversation_status" ON "agent_task" ("conversation_id", "status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_agent_task_conversation_status";`);
    this.addSql(`alter table if exists "agent_task" drop column if exists "conversation_id";`);
  }

}
