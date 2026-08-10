import {
  assignOrderSlaMetadata,
  ORDER_SLA_POLICY_VERSION,
  resolveOrderSlaPolicy,
} from "../order-sla-assignment"

describe("order SLA assignment", () => {
  const createdAt = "2026-08-11T00:00:00.000Z"

  test("assigns deterministic payment and fulfillment deadlines", () => {
    const result = assignOrderSlaMetadata(
      {
        created_at: createdAt,
        items: [{ requires_shipping: true }],
      },
      {
        fulfillment_sla_minutes: 120,
        payment_sla_minutes: 30,
      }
    )

    expect(result).toEqual({
      changed: true,
      metadata: {
        agent_fulfillment_due_at: "2026-08-11T02:00:00.000Z",
        agent_payment_due_at: "2026-08-11T00:30:00.000Z",
        agent_sla_policy_version: ORDER_SLA_POLICY_VERSION,
        agent_sla_source: "medusa-order-created",
      },
    })
  })

  test("does not assign a fulfillment deadline to digital orders", () => {
    const result = assignOrderSlaMetadata({
      created_at: createdAt,
      items: [{ requires_shipping: false }],
    })

    expect(result.metadata.agent_payment_due_at).toBeDefined()
    expect(result.metadata.agent_fulfillment_due_at).toBeUndefined()
  })

  test("does not assign SLA metadata to draft orders", () => {
    expect(
      assignOrderSlaMetadata({
        created_at: createdAt,
        is_draft_order: true,
        metadata: { purpose: "draft" },
      })
    ).toEqual({ changed: false, metadata: { purpose: "draft" } })
  })

  test("preserves valid OMS deadlines and source metadata", () => {
    const result = assignOrderSlaMetadata({
      created_at: createdAt,
      items: [{ requires_shipping: true }],
      metadata: {
        agent_fulfillment_due_at: "2026-08-20T00:00:00.000Z",
        agent_payment_due_at: "2026-08-12T00:00:00.000Z",
        agent_sla_policy_version: "oms-policy@2",
        agent_sla_source: "oms",
      },
    })

    expect(result.changed).toBe(false)
    expect(result.metadata.agent_sla_source).toBe("oms")
  })

  test("replaces invalid external deadlines with safe defaults", () => {
    const result = assignOrderSlaMetadata({
      created_at: createdAt,
      items: [{ requires_shipping: true }],
      metadata: {
        agent_fulfillment_due_at: "invalid",
        agent_payment_due_at: "invalid",
      },
    })

    expect(result.changed).toBe(true)
    expect(result.metadata.agent_payment_due_at).toBe(
      "2026-08-11T02:00:00.000Z"
    )
    expect(result.metadata.agent_fulfillment_due_at).toBe(
      "2026-08-13T00:00:00.000Z"
    )
  })

  test("bounds environment configuration", () => {
    expect(
      resolveOrderSlaPolicy({
        ORDER_FULFILLMENT_SLA_MINUTES: "999999",
        ORDER_PAYMENT_SLA_MINUTES: "invalid",
      })
    ).toEqual({
      fulfillment_sla_minutes: 43_200,
      payment_sla_minutes: 120,
    })
  })
})
