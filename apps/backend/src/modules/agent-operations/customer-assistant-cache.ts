import type { ICachingModuleService } from "@medusajs/framework/types"
import { createHash } from "node:crypto"

export const CUSTOMER_ASSISTANT_CACHE_TTL_SECONDS = {
  catalog: 10,
  conversation_reply: 10 * 60,
  intent: 60 * 60,
  knowledge_answer: 60 * 60,
  knowledge_search: 5 * 60,
  product_advice: 15 * 60,
} as const

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)])
  )
}

export function normalizeCustomerCacheText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim()
}

export function buildCustomerAssistantCacheKey(
  kind: string,
  input: Record<string, unknown>
) {
  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex")
  return `customer-assistant:${kind}:v1:${digest}`
}

export async function readCustomerAssistantCache<T>(
  caching: ICachingModuleService | undefined,
  key: string,
  parse: (value: unknown) => T | null
) {
  if (!caching) return null
  try {
    const cached = await caching.get({ key })
    if (!cached || typeof cached !== "object") return null
    return parse((cached as { value?: unknown }).value)
  } catch {
    return null
  }
}

export async function writeCustomerAssistantCache(
  caching: ICachingModuleService | undefined,
  input: {
    key: string
    tags: string[]
    ttl: number
    value: object
  }
) {
  if (!caching) return
  try {
    await caching.set({
      data: { value: input.value },
      key: input.key,
      tags: input.tags,
      ttl: input.ttl,
    })
  } catch {
    // Cache failure must never block a customer response.
  }
}
