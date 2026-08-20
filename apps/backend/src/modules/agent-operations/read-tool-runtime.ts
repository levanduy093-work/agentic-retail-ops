import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool } from "./tool-executor"
import {
  AUDIT_SEARCH_TOOL,
  AuditSearchInput,
  AuditSearchOutput,
  KNOWLEDGE_SEARCH_TOOL,
  KnowledgeSearchInput,
  KnowledgeSearchOutput,
  TRACE_REPLAY_TOOL,
  TraceReplayInput,
  TraceReplayOutput,
} from "./tools/platform-read-tools"

export type AgentReadToolAuthority = {
  actor_id: string
  granted_permissions: readonly string[]
  granted_roles?: readonly string[]
}

export type AgentReadToolService = {
  replayAgentTrace(input: TraceReplayInput): Promise<TraceReplayOutput>
  searchAgentAuditTrail(input: AuditSearchInput): Promise<AuditSearchOutput>
  searchGovernedKnowledge(
    input: KnowledgeSearchInput
  ): Promise<KnowledgeSearchOutput>
}

function directAuthority(authority: AgentReadToolAuthority) {
  return { ...authority, mode: "DIRECT" as const }
}

export async function executeKnowledgeSearchTool(
  service: Pick<AgentReadToolService, "searchGovernedKnowledge">,
  authority: AgentReadToolAuthority,
  input: unknown
) {
  return executeAgentTool<KnowledgeSearchInput, KnowledgeSearchOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: directAuthority(authority),
      input,
      tool_name: KNOWLEDGE_SEARCH_TOOL.name,
      tool_version: KNOWLEDGE_SEARCH_TOOL.version,
    },
    (parsed) => service.searchGovernedKnowledge(parsed)
  )
}

export async function executeAuditSearchTool(
  service: AgentReadToolService,
  authority: AgentReadToolAuthority,
  input: unknown
) {
  return executeAgentTool<AuditSearchInput, AuditSearchOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: directAuthority(authority),
      input,
      tool_name: AUDIT_SEARCH_TOOL.name,
      tool_version: AUDIT_SEARCH_TOOL.version,
    },
    (parsed) => service.searchAgentAuditTrail(parsed)
  )
}

export async function executeTraceReplayTool(
  service: AgentReadToolService,
  authority: AgentReadToolAuthority,
  input: unknown
) {
  return executeAgentTool<TraceReplayInput, TraceReplayOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: directAuthority(authority),
      input,
      tool_name: TRACE_REPLAY_TOOL.name,
      tool_version: TRACE_REPLAY_TOOL.version,
    },
    (parsed) => service.replayAgentTrace(parsed)
  )
}
