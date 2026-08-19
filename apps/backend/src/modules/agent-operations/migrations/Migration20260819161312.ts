import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260819161312 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_channel_credential" drop constraint if exists "agent_channel_credential_unique";`);
    this.addSql(`create table if not exists "agent_channel_credential" ("id" text not null, "channel" text check ("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'MESSENGER', 'EMAIL', 'SLACK', 'TEAMS')) not null, "tenant_id" text not null default 'default', "account_ref" text not null default 'primary', "encrypted_secret" text not null, "encryption_iv" text not null, "encryption_tag" text not null, "key_version" text not null default 'v1', "secret_hint" text not null, "encrypted_webhook_secret" text null, "webhook_secret_iv" text null, "webhook_secret_tag" text null, "public_base_url" text null, "updated_by_id" text not null default 'system', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_channel_credential_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_channel_credential_deleted_at" ON "agent_channel_credential" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_channel_credential_unique" ON "agent_channel_credential" ("tenant_id", "channel", "account_ref") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "agent_channel_connection" drop constraint if exists "agent_channel_connection_channel_check";`);

    this.addSql(`alter table if exists "agent_conversation" drop constraint if exists "agent_conversation_channel_check";`);

    this.addSql(`alter table if exists "agent_delivery" drop constraint if exists "agent_delivery_channel_check";`);

    this.addSql(`alter table if exists "agent_message" drop constraint if exists "agent_message_channel_check";`);

    this.addSql(`alter table if exists "agent_channel_connection" add constraint "agent_channel_connection_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'MESSENGER', 'EMAIL', 'SLACK', 'TEAMS'));`);

    this.addSql(`alter table if exists "agent_conversation" add constraint "agent_conversation_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'MESSENGER', 'EMAIL', 'SLACK', 'TEAMS'));`);

    this.addSql(`alter table if exists "agent_delivery" add constraint "agent_delivery_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'MESSENGER', 'EMAIL', 'SLACK', 'TEAMS'));`);

    this.addSql(`alter table if exists "agent_message" add constraint "agent_message_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'MESSENGER', 'EMAIL', 'SLACK', 'TEAMS'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_channel_credential" cascade;`);

    this.addSql(`alter table if exists "agent_channel_connection" drop constraint if exists "agent_channel_connection_channel_check";`);

    this.addSql(`alter table if exists "agent_conversation" drop constraint if exists "agent_conversation_channel_check";`);

    this.addSql(`alter table if exists "agent_delivery" drop constraint if exists "agent_delivery_channel_check";`);

    this.addSql(`alter table if exists "agent_message" drop constraint if exists "agent_message_channel_check";`);

    this.addSql(`alter table if exists "agent_channel_connection" add constraint "agent_channel_connection_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'SLACK', 'TEAMS'));`);

    this.addSql(`alter table if exists "agent_conversation" add constraint "agent_conversation_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'SLACK', 'TEAMS'));`);

    this.addSql(`alter table if exists "agent_delivery" add constraint "agent_delivery_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'SLACK', 'TEAMS'));`);

    this.addSql(`alter table if exists "agent_message" add constraint "agent_message_channel_check" check("channel" in ('IN_APP', 'WEB_PUSH', 'TELEGRAM', 'ZALO', 'SLACK', 'TEAMS'));`);
  }

}
