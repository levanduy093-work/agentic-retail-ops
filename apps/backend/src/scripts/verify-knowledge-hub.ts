import assert from "node:assert/strict"
import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { approveKnowledgeDocumentWorkflow } from "../workflows/agent-operations/approve-knowledge-document"
import { createKnowledgeDocumentWorkflow } from "../workflows/agent-operations/create-knowledge-document"
import { retireKnowledgeDocumentWorkflow } from "../workflows/agent-operations/retire-knowledge-document"

export default async function verifyKnowledgeHub({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const verificationId = `verify-knowledge-${Date.now()}`
  const source = `policy://customer-support/${verificationId}`
  const content = [
    "Khi khách hỏi về thanh toán, nhân viên phải kiểm tra trạng thái thanh toán trực tiếp trên đơn hàng.",
    "Khi khách hỏi thời gian giao hàng, nhân viên phải kiểm tra trạng thái chuẩn bị hàng và vận chuyển trước khi trả lời.",
    "Nếu hệ thống chưa có dữ liệu giao hàng, nhân viên cần nói rõ chưa có lịch giao xác nhận và không được tự đoán ngày giao.",
  ].join("\n\n")
  const { result: creation } = await createKnowledgeDocumentWorkflow(
    container
  ).run({
    input: {
      citation_locator: source,
      content,
      document_key: verificationId,
      effective_at: new Date(Date.now() - 60_000).toISOString(),
      locale: "vi",
      owner_id: "knowledge-hub-verifier",
      scope: "customer_support",
      tenant_id: "default",
      title: "Hướng dẫn kiểm tra đơn hàng",
      version: "1.0.0",
    },
  })

  const chunks = await service.listAgentKnowledgeChunks({
    document_id: creation.document.id,
  })
  assert.ok(chunks.length >= 1)
  assert.ok(chunks.every((chunk) => chunk.citation_locator.includes("#chunk-")))

  const beforeApproval = await service.searchGovernedKnowledge({
    limit: 5,
    locale: "vi",
    query: "chưa có lịch giao xác nhận",
    scope: "customer_support",
    tenant_id: "default",
  })
  assert.equal(
    beforeApproval.results.some(
      (result) => result.document_id === creation.document.id
    ),
    false
  )

  const { result: approval } = await approveKnowledgeDocumentWorkflow(
    container
  ).run({
    input: {
      actor_id: "knowledge-hub-verifier",
      document_id: creation.document.id,
    },
  })
  assert.equal(approval.rag_index.status, "INDEXED")
  assert.equal(approval.rag_index.indexed_chunks, chunks.length)
  const approvedSearch = await service.searchGovernedKnowledge({
    limit: 5,
    locale: "vi",
    query: "chưa có lịch giao xác nhận",
    scope: "customer_support",
    tenant_id: "default",
  })
  const match = approvedSearch.results.find(
    (result) => result.document_id === creation.document.id
  )
  assert.ok(match)
  assert.ok(match.citation_locator.startsWith(`${source}#chunk-`))
  assert.ok(match.quote_checksum)

  await retireKnowledgeDocumentWorkflow(container).run({
    input: {
      actor_id: "knowledge-hub-verifier",
      document_id: creation.document.id,
      reason: "Completed lifecycle verification",
    },
  })
  const retiredSearch = await service.searchGovernedKnowledge({
    limit: 5,
    locale: "vi",
    query: "chưa có lịch giao xác nhận",
    scope: "customer_support",
    tenant_id: "default",
  })
  assert.equal(
    retiredSearch.results.some(
      (result) => result.document_id === creation.document.id
    ),
    false
  )

  console.log(
    JSON.stringify(
      {
        approved_search_found_precise_chunk: true,
        approval_rag_index_status: approval.rag_index.status,
        chunk_count: chunks.length,
        draft_excluded_from_search: true,
        document_id: creation.document.id,
        retired_excluded_from_search: true,
      },
      null,
      2
    )
  )
}
