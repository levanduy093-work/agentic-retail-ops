import { ModelGatewayAdapter, ModelInvocation } from "../model-gateway"
import { runNativeToolLoop } from "../native-tool-loop"

const invocation: ModelInvocation = {
  agent_id: "customer-support-agent",
  input: { question: "Áo polo size M còn không?" },
  max_tokens: 300,
  prompt_key: "customer-support-tool-loop",
  prompt_version: "1",
  system_prompt: "Use only approved tools.",
  tools: [
    {
      description: "Searches the approved product catalog.",
      name: "search_catalog",
      parameters: { properties: {}, type: "object" },
    },
  ],
}

describe("native tool loop", () => {
  it("executes an allowlisted tool and returns its result to the next model turn", async () => {
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({
        tool_calls: [
          {
            arguments: { query: "áo polo size M" },
            id: "call_1",
            name: "search_catalog",
          },
        ],
      })
      .mockResolvedValueOnce({ body: "Áo polo size M hiện còn hàng." })
    const adapter: ModelGatewayAdapter = {
      invoke,
      model: "test-model",
      provider: "test",
    }
    const executeTool = jest.fn(async () => ({
      products: [{ id: "prod_polo", stock: "IN_STOCK" }],
    }))

    const result = await runNativeToolLoop({
      adapter,
      execute_tool: executeTool,
      invocation,
    })

    expect(result).toMatchObject({
      iterations: 2,
      output: { body: "Áo polo size M hiện còn hàng." },
      termination: "COMPLETE",
      tool_results: [
        {
          call_id: "call_1",
          name: "search_catalog",
          output: { products: [{ id: "prod_polo", stock: "IN_STOCK" }] },
        },
      ],
      trace: [
        {
          call_id: "call_1",
          iteration: 1,
          name: "search_catalog",
          status: "EXECUTED",
        },
      ],
    })
    expect(executeTool).toHaveBeenCalledWith({
      arguments: { query: "áo polo size M" },
      id: "call_1",
      name: "search_catalog",
    })
    expect(invoke.mock.calls[1][0].input).toEqual({
      request: invocation.input,
      tool_results: result.tool_results,
    })
  })

  it("never executes a model-hallucinated tool", async () => {
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({
        tool_calls: [
          {
            arguments: { amount: 1 },
            id: "call_unsafe",
            name: "delete_everything",
          },
        ],
      })
      .mockResolvedValueOnce({ body: "Mình không thể thực hiện thao tác này." })
    const adapter: ModelGatewayAdapter = {
      invoke,
      model: "test-model",
      provider: "test",
    }
    const executeTool = jest.fn()

    const result = await runNativeToolLoop({
      adapter,
      execute_tool: executeTool,
      invocation,
    })

    expect(executeTool).not.toHaveBeenCalled()
    expect(result.trace).toEqual([
      {
        call_id: "call_unsafe",
        iteration: 1,
        name: "delete_everything",
        status: "REJECTED",
      },
    ])
    expect(result.tool_results[0].output).toEqual({
      error: {
        code: "TOOL_UNAVAILABLE",
        message: "The requested tool is unavailable for this conversation.",
      },
    })
  })

  it("stops after its bounded iteration budget", async () => {
    const adapter: ModelGatewayAdapter = {
      invoke: jest.fn(async () => ({
        tool_calls: [
          {
            arguments: { query: "áo polo" },
            id: "call_repeat",
            name: "search_catalog",
          },
        ],
      })),
      model: "test-model",
      provider: "test",
    }

    const result = await runNativeToolLoop({
      adapter,
      execute_tool: async () => ({ products: [] }),
      invocation,
      max_iterations: 2,
    })

    expect(result).toMatchObject({
      iterations: 3,
      output: null,
      termination: "MAX_ITERATIONS",
    })
    expect(result.tool_results).toHaveLength(2)
    expect(adapter.invoke).toHaveBeenLastCalledWith(
      expect.objectContaining({ tools: [] })
    )
  })
})
