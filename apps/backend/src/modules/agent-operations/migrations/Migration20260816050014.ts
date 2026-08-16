import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260816050014 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "agent_customer_preference" ("id" text not null, "tenant_id" text not null default 'default', "customer_id" text not null, "preference_type" text check ("preference_type" in ('SIZE')) not null, "value" text not null, "status" text check ("status" in ('CUSTOMER_STATED', 'CONFIRMED')) not null, "source_conversation_id" text not null, "source_message_id" text not null, "last_confirmed_at" timestamptz not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_customer_preference_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_customer_preference_deleted_at" ON "agent_customer_preference" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_customer_preference_customer_type" ON "agent_customer_preference" ("tenant_id", "customer_id", "preference_type") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_customer_preference_expiry" ON "agent_customer_preference" ("tenant_id", "expires_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_customer_preference" cascade;`);
  }

}
