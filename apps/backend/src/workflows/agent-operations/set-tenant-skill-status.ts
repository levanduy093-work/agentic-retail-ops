import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

export type SetTenantSkillStatusWorkflowInput = {
  actor_id: string
  skill_id: string
  status: "DRAFT" | "PAUSED" | "RETIRED" | "SHADOW"
  tenant_id?: string
}

const setTenantSkillStatusStep = createStep(
  "set-tenant-skill-status",
  async (input: SetTenantSkillStatusWorkflowInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    return new StepResponse(await service.setTenantSkillShadowStatus(input))
  }
)

export const setTenantSkillStatusWorkflow = createWorkflow(
  "set-tenant-skill-status",
  function (input: SetTenantSkillStatusWorkflowInput) {
    return new WorkflowResponse(setTenantSkillStatusStep(input))
  }
)
