import { MedusaError } from "@medusajs/framework/utils"
import { AiProvider } from "./types"

export type AiProviderModelOption = {
  description: string | null
  id: string
  label: string
}

export type AiProviderModelCatalog = {
  embedding_models: AiProviderModelOption[]
  generation_models: AiProviderModelOption[]
  provider: AiProvider
}

type FetchLike = typeof fetch

const OPENAI_GENERATION_PREFIXES = [
  "gpt-",
  "o1",
  "o3",
  "o4",
]

const OPENAI_UNSUPPORTED_MARKERS = [
  "audio",
  "codex",
  "embedding",
  "image",
  "moderation",
  "realtime",
  "search",
  "transcribe",
  "tts",
]

function uniqueModels(models: AiProviderModelOption[]) {
  return Array.from(new Map(models.map((model) => [model.id, model])).values())
}

function isOpenAiGenerationModel(id: string) {
  const normalized = id.toLowerCase()
  return (
    !normalized.startsWith("ft:") &&
    OPENAI_GENERATION_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix)
    ) &&
    !OPENAI_UNSUPPORTED_MARKERS.some((marker) => normalized.includes(marker))
  )
}

async function listOpenAiModels(
  apiKey: string,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<AiProviderModelCatalog> {
  const response = await fetchImpl("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  })
  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `OpenAI could not list models (HTTP ${response.status}).`
    )
  }
  const payload = (await response.json()) as {
    data?: Array<{ created?: number; id?: string }>
  }
  const models = (payload.data ?? [])
    .filter((model): model is { created?: number; id: string } =>
      Boolean(model.id)
    )
    .sort((left, right) => (right.created ?? 0) - (left.created ?? 0))
  const toOption = (model: { id: string }): AiProviderModelOption => ({
    description: null,
    id: model.id,
    label: model.id,
  })

  return {
    embedding_models: uniqueModels(
      models
        .filter((model) => model.id.startsWith("text-embedding-"))
        .map(toOption)
    ),
    generation_models: uniqueModels(
      models.filter((model) => isOpenAiGenerationModel(model.id)).map(toOption)
    ),
    provider: "OPENAI",
  }
}

async function listGeminiModels(
  apiKey: string,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<AiProviderModelCatalog> {
  const response = await fetchImpl(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    {
      headers: { "x-goog-api-key": apiKey },
      signal,
    }
  )
  if (!response.ok) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Gemini could not list models (HTTP ${response.status}).`
    )
  }
  const payload = (await response.json()) as {
    models?: Array<{
      baseModelId?: string
      description?: string
      displayName?: string
      name?: string
      supportedGenerationMethods?: string[]
    }>
  }
  const models = (payload.models ?? []).flatMap((model) => {
    const id = model.baseModelId ?? model.name?.replace(/^models\//, "")
    if (!id) return []
    return [
      {
        description: model.description ?? null,
        id,
        label: model.displayName ? `${model.displayName} (${id})` : id,
        methods: model.supportedGenerationMethods ?? [],
      },
    ]
  })
  const toOption = (model: (typeof models)[number]) => ({
    description: model.description,
    id: model.id,
    label: model.label,
  })

  return {
    embedding_models: uniqueModels(
      models
        .filter((model) => model.methods.includes("embedContent"))
        .map(toOption)
    ),
    generation_models: uniqueModels(
      models
        .filter((model) => model.methods.includes("generateContent"))
        .map(toOption)
    ),
    provider: "GEMINI",
  }
}

export async function listAiProviderModels(
  input: { api_key: string; provider: AiProvider },
  fetchImpl: FetchLike = fetch
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    return input.provider === "GEMINI"
      ? await listGeminiModels(input.api_key, fetchImpl, controller.signal)
      : await listOpenAiModels(input.api_key, fetchImpl, controller.signal)
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "The AI provider timed out while listing models."
      )
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
