import { listAiProviderModels } from "../ai-provider-models"

describe("AI provider model discovery", () => {
  it("separates OpenAI embedding models from compatible response models", async () => {
    const request = jest.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        "Bearer openai-test-key"
      )
      return new Response(
        JSON.stringify({
          data: [
            { created: 4, id: "gpt-5-mini" },
            { created: 3, id: "gpt-realtime" },
            { created: 2, id: "text-embedding-3-small" },
            { created: 1, id: "whisper-1" },
          ],
        }),
        { status: 200 }
      )
    })

    const catalog = await listAiProviderModels(
      { api_key: "openai-test-key", provider: "OPENAI" },
      request as typeof fetch
    )

    expect(catalog.embedding_models.map((model) => model.id)).toEqual([
      "text-embedding-3-small",
    ])
    expect(catalog.generation_models.map((model) => model.id)).toEqual([
      "gpt-5-mini",
    ])
  })

  it("uses Gemini capabilities to separate embedding and generation", async () => {
    const request = jest.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(
        "gemini-test-key"
      )
      return new Response(
        JSON.stringify({
          models: [
            {
              baseModelId: "gemini-embedding-001",
              displayName: "Gemini Embedding",
              supportedGenerationMethods: ["embedContent"],
            },
            {
              baseModelId: "gemini-2.5-flash",
              displayName: "Gemini 2.5 Flash",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        }),
        { status: 200 }
      )
    })

    const catalog = await listAiProviderModels(
      { api_key: "gemini-test-key", provider: "GEMINI" },
      request as typeof fetch
    )

    expect(catalog.embedding_models[0]).toMatchObject({
      id: "gemini-embedding-001",
    })
    expect(catalog.generation_models[0]).toMatchObject({
      id: "gemini-2.5-flash",
    })
  })
})
