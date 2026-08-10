import { RiskLevel, ToolCallKind } from "./types"

export type AgentToolSchema<T> = {
  parse(value: unknown): T
}

export type AgentToolRetryPolicy = {
  backoff: "EXPONENTIAL" | "NONE"
  base_delay_ms: number
  max_attempts: number
  max_delay_ms: number
}

export type AgentToolDefinition<
  TInput = unknown,
  TOutput = unknown,
  TName extends string = string,
  TVersion extends string = string,
> = {
  approval_required: boolean
  audit_fields: readonly string[]
  description: string
  error_codes: readonly string[]
  idempotency: "NOT_REQUIRED" | "REQUIRED"
  input_schema: AgentToolSchema<TInput>
  kind: ToolCallKind
  name: TName
  output_schema: AgentToolSchema<TOutput>
  permission: string
  required_role: string | null
  retry: AgentToolRetryPolicy
  risk_level: RiskLevel
  timeout_ms: number
  version: TVersion
}

export type AgentToolMetadata = Omit<
  AgentToolDefinition,
  "input_schema" | "output_schema"
>

export function defineAgentTool<
  TInput,
  TOutput,
  const TName extends string,
  const TVersion extends string,
>(
  definition: AgentToolDefinition<TInput, TOutput, TName, TVersion>
) {
  return definition
}

export function toAgentToolMetadata(
  definition: AgentToolDefinition
): AgentToolMetadata {
  return {
    approval_required: definition.approval_required,
    audit_fields: definition.audit_fields,
    description: definition.description,
    error_codes: definition.error_codes,
    idempotency: definition.idempotency,
    kind: definition.kind,
    name: definition.name,
    permission: definition.permission,
    required_role: definition.required_role,
    retry: definition.retry,
    risk_level: definition.risk_level,
    timeout_ms: definition.timeout_ms,
    version: definition.version,
  }
}
