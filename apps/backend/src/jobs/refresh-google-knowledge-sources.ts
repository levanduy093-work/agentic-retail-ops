import os from "node:os"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"
import { prepareKnowledgeSourceWorkflow } from "../workflows/agent-operations/prepare-knowledge-source"
import { syncKnowledgeSourceWorkflow } from "../workflows/agent-operations/sync-knowledge-source"

const BATCH_SIZE = 100
const KNOWLEDGE_SYNC_ACTOR_ID = `knowledge-source-sync-${os.hostname()}-${process.pid}`

export default async function refreshGoogleKnowledgeSourcesJob(
  container: MedusaContainer
) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const sources = await service.listAgentKnowledgeSources(
    { status: "ACTIVE" },
    { order: { last_checked_at: "ASC" }, take: BATCH_SIZE }
  )

  let changed = 0
  let failed = 0
  let checked = 0
  for (const source of sources) {
    try {
      const { result: sync } = await syncKnowledgeSourceWorkflow(container).run({
        input: {
          actor_id: KNOWLEDGE_SYNC_ACTOR_ID,
          actor_type: "system",
          source_id: source.id,
        },
      })
      checked += 1
      if (sync.status === "FAILED") {
        failed += 1
        continue
      }

      const documentId = sync.document?.id ?? sync.source.last_document_id
      if (!documentId) continue
      const document = await service.retrieveAgentKnowledgeDocument(documentId)
      if (sync.status === "SUCCEEDED" || document.status === "DRAFT") {
        const { result: prepared } = await prepareKnowledgeSourceWorkflow(
          container
        ).run({
          input: {
            actor_id: KNOWLEDGE_SYNC_ACTOR_ID,
            actor_type: "system",
            source_id: source.id,
          },
        })
        if (prepared.rag_index.status !== "INDEXED") {
          failed += 1
          continue
        }
        if (sync.status === "SUCCEEDED") changed += 1
      }
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(`Knowledge source ${source.id} refresh failed: ${message}`)
    }
  }

  if (checked || failed) {
    logger.info(
      `Google knowledge refresh completed: ${checked} checked, ${changed} changed, ${failed} failed.`
    )
  }
}

export const config = {
  name: "refresh-google-knowledge-sources",
  schedule: "*/10 * * * *",
}
