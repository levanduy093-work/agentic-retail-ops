import { Document } from "@langchain/core/documents"
import { OpenAIEmbeddings } from "@langchain/openai"
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai"
import { EmbeddingsInterface } from "@langchain/core/embeddings"
import {
  QdrantFilter,
  QdrantVectorStore,
} from "@langchain/qdrant"
import { MedusaError } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"

const KNOWLEDGE_VECTOR_NAMESPACE = "897236eb-24d0-4dd2-8b0b-858539199a18"
const DEFAULT_COLLECTION = "agent_knowledge"

export type KnowledgeRagDocument = {
  checksum: string
  chunk_id: string
  citation_locator: string
  content: string
  document_id: string
  document_key: string
  locale: string
  scope: string
  tenant_id: string
  title: string
  version: string
}

export type KnowledgeRagSearchInput = {
  candidate_limit: number
  locale?: string
  query: string
  scope?: string
  tenant_id: string
}

export type KnowledgeRagSearchResult = {
  chunk_id: string
  score: number
}

export type KnowledgeRagIndexResult = {
  indexed_chunks: number
  provider: string
  status: "DISABLED" | "INDEXED"
}

export type KnowledgeRagEngine = {
  deleteDocument(documentId: string): Promise<void>
  indexDocuments(
    documents: KnowledgeRagDocument[]
  ): Promise<KnowledgeRagIndexResult>
  provider: string
  search(input: KnowledgeRagSearchInput): Promise<KnowledgeRagSearchResult[]>
}

export type KnowledgeVectorDeleteResult = {
  deleted_collections: number
  provider: "disabled" | "langchain-qdrant"
  status: "DELETED" | "DISABLED"
}

export type KnowledgeEmbeddingCredential = {
  api_key: string
  dimensions?: number
  model: string
  provider: "deepseek" | "gemini" | "openai"
}

class DisabledKnowledgeRagEngine implements KnowledgeRagEngine {
  provider = "disabled"

  async deleteDocument(_documentId: string) {}

  async indexDocuments(
    _documents: KnowledgeRagDocument[]
  ): Promise<KnowledgeRagIndexResult> {
    return { indexed_chunks: 0, provider: this.provider, status: "DISABLED" }
  }

  async search(_input: KnowledgeRagSearchInput) {
    return []
  }
}

function assertCollectionName(value: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "QDRANT_COLLECTION must contain only letters, numbers, underscores, or dashes."
    )
  }
  return value
}

