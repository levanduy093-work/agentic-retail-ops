import {
  AGENT_CATALOG,
  AGENT_FOUNDATIONS,
  getAgentCatalogReadiness,
} from "../catalog-registry"
import { createChannelAdapter } from "../channel-gateway"
import { evaluateAssertions } from "../evaluation"
import {
  buildKnowledgeCitation,
  checksumKnowledgeContent,
  isKnowledgeEligible,
} from "../knowledge"
import {
  assertModelInvocation,
  DisabledModelAdapter,
  redactModelInput,
} from "../model-gateway"
import { evaluatePolicies } from "../policy-engine"
import {
  assertAgentTaskRelease,
  assertAgentTaskTransition,
} from "../task-state-machine"

describe("agent platform foundations", () => {
  it("registers every catalog agent against known shared foundations", () => {
    expect(AGENT_CATALOG).toHaveLength(17)
    expect(new Set(AGENT_CATALOG.map((agent) => agent.id)).size).toBe(17)
    expect(AGENT_FOUNDATIONS.length).toBeGreaterThanOrEqual(10)
    expect(
      getAgentCatalogReadiness().every((agent) =>
        agent.foundation_coverage.every((item) => item.available)
      )
    ).toBe(true)
    expect(
      AGENT_CATALOG.find(
        (agent) => agent.id === "workforce-coordinator-agent"
      )?.status
    ).toBe("implemented-static")
  })

  it("enforces the task lifecycle", () => {
    expect(() => assertAgentTaskTransition("TODO", "CLAIMED")).not.toThrow()
    expect(() =>
      assertAgentTaskTransition("COMPLETED", "IN_PROGRESS")
    ).toThrow("Invalid agent task transition")
  })

  it("only lets the assigned employee return an active task", () => {
    const activeTask = {
      assigned_to_id: "user_staff",
      assigned_to_type: "user",
      status: "IN_PROGRESS" as const,
    }

    expect(() => assertAgentTaskRelease(activeTask, "user_staff")).not.toThrow()
    expect(() => assertAgentTaskRelease(activeTask, "user_other")).toThrow(
      "Only the employee handling this task"
    )
    expect(() =>
      assertAgentTaskRelease(
        { ...activeTask, status: "COMPLETED" },
        "user_staff"
      )
    ).toThrow("Only an active task")
  })

  it("evaluates deterministic approval and prohibited policies", () => {
    const decision = evaluatePolicies(
      [
        {
          action_type: "INVENTORY_TRANSFER",
          conditions: [{ field: "shortfall", operator: "gte", value: 1 }],
          policy_key: "inventory-transfer",
          policy_version: "1",
          required_role: "operations_manager",
          requires_approval: true,
          risk_level: "HIGH",
        },
      ],
      "INVENTORY_TRANSFER",
      { shortfall: 10 }
    )

    expect(decision).toMatchObject({
      allowed: true,
      required_roles: ["operations_manager"],
      requires_approval: true,
      risk_level: "HIGH",
    })

    const prohibited = evaluatePolicies(
      [
        {
          action_type: "PAYMENT_CAPTURE",
          conditions: [],
          policy_key: "no-autonomous-payment",
          policy_version: "1",
          requires_approval: false,
          risk_level: "PROHIBITED",
        },
      ],
      "PAYMENT_CAPTURE",
      {}
    )
    expect(prohibited.allowed).toBe(false)

    const orderedRisk = evaluatePolicies(
      [
        {
          action_type: "TASK_ASSIGN",
          conditions: [],
          policy_key: "higher-risk-first",
          policy_version: "1",
          requires_approval: true,
          risk_level: "HIGH",
        },
        {
          action_type: "TASK_ASSIGN",
          conditions: [],
          policy_key: "lower-risk-last",
          policy_version: "1",
          requires_approval: false,
          risk_level: "LOW",
        },
      ],
      "TASK_ASSIGN",
      {}
    )
    expect(orderedRisk).toMatchObject({
      requires_approval: true,
      risk_level: "HIGH",
    })
  })

  it("only cites approved knowledge that is in effect", () => {
    const document = {
      approved_at: new Date("2026-08-01T00:00:00.000Z"),
      citation_locator: "policy://returns/1.0#eligibility",
      content: "Returns are accepted within the approved policy window.",
      effective_at: new Date("2026-08-01T00:00:00.000Z"),
      expires_at: null,
      status: "APPROVED",
    }

    expect(isKnowledgeEligible(document, new Date("2026-08-10T00:00:00.000Z"))).toBe(true)
    expect(buildKnowledgeCitation(document)).toEqual({
      locator: document.citation_locator,
      quote_checksum: checksumKnowledgeContent(document.content),
    })
    expect(buildKnowledgeCitation({ ...document, status: "DRAFT" })).toBeNull()
  })

  it("redacts model input and rejects unbounded or schema-less runs", async () => {
    expect(
      redactModelInput({
        customer: { email: "safe@example.com", password: "do-not-send" },
        secret: "provider-secret",
      })
    ).toEqual({
      customer: { email: "safe@example.com", password: "[REDACTED]" },
      secret: "[REDACTED]",
    })
    expect(() =>
      assertModelInvocation({
        agent_id: "support-agent",
        input: {},
        max_tokens: 9000,
        output_schema: { type: "object" },
        prompt_key: "support",
        prompt_version: "1",
      })
    ).toThrow("max_tokens")
    await expect(
      new DisabledModelAdapter().invoke({
        agent_id: "support-agent",
        input: {},
        max_tokens: 100,
        output_schema: { type: "object" },
        prompt_key: "support",
        prompt_version: "1",
      })
    ).rejects.toThrow("No model provider is enabled")
  })

  it("scores structured evaluation assertions", () => {
    expect(
      evaluateAssertions(
        { citations: ["policy://returns"], requires_human_review: true },
        [
          { field: "citations", operator: "exists" },
          { field: "requires_human_review", operator: "eq", value: true },
        ]
      )
    ).toMatchObject({ passed: true, score: 1 })
  })

  it("delivers in-app messages and refuses unconfigured external channels", async () => {
    const input = {
      body: "Approval required",
      idempotency_key: "message:1",
      message_id: "agmsg_1",
      recipient_ref: "admin",
    }
    await expect(createChannelAdapter("IN_APP").deliver(input)).resolves.toEqual({
      external_message_id: "agmsg_1",
      status: "DELIVERED",
    })
    await expect(
      createChannelAdapter("TELEGRAM").deliver(input)
    ).rejects.toThrow("no enabled delivery adapter")
  })
})
