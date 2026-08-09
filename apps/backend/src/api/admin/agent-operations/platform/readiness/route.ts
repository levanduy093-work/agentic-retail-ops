import { IRbacModuleService } from "@medusajs/framework/types"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { AGENT_OPERATIONS_MODULE } from "../../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../../modules/agent-operations/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const rbac = req.scope.resolve<IRbacModuleService>(Modules.RBAC)
  const [roles, policies, prompts, scenarios, channels] = await Promise.all([
    rbac.listRbacRoles({ name: "operations_manager" }),
    service.listAgentPolicyDefinitions({ status: "ACTIVE" }),
    service.listAgentPromptTemplates({ status: "ACTIVE" }),
    service.listAgentEvaluationCases({ status: "ACTIVE" }),
    service.listAgentChannelConnections({ status: "ACTIVE" }),
  ])
  const checks = {
    active_channel: channels.length > 0,
    active_evaluation_scenarios: scenarios.length >= 2,
    active_policy: policies.length > 0,
    active_prompt: prompts.length > 0,
    model_provider_configured:
      Boolean(process.env.AGENT_MODEL_PROVIDER) &&
      process.env.AGENT_MODEL_PROVIDER !== "disabled",
    operations_manager_role: roles.length > 0,
    redis_infrastructure_enabled:
      process.env.REDIS_INFRASTRUCTURE_ENABLED === "true" &&
      Boolean(process.env.REDIS_URL),
  }

  res.json({
    checks,
    code_ready: Object.entries(checks)
      .filter(([key]) =>
        [
          "active_channel",
          "active_evaluation_scenarios",
          "active_policy",
          "active_prompt",
          "operations_manager_role",
        ].includes(key)
      )
      .every(([, value]) => value),
    deployment_ready: Object.values(checks).every(Boolean),
  })
}
