import { definePolicies } from "@medusajs/framework/utils"
import { AGENT_RBAC_POLICY_DEFINITIONS } from "../modules/agent-operations/rbac-policies"

export const agentOperationsPolicies = definePolicies(
  AGENT_RBAC_POLICY_DEFINITIONS.map((policy) => ({ ...policy }))
)
