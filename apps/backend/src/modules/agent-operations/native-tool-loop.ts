import { MedusaError } from "@medusajs/framework/utils"
import {
  ModelGatewayAdapter,
  ModelInvocation,
  ModelInvocationResult,
  ModelToolCall,
  ModelUsage,
  sumModelUsage,
} from "./model-gateway"

export type NativeToolLoopTrace = {
  call_id: string
  iteration: number
  name: string
  status: "EXECUTED" | "REJECTED"
}

export type NativeToolLoopResult = {
  iterations: number
  output: ModelInvocationResult | null
  termination: "COMPLETE" | "MAX_ITERATIONS"
  tool_results: Array<{
    call_id: string
    name: string
    output: Record<string, unknown>
  }>
  trace: NativeToolLoopTrace[]
  usage?: ModelUsage
}

export type NativeToolCallExecutor = (
  call: ModelToolCall
) => Promise<Record<string, unknown>>

export type RunNativeToolLoopInput = {
  adapter: ModelGatewayAdapter
  execute_tool: NativeToolCallExecutor
  invocation: ModelInvocation
  max_iterations?: number
}

function getSafeToolFailure() {
  return {
    error: {
      code: "TOOL_UNAVAILABLE",
      message: "The requested tool is unavailable for this conversation.",
    },
  }
}

export async function runNativeToolLoop(
  input: RunNativeToolLoopInput
): Promise<NativeToolLoopResult> {
  const maxIterations = input.max_iterations ?? 3
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 5) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Native tool loops must run between one and five iterations."
    )
  }

  const allowedToolNames = new Set(
    (input.invocation.tools ?? []).map((tool) => tool.name)
  )
  const toolResults: NativeToolLoopResult["tool_results"] = []
  const trace: NativeToolLoopTrace[] = []
  const usages: Array<ModelUsage | undefined> = []

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const output = await input.adapter.invoke({
      ...input.invocation,
      input: {
        request: input.invocation.input,
        tool_results: toolResults,
      },
    })
    const toolCalls = output.tool_calls ?? []
    usages.push(output.usage)
    if (!toolCalls.length) {
      return {
        iterations: iteration,
        output,
        termination: "COMPLETE",
        tool_results: toolResults,
        trace,
        usage: sumModelUsage(usages),
      }
    }

    for (const toolCall of toolCalls) {
      if (!allowedToolNames.has(toolCall.name)) {
        trace.push({
          call_id: toolCall.id,
          iteration,
          name: toolCall.name,
          status: "REJECTED",
        })
        toolResults.push({
          call_id: toolCall.id,
          name: toolCall.name,
          output: getSafeToolFailure(),
        })
        continue
      }

      try {
        const toolOutput = await input.execute_tool(toolCall)
        trace.push({
          call_id: toolCall.id,
          iteration,
          name: toolCall.name,
          status: "EXECUTED",
        })
        toolResults.push({
          call_id: toolCall.id,
          name: toolCall.name,
          output: toolOutput,
        })
      } catch {
        trace.push({
          call_id: toolCall.id,
          iteration,
          name: toolCall.name,
          status: "REJECTED",
        })
        toolResults.push({
          call_id: toolCall.id,
          name: toolCall.name,
          output: getSafeToolFailure(),
        })
      }
    }
  }

  // Once the tool budget is exhausted, force one tool-free synthesis turn.
  // This prevents a capable provider from losing already validated read-tool
  // results merely because it kept requesting more searches instead of
  // emitting the required structured decision.
  const finalOutput = await input.adapter.invoke({
    ...input.invocation,
    input: {
      request: input.invocation.input,
      tool_budget_exhausted: true,
      tool_results: toolResults,
    },
    tools: [],
  })
  usages.push(finalOutput.usage)
  if (!(finalOutput.tool_calls ?? []).length) {
    return {
      iterations: maxIterations + 1,
      output: finalOutput,
      termination: "COMPLETE",
      tool_results: toolResults,
      trace,
      usage: sumModelUsage(usages),
    }
  }

  return {
    iterations: maxIterations + 1,
    output: null,
    termination: "MAX_ITERATIONS",
    tool_results: toolResults,
    trace,
    usage: sumModelUsage(usages),
  }
}
