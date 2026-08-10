import { getAgentToolCoverage, listAgentToolMetadata } from "../tool-registry"

describe("agent tool registry", () => {
  test("reports implemented tools separately from catalog contracts", () => {
    const coverage = getAgentToolCoverage()

    expect(coverage).toMatchObject({
      catalog_count: 24,
      complete: false,
      registered_count: 15,
      registered_tools: [
        "approval.decide",
        "approval.request",
        "audit.search",
        "incident.create",
        "incident.update",
        "inventory.execute-transfer",
        "inventory.get-position",
        "knowledge.propose",
        "knowledge.search",
        "message.send",
        "order.read",
        "task.assign",
        "task.create",
        "task.escalate",
        "trace.replay",
      ],
    })
    expect(coverage.missing).not.toContain("order.read")
    expect(coverage.missing).not.toContain("inventory.get-position")
    expect(coverage.missing).toHaveLength(
      coverage.catalog_count - coverage.registered_count
    )
  })

  test("publishes serializable metadata without runtime schemas", () => {
    const metadata = listAgentToolMetadata()

    expect(metadata).toHaveLength(15)
    expect(metadata[0]).not.toHaveProperty("input_schema")
    expect(metadata[0]).not.toHaveProperty("output_schema")
    expect(metadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idempotency: "REQUIRED",
          kind: "COMMAND",
          name: "inventory.execute-transfer",
          timeout_ms: 60_000,
        }),
      ])
    )
  })
})
