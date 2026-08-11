import { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"

export default async function reindexAgentKnowledge({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const documents = await service.listAgentKnowledgeDocuments(
    {},
    { order: { created_at: "ASC" }, take: 10_000 }
  )
  let createdChunks = 0
  let indexedDocuments = 0

  for (const document of documents) {
    const result = await service.ensureKnowledgeDocumentChunks(document.id)
    if (result.created) {
      indexedDocuments += 1
      createdChunks += result.chunk_count
    }
  }

  console.log(
    JSON.stringify(
      {
        created_chunks: createdChunks,
        indexed_documents: indexedDocuments,
        scanned_documents: documents.length,
      },
      null,
      2
    )
  )
}
