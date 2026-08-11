import { Embeddings } from "@langchain/core/embeddings"
import { QdrantVectorStore } from "@langchain/qdrant"
import { ExecArgs } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { LangChainQdrantKnowledgeRagEngine } from "../modules/agent-operations/knowledge-rag-engine"

const DIMENSIONS = 16

class VerificationEmbeddings extends Embeddings {
  constructor() {
    super({ maxConcurrency: 2, maxRetries: 0 })
  }

  private vectorize(value: string) {
    const vector = Array.from({ length: DIMENSIONS }, () => 0)
    for (const token of value.toLowerCase().split(/\W+/).filter(Boolean)) {
      let hash = 0
      for (const character of token) {
        hash = (hash * 31 + character.charCodeAt(0)) >>> 0
      }
      vector[hash % DIMENSIONS] += 1
    }
    const magnitude = Math.sqrt(
      vector.reduce((total, entry) => total + entry * entry, 0)
    )
    return magnitude ? vector.map((entry) => entry / magnitude) : vector
  }

  async embedDocuments(documents: string[]) {
    return documents.map((document) => this.vectorize(document))
  }

  async embedQuery(document: string) {
    return this.vectorize(document)
  }
}

export default async function verifyKnowledgeRag(_args: ExecArgs) {
  const url = process.env.QDRANT_URL?.trim() || "http://localhost:6333"
  const collectionName = `agent_knowledge_verify_${Date.now()}`
  const store = new QdrantVectorStore(new VerificationEmbeddings(), {
    collectionConfig: {
      vectors: { distance: "Cosine", size: DIMENSIONS },
    },
    collectionName,
    url,
  })
  const engine = new LangChainQdrantKnowledgeRagEngine(store)

  try {
    const indexed = await engine.indexDocuments([
      {
        checksum: "default-checksum",
        chunk_id: "agkchunk_default",
        citation_locator: "policy://delivery#chunk-1",
        content: "Customers can check delivery status with store staff.",
        document_id: "agknow_default",
        document_key: "delivery-default",
        locale: "en",
        scope: "customer_support",
        tenant_id: "default",
        title: "Delivery guidance",
        version: "1.0.0",
      },
      {
        checksum: "other-checksum",
        chunk_id: "agkchunk_other",
        citation_locator: "policy://other#chunk-1",
        content: "Customers can check delivery status with another shop.",
        document_id: "agknow_other",
        document_key: "delivery-other",
        locale: "en",
        scope: "customer_support",
        tenant_id: "other",
        title: "Other delivery guidance",
        version: "1.0.0",
      },
    ])
    if (indexed.indexed_chunks !== 2) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Qdrant did not index both verification chunks."
      )
    }

    const results = await engine.search({
      candidate_limit: 5,
      locale: "en",
      query: "check delivery status",
      scope: "customer_support",
      tenant_id: "default",
    })
    if (
      results.length !== 1 ||
      results[0].chunk_id !== "agkchunk_default"
    ) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Qdrant metadata filtering did not isolate the tenant."
      )
    }

    await engine.deleteDocument("agknow_default")
    const afterDelete = await engine.search({
      candidate_limit: 5,
      locale: "en",
      query: "check delivery status",
      scope: "customer_support",
      tenant_id: "default",
    })
    if (afterDelete.length) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Retired knowledge remained in the Qdrant index."
      )
    }

    console.log(
      JSON.stringify(
        {
          deletion_verified: true,
          indexed_chunks: indexed.indexed_chunks,
          metadata_filter_verified: true,
          provider: indexed.provider,
          qdrant_url: url,
        },
        null,
        2
      )
    )
  } finally {
    const collections = await store.client.getCollections()
    if (collections.collections.some((item) => item.name === collectionName)) {
      await store.client.deleteCollection(collectionName)
    }
  }
}
