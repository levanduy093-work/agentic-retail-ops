import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260810132610 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "agent_action_request" add column if not exists "authorized_roles" jsonb not null default '{"values":[]}';`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "agent_action_request" drop column if exists "authorized_roles";`
    )
  }
}
