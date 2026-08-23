import {
  CUSTOMER_SUPPORT_ORCHESTRATOR_OUTPUT_SCHEMA,
  CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_KEY,
  CUSTOMER_SUPPORT_ORCHESTRATOR_SYSTEM_PROMPT,
  CustomerSupportOrchestratorDecision,
  reconcileCustomerSupportDecision,
} from "../customer-support-orchestrator"

describe("customer support orchestrator contract", () => {
  it("accepts a bounded contextual routing decision", () => {
    expect(
      CustomerSupportOrchestratorDecision.parse({
        confidence: 0.96,
        intent: "PRODUCT_DISCOVERY",
        needs_immediate_escalation: false,
        reason: "The customer is continuing a product search from the current conversation.",
        requested_action: "NONE",
        sentiment: "NEUTRAL",
        urgency: "NORMAL",
      })
    ).toMatchObject({
      intent: "PRODUCT_DISCOVERY",
      needs_immediate_escalation: false,
    })
  })

  it("rejects routes outside the governed customer-support intents", () => {
    expect(
      CustomerSupportOrchestratorDecision.safeParse({
        confidence: 1,
        intent: "DELETE_DATABASE",
        needs_immediate_escalation: false,
        reason: "Unsafe model route.",
        requested_action: "NONE",
        sentiment: "NEUTRAL",
        urgency: "NORMAL",
      }).success
    ).toBe(false)
  })

  it("defines a managed tool-first context engineering prompt", () => {
    expect(CUSTOMER_SUPPORT_ORCHESTRATOR_PROMPT_KEY).toBe(
      "customer-support.orchestrator"
    )
    expect(CUSTOMER_SUPPORT_ORCHESTRATOR_SYSTEM_PROMPT).toContain(
      "Preserve conversational continuity"
    )
    expect(CUSTOMER_SUPPORT_ORCHESTRATOR_SYSTEM_PROMPT).toContain(
      "choose the minimum necessary tools"
    )
    expect(CUSTOMER_SUPPORT_ORCHESTRATOR_OUTPUT_SCHEMA.required).toContain(
      "needs_immediate_escalation"
    )
  })

  it("keeps requested mutations in the governed human-action lane", () => {
    const decision = CustomerSupportOrchestratorDecision.parse({
      confidence: 0.9,
      intent: "CLARIFY",
      needs_immediate_escalation: false,
      reason: "The order code is missing.",
      requested_action: "CANCEL_ORDER",
      sentiment: "NEUTRAL",
      urgency: "NORMAL",
    })

    expect(
      reconcileCustomerSupportDecision(decision, {
        catalog_ready: false,
        proposal_ready: false,
      }).intent
    ).toBe("HUMAN_ACTION")
  })

  it("uses a model-selected catalog result instead of re-clarifying", () => {
    const decision = CustomerSupportOrchestratorDecision.parse({
      confidence: 0.8,
      intent: "CLARIFY",
      needs_immediate_escalation: false,
      reason: "More style detail could improve ranking.",
      requested_action: "NONE",
      sentiment: "NEUTRAL",
      urgency: "NORMAL",
    })

    expect(
      reconcileCustomerSupportDecision(decision, {
        catalog_ready: true,
        proposal_ready: false,
      }).intent
    ).toBe("PRODUCT_DISCOVERY")
  })
})
