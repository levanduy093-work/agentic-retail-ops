import { AiProvider } from "./types"

export type AiProviderPurpose = "embedding" | "generation"

export const AI_PROVIDER_PRIORITY: Record<
  AiProviderPurpose,
  readonly AiProvider[]
> = {
  embedding: ["GEMINI", "OPENAI"],
  generation: ["GEMINI", "DEEPSEEK", "OPENAI"],
}

export function sortAiProvidersByPriority<T extends { provider: AiProvider }>(
  providers: T[],
  purpose: AiProviderPurpose
) {
  const priority = AI_PROVIDER_PRIORITY[purpose]
  const rank = new Map(priority.map((provider, index) => [provider, index]))

  return [...providers]
    .filter((provider) => rank.has(provider.provider))
    .sort(
      (left, right) =>
        (rank.get(left.provider) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.provider) ?? Number.MAX_SAFE_INTEGER)
    )
}
