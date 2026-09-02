import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260902010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      with ranked_preferences as (
        select
          "id",
          row_number() over (
            partition by "tenant_id", "customer_id", "preference_type"
            order by "last_confirmed_at" desc, "updated_at" desc, "id" desc
          ) as preference_rank
        from "agent_customer_preference"
        where "deleted_at" is null
      )
      update "agent_customer_preference" as preference
      set "deleted_at" = now(), "updated_at" = now()
      from ranked_preferences
      where preference."id" = ranked_preferences."id"
        and ranked_preferences.preference_rank > 1;
    `)
    this.addSql(`drop index if exists "IDX_agent_customer_preference_expiry";`)
    this.addSql(`drop index if exists "IDX_agent_customer_preference_customer_type";`)
    this.addSql(`alter table if exists "agent_customer_preference" drop column if exists "expires_at";`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_customer_preference_customer_type" ON "agent_customer_preference" ("tenant_id", "customer_id", "preference_type") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_agent_customer_preference_customer_type";`)
    this.addSql(`alter table if exists "agent_customer_preference" add column if not exists "expires_at" timestamptz null;`)
    this.addSql(`update "agent_customer_preference" set "expires_at" = now() + interval '100 years' where "expires_at" is null;`)
    this.addSql(`alter table if exists "agent_customer_preference" alter column "expires_at" set not null;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_customer_preference_customer_type" ON "agent_customer_preference" ("tenant_id", "customer_id", "preference_type") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_customer_preference_expiry" ON "agent_customer_preference" ("tenant_id", "expires_at") WHERE deleted_at IS NULL;`)
  }
}
