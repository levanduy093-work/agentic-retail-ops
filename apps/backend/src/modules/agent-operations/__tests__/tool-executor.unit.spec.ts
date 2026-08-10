import { z } from "@medusajs/framework/zod"
import { defineAgentTool } from "../tool-contract"
import { executeAgentTool, prepareAgentCommand } from "../tool-executor"

const inputSchema = z.strictObject({ value: z.number().int() })
const outputSchema = z.strictObject({ doubled: z.number().int() })

const readTool = defineAgentTool({
  approval_required: false,
  audit_fields: ["value", "doubled"],
  description: "Read a deterministic value.",
  error_codes: ["INVALID_TOOL_INPUT"],
  idempotency: "NOT_REQUIRED",
  input_schema: inputSchema,
  kind: "READ",
  name: "test.read",
  output_schema: outputSchema,
  permission: "test:read",
  required_role: null,
  retry: {
    backoff: "NONE",
    base_delay_ms: 0,
    max_attempts: 1,
    max_delay_ms: 0,
  },
  risk_level: "READ_ONLY",
  timeout_ms: 1_000,
  version: "1.0.0",
})

const commandTool = defineAgentTool({
  approval_required: true,
  audit_fields: ["value", "doubled"],
  description: "Execute a deterministic command.",
  error_codes: ["INVALID_TOOL_INPUT"],
  idempotency: "REQUIRED",
  input_schema: inputSchema,
  kind: "COMMAND",
  name: "test.command",
  output_schema: outputSchema,
  permission: "test:execute",
  required_role: "operations_manager",
  retry: {
    backoff: "EXPONENTIAL",
    base_delay_ms: 100,
    max_attempts: 3,
    max_delay_ms: 1_000,
  },
  risk_level: "HIGH",
  timeout_ms: 1_000,
  version: "1.0.0",
})

const registry = {
  [commandTool.name]: commandTool,
  [readTool.name]: readTool,
}

