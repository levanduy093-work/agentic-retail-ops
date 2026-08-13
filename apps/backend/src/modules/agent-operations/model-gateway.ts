import { MedusaError } from "@medusajs/framework/utils"

export type ModelInvocation = {
  agent_id: string
  input: Record<string, unknown>
  max_tokens: number
  output_schema: Record<string, unknown>
  prompt_key: string
  prompt_version: string
  system_prompt: string
}

export type ModelGatewayAdapter = {
  invoke(input: ModelInvocation): Promise<Record<string, unknown>>
  model: string
  provider: string
}

const SENSITIVE_KEYS = new Set([
  "access_token",
  "api_key",
  "authorization",
  "cookie",
  "password",
  "private_key",
  "refresh_token",
  "secret",
  "token",
])

export function redactModelInput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactModelInput)
  }
  if (!value || typeof value !== "object") {
    return value
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redactModelInput(entry),
    ])
  )
}

export function assertModelInvocation(input: ModelInvocation) {
  if (input.max_tokens < 1 || input.max_tokens > 8192) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Model max_tokens must be between 1 and 8192."
    )
  }
  if (!Object.keys(input.output_schema).length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A structured output schema is required for model runs."
    )
  }
  if (!input.system_prompt.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A system prompt is required for model runs."
    )
  }
}

export class DisabledModelAdapter implements ModelGatewayAdapter {
  model = "disabled"
  provider = "disabled"

  async invoke(
    _input: ModelInvocation
  ): Promise<Record<string, unknown>> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "No model provider is enabled. Configure an approved provider before model execution."
    )
  }
}

type FetchLike = typeof fetch

export class OpenAIResponsesModelAdapter implements ModelGatewayAdapter {
  provider = "openai"

  constructor(
    private readonly apiKey: string,
    public readonly model: string,
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async invoke(input: ModelInvocation): Promise<Record<string, unknown>> {
    assertModelInvocation(input)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
        body: JSON.stringify({
          input: [
            {
              content: input.system_prompt,
              role: "system",
            },
            {
              content: JSON.stringify(redactModelInput(input.input)),
              role: "user",
            },
          ],
          max_output_tokens: input.max_tokens,
          model: this.model,
          store: false,
          text: {
            format: {
              name: "customer_support_draft",
              schema: input.output_schema,
              strict: true,
              type: "json_schema",
            },
          },
        }),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Model provider returned HTTP ${response.status}.`
        )
      }

      const payload = (await response.json()) as {
        output?: Array<{
          content?: Array<{ refusal?: string; text?: string; type?: string }>
        }>
      }
      const content = payload.output?.flatMap((item) => item.content ?? []) ?? []
      const refusal = content.find((item) => item.type === "refusal")?.refusal
      if (refusal) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "The model provider refused the draft request."
        )
      }
      const outputText = content.find(
        (item) => item.type === "output_text"
      )?.text
      if (!outputText) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The model provider returned no structured output."
        )
      }

      return JSON.parse(outputText) as Record<string, unknown>
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "The model provider returned invalid structured output."
        )
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The model provider timed out."
        )
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}

export class GeminiModelAdapter implements ModelGatewayAdapter {
  provider = "gemini"

  constructor(
    private readonly apiKey: string,
    public readonly model: string,
    private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta",
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async invoke(input: ModelInvocation): Promise<Record<string, unknown>> {
    assertModelInvocation(input)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: JSON.stringify(redactModelInput(input.input)) },
                ],
                role: "user",
              },
            ],
            generationConfig: {
              maxOutputTokens: input.max_tokens,
              responseJsonSchema: input.output_schema,
              responseMimeType: "application/json",
            },
            system_instruction: {
              parts: [
                {
                  text: input.system_prompt,
                },
              ],
            },
          }),
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          method: "POST",
          signal: controller.signal,
        }
      )
      if (!response.ok) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Model provider returned HTTP ${response.status}.`
        )
      }
      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> }
        }>
      }
      const outputText = payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
      if (!outputText) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The model provider returned no structured output."
        )
      }
      return JSON.parse(outputText) as Record<string, unknown>
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "The model provider returned invalid structured output."
        )
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The model provider timed out."
        )
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}

export class DeepSeekChatModelAdapter implements ModelGatewayAdapter {
  provider = "deepseek"

  constructor(
    private readonly apiKey: string,
    public readonly model: string,
    private readonly baseUrl = "https://api.deepseek.com",
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async invoke(input: ModelInvocation): Promise<Record<string, unknown>> {
    assertModelInvocation(input)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        body: JSON.stringify({
          max_tokens: input.max_tokens,
          messages: [
            { content: input.system_prompt, role: "system" },
            {
              content: JSON.stringify(redactModelInput(input.input)),
              role: "user",
            },
          ],
          model: this.model,
          response_format: { type: "json_object" },
          stream: false,
          thinking: { type: "disabled" },
        }),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Model provider returned HTTP ${response.status}.`
        )
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>
      }
      const outputText = payload.choices?.[0]?.message?.content
      if (!outputText) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The model provider returned no structured output."
        )
      }
      return JSON.parse(outputText) as Record<string, unknown>
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "The model provider returned invalid structured output."
        )
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The model provider timed out."
        )
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function createModelAdapter(input: {
  apiKey: string
  model: string
  provider: "deepseek" | "gemini" | "openai"
}): ModelGatewayAdapter {
  if (input.provider === "gemini") {
    return new GeminiModelAdapter(input.apiKey, input.model)
  }
  if (input.provider === "deepseek") {
    return new DeepSeekChatModelAdapter(input.apiKey, input.model)
  }
  return new OpenAIResponsesModelAdapter(input.apiKey, input.model)
}
