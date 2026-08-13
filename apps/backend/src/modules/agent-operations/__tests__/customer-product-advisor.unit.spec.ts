import {
  buildProductAdvisorFallback,
  extractCatalogSearchQuery,
  formatProductAdvisorReply,
  isCatalogOverviewRequest,
  isPotentialProductRequest,
  resolveProductAdvisorModelOutput,
} from "../customer-product-advisor"

describe("customer product advisor", () => {
  const catalog = {
    products: [
      {
        category_names: ["Áo"],
        collection_title: "Hàng mới",
        description: "Áo thun cotton form cơ bản.",
        handle: "ao-thun-cotton",
        id: "prod_1",
        subtitle: null,
        thumbnail: null,
        title: "Áo thun cotton",
        product_url: "https://shop.example/vi/vn/products/ao-thun-cotton",
        variants: [
          {
            availability: "IN_STOCK" as const,
            available_quantity: 12,
            currency_code: "vnd",
            id: "variant_1",
            manage_inventory: true,
            price: 199000,
            sku: "AT-01",
            title: "Mặc định",
          },
        ],
      },
    ],
    query: "áo",
    status: "READY" as const,
    total_count: 1,
  }

  it("detects catalog browsing and extracts a bounded search query", () => {
    expect(isPotentialProductRequest("Sốp bán gì thế?")).toBe(true)
    expect(extractCatalogSearchQuery("Sốp bán gì thế?")).toBeUndefined()
    expect(extractCatalogSearchQuery("Tư vấn áo nam cho mình")).toContain(
      "áo"
    )
    expect(isCatalogOverviewRequest("Sốp bán gì thế?")).toBe(true)
    expect(isCatalogOverviewRequest("Tư vấn áo nam dưới 300 nghìn")).toBe(false)
  })

  it("renders verified name, price and availability from the live snapshot", () => {
    const output = formatProductAdvisorReply(
      buildProductAdvisorFallback(catalog, "vi"),
      catalog,
      "vi"
    )

    expect(output.body).toContain("Áo thun cotton")
    expect(output.body).toContain("199.000")
    expect(output.body).toContain("còn hàng")
    expect(output.body).toContain(
      "https://shop.example/vi/vn/products/ao-thun-cotton"
    )
    expect(output.product_ids).toEqual(["prod_1"])
  })

  it("drops model-invented product IDs", () => {
    const output = resolveProductAdvisorModelOutput(
      {
        follow_up_question: null,
        intro: "Có hai mẫu phù hợp.",
        recommendations: [
          { product_id: "invented", reason: "Không tồn tại." },
        ],
      },
      catalog,
      "vi"
    )

    expect(output.product_ids).toEqual(["prod_1"])
    expect(output.body).not.toContain("Không tồn tại")
  })
})
