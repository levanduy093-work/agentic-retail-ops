import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260811052521 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "agent_knowledge_chunk" ("id" text not null, "document_id" text not null, "chunk_index" integer not null, "content" text not null, "checksum" text not null, "citation_locator" text not null, "word_count" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_knowledge_chunk_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_knowledge_chunk_deleted_at" ON "agent_knowledge_chunk" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_knowledge_chunk_document_index" ON "agent_knowledge_chunk" ("document_id", "chunk_index") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_knowledge_chunk_document_id" ON "agent_knowledge_chunk" ("document_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_knowledge_chunk" cascade;`);
  }

}
