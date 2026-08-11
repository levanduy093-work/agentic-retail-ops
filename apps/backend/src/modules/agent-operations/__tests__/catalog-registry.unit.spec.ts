import { AGENT_CATALOG } from "../catalog-registry"

describe("agent catalog registry", () => {
  test("publishes the implementation status supported by runtime evidence", () => {
    const statuses = Object.fromEntries(
      AGENT_CATALOG.map((agent) => [agent.id, agent.status])
    )

    expect(statuses).toMatchObject({
      "customer-support-agent": "runtime-verified",
      "knowledge-curator-agent": "implemented-static",
      "order-exception-agent": "runtime-verified",
      "workforce-coordinator-agent": "implemented-static",
    })
    expect(statuses["fulfillment-agent"]).toBe("contracted")
  })

  test("keeps the documented status totals visible to the Admin catalog", () => {
    const totals = AGENT_CATALOG.reduce<Record<string, number>>(
      (result, agent) => {
        result[agent.status] = (result[agent.status] ?? 0) + 1
        return result
      },
      {}
    )

    expect(totals).toEqual({
      contracted: 9,
      "implemented-static": 6,
      "runtime-verified": 2,
    })
  })
})
