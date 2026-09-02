import { isExplicitPromptAttack } from "./customer-chat-security"

export type GuardrailDecision =
  | { allowed: true }
  | {
      allowed: false
      reason: "PROMPT_ATTACK" | "SENSITIVE_OUTPUT"
    }

function passesLuhnCheck(value: string) {
  const digits = value.replace(/\D/gu, "")
  if (digits.length < 13 || digits.length > 19) return false

  let sum = 0
  let shouldDouble = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

/**
 * Fast deterministic checks around the governed customer-support pipeline.
 * These checks never throw: an unsafe input must still reach the existing
 * deterministic response composer so the customer receives a safe reply.
 */
export class GuardrailsEngine {
  /**
   * Detects explicit attempts to override policy or expose privileged data.
   * Normal customer requests, including refund requests, are not attacks.
   */
  static evaluateInputSafeguard(message: string): GuardrailDecision {
    return isExplicitPromptAttack(message)
      ? { allowed: false, reason: "PROMPT_ATTACK" }
      : { allowed: true }
  }

  /**
   * Verifies if the agent's output is safe to send to the user.
   */
  static evaluateOutputSafeguard(response: string): GuardrailDecision {
    const cardCandidates = response.match(/\b(?:\d[ -]*?){13,19}\b/gu) ?? []
    const sensitiveDataPatterns = [
      /(?:api[ _-]?key|access token|refresh token|password)\s*[:=]/iu,
      /(?:system|developer)\s+(?:prompt|message)\s*[:=]/iu,
    ]

    return cardCandidates.some(passesLuhnCheck) ||
      sensitiveDataPatterns.some((pattern) => pattern.test(response))
      ? { allowed: false, reason: "SENSITIVE_OUTPUT" }
      : { allowed: true }
  }
}
