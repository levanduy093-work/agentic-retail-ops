import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811121035 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_ai_provider_credential" drop constraint if exists "agent_ai_provider_credential_provider_check";`);

    this.addSql(`alter table if exists "agent_ai_provider_credential" add constraint "agent_ai_provider_credential_provider_check" check("provider" in ('OPENAI', 'GEMINI', 'DEEPSEEK'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "agent_ai_provider_credential" drop constraint if exists "agent_ai_provider_credential_provider_check";`);

    this.addSql(`alter table if exists "agent_ai_provider_credential" add constraint "agent_ai_provider_credential_provider_check" check("provider" in ('OPENAI', 'GEMINI'));`);
  }

}
