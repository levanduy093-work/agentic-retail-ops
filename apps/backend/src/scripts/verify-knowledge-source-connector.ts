import assert from "node:assert/strict"
import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { approveKnowledgeDocumentWorkflow } from "../workflows/agent-operations/approve-knowledge-document"
import { createKnowledgeSourceWorkflow } from "../workflows/agent-operations/create-knowledge-source"
import { retireKnowledgeDocumentWorkflow } from "../workflows/agent-operations/retire-knowledge-document"
import { syncKnowledgeSourceWorkflow } from "../workflows/agent-operations/sync-knowledge-source"

export default async function verifyKnowledgeSourceConnector({
  container,
}: ExecArgs) {
  const sourceUrl = process.env.KNOWLEDGE_CONNECTOR_TEST_URL
  assert.ok(
    sourceUrl,
    "Set KNOWLEDGE_CONNECTOR_TEST_URL to an allowlisted HTTPS Markdown or text document."
  )

  const verificationId = `verify-connector-${Date.now()}`
  const url = new URL(sourceUrl)
  url.searchParams.set("connector_verification", verificationId)

  const { result: creation } = await createKnowledgeSourceWorkflow(
    container
  ).run({
    input: {
      locale: "en",
      name: "Connector runtime verification",
      owner_id: "knowledge-connector-verifier",
      scope: "operations",
      source_type: "HTTPS_TEXT",
      source_url: url.toString(),
      tenant_id: "default",
    },
  })
  assert.equal(creation.duplicate, false)

  const { result: firstSync } = await syncKnowledgeSourceWorkflow(container).run(
    {
      input: {
        actor_id: "knowledge-connector-verifier",
        source_id: creation.source.id,
      },
    }
  )
  assert.equal(firstSync.status, "SUCCEEDED")
  assert.ok(firstSync.document)
  assert.equal(firstSync.document.status, "DRAFT")

  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const chunks = await service.listAgentKnowledgeChunks({
    document_id: firstSync.document.id,
  })
  assert.ok(chunks.length > 0)

  const { result: secondSync } = await syncKnowledgeSourceWorkflow(container).run(
    {
      input: {
        actor_id: "knowledge-connector-verifier",
        source_id: creation.source.id,
      },
    }
  )
  assert.equal(secondSync.status, "UNCHANGED")
  assert.equal(secondSync.document, null)

  const documents = await service.listAgentKnowledgeDocuments({
    document_key: `source-${creation.source.id}`,
  })
  assert.equal(documents.length, 1)

  await approveKnowledgeDocumentWorkflow(container).run({
    input: {
      actor_id: "knowledge-connector-verifier",
      document_id: firstSync.document.id,
    },
  })
  await retireKnowledgeDocumentWorkflow(container).run({
    input: {
      actor_id: "knowledge-connector-verifier",
      document_id: firstSync.document.id,
      reason: "Completed connector runtime verification",
    },
  })

  console.log(
    JSON.stringify(
      {
        connection_created: true,
        draft_created: true,
        duplicate_draft_prevented: true,
        fetched_chunk_count: chunks.length,
        source_id: creation.source.id,
      },
      null,
      2
    )
  )
}
