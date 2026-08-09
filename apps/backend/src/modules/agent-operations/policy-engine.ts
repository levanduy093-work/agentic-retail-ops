import { PolicyCondition, RiskLevel } from "./types"

export type PolicyDefinition = {
  action_type: string
  conditions: PolicyCondition[]
  policy_key: string
  policy_version: string
  required_role?: string | null
  requires_approval: boolean
  risk_level: RiskLevel
}

function getValue(input: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") {
      return undefined
    }
    return (value as Record<string, unknown>)[key]
  }, input)
}

export function conditionMatches(
  condition: PolicyCondition,
  input: Record<string, unknown>
) {
  const actual = getValue(input, condition.field)

  switch (condition.operator) {
    case "eq":
      return actual === condition.value
    case "gte":
      return typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual >= condition.value
    case "lte":
      return typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual <= condition.value
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(actual)
  }
}

export function evaluatePolicies(
  policies: PolicyDefinition[],
  actionType: string,
  input: Record<string, unknown>
) {
  const matches = policies.filter(
    (policy) =>
      policy.action_type === actionType &&
      policy.conditions.every((condition) => conditionMatches(condition, input))
  )

  return {
    allowed: !matches.some((policy) => policy.risk_level === "PROHIBITED"),
    matched_policies: matches.map((policy) => ({
      policy_key: policy.policy_key,
      policy_version: policy.policy_version,
    })),
    required_roles: [
      ...new Set(
        matches.flatMap((policy) =>
          policy.required_role ? [policy.required_role] : []
        )
      ),
    ],
    requires_approval: matches.some((policy) => policy.requires_approval),
    risk_level: matches.at(-1)?.risk_level ?? ("READ_ONLY" as RiskLevel),
  }
}
