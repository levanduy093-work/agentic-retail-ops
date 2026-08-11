import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811122426 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "agent_knowledge_source" drop constraint if exists "agent_knowledge_source_source_type_check";`);

    this.addSql(`delete from "agent_knowledge_source" where "source_type" = 'HTTPS_TEXT';`);

    this.addSql(`alter table if exists "agent_knowledge_source" alter column "source_type" type text using ("source_type"::text);`);
    this.addSql(`alter table if exists "agent_knowledge_source" alter column "source_type" set default 'GOOGLE_DRIVE';`);
    this.addSql(`alter table if exists "agent_knowledge_source" add constraint "agent_knowledge_source_source_type_check" check("source_type" in ('GOOGLE_DOC', 'GOOGLE_SHEET', 'GOOGLE_DRIVE'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "agent_knowledge_source" drop constraint if exists "agent_knowledge_source_source_type_check";`);

    this.addSql(`alter table if exists "agent_knowledge_source" alter column "source_type" type text using ("source_type"::text);`);
    this.addSql(`alter table if exists "agent_knowledge_source" alter column "source_type" set default 'HTTPS_TEXT';`);
    this.addSql(`alter table if exists "agent_knowledge_source" add constraint "agent_knowledge_source_source_type_check" check("source_type" in ('HTTPS_TEXT', 'GOOGLE_DOC', 'GOOGLE_SHEET', 'GOOGLE_DRIVE'));`);
  }

}
