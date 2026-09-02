import { Document } from "@langchain/core/documents"
import { QdrantVectorStore } from "@langchain/qdrant"
import {
  createKnowledgeRagEngine,
  deleteKnowledgeDocumentVectors,
  getKnowledgeRagRuntimeStatus,
  LangChainQdrantKnowledgeRagEngine,
  probeKnowledgeRagRuntime,
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

  it("checks Qdrant reachability instead of treating configuration as readiness", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }))

    await expect(
      probeKnowledgeRagRuntime(
        {
          QDRANT_API_KEY: "qdrant-key",
          QDRANT_URL: "http://qdrant:6333/",
        },
        fetchImpl as typeof fetch
      )
    ).resolves.toEqual({
      checked: true,
      http_status: 200,
      reachable: true,
      status: "READY",
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://qdrant:6333/collections",
      expect.objectContaining({
        headers: { "api-key": "qdrant-key" },
        method: "GET",
      })
    )
  })

  it("reports an unreachable or disabled Qdrant runtime without throwing", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("offline"))

    await expect(
      probeKnowledgeRagRuntime(
        { QDRANT_URL: "http://qdrant:6333" },
        fetchImpl as typeof fetch
      )
    ).resolves.toMatchObject({
      checked: true,
      reachable: false,
      status: "UNREACHABLE",
    })
    await expect(probeKnowledgeRagRuntime({})).resolves.toMatchObject({
      checked: false,
      reachable: false,
      status: "DISABLED",
    })
  })

  it("deletes a document from every current and historical knowledge collection", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              collections: [
                { name: "agent_knowledge_gemini_current" },
                { name: "agent_knowledge_openai_previous" },
                { name: "unrelated_collection" },
              ],
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValue(new Response("{}", { status: 200 }))

    await expect(
      deleteKnowledgeDocumentVectors(
        "agknow_1",
        {
          QDRANT_API_KEY: "qdrant-key",
          QDRANT_COLLECTION: "agent_knowledge",
          QDRANT_URL: "http://qdrant:6333",
        },
        fetchImpl as typeof fetch
      )
    ).resolves.toMatchObject({
      deleted_collections: 2,
      status: "DELETED",
    })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls[1][0]).toContain(
      "agent_knowledge_gemini_current/points/delete"
    )
    expect(fetchImpl.mock.calls[2][0]).toContain(
      "agent_knowledge_openai_previous/points/delete"
    )
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({
      filter: {
        must: [
          {
            key: "metadata.document_id",
            match: { value: "agknow_1" },
          },
        ],
      },
    })
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

    await engine.deleteDocument("agknow_1")
    expect(deleteDocuments).toHaveBeenCalledWith({
      filter: {
        must: [
          {
            key: "metadata.document_id",
            match: { value: "agknow_1" },
          },
        ],
      },
    })
  })
})
