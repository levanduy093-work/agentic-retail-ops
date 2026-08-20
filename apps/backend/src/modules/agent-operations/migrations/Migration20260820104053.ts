import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260820104053 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_customer_preference" drop constraint if exists "agent_customer_preference_preference_type_check";`);

    this.addSql(`alter table if exists "agent_customer_preference" add constraint "agent_customer_preference_preference_type_check" check("preference_type" in ('SIZE', 'STYLE', 'MEASUREMENTS'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "agent_customer_preference" drop constraint if exists "agent_customer_preference_preference_type_check";`);

    this.addSql(`alter table if exists "agent_customer_preference" add constraint "agent_customer_preference_preference_type_check" check("preference_type" in ('SIZE'));`);
  }

}
