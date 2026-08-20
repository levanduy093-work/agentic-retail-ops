import {
  detectHybridIntent,
  processSentimentGuard,
  runCustomerSupportReadToolLoop,
  synthesizeHybridAnswer,
} from "../customer-react-engine"
import { KnowledgeAnswer } from "../knowledge-answer"
import { CatalogReadOutput } from "../tools/catalog-tools"

describe("customer react engine", () => {
  const sampleCatalog: CatalogReadOutput = {
    products: [
      {
        category_names: ["Áo"],
        collection_title: null,
        description: "Áo polo",
        handle: "ao-polo",
        id: "prod_1",
        product_url: "https://shop.example/ao-polo",
        subtitle: null,
        thumbnail: null,
        title: "Áo Polo",
        variants: [],
      },
    ],
    query: "áo polo",
    status: "READY",
    total_count: 1,
  }

  it("detects hybrid intents combining product search and shipping / policy inquiries", () => {
    expect(
      detectHybridIntent("Tư vấn áo phông và ship về Hà Nội mất bao lâu thế shop?")
    ).toBe("PRODUCT_AND_SHIPPING")

    expect(
      detectHybridIntent("Mình mua đầm này thì có được đổi trả không?")
    ).toBe("PRODUCT_AND_POLICY")

    expect(
      detectHybridIntent("Mình 1m70 nặng 60kg mặc áo này vừa không?")
    ).toBe("PRODUCT_AND_SIZING")

    expect(detectHybridIntent("Chào shop")).toBe("STANDARD")
  })

  it("synthesizes hybrid answers with cohesive markdown and merged citations", () => {
    const productAnswer: KnowledgeAnswer = {
      body: "Dạ shop gợi ý cho bạn mẫu áo phông Cotton Oversize cực xinh này nhé ạ!",
      citations: [],
      disposition: "ANSWER",
      grounded: true,
      locale: "vi",
      product_ids: ["prod_1"],
    }

    const knowledgeAnswer: KnowledgeAnswer = {
      body: "Đơn hàng về Hà Nội giao trong 1-2 ngày với phí ship 25.000đ ạ.",
      citations: [
        {
          document_id: "doc_shipping",
          locator: "drive://shipping#chunk-1",
          quote_checksum: "chk_1",
          title: "Chính sách vận chuyển",
          version: "1.0",
        },
      ],
      disposition: "ANSWER",
      grounded: true,
      locale: "vi",
    }

    const synthesized = synthesizeHybridAnswer(
      { locale: "vi", question: "Tư vấn áo và ship Hà Nội" },
      productAnswer,
      knowledgeAnswer
    )

    expect(synthesized.body).toContain("áo phông Cotton Oversize")
    expect(synthesized.body).toContain("Đơn hàng về Hà Nội")
    expect(synthesized.citations).toHaveLength(1)
    expect(synthesized.product_ids).toEqual(["prod_1"])
    expect(synthesized.grounded).toBe(true)
  })

  it("guards and detects frustrated customer sentiment", () => {
    const guard = processSentimentGuard("Shop làm ăn chán quá, 4 ngày chưa có hàng")
    expect(guard.sentiment).toBe("FRUSTRATED_ANGRY")
    expect(guard.needs_immediate_escalation).toBe(true)
  })

  it("runs a bounded, read-only catalog filter and stock-check loop", () => {
    const result = runCustomerSupportReadToolLoop({
      catalog: {
        ...sampleCatalog,
        products: [
          {
            ...sampleCatalog.products[0],
            variants: [
              {
                availability: "IN_STOCK",
                available_quantity: 4,
                currency_code: "vnd",
                id: "var_1",
                manage_inventory: true,
                price: 299_000,
                sku: "POLO-M",
                title: "Size M",
              },
            ],
          },
        ],
      },
      question: "Mình tìm áo polo size M dưới 400k",
    })

    expect(result.catalog.status).toBe("READY")
    expect(result.catalog.products).toHaveLength(1)
    expect(result.trace).toEqual([
      expect.objectContaining({ tool_name: "catalog.filter" }),
      expect.objectContaining({ tool_name: "catalog.variant-stock" }),
    ])
  })
})
