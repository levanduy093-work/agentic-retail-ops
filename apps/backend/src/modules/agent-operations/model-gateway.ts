import { MedusaError } from "@medusajs/framework/utils"

export type ToolDefinition = {
  description: string
  name: string
  parameters: Record<string, unknown>
}

export type ModelToolCall = {
  arguments: Record<string, unknown>
  id: string
  name: string
}

export type ModelInvocation = {
  agent_id: string
  image_urls?: string[]
  input: Record<string, unknown> | any[]
  tools?: ToolDefinition[]
  max_tokens: number
  output_schema?: Record<string, unknown>
  prompt_key: string
  prompt_version: string
  system_prompt: string
  timeout_ms?: number
}

export type ModelGatewayAdapter = {
  invoke(input: ModelInvocation): Promise<ModelInvocationResult>
  model: string
  provider: string
}

export type ModelInvocationResult = Record<string, unknown> & {
  tool_calls?: ModelToolCall[]
}

const SENSITIVE_KEYS = new Set([
  "access_token",
  "address_1",
  "api_key",
  "authorization",
  "cookie",
  "customer_email",
  "customer_name",
  "customer_phone",
  "email",
  "first_name",
  "last_name",
  "password",
  "phone",
  "private_key",
  "refresh_token",
  "secret",
  "token",
])

const MODEL_INPUT_EMAIL_PATTERN =
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gu
const MODEL_INPUT_PHONE_PATTERN =
  /(?<!\d)(?:\+?84|0)[35789](?:[ .-]?\d){8}(?!\d)/gu
const MODEL_INPUT_PAYMENT_NUMBER_PATTERN =
  /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/gu
const MODEL_INPUT_AUTH_CODE_PATTERN =
  /\b(?:otp|mã xác thực|verification code)\s*[:=]?\s*\d{4,8}\b/giu

