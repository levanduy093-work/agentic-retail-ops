import { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"

export type ConfigureTenantSkillWorkflowInput =
  | {
      action: "CREATE_DRAFT"
      actor_id: string
      description: string
      escalation_guidance: string
      name: string
      tenant_id?: string
      when_to_use: string
    }
  | {
      action: "INSTALL_PLATFORM"
      actor_id: string
      configuration?: Record<string, unknown>
      enabled_tool_names?: string[]
      skill_key: string
      skill_version: string
      tenant_id?: string
    }

const configureTenantSkillStep = createStep(
  "configure-tenant-skill",
  async (input: ConfigureTenantSkillWorkflowInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const tenantId = input.tenant_id ?? "default"
    const result = await locking.execute(`agent-skill:${tenantId}`, async () => {
      if (input.action === "CREATE_DRAFT") {
        return service.createTenantSkillDraft(input)
      }
      return service.installPlatformSkill(input)
    })
    return new StepResponse(result)
  }
)

export const configureTenantSkillWorkflow = createWorkflow(
  "configure-tenant-skill",
  function (input: ConfigureTenantSkillWorkflowInput) {
    return new WorkflowResponse(configureTenantSkillStep(input))
  }
)
