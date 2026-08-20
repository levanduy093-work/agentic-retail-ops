import { NativeToolLoopTrace } from "./native-tool-loop"

export type NativeToolLoopEvaluationAssertion = {
  id: "completion" | "no-rejected-calls" | "allowlisted-tool-names"
  passed: boolean
}

export type NativeToolLoopEvaluation = {
  safe_to_use: boolean
  score: number
  assertions: NativeToolLoopEvaluationAssertion[]
}

type EvaluateNativeToolLoopInput = {
  allowed_tool_names: ReadonlySet<string>
  termination: "COMPLETE" | "MAX_ITERATIONS"
  trace: NativeToolLoopTrace[]
}

/**
 * Evaluates deterministic safety properties for using a native-tool-loop result
 * as response context. This is not a rollout gate: ACTIVE mode always invokes
 * the native harness. A failed or rejected trace simply cannot supply facts to
 * the customer-facing response.
 */
export function evaluateNativeToolLoop(
  input: EvaluateNativeToolLoopInput
): NativeToolLoopEvaluation {
  const assertions: NativeToolLoopEvaluationAssertion[] = [
    {
      id: "completion",
      passed: input.termination === "COMPLETE",
    },
    {
      id: "no-rejected-calls",
      passed: input.trace.every((entry) => entry.status === "EXECUTED"),
    },
    {
      id: "allowlisted-tool-names",
      passed: input.trace.every((entry) =>
        input.allowed_tool_names.has(entry.name)
      ),
    },
  ]
  const passedCount = assertions.filter((assertion) => assertion.passed).length

  return {
    assertions,
    safe_to_use: passedCount === assertions.length,
    score: Math.round((passedCount / assertions.length) * 10_000),
  }
}
