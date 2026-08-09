import {
  INVENTORY_EXECUTE_TRANSFER_TOOL,
  INVENTORY_GET_POSITION_TOOL,
} from "./tools/inventory-tools"

export const AGENT_TOOL_REGISTRY = {
  [INVENTORY_GET_POSITION_TOOL.name]: INVENTORY_GET_POSITION_TOOL,
  [INVENTORY_EXECUTE_TRANSFER_TOOL.name]: INVENTORY_EXECUTE_TRANSFER_TOOL,
} as const

export type AgentToolName = keyof typeof AGENT_TOOL_REGISTRY

export function getAgentToolDefinition(name: AgentToolName) {
  return AGENT_TOOL_REGISTRY[name]
}
