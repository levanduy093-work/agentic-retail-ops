import {
  buildProductAdvisorFallback,
  buildCatalogOverviewReply,
  extractCustomerProductPreferences,
  extractCatalogSearchQuery,
  extractRecentCatalogSearchQuery,
  formatProductAdvisorReply,
  isCatalogOverviewRequest,
  isProductDiscoveryFollowUp,
  isPotentialProductRequest,
  resolveProductAdvisorModelOutput,
  shouldReadCatalogForCustomerMessage,
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
    expect(isPotentialProductRequest("Mình cần mua đồ đông")).toBe(true)
    expect(isProductDiscoveryFollowUp("Năng động đi sốp")).toBe(true)
    expect(
      shouldReadCatalogForCustomerMessage("Năng động đi sốp", [
        "Mình cần mua đồ đông",
      ])
    ).toBe(true)
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
      extractCatalogSearchQuery("Mình muốn size M khoảng 300 áo thun")
    ).toBe("áo thun")
    expect(
      extractCustomerProductPreferences("Mình muốn size M khoảng 300 áo thun")
    ).toEqual({
      budget_max: 300000,
      color: undefined,
      product_query: "áo thun",
      size: "M",
    })
    expect(
      extractCustomerProductPreferences("Bao nhiêu cũng được", [
        {
          body: "Mình cần áo polo màu đen, size M",
          direction: "INBOUND",
        },
      ])
    ).toEqual({
      budget_flexible: true,
      color: "đen",
      product_query: "áo polo",
      size: "M",
    })
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

  it("does not repeat questions when customer specifies flexible budget across turns", () => {
    const preferences = extractCustomerProductPreferences("Bao nhiêu cũng được", [
      {
        body: "Mình cần áo polo màu đen, size M",
        direction: "INBOUND",
      },
    ])
    const output = buildProductAdvisorFallback(
      catalog,
      "vi",
      "Bao nhiêu cũng được",
      preferences
    )

    expect(output.follow_up_question).not.toMatch(/loại đồ|size|khoảng ngân sách/iu)
    expect(output.follow_up_question).toContain("màu")
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

  it("uses the supplied size and budget before asking for another preference", () => {
    const output = buildProductAdvisorFallback(
      catalog,
      "vi",
      "Mình muốn áo thun size M khoảng 300"
    )

    expect(output.recommendations[0]?.reason).toContain("199.000")
    expect(output.follow_up_question).toContain("màu")
    expect(output.follow_up_question).not.toMatch(/loại đồ|size|ngân sách/iu)
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

  it("keeps helping without exposing a catalog outage to the customer", () => {
    const output = buildProductAdvisorFallback(
      { products: [], query: null, status: "UNAVAILABLE", total_count: 0 },
      "vi",
      "Tôi muốn mua đồ đi chơi"
    )
    const rendered = formatProductAdvisorReply(
      output,
      { products: [], query: null, status: "UNAVAILABLE", total_count: 0 },
      "vi"
    )

    expect(output.follow_up_question).toContain("loại đồ")
    expect(rendered.body).toContain("thêm một chút thông tin")
    expect(rendered.body).not.toMatch(/chờ|nhắn lại|truy vấn được catalog/iu)
    expect(rendered.product_ids).toEqual([])
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
