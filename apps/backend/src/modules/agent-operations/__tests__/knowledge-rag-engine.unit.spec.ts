import { Document } from "@langchain/core/documents"
import { QdrantVectorStore } from "@langchain/qdrant"
import {
  createKnowledgeRagEngine,
  getKnowledgeRagRuntimeStatus,
  LangChainQdrantKnowledgeRagEngine,
} from "../knowledge-rag-engine"

describe("knowledge RAG engine", () => {
  it("stays disabled unless the open-source RAG runtime is explicitly enabled", () => {
    expect(getKnowledgeRagRuntimeStatus({})).toMatchObject({
      enabled: false,
      provider: "disabled",
    })
    expect(createKnowledgeRagEngine({}).provider).toBe("disabled")
  })

  it("requires an Admin credential and Qdrant infrastructure", () => {
    expect(
      createKnowledgeRagEngine({ QDRANT_URL: "http://localhost:6333" })
        .provider
    ).toBe("disabled")
    expect(() =>
      createKnowledgeRagEngine(
        {},
        {
          api_key: "admin-managed-key",
          model: "text-embedding-3-small",
          provider: "openai",
        }
      )
    ).toThrow("Admin-managed AI provider")
  })

  it("maps governed chunks into LangChain documents and returns Qdrant scores", async () => {
    const addDocuments = jest.fn().mockResolvedValue(undefined)
    const deleteDocuments = jest.fn().mockResolvedValue(undefined)
    const similaritySearchWithScore = jest.fn().mockResolvedValue([
      [
        new Document({
          metadata: { chunk_id: "agkchunk_1" },
          pageContent: "Customers may check delivery progress.",
        }),
        0.91,
      ],
    ])
    const createPayloadIndex = jest.fn().mockResolvedValue(undefined)
    const updateCollection = jest.fn().mockResolvedValue(undefined)
    const engine = new LangChainQdrantKnowledgeRagEngine({
      addDocuments,
      client: { createPayloadIndex, updateCollection },
      collectionName: "agent_knowledge",
      delete: deleteDocuments,
      ensureCollection: jest.fn().mockResolvedValue(undefined),
      similaritySearchWithScore,
    } as unknown as QdrantVectorStore)

    const result = await engine.indexDocuments([
      {
        checksum: "checksum-1",
        chunk_id: "agkchunk_1",
        citation_locator: "policy://orders#chunk-1",
        content: "Customers may check delivery progress.",
        document_id: "agknow_1",
        document_key: "orders",
        locale: "en",
        scope: "customer_support",
        tenant_id: "default",
        title: "Order guidance",
        version: "1.0.0",
      },
    ])

    expect(result).toMatchObject({ indexed_chunks: 1, status: "INDEXED" })
    const indexed = addDocuments.mock.calls[0][0][0] as Document
    expect(indexed.pageContent).toBe("Customers may check delivery progress.")
    expect(indexed.metadata).toMatchObject({
      chunk_id: "agkchunk_1",
      tenant_id: "default",
    })

    await expect(
      engine.search({
        candidate_limit: 10,
        locale: "en",
        query: "Where is my parcel?",
        scope: "customer_support",
        tenant_id: "default",
      })
    ).resolves.toEqual([{ chunk_id: "agkchunk_1", score: 0.91 }])
    expect(similaritySearchWithScore).toHaveBeenCalledWith(
      "Where is my parcel?",
      10,
      expect.objectContaining({ must: expect.any(Array) })
    )
    expect(createPayloadIndex).toHaveBeenCalledTimes(4)
    expect(updateCollection).toHaveBeenCalledWith("agent_knowledge", {
      strict_mode_config: {
        enabled: true,
        unindexed_filtering_retrieve: false,
        unindexed_filtering_update: false,
      },
    })
  })
})
