import { EvaluationAssertion } from "./types"

function getValue(input: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") {
      return undefined
    }
    return (value as Record<string, unknown>)[key]
  }, input)
}

export function evaluateAssertions(
  output: Record<string, unknown>,
  assertions: EvaluationAssertion[]
) {
  const results = assertions.map((assertion) => {
    const actual = getValue(output, assertion.field)
    let passed = false

    switch (assertion.operator) {
      case "eq":
        passed = actual === assertion.value
        break
      case "in":
        passed = Array.isArray(assertion.value) && assertion.value.includes(actual)
        break
      case "exists":
        passed = actual !== undefined && actual !== null
        break
      case "not_exists":
        passed = actual === undefined || actual === null
        break
    }

    return { ...assertion, actual, passed }
  })

  return {
    passed: results.every((result) => result.passed),
    results,
    score: results.length
      ? results.filter((result) => result.passed).length / results.length
      : 1,
  }
}