function pointId(chunkId: string, checksum: string) {
  const bytes = createHash("sha256")
    .update(`${KNOWLEDGE_VECTOR_NAMESPACE}:${chunkId}:${checksum}`)
    .digest()
    .subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const value = bytes.toString("hex")
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function buildFilter(input: KnowledgeRagSearchInput): QdrantFilter {
  const must: NonNullable<QdrantFilter["must"]> = [
    {
      key: "metadata.tenant_id",
      match: { value: input.tenant_id },
    },
  ]
  if (input.scope) {
    must.push({ key: "metadata.scope", match: { value: input.scope } })
  }
  if (input.locale) {
    must.push({ key: "metadata.locale", match: { value: input.locale } })
  }
  return { must }
}

export class LangChainQdrantKnowledgeRagEngine implements KnowledgeRagEngine {
  provider = "langchain-qdrant"
  private payloadIndexesReady?: Promise<void>

  constructor(private readonly store: QdrantVectorStore) {}

  private ensurePayloadIndexes() {
    if (!this.payloadIndexesReady) {
      this.payloadIndexesReady = (async () => {
        await this.store.ensureCollection()
        for (const fieldName of [
          "metadata.tenant_id",
          "metadata.scope",
          "metadata.locale",
          "metadata.document_id",
        ]) {
          await this.store.client.createPayloadIndex(this.store.collectionName, {
            field_name: fieldName,
            field_schema: "keyword",
            wait: true,
          })
        }
        await this.store.client.updateCollection(this.store.collectionName, {
          strict_mode_config: {
            enabled: true,
            unindexed_filtering_retrieve: false,
            unindexed_filtering_update: false,
          },
        })
      })()
    }
    return this.payloadIndexesReady
  }

  async deleteDocument(documentId: string) {
    await this.ensurePayloadIndexes()
    await this.store.delete({
      filter: {
        must: [
          {
            key: "metadata.document_id",
            match: { value: documentId },
          },
        ],
      },
    })
  }

  async indexDocuments(documents: KnowledgeRagDocument[]) {
    if (!documents.length) {
      return { indexed_chunks: 0, provider: this.provider, status: "INDEXED" } as const
    }

    await this.ensurePayloadIndexes()
    await this.store.addDocuments(
      documents.map(
        (document) =>
          new Document({
            id: pointId(document.chunk_id, document.checksum),
            metadata: {
              checksum: document.checksum,
              chunk_id: document.chunk_id,
              citation_locator: document.citation_locator,
              document_id: document.document_id,
              document_key: document.document_key,
              locale: document.locale,
              scope: document.scope,
              tenant_id: document.tenant_id,
              title: document.title,
              version: document.version,
            },
            pageContent: document.content,
          })
      )
    )

    return {
      indexed_chunks: documents.length,
      provider: this.provider,
      status: "INDEXED",
    } as const
  }

  async search(input: KnowledgeRagSearchInput) {
    await this.ensurePayloadIndexes()
    const results = await this.store.similaritySearchWithScore(
      input.query,
      input.candidate_limit,
      buildFilter(input)
    )

    return results.flatMap(([document, score]) => {
      const chunkId = document.metadata.chunk_id
      if (typeof chunkId !== "string" || !Number.isFinite(score)) return []
      return [{ chunk_id: chunkId, score: Math.max(0, score) }]
    })
  }
}

export function getKnowledgeRagRuntimeStatus(
  environment: NodeJS.ProcessEnv = process.env
) {
  const qdrantConfigured = Boolean(environment.QDRANT_URL?.trim())

  return {
    collection:
      environment.QDRANT_COLLECTION?.trim() || DEFAULT_COLLECTION,
    enabled: qdrantConfigured,
    provider: qdrantConfigured ? "langchain-qdrant" : "disabled",
    qdrant_configured: qdrantConfigured,
  }
}

export async function deleteKnowledgeDocumentVectors(
  documentId: string,
  environment: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<KnowledgeVectorDeleteResult> {
  const qdrantUrl = environment.QDRANT_URL?.trim().replace(/\/$/, "")
  if (!qdrantUrl) {
    return {
      deleted_collections: 0,
      provider: "disabled",
      status: "DISABLED",
    }
  }

  const headers = {
    "Content-Type": "application/json",
    ...(environment.QDRANT_API_KEY?.trim()
      ? { "api-key": environment.QDRANT_API_KEY.trim() }
      : {}),
  }
  const collectionsResponse = await fetchImpl(`${qdrantUrl}/collections`, {
    headers,
    method: "GET",
  })
  if (!collectionsResponse.ok) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Qdrant collection discovery returned HTTP ${collectionsResponse.status}.`
    )
  }
  const collectionsPayload = (await collectionsResponse.json()) as {
    result?: { collections?: Array<{ name?: string }> }
  }
  const baseCollectionName = assertCollectionName(
    environment.QDRANT_COLLECTION?.trim() || DEFAULT_COLLECTION
  )
  const collectionNames = (collectionsPayload.result?.collections ?? [])
    .flatMap((collection) =>
      typeof collection.name === "string" ? [collection.name] : []
    )
    .filter(
      (name) =>
        name === baseCollectionName || name.startsWith(`${baseCollectionName}_`)
    )

  for (const collectionName of collectionNames) {
    const deleteResponse = await fetchImpl(
      `${qdrantUrl}/collections/${encodeURIComponent(collectionName)}/points/delete?wait=true`,
      {
        body: JSON.stringify({
          filter: {
            must: [
              {
                key: "metadata.document_id",
                match: { value: documentId },
              },
            ],
          },
        }),
        headers,
        method: "POST",
      }
    )
    if (!deleteResponse.ok) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Qdrant vector deletion returned HTTP ${deleteResponse.status}.`
      )
    }
  }

  return {
    deleted_collections: collectionNames.length,
    provider: "langchain-qdrant",
    status: "DELETED",
  }
}

export function createKnowledgeRagEngine(
  environment: NodeJS.ProcessEnv = process.env,
  credential?: KnowledgeEmbeddingCredential | null
): KnowledgeRagEngine {
  if (!credential) return new DisabledKnowledgeRagEngine()

  const embeddingProvider = credential.provider
  if (embeddingProvider !== "openai" && embeddingProvider !== "gemini") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Connect OpenAI or Gemini for knowledge search before enabling RAG."
    )
  }

  const apiKey = credential.api_key
  const embeddingModel = credential.model
  const qdrantUrl = environment.QDRANT_URL?.trim()
  if (!apiKey || !embeddingModel || !qdrantUrl) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "An Admin-managed AI provider, embedding model, and QDRANT_URL are required when RAG is enabled."
    )
  }

  const dimensions = credential.dimensions
  const baseCollectionName = assertCollectionName(
    environment.QDRANT_COLLECTION?.trim() || DEFAULT_COLLECTION
  )
  const collectionName = assertCollectionName(
    `${baseCollectionName}_${embeddingProvider}_${createHash("sha256")
      .update(embeddingModel)
      .digest("hex")
      .slice(0, 8)}`
  )
  let embeddings: EmbeddingsInterface
  if (embeddingProvider === "gemini") {
    embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey,
      maxRetries: 2,
      model: embeddingModel,
    })
  } else {
    embeddings = new OpenAIEmbeddings({
      apiKey,
      batchSize: 64,
      dimensions,
      maxRetries: 2,
      model: embeddingModel,
      timeout: 5_000,
    })
  }
  const collectionConfig = embeddingProvider === "openai" && dimensions
    ? {
        vectors: {
          distance: "Cosine" as const,
          size: dimensions,
        },
      }
    : undefined
  const store = new QdrantVectorStore(embeddings, {
    apiKey: environment.QDRANT_API_KEY?.trim() || undefined,
    collectionConfig,
    collectionName,
    url: qdrantUrl,
  })

  return new LangChainQdrantKnowledgeRagEngine(store)
}
