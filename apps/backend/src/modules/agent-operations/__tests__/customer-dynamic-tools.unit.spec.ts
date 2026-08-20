import {
  CheckVariantStockToolInput,
  executeCatalogFilter,
  executePolicyFilter,
  executeStockCheck,
  SearchCatalogToolInput,
} from "../customer-dynamic-tools"
import { CatalogReadOutput } from "../tools/catalog-tools"
import { KnowledgeSearchOutput } from "../tools/platform-read-tools"

describe("customer dynamic tools", () => {
  const sampleCatalog: CatalogReadOutput = {
    products: [
      {
        category_names: ["Áo", "Áo thun"],
        collection_title: "Hè 2026",
        description: "Áo thun cotton thoáng mát",
        handle: "ao-thun-cotton",
        id: "prod_tee_1",
        product_url: "https://shop.example/products/ao-thun-cotton",
        subtitle: null,
        thumbnail: "https://cdn.example/tee.jpg",
        title: "Áo thun Cotton Basic",
        variants: [
          {
            availability: "IN_STOCK",
            available_quantity: 15,
            currency_code: "vnd",
            id: "var_tee_s",
            manage_inventory: true,
            price: 199_000,
            sku: "TSHIRT-S",
            title: "Size S",
          },
          {
            availability: "IN_STOCK",
            available_quantity: 8,
            currency_code: "vnd",
            id: "var_tee_m",
            manage_inventory: true,
            price: 199_000,
            sku: "TSHIRT-M",
            title: "Size M",
          },
          {
            availability: "OUT_OF_STOCK",
            available_quantity: 0,
            currency_code: "vnd",
            id: "var_tee_l",
            manage_inventory: true,
            price: 199_000,
            sku: "TSHIRT-L",
            title: "Size L",
          },
        ],
      },
    ],
    query: "áo thun",
    status: "READY",
    total_count: 1,
  }

  const sampleKnowledge: KnowledgeSearchOutput = {
    results: [
      {
        chunk_id: "chunk_1",
        chunk_index: 0,
        citation_locator: "drive://shipping#1",
        document_id: "doc_1",
        document_key: "shipping",
        effective_at: "2026-08-01",
        excerpt: "Giao hàng nội thành Hà Nội trong 1-2 ngày, phí ship 25k.",
        quote_checksum: "chk_1",
        score: 0.95,
        title: "Chính sách giao hàng",
        version: "1.0",
      },
    ],
    total_candidates: 1,
  }

  it("filters catalog items by category, price bounds and size", () => {
    const input: SearchCatalogToolInput = {
      category: "Áo",
      max_price: 250_000,
      min_price: 100_000,
      query: "áo thun",
    }
    const results = executeCatalogFilter(sampleCatalog, input)
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe("Áo thun Cotton Basic")
  })

  it("checks real-time stock and variant availability correctly", () => {
    const inStockInput: CheckVariantStockToolInput = {
      product_id: "prod_tee_1",
      size: "M",
    }
    const inStockResult = executeStockCheck(sampleCatalog, inStockInput)
    expect(inStockResult.in_stock).toBe(true)
    expect(inStockResult.available_quantity).toBe(8)

    const outOfStockInput: CheckVariantStockToolInput = {
      product_id: "prod_tee_1",
      size: "L",
    }
    const outOfStockResult = executeStockCheck(sampleCatalog, outOfStockInput)
    expect(outOfStockResult.in_stock).toBe(false)
    expect(outOfStockResult.available_quantity).toBe(0)
  })

  it("filters policy FAQ knowledge correctly", () => {
    const policyResult = executePolicyFilter(sampleKnowledge, {
      query: "giao hàng hà nội",
      topic: "DELIVERY",
    })
    expect(policyResult.results).toHaveLength(1)
    expect(policyResult.results[0].title).toBe("Chính sách giao hàng")
  })
})
