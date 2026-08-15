import {
  findKnowledgeDocumentSource,
  isKnowledgeVerificationArtifact,
} from "../knowledge-hub-utils"

describe("Knowledge Hub utilities", () => {
  it("hides platform verification documents even when the owner is an agent", () => {
    expect(
      isKnowledgeVerificationArtifact({
        citation_locator:
          "policy://verification/verify-agent-platform-1755100000000",
        document_key: "verify-agent-platform-1755100000000",
        owner_id: "knowledge-curator-agent",
        scope: "operations",
      })
    ).toBe(true)
  })

  it("keeps normal manual guidance visible", () => {
    expect(
      isKnowledgeVerificationArtifact({
        citation_locator: "manual://knowledge/store-return-policy",
        document_key: "store-return-policy",
        owner_id: "admin-user",
        scope: "customer_support",
      })
    ).toBe(false)
  })

  it("links current and historical connected documents to their source", () => {
    const sources = [
      {
        id: "source_01",
        last_document_id: "document_current",
        name: "Returns policy",
      },
    ]

    expect(
      findKnowledgeDocumentSource(
        { document_key: "source-source_01", id: "document_current" },
        sources
      )?.name
    ).toBe("Returns policy")
    expect(
      findKnowledgeDocumentSource(
        { document_key: "source-source_01", id: "document_previous" },
        sources
      )?.name
    ).toBe("Returns policy")
  })
})
