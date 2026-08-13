import {
  AI_PROVIDER_PRIORITY,
  sortAiProvidersByPriority,
} from "../ai-provider-routing"

describe("AI provider routing", () => {
  it("prioritizes Gemini, DeepSeek, then OpenAI for generation", () => {
    expect(AI_PROVIDER_PRIORITY.generation).toEqual([
      "GEMINI",
      "DEEPSEEK",
      "OPENAI",
    ])
    expect(
      sortAiProvidersByPriority(
        [
          { provider: "OPENAI" as const },
          { provider: "DEEPSEEK" as const },
          { provider: "GEMINI" as const },
        ],
        "generation"
      ).map((item) => item.provider)
    ).toEqual(["GEMINI", "DEEPSEEK", "OPENAI"])
  })

  it("uses only Gemini then OpenAI for embeddings", () => {
    expect(
      sortAiProvidersByPriority(
        [
          { provider: "OPENAI" as const },
          { provider: "DEEPSEEK" as const },
          { provider: "GEMINI" as const },
        ],
        "embedding"
      ).map((item) => item.provider)
    ).toEqual(["GEMINI", "OPENAI"])
  })
})
