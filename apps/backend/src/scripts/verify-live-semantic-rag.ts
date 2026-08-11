import assert from "node:assert/strict"
import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import { createKnowledgeRagEngine } from "../modules/agent-operations/knowledge-rag-engine"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { searchKnowledgeChunks } from "../modules/agent-operations/tools/platform-read-tools"
import { approveKnowledgeDocumentWorkflow } from "../workflows/agent-operations/approve-knowledge-document"
import { createKnowledgeDocumentWorkflow } from "../workflows/agent-operations/create-knowledge-document"
import { retireKnowledgeDocumentWorkflow } from "../workflows/agent-operations/retire-knowledge-document"

export default async function verifyLiveSemanticRag({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const verificationId = `verify-live-semantic-rag-${Date.now()}`
  const query = "package mismatch remedy"
  let documentId: string | null = null
  let approved = false

  try {
    const { result: creation } = await createKnowledgeDocumentWorkflow(
      container
    ).run({
      input: {
        citation_locator: `policy://semantic-rag/${verificationId}`,
        content:
          "Returns are accepted when the delivered product differs from the purchased variant. Staff verify the order and photo evidence before offering an exchange.",
        document_key: verificationId,
        effective_at: new Date(Date.now() - 60_000).toISOString(),
        locale: "en",
        owner_id: "semantic-rag-runtime-verifier",
        scope: "semantic_rag_verification",
        tenant_id: "default",
        title: "Semantic return guidance",
        version: "1.0.0",
      },
    })
    documentId = creation.document.id

    const { result: approval } = await approveKnowledgeDocumentWorkflow(
      container
    ).run({
      input: {
        actor_id: "semantic-rag-runtime-verifier",
        document_id: documentId,
      },
    })
    approved = approval.document.status === "APPROVED"
    assert.equal(approved, true)
    assert.equal(approval.rag_index.status, "INDEXED")

    const chunks = await service.listAgentKnowledgeChunks({
      document_id: documentId,
    })
    assert.ok(chunks.length > 0)

    const input = {
      limit: 5,
      locale: "en",
      query,
      scope: "semantic_rag_verification",
      tenant_id: "default",
    }
    const lexical = searchKnowledgeChunks(
      input,
      [approval.document],
      chunks
    )
    assert.equal(lexical.results.length, 0)

    const credential = await service.getActiveAiProviderCredential(
      "embedding",
      "default"
    )
    assert.ok(credential)
    const semantic = await createKnowledgeRagEngine(
      process.env,
      credential
    ).search({
      candidate_limit: 10,
      locale: "en",
      query,
      scope: "semantic_rag_verification",
      tenant_id: "default",
    })
    const chunkIds = new Set(chunks.map((chunk) => chunk.id))
    assert.ok(semantic.some((result) => chunkIds.has(result.chunk_id)))

    const hybrid = await service.searchGovernedKnowledge(input)
    assert.ok(hybrid.results.some((result) => result.document_id === documentId))

    console.log(
      JSON.stringify(
        {
          document_id: documentId,
          hybrid_result_count: hybrid.results.length,
          lexical_result_count: lexical.results.length,
          provider: credential.provider,
          semantic_result_count: semantic.length,
          status: "LIVE_SEMANTIC_RAG_VERIFIED",
        },
        null,
        2
      )
    )
  } finally {
    if (documentId && approved) {
      await retireKnowledgeDocumentWorkflow(container).run({
        input: {
          actor_id: "semantic-rag-runtime-verifier",
          document_id: documentId,
          reason: "Runtime semantic verification completed",
        },
      })
    }
  }
}