export function redactModelText(value: string) {
  return value
    .replace(MODEL_INPUT_EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(MODEL_INPUT_PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(MODEL_INPUT_PAYMENT_NUMBER_PATTERN, "[REDACTED_PAYMENT_NUMBER]")
    .replace(MODEL_INPUT_AUTH_CODE_PATTERN, "[REDACTED_AUTH_CODE]")
}

export function redactModelInput(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactModelInput)
  }
  if (typeof value === "string") {
    return redactModelText(value)
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
  if (!Object.keys(input.output_schema || {}).length && !input.tools?.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A structured output schema is required for model runs."
    )
  }
  if (input.tools) {
    const names = new Set<string>()
    for (const tool of input.tools) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(tool.name) || names.has(tool.name)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Model tool names must be unique and contain only letters, numbers, underscores, or dashes."
        )
      }
      if (!tool.description.trim() || tool.parameters.type !== "object") {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Model tool ${tool.name} requires a description and an object parameter schema.`
        )
      }
      names.add(tool.name)
    }
  }
  if (!input.system_prompt.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A system prompt is required for model runs."
    )
  }
  if (input.image_urls) {
    if (input.image_urls.length > 3) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "A model invocation can include at most three images."
      )
    }
    for (const imageUrl of input.image_urls) {
      try {
        const url = new URL(imageUrl)
        if (url.protocol !== "https:" || url.username || url.password) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Model image inputs must be public HTTPS URLs without credentials."
          )
        }
      } catch (error) {
        if (error instanceof MedusaError) throw error
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Model image inputs must be public HTTPS URLs without credentials."
        )
      }
    }
  }
  if (
    input.timeout_ms !== undefined &&
    (input.timeout_ms < 1_000 || input.timeout_ms > 30_000)
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Model timeout_ms must be between 1000 and 30000."
    )
  }
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value !== "string") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The model provider returned invalid tool arguments."
    )
  }
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "The model provider returned invalid tool arguments."
      )
    }
    return parsed as Record<string, unknown>
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The model provider returned invalid tool arguments."
    )
  }
}

function parseStructuredModelOutput(value: string): ModelInvocationResult {
  const trimmed = value.trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim()
  const candidates = [withoutFence]
  const objectStart = withoutFence.indexOf("{")
  const objectEnd = withoutFence.lastIndexOf("}")
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(withoutFence.slice(objectStart, objectEnd + 1))
  }

  for (const candidate of [...new Set(candidates)]) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as ModelInvocationResult
      }
    } catch {
      // Try the next bounded JSON candidate.
    }
  }
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "The model provider returned invalid structured output."
  )
}

function sanitizeGeminiFunctionSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeGeminiFunctionSchema)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "additionalProperties")
      .map(([key, entry]) => [key, sanitizeGeminiFunctionSchema(entry)])
  )
}

export class DisabledModelAdapter implements ModelGatewayAdapter {
  model = "disabled"
  provider = "disabled"

  async invoke(
    _input: ModelInvocation
  ): Promise<ModelInvocationResult> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "No model provider is enabled. Configure an approved provider before model execution."
    )
  }
}

type FetchLike = typeof fetch

const GEMINI_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])
const MAX_MODEL_IMAGE_BYTES = 5 * 1024 * 1024

async function readBoundedImage(
  response: Response
): Promise<Buffer> {
  const contentLength = Number(response.headers.get("content-length"))
  if (
    !response.ok ||
    !GEMINI_IMAGE_MIME_TYPES.has(
      response.headers.get("content-type")?.split(";", 1)[0] ?? ""
    ) ||
    (Number.isFinite(contentLength) && contentLength > MAX_MODEL_IMAGE_BYTES)
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Gemini image input is invalid or unsupported."
    )
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Gemini image input has no readable content."
    )
  }

  const chunks: Buffer[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_MODEL_IMAGE_BYTES) {
      await reader.cancel()
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Gemini image input exceeds the 5 MB limit."
      )
    }
    chunks.push(Buffer.from(value))
  }
  if (!size) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Gemini image input is empty."
    )
  }
  return Buffer.concat(chunks)
}

export class OpenAIResponsesModelAdapter implements ModelGatewayAdapter {
  provider = "openai"

  constructor(
    private readonly apiKey: string,
    public readonly model: string,
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async invoke(input: ModelInvocation): Promise<ModelInvocationResult> {
    assertModelInvocation(input)
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeout_ms ?? 15_000
    )

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
        body: JSON.stringify({
          input: [
            {
              content: input.system_prompt,
              role: "system",
            },
            {
              content: [
                {
                  text: JSON.stringify(redactModelInput(input.input)),
                  type: "input_text",
                },
                ...(input.image_urls ?? []).map((imageUrl) => ({
                  detail: "low",
                  image_url: imageUrl,
                  type: "input_image",
                })),
              ],
              role: "user",
            },
          ],
          max_output_tokens: input.max_tokens,
          model: this.model,
          store: false,
          ...(input.tools?.length
            ? {
                tools: input.tools.map((tool) => ({
                  description: tool.description,
                  name: tool.name,
                  parameters: tool.parameters,
                  strict: true,
                  type: "function",
                })),
              }
            : {}),
          ...(input.output_schema
            ? {
                text: {
                  format: {
                    name: "customer_support_draft",
                    schema: input.output_schema,
                    strict: true,
                    type: "json_schema",
                  },
                },
              }
            : {}),
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
          arguments?: string
          call_id?: string
          content?: Array<{ refusal?: string; text?: string; type?: string }>
          name?: string
          type?: string
        }>
      }
      const toolCalls = (payload.output ?? [])
        .filter((item) => item.type === "function_call")
        .map((item, index) => {
          if (!item.name) {
            throw new MedusaError(
              MedusaError.Types.INVALID_DATA,
              "The model provider returned a function call without a name."
            )
          }
          return {
            arguments: parseToolArguments(item.arguments),
            id: item.call_id ?? `model-call-${index + 1}`,
            name: item.name,
          }
        })
      if (toolCalls.length) return { tool_calls: toolCalls }
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

      return parseStructuredModelOutput(outputText)
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
    private readonly fetchImpl: FetchLike = fetch,
    private readonly imageFetchImpl: FetchLike = fetch
  ) {}

  async invoke(input: ModelInvocation): Promise<ModelInvocationResult> {
    assertModelInvocation(input)
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeout_ms ?? 15_000
    )
    try {
      const imageParts = await Promise.all(
        (input.image_urls ?? []).map(async (imageUrl) => {
          const response = await this.imageFetchImpl(imageUrl, {
            signal: controller.signal,
          })
          const mimeType = response.headers.get("content-type")?.split(";", 1)[0]
          const content = await readBoundedImage(response)
          return {
            inlineData: {
              data: content.toString("base64"),
              mimeType,
            },
          }
        })
      )
      const response = await this.fetchImpl(
        `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: JSON.stringify(redactModelInput(input.input)) },
                  ...imageParts,
                ],
                role: "user",
              },
            ],
            generationConfig: {
              maxOutputTokens: input.max_tokens,
              ...(input.output_schema && !input.tools?.length
                ? {
                    responseJsonSchema: input.output_schema,
                    responseMimeType: "application/json",
                  }
                : {}),
            },
            system_instruction: {
              parts: [
                {
                  text: input.system_prompt,
                },
              ],
            },
            ...(input.tools?.length
              ? {
                  tools: [
                    {
                      functionDeclarations: input.tools.map((tool) => ({
                        description: tool.description,
                        name: tool.name,
                        parameters: sanitizeGeminiFunctionSchema(tool.parameters),
                      })),
                    },
                  ],
                }
              : {}),
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
          content?: {
            parts?: Array<{
              functionCall?: {
                args?: Record<string, unknown>
                id?: string
                name?: string
              }
              text?: string
            }>
          }
        }>
      }
      const parts = payload.candidates?.[0]?.content?.parts ?? []
      const toolCalls = parts.flatMap((part, index) => {
        if (!part.functionCall?.name) return []
        return [{
          arguments: parseToolArguments(part.functionCall.args ?? {}),
          id: part.functionCall.id ?? `model-call-${index + 1}`,
          name: part.functionCall.name,
        }]
      })
      if (toolCalls.length) return { tool_calls: toolCalls }
      const outputText = parts
        ?.map((part) => part.text ?? "")
        .join("")
      if (!outputText) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The model provider returned no structured output."
        )
      }
      return parseStructuredModelOutput(outputText)
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

  async invoke(input: ModelInvocation): Promise<ModelInvocationResult> {
    assertModelInvocation(input)
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      input.timeout_ms ?? 30_000
    )
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        body: JSON.stringify({
          max_tokens: input.max_tokens,
          messages: [
            {
              content: `${input.system_prompt}\nReturn only valid JSON matching this JSON Schema: ${JSON.stringify(
                input.output_schema
              )}`,
              role: "system",
            },
            {
              content: JSON.stringify(redactModelInput(input.input)),
              role: "user",
            },
          ],
          model: this.model,
          ...(input.tools?.length
            ? {
                tools: input.tools.map((tool) => ({
                  function: {
                    description: tool.description,
                    name: tool.name,
                    parameters: tool.parameters,
                  },
                  type: "function",
                })),
              }
            : { response_format: { type: "json_object" } }),
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
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        const providerMessage = payload?.error?.message
          ?.replace(/[\r\n\t]+/g, " ")
          .slice(0, 300)
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Model provider returned HTTP ${response.status}${
            providerMessage ? `: ${providerMessage}` : "."
          }`
        )
      }
      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null
            tool_calls?: Array<{
              function?: { arguments?: string; name?: string }
              id?: string
            }>
          }
        }>
      }
      const toolCalls = (payload.choices?.[0]?.message?.tool_calls ?? []).map(
        (toolCall, index) => {
          if (!toolCall.function?.name) {
            throw new MedusaError(
              MedusaError.Types.INVALID_DATA,
              "The model provider returned a function call without a name."
            )
          }
          return {
            arguments: parseToolArguments(toolCall.function.arguments),
            id: toolCall.id ?? `model-call-${index + 1}`,
            name: toolCall.function.name,
          }
        }
      )
      if (toolCalls.length) return { tool_calls: toolCalls }
      const outputText = payload.choices?.[0]?.message?.content
      if (!outputText) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The model provider returned no structured output."
        )
      }
      return parseStructuredModelOutput(outputText)
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
