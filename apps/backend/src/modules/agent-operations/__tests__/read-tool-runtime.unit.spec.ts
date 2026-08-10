import {
  executeAuditSearchTool,
  executeKnowledgeSearchTool,
  executeTraceReplayTool,
} from "../read-tool-runtime"

function createService() {
  return {
    replayAgentTrace: jest.fn(async () => ({
      correlation_id: "corr_1",
      incident_ids: ["aginc_1"],
      returned_count: 0,
      timeline: [],
      truncated: false,
    })),
    searchAgentAuditTrail: jest.fn(async () => ({
      events: [],
      returned_count: 0,
    })),
    searchGovernedKnowledge: jest.fn(async () => ({
      results: [],
      total_candidates: 0,
    })),
  }
}

describe("agent read tool runtime", () => {
  test("executes knowledge search through schema and permission gates", async () => {
    const service = createService()
    const execution = await executeKnowledgeSearchTool(
      service,
      {
        actor_id: "agent_support",
        granted_permissions: ["agent_knowledge:read"],
      },
      { query: "return policy" }
    )

    expect(service.searchGovernedKnowledge).toHaveBeenCalledWith({
      limit: 5,
      query: "return policy",
      tenant_id: "default",
    })
    expect(execution.output).toEqual({ results: [], total_candidates: 0 })
  })

  test("rejects audit search without permission before querying the service", async () => {
    const service = createService()

    await expect(
      executeAuditSearchTool(
        service,
        { actor_id: "agent_support", granted_permissions: [] },
        { incident_id: "aginc_1" }
      )
    ).rejects.toThrow("is not allowed to use agent tool")
    expect(service.searchAgentAuditTrail).not.toHaveBeenCalled()
  })

  test("executes trace replay through the governed read runtime", async () => {
    const service = createService()
    const execution = await executeTraceReplayTool(
      service,
      {
        actor_id: "agent_auditor",
        granted_permissions: ["agent_audit:read"],
        granted_roles: ["operations_manager"],
      },
      { correlation_id: "corr_1" }
    )

    expect(service.replayAgentTrace).toHaveBeenCalledWith({
      correlation_id: "corr_1",
      limit: 200,
    })
    expect(execution.output.correlation_id).toBe("corr_1")
  })
})
