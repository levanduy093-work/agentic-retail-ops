import {
  fetchKnowledgeSource,
  validateKnowledgeSourceUrl,
} from "../knowledge-connector"

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }]
const environment = {
  KNOWLEDGE_CONNECTOR_ALLOWED_HOSTS: "docs.example.com,raw.githubusercontent.com",
}

describe("knowledge source connector", () => {
  it("accepts allowlisted public HTTPS sources", async () => {
    await expect(
      validateKnowledgeSourceUrl("https://docs.example.com/returns.md", {
        environment,
        resolveAddresses: publicResolver,
      })
    ).resolves.toMatchObject({ hostname: "docs.example.com", protocol: "https:" })
  })

  it("rejects non-HTTPS, non-allowlisted, and private network sources", async () => {
    await expect(
      validateKnowledgeSourceUrl("http://docs.example.com/returns.md", {
        environment,
        resolveAddresses: publicResolver,
      })
    ).rejects.toThrow("must use HTTPS")
    await expect(
      validateKnowledgeSourceUrl("https://other.example.com/returns.md", {
        environment,
        resolveAddresses: publicResolver,
      })
    ).rejects.toThrow("not in KNOWLEDGE_CONNECTOR_ALLOWED_HOSTS")
    await expect(
      validateKnowledgeSourceUrl("https://docs.example.com/returns.md", {
        environment,
        resolveAddresses: async () => [
          { address: "127.0.0.1", family: 4 },
        ],
      })
    ).rejects.toThrow("private")
  })

  it("fetches bounded text and returns a content checksum", async () => {
    const fetchImpl = jest.fn(async () =>
      new Response(
        "# Return policy\n\nCustomers may request a return within the approved window.",
        {
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            etag: '"version-1"',
          },
          status: 200,
        }
      )
    )
    const result = await fetchKnowledgeSource(
      "https://docs.example.com/returns.md",
      {
        environment,
        fetchImpl: fetchImpl as typeof fetch,
        resolveAddresses: publicResolver,
      }
    )

    expect(result).toMatchObject({
      content_type: "text/markdown",
      etag: '"version-1"',
      final_url: "https://docs.example.com/returns.md",
    })
    expect(result.checksum).toHaveLength(64)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("rejects HTML responses so navigation pages are not treated as policy", async () => {
    await expect(
      fetchKnowledgeSource("https://docs.example.com/returns", {
        environment,
        fetchImpl: async () =>
          new Response("<html><body>not a source document</body></html>", {
            headers: { "content-type": "text/html" },
            status: 200,
          }),
        resolveAddresses: publicResolver,
      })
    ).rejects.toThrow("text/plain or text/markdown")
  })
})
