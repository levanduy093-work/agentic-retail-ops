import {
  INVENTORY_EXECUTE_TRANSFER_TOOL,
  INVENTORY_GET_POSITION_TOOL,
} from "./tools/inventory-tools"
import {
  AUDIT_SEARCH_TOOL,
  KNOWLEDGE_SEARCH_TOOL,
  TRACE_REPLAY_TOOL,
} from "./tools/platform-read-tools"
import {
  TASK_ASSIGN_TOOL,
  TASK_CREATE_TOOL,
  TASK_ESCALATE_TOOL,
} from "./tools/task-tools"
import {
  APPROVAL_DECIDE_TOOL,
  APPROVAL_REQUEST_TOOL,
  INCIDENT_CREATE_TOOL,
  INCIDENT_UPDATE_TOOL,
  KNOWLEDGE_PROPOSE_TOOL,
  MESSAGE_SEND_TOOL,
} from "./tools/platform-command-tools"
import { ORDER_READ_TOOL } from "./tools/order-tools"
import { CATALOG_READ_TOOL } from "./tools/catalog-tools"
import { RESPONSE_DRAFT_TOOL } from "./tools/response-tools"
import { AgentToolDefinition, toAgentToolMetadata } from "./tool-contract"
import { AGENT_CATALOG } from "./catalog-registry"

export const AGENT_TOOL_REGISTRY = {
  [APPROVAL_DECIDE_TOOL.name]: APPROVAL_DECIDE_TOOL,
  [APPROVAL_REQUEST_TOOL.name]: APPROVAL_REQUEST_TOOL,
  [AUDIT_SEARCH_TOOL.name]: AUDIT_SEARCH_TOOL,
  [CATALOG_READ_TOOL.name]: CATALOG_READ_TOOL,
  [INVENTORY_GET_POSITION_TOOL.name]: INVENTORY_GET_POSITION_TOOL,
  [INVENTORY_EXECUTE_TRANSFER_TOOL.name]: INVENTORY_EXECUTE_TRANSFER_TOOL,
  [INCIDENT_CREATE_TOOL.name]: INCIDENT_CREATE_TOOL,
  [INCIDENT_UPDATE_TOOL.name]: INCIDENT_UPDATE_TOOL,
  [KNOWLEDGE_SEARCH_TOOL.name]: KNOWLEDGE_SEARCH_TOOL,
  [KNOWLEDGE_PROPOSE_TOOL.name]: KNOWLEDGE_PROPOSE_TOOL,
  [MESSAGE_SEND_TOOL.name]: MESSAGE_SEND_TOOL,
  [ORDER_READ_TOOL.name]: ORDER_READ_TOOL,
  [RESPONSE_DRAFT_TOOL.name]: RESPONSE_DRAFT_TOOL,
  [TASK_ASSIGN_TOOL.name]: TASK_ASSIGN_TOOL,
  [TASK_CREATE_TOOL.name]: TASK_CREATE_TOOL,
  [TASK_ESCALATE_TOOL.name]: TASK_ESCALATE_TOOL,
  [TRACE_REPLAY_TOOL.name]: TRACE_REPLAY_TOOL,
} as const satisfies Readonly<Record<string, AgentToolDefinition>>

export type AgentToolName = keyof typeof AGENT_TOOL_REGISTRY

export function getAgentToolDefinition(name: string) {
  return AGENT_TOOL_REGISTRY[name]
}

export function listAgentToolMetadata() {
  return Object.values(AGENT_TOOL_REGISTRY).map(toAgentToolMetadata)
}

export function getAgentToolCoverage() {
  const catalogTools = [
    ...new Set(AGENT_CATALOG.flatMap((agent) => agent.tools)),
  ].sort()
  const registeredTools = Object.keys(AGENT_TOOL_REGISTRY).sort()

  return {
    catalog_count: catalogTools.length,
    complete: catalogTools.every((tool) => tool in AGENT_TOOL_REGISTRY),
    missing: catalogTools.filter((tool) => !(tool in AGENT_TOOL_REGISTRY)),
    registered_count: registeredTools.length,
    registered_tools: registeredTools,
  }
}
