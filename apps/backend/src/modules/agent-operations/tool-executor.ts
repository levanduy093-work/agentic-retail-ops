import { MedusaError } from "@medusajs/framework/utils"
import { AgentToolDefinition } from "./tool-contract"

export type AgentToolExecutionAuthority =
  | {
      actor_id: string
      granted_permissions: readonly string[]
      granted_roles?: readonly string[]
      mode: "DIRECT"
    }
  | {
      action_request_id: string
      actor_id: string
      approval_id: string | null
      granted_permissions: readonly string[]
      granted_roles?: readonly string[]
      idempotency_key: string
      mode: "ACTION_GATEWAY"
    }
  | {
      actor_id: string
      approval_id: string | null
      granted_permissions: readonly string[]
      granted_roles?: readonly string[]
      idempotency_key: string
      mode: "ACTION_GATEWAY_REQUEST"
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

export type AgentToolRegistry = Readonly<Record<string, AgentToolDefinition>>

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

  if (definition.kind === "COMMAND" && request.authority.mode === "DIRECT") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Command tool ${request.tool_name} must execute through the Action Gateway.`
    )
  }

  if (
    definition.kind === "COMMAND" &&
    definition.approval_required &&
    request.authority.mode !== "DIRECT" &&
    !request.authority.approval_id
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Command tool ${request.tool_name} requires an approved request.`
    )
  }

  if (!request.authority.granted_permissions.includes(definition.permission)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Actor ${request.authority.actor_id} is not allowed to use agent tool ${request.tool_name}.`
    )
  }

  if (
    definition.required_role &&
    !request.authority.granted_roles?.includes(definition.required_role)
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Actor ${request.authority.actor_id} requires role ${definition.required_role} to use agent tool ${request.tool_name}.`
    )
  }

  if (
    definition.idempotency === "REQUIRED" &&
    (request.authority.mode === "DIRECT" ||
      !request.authority.idempotency_key.trim())
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Agent tool ${request.tool_name} requires an idempotency key from the Action Gateway.`
    )
  }

  return definition
}

export function prepareAgentCommand<TInput>(
  registry: AgentToolRegistry,
  request: AgentToolExecutionRequest
) {
  if (request.authority.mode !== "ACTION_GATEWAY_REQUEST") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Agent command preparation requires Action Gateway request authority."
    )
  }

  const definition = resolveAgentTool<TInput, unknown>(registry, request)

  if (definition.kind !== "COMMAND") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Agent tool ${definition.name} is not a command tool.`
    )
  }

  const input = parseToolValue(
    definition,
    definition.input_schema,
    request.input,
    "input"
  )

  return { definition, input }
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
  if (request.authority.mode === "ACTION_GATEWAY_REQUEST") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Prepared Agent Gateway requests cannot execute a tool handler."
    )
  }

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
