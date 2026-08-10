import { MedusaError } from "@medusajs/framework/utils"
import { AgentToolDefinition } from "./tool-contract"

export type AgentToolExecutionAuthority =
  | {
      actor_id: string
      granted_permissions: readonly string[]
      mode: "DIRECT"
    }
  | {
      action_request_id: string
      actor_id: string
      approval_id: string
      granted_permissions: readonly string[]
      idempotency_key: string
      mode: "ACTION_GATEWAY"
    }

export type AgentToolExecutionRequest = {
  authority: AgentToolExecutionAuthority
  input: unknown
  tool_name: string
  tool_version: string
}

export type AgentToolExecutionResult<TInput, TOutput> = {
  definition: AgentToolDefinition<TInput, TOutput>
  input: TInput
  output: TOutput
}

export type AgentToolRegistry = Readonly<
  Record<string, AgentToolDefinition>
>

function resolveAgentTool<TInput, TOutput>(
  registry: AgentToolRegistry,
  request: AgentToolExecutionRequest
) {
  const definition = registry[request.tool_name] as
    | AgentToolDefinition<TInput, TOutput>
    | undefined

  if (!definition) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Agent tool ${request.tool_name} is not registered.`
    )
  }

  if (definition.version !== request.tool_version) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      `Agent tool ${request.tool_name} version ${request.tool_version} is not available.`
    )
  }

  if (
    definition.kind === "COMMAND" &&
    request.authority.mode !== "ACTION_GATEWAY"
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Command tool ${request.tool_name} must execute through the Action Gateway.`
    )
  }

  if (!request.authority.granted_permissions.includes(definition.permission)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Actor ${request.authority.actor_id} is not allowed to use agent tool ${request.tool_name}.`
    )
  }

  if (
    definition.idempotency === "REQUIRED" &&
    (request.authority.mode !== "ACTION_GATEWAY" ||
      !request.authority.idempotency_key.trim())
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Agent tool ${request.tool_name} requires an idempotency key from the Action Gateway.`
    )
  }

  return definition
}

function parseToolValue<T>(
  definition: AgentToolDefinition,
  schema: { parse(value: unknown): T },
  value: unknown,
  boundary: "input" | "output"
) {
  try {
    return schema.parse(value)
  } catch {
    throw new MedusaError(
      boundary === "input"
        ? MedusaError.Types.INVALID_DATA
        : MedusaError.Types.UNEXPECTED_STATE,
      `Agent tool ${definition.name}@${definition.version} ${boundary} failed schema validation.`
    )
  }
}

export async function executeAgentTool<TInput, TOutput>(
  registry: AgentToolRegistry,
  request: AgentToolExecutionRequest,
  handler: (
    input: TInput,
    definition: AgentToolDefinition<TInput, TOutput>
  ) => Promise<TOutput>
): Promise<AgentToolExecutionResult<TInput, TOutput>> {
  const definition = resolveAgentTool<TInput, TOutput>(registry, request)
  const input = parseToolValue(
    definition,
    definition.input_schema,
    request.input,
    "input"
  )
  const rawOutput = await handler(input, definition)
  const output = parseToolValue(
    definition,
    definition.output_schema,
    rawOutput,
    "output"
  )

  return { definition, input, output }
}