describe("agent tool executor", () => {
  test("validates and executes a registered read tool", async () => {
    const execution = await executeAgentTool<
      z.infer<typeof inputSchema>,
      z.infer<typeof outputSchema>
    >(
      registry,
      {
        authority: {
          actor_id: "agent_test",
          granted_permissions: [readTool.permission],
          mode: "DIRECT",
        },
        input: { value: 4 },
        tool_name: readTool.name,
        tool_version: readTool.version,
      },
      async (input) => ({ doubled: input.value * 2 })
    )

    expect(execution.input).toEqual({ value: 4 })
    expect(execution.output).toEqual({ doubled: 8 })
  })

  test("rejects an unregistered tool and a stale version", async () => {
    await expect(
      executeAgentTool(
        registry,
        {
          authority: {
            actor_id: "agent_test",
            granted_permissions: [readTool.permission],
            mode: "DIRECT",
          },
          input: { value: 1 },
          tool_name: "test.missing",
          tool_version: "1.0.0",
        },
        async () => ({ doubled: 2 })
      )
    ).rejects.toThrow("is not registered")

    await expect(
      executeAgentTool(
        registry,
        {
          authority: {
            actor_id: "agent_test",
            granted_permissions: [readTool.permission],
            mode: "DIRECT",
          },
          input: { value: 1 },
          tool_name: readTool.name,
          tool_version: "0.9.0",
        },
        async () => ({ doubled: 2 })
      )
    ).rejects.toThrow("version 0.9.0 is not available")
  })

  test("rejects invalid input before calling the handler", async () => {
    const handler = jest.fn(async () => ({ doubled: 2 }))

    await expect(
      executeAgentTool(
        registry,
        {
          authority: {
            actor_id: "agent_test",
            granted_permissions: [readTool.permission],
            mode: "DIRECT",
          },
          input: { value: "invalid" },
          tool_name: readTool.name,
          tool_version: readTool.version,
        },
        handler
      )
    ).rejects.toThrow("input failed schema validation")
    expect(handler).not.toHaveBeenCalled()
  })

  test("rejects actors without the tool permission", async () => {
    await expect(
      executeAgentTool(
        registry,
        {
          authority: {
            actor_id: "agent_test",
            granted_permissions: [],
            mode: "DIRECT",
          },
          input: { value: 1 },
          tool_name: readTool.name,
          tool_version: readTool.version,
        },
        async () => ({ doubled: 2 })
      )
    ).rejects.toThrow("is not allowed to use agent tool")
  })

  test("rejects handler output that violates the tool contract", async () => {
    await expect(
      executeAgentTool(
        registry,
        {
          authority: {
            actor_id: "agent_test",
            granted_permissions: [readTool.permission],
            mode: "DIRECT",
          },
          input: { value: 1 },
          tool_name: readTool.name,
          tool_version: readTool.version,
        },
        async () => ({ invalid: true })
      )
    ).rejects.toThrow("output failed schema validation")
  })

  test("requires Action Gateway authority for command tools", async () => {
    const handler = jest.fn(async () => ({ doubled: 2 }))

    await expect(
      executeAgentTool(
        registry,
        {
          authority: {
            actor_id: "agent_test",
            granted_permissions: [commandTool.permission],
            mode: "DIRECT",
          },
          input: { value: 1 },
          tool_name: commandTool.name,
          tool_version: commandTool.version,
        },
        handler
      )
    ).rejects.toThrow("must execute through the Action Gateway")
    expect(handler).not.toHaveBeenCalled()
  })

  test("executes command tools with Action Gateway authority", async () => {
    const execution = await executeAgentTool<
      z.infer<typeof inputSchema>,
      z.infer<typeof outputSchema>
    >(
      registry,
      {
        authority: {
          action_request_id: "act_test",
          actor_id: "agent_test",
          approval_id: "appr_test",
          granted_permissions: [commandTool.permission],
          idempotency_key: "act_test:test.command:1",
          mode: "ACTION_GATEWAY",
        },
        input: { value: 3 },
        tool_name: commandTool.name,
        tool_version: commandTool.version,
      },
      async (input) => ({ doubled: input.value * 2 })
    )

    expect(execution.output).toEqual({ doubled: 6 })
  })

  test("requires an Action Gateway idempotency key for commands", async () => {
    await expect(
      executeAgentTool(
        registry,
        {
          authority: {
            action_request_id: "act_test",
            actor_id: "agent_test",
            approval_id: "appr_test",
            granted_permissions: [commandTool.permission],
            idempotency_key: "",
            mode: "ACTION_GATEWAY",
          },
          input: { value: 3 },
          tool_name: commandTool.name,
          tool_version: commandTool.version,
        },
        async () => ({ doubled: 6 })
      )
    ).rejects.toThrow("requires an idempotency key")
  })

  test("prepares commands without executing their handler", () => {
    const prepared = prepareAgentCommand<{ value: number }>(registry, {
      authority: {
        actor_id: "agent_test",
        approval_id: "appr_test",
        granted_permissions: [commandTool.permission],
        idempotency_key: "request:test.command:1",
        mode: "ACTION_GATEWAY_REQUEST",
      },
      input: { value: 5 },
      tool_name: commandTool.name,
      tool_version: commandTool.version,
    })

    expect(prepared.input).toEqual({ value: 5 })
    expect(prepared.definition.name).toBe(commandTool.name)
  })

  test("does not execute a prepared gateway request", async () => {
    const handler = jest.fn(async () => ({ doubled: 10 }))

    await expect(
      executeAgentTool(
        registry,
        {
          authority: {
            actor_id: "agent_test",
            approval_id: "appr_test",
            granted_permissions: [commandTool.permission],
            idempotency_key: "request:test.command:1",
            mode: "ACTION_GATEWAY_REQUEST",
          },
          input: { value: 5 },
          tool_name: commandTool.name,
          tool_version: commandTool.version,
        },
        handler
      )
    ).rejects.toThrow("cannot execute a tool handler")
    expect(handler).not.toHaveBeenCalled()
  })
})
