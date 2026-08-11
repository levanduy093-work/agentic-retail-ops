import {
  AGENT_CATALOG,
  AGENT_FOUNDATIONS,
  getAgentCatalogReadiness,
} from "../catalog-registry"
import { createChannelAdapter } from "../channel-gateway"
import { evaluateAssertions } from "../evaluation"
import {
  buildKnowledgeCitation,
  chunkKnowledgeContent,
  checksumKnowledgeContent,
  isKnowledgeEligible,
} from "../knowledge"
import {
  searchKnowledgeChunks,
  searchKnowledgeChunksHybrid,
} from "../tools/platform-read-tools"
import {
  assertModelInvocation,
  DeepSeekChatModelAdapter,
  DisabledModelAdapter,
  GeminiModelAdapter,
  OpenAIResponsesModelAdapter,
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

  it("creates deterministic searchable knowledge chunks with precise citations", () => {
    const content = Array.from(
      { length: 20 },
      (_, index) =>
        `Section ${index + 1}. Customers can check order payment and delivery status with store staff.`
    ).join("\n\n")
    const chunks = chunkKnowledgeContent(content, "policy://orders/1.0", {
      max_characters: 360,
      overlap_characters: 40,
    })

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.content.length <= 360)).toBe(true)
    expect(chunks[0].citation_locator).toBe("policy://orders/1.0#chunk-1")
    expect(chunkKnowledgeContent(content, "policy://orders/1.0")).toEqual(
      chunkKnowledgeContent(content, "policy://orders/1.0")
    )

    const document = {
      approved_at: "2026-08-01T00:00:00.000Z",
      citation_locator: "policy://orders/1.0",
      content,
      document_key: "order-status",
      effective_at: "2026-08-01T00:00:00.000Z",
      expires_at: null,
      id: "agknow_test",
      status: "APPROVED",
      title: "Order status guidance",
      version: "1.0.0",
    }
    const result = searchKnowledgeChunks(
      {
        limit: 2,
        query: "payment delivery",
        tenant_id: "default",
      },
      [document],
      chunks.map((chunk, index) => ({
        ...chunk,
        document_id: document.id,
        id: `agkchunk_${index}`,
      })),
      new Date("2026-08-11T00:00:00.000Z")
    )

    expect(result.results[0]).toMatchObject({
      chunk_id: "agkchunk_0",
      citation_locator: "policy://orders/1.0#chunk-1",
      document_id: document.id,
    })
    expect(result.results[0].quote_checksum).toBe(chunks[0].checksum)
  })

  it("uses semantic retrieval when a customer uses different wording", () => {
    const document = {
      approved_at: "2026-08-01T00:00:00.000Z",
      citation_locator: "policy://delivery/1.0",
      content: "Khách hàng có thể kiểm tra tiến độ giao hàng.",
      document_key: "delivery-progress",
      effective_at: "2026-08-01T00:00:00.000Z",
      expires_at: null,
      id: "agknow_delivery",
      status: "APPROVED",
      title: "Theo dõi giao hàng",
      version: "1.0.0",
    }
    const chunk = {
      checksum: checksumKnowledgeContent(document.content),
      chunk_index: 0,
      citation_locator: "policy://delivery/1.0#chunk-1",
      content: document.content,
      document_id: document.id,
      id: "agkchunk_delivery",
    }

    const lexical = searchKnowledgeChunks(
      {
        limit: 5,
        query: "bưu kiện của tôi đang ở đâu",
        tenant_id: "default",
      },
      [document],
      [chunk],
      new Date("2026-08-11T00:00:00.000Z")
    )
    expect(lexical.results).toHaveLength(0)

    const hybrid = searchKnowledgeChunksHybrid(
      {
        limit: 5,
        query: "bưu kiện của tôi đang ở đâu",
        tenant_id: "default",
      },
      [document],
      [chunk],
      new Map([[chunk.id, 0.92]]),
      new Date("2026-08-11T00:00:00.000Z")
    )
    expect(hybrid.results[0]).toMatchObject({
      chunk_id: chunk.id,
      citation_locator: chunk.citation_locator,
    })
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
        system_prompt: "Use only approved facts.",
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
        system_prompt: "Use only approved facts.",
      })
    ).rejects.toThrow("No model provider is enabled")
  })

  it("uses structured Responses output without exposing provider credentials", async () => {
    const request = jest.fn(async (_url: string, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get("Authorization")
      expect(authorization).toBe("Bearer test-key")
      const body = JSON.parse(String(init?.body))
      expect(body.store).toBe(false)
      expect(body.input[0].content).toBe("Configured support prompt")
      expect(body.text.format).toMatchObject({
        name: "customer_support_draft",
        strict: true,
        type: "json_schema",
      })
      return new Response(
        JSON.stringify({
          output: [
            {
              content: [
                {
                  text: JSON.stringify({ body: "Your order is being prepared." }),
                  type: "output_text",
                },
              ],
            },
          ],
        }),
        { status: 200 }
      )
    })
    const adapter = new OpenAIResponsesModelAdapter(
      "test-key",
      "test-model",
      "https://provider.test/v1",
      request as typeof fetch
    )

    await expect(
      adapter.invoke({
        agent_id: "customer-support-agent",
        input: { question: "Where is my order?" },
        max_tokens: 100,
        output_schema: {
          properties: { body: { type: "string" } },
          required: ["body"],
          type: "object",
        },
        prompt_key: "support",
        prompt_version: "1",
        system_prompt: "Configured support prompt",
      })
    ).resolves.toEqual({ body: "Your order is being prepared." })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it("uses Gemini structured JSON without exposing the API key in the request body", async () => {
    const request = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "https://generativelanguage.test/v1beta/models/gemini-test:generateContent"
      )
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("gemini-key")
      const body = JSON.parse(String(init?.body))
      expect(String(init?.body)).not.toContain("gemini-key")
      expect(body.generationConfig).toMatchObject({
        responseMimeType: "application/json",
      })
      expect(body.system_instruction.parts[0].text).toBe(
        "Configured Gemini support prompt"
      )
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ body: "Đơn đang xử lý." }) }],
              },
            },
          ],
        }),
        { status: 200 }
      )
    })
    const adapter = new GeminiModelAdapter(
      "gemini-key",
      "gemini-test",
      "https://generativelanguage.test/v1beta",
      request as typeof fetch
    )

    await expect(
      adapter.invoke({
        agent_id: "customer-support-agent",
        input: { question: "Đơn hàng ở đâu?" },
        max_tokens: 100,
        output_schema: {
          properties: { body: { type: "string" } },
          required: ["body"],
          type: "object",
        },
        prompt_key: "support",
        prompt_version: "1",
        system_prompt: "Configured Gemini support prompt",
      })
    ).resolves.toEqual({ body: "Đơn đang xử lý." })
  })

  it("uses DeepSeek JSON chat completion without exposing its API key", async () => {
    const request = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.deepseek.test/chat/completions")
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer deepseek-key"
      )
      const body = JSON.parse(String(init?.body))
      expect(String(init?.body)).not.toContain("deepseek-key")
      expect(body).toMatchObject({
        max_tokens: 100,
        model: "deepseek-v4-flash",
        response_format: { type: "json_object" },
        stream: false,
        thinking: { type: "disabled" },
      })
      expect(body.messages[0]).toEqual({
        content: "Configured DeepSeek support prompt",
        role: "system",
      })
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ body: "Đơn đang được chuẩn bị." }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    })
    const adapter = new DeepSeekChatModelAdapter(
      "deepseek-key",
      "deepseek-v4-flash",
      "https://api.deepseek.test",
      request as typeof fetch
    )

    await expect(
      adapter.invoke({
        agent_id: "customer-support-agent",
        input: { question: "Đơn hàng ở đâu?" },
        max_tokens: 100,
        output_schema: {
          properties: { body: { type: "string" } },
          required: ["body"],
          type: "object",
        },
        prompt_key: "support",
        prompt_version: "1",
        system_prompt: "Configured DeepSeek support prompt",
      })
    ).resolves.toEqual({ body: "Đơn đang được chuẩn bị." })
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
