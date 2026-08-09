import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260809180247 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_outbox_event" add column if not exists "lock_expires_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "agent_outbox_event" drop column if exists "lock_expires_at";`);
  }

}
