export type ModelInvocation = {
  agent_id: string
  input: Record<string, unknown>
  max_tokens: number
  output_schema: Record<string, unknown>
  prompt_key: string
  prompt_version: string
}

export type ModelGatewayAdapter = {
  invoke(input: ModelInvocation): Promise<Record<string, unknown>>
  model: string
  provider: string
}

const SENSITIVE_KEYS = new Set([
  "access_token",
  "authorization",
  "cookie",
  "password",
  "refresh_token",
  "secret",
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
import { MedusaError } from "@medusajs/framework/utils"
