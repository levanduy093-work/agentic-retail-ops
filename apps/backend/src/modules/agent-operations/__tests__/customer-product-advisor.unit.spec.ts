import {
  buildProductAdvisorFallback,
  buildCatalogOverviewReply,
  extractCatalogSearchQuery,
  extractRecentCatalogSearchQuery,
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
        thumbnail: "https://cdn.example/ao-thun-cotton.jpg",
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
    expect(
      extractCatalogSearchQuery(
        "Sốp có áo khoác Active Move không? Cho em xem ảnh mẫu này với."
      )
    ).toBe("áo khoác active move")
    expect(
      extractCatalogSearchQuery("Em nữ, mặc size M, tầm 600 nghìn thôi sốp.")
    ).toBeUndefined()
    expect(
      extractRecentCatalogSearchQuery([
        { body: "Mẫu đó còn size M không?", direction: "INBOUND" },
        {
          body: "Sốp có áo khoác Active Move không?",
          direction: "INBOUND",
        },
      ])
    ).toBe("áo khoác active move")
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

  it("answers a broad catalog question as a proactive consultation", () => {
    const output = buildCatalogOverviewReply(catalog, "vi")

    expect(output.body).toContain("nhu cầu, size, phong cách và ngân sách")
    expect(output.body).toContain("đi làm, đi chơi hay mặc hằng ngày")
    expect(output.body).not.toContain("https://")
    expect(output.product_ids).toEqual([])
  })

  it("does not expose local storefront links to customers", () => {
    const localCatalog = {
      ...catalog,
      products: [
        {
          ...catalog.products[0],
          product_url: "http://localhost:8000/vi/vn/products/ao-thun-cotton",
        },
      ],
    }
    const output = formatProductAdvisorReply(
      buildProductAdvisorFallback(localCatalog, "vi"),
      localCatalog,
      "vi"
    )

    expect(output.body).not.toContain("localhost")
  })

  it("asks targeted winter-shopping questions when no exact match exists", () => {
    const output = buildProductAdvisorFallback(
      { products: [], query: "đồ mùa đông", status: "READY", total_count: 0 },
      "vi",
      "Sốp tư vấn đồ mùa đông"
    )

    expect(output.follow_up_question).toContain("áo khoác")
    expect(output.follow_up_question).toContain("size")
    expect(output.recommendations).toEqual([])
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
