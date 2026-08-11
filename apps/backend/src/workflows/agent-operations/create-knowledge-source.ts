import { ILockingModule } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { validateKnowledgeSource } from "../../modules/agent-operations/knowledge-connector"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import { CreateKnowledgeSourceInput } from "../../modules/agent-operations/types"

const createKnowledgeSourceStep = createStep(
  "create-knowledge-source",
  async (input: CreateKnowledgeSourceInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const normalizedUrl = await validateKnowledgeSource(
      input.source_url,
      input.source_type
    )
    if (input.source_type !== "HTTPS_TEXT") {
      const status = await service.getGoogleKnowledgeConnectorStatus(
        input.tenant_id ?? "default"
      )
      if (!status.connected) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Connect a Google account before adding Google documents."
        )
      }
    }
    return new StepResponse(
      await locking.execute(
        `agent-knowledge-source:${input.tenant_id ?? "default"}:${normalizedUrl}`,
        () =>
          service.createGovernedKnowledgeSource({
            ...input,
            source_url: normalizedUrl,
          })
      )
    )
  }
)

export const createKnowledgeSourceWorkflow = createWorkflow(
  "create-knowledge-source",
  function (input: CreateKnowledgeSourceInput) {
    return new WorkflowResponse(createKnowledgeSourceStep(input))
  }
)
