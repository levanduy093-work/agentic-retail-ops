import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811064334 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_knowledge_source" drop constraint if exists "agent_knowledge_source_source_type_check";`);

    this.addSql(`alter table if exists "agent_knowledge_source" add constraint "agent_knowledge_source_source_type_check" check("source_type" in ('HTTPS_TEXT', 'GOOGLE_DOC', 'GOOGLE_SHEET', 'GOOGLE_DRIVE'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "agent_knowledge_source" drop constraint if exists "agent_knowledge_source_source_type_check";`);

    this.addSql(`alter table if exists "agent_knowledge_source" add constraint "agent_knowledge_source_source_type_check" check("source_type" in ('HTTPS_TEXT'));`);
  }

}
