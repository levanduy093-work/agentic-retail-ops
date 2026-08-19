import { MedusaContainer } from "@medusajs/framework"
import type { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

type CatalogDefinition = {
  basePrice: number
  category: string
  description: string
  image: string
  length: number
  material: string
  name: string
  weight: number
  width: number
  height: number
}

const catalog: CatalogDefinition[] = [
  { name: "Áo thun Essential", category: "Áo", basePrice: 229000, weight: 220, length: 28, width: 20, height: 4, material: "100% cotton compact", description: "Áo thun phom regular, vải cotton mềm thoáng cho nhu cầu mặc hằng ngày.", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85" },
  { name: "Áo polo Piqué", category: "Áo", basePrice: 329000, weight: 280, length: 30, width: 22, height: 5, material: "Cotton piqué co giãn", description: "Áo polo cổ bẻ chỉn chu, phù hợp đi làm và gặp gỡ cuối tuần.", image: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=1200&q=85" },
  { name: "Áo sơ mi Linen", category: "Áo", basePrice: 419000, weight: 260, length: 32, width: 24, height: 4, material: "Linen pha rayon", description: "Áo sơ mi linen nhẹ, đứng dáng và thoáng mát trong thời tiết nhiệt đới.", image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1200&q=85" },
  { name: "Áo hoodie Fleece", category: "Áo khoác", basePrice: 529000, weight: 620, length: 38, width: 30, height: 9, material: "Nỉ da cá 420gsm", description: "Hoodie nỉ dày có mũ, giữ ấm vừa phải và hoàn thiện bo viền bền chắc.", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1200&q=85" },
  { name: "Áo cardigan Merino", category: "Áo khoác", basePrice: 589000, weight: 460, length: 36, width: 28, height: 7, material: "Len merino pha cotton", description: "Cardigan dệt kim mềm, phù hợp phối lớp khi đi làm hoặc đi chơi.", image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=1200&q=85" },
  { name: "Áo khoác Coach", category: "Áo khoác", basePrice: 699000, weight: 720, length: 42, width: 32, height: 9, material: "Nylon tái chế chống gió", description: "Áo khoác coach nhẹ, chống gió nhẹ với lớp lót thoáng và túi khóa kéo.", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1200&q=85" },
  { name: "Quần jeans Straight", category: "Quần", basePrice: 549000, weight: 650, length: 38, width: 28, height: 7, material: "Denim cotton 12oz", description: "Quần jeans ống đứng, màu wash trung tính và đường may gia cố ở vị trí chịu lực.", image: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=85" },
  { name: "Quần kaki Tapered", category: "Quần", basePrice: 469000, weight: 480, length: 36, width: 27, height: 6, material: "Cotton twill co giãn", description: "Quần kaki côn nhẹ, mặc thoải mái và dễ phối cùng áo sơ mi hoặc polo.", image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1200&q=85" },
  { name: "Quần jogger Active", category: "Quần", basePrice: 389000, weight: 420, length: 34, width: 26, height: 6, material: "Polyester tái chế", description: "Quần jogger thấm hút, co giãn và có túi khóa kéo an toàn khi vận động.", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85" },
  { name: "Quần short Resort", category: "Quần", basePrice: 279000, weight: 290, length: 30, width: 24, height: 5, material: "Cotton canvas nhẹ", description: "Quần short cạp chun, mát nhẹ cho các hoạt động thường ngày và du lịch.", image: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=1200&q=85" },
  { name: "Chân váy A-line", category: "Váy & đầm", basePrice: 359000, weight: 350, length: 32, width: 25, height: 5, material: "Twill polyester", description: "Chân váy chữ A cạp cao, có lớp lót và khóa kéo sau tiện dụng.", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1200&q=85" },
  { name: "Đầm midi Sora", category: "Váy & đầm", basePrice: 629000, weight: 430, length: 36, width: 28, height: 6, material: "Voan chiffon hai lớp", description: "Đầm midi rủ nhẹ, có lớp lót và dây điều chỉnh cho nhiều dáng người.", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85" },
  { name: "Bộ thể thao Motion", category: "Thể thao", basePrice: 659000, weight: 580, length: 40, width: 30, height: 8, material: "Nylon spandex 4 chiều", description: "Bộ thể thao hai món co giãn, ưu tiên thoát ẩm cho tập gym và chạy bộ.", image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=85" },
  { name: "Nón lưỡi trai Core", category: "Phụ kiện", basePrice: 179000, weight: 140, length: 22, width: 20, height: 11, material: "Canvas cotton", description: "Nón lưỡi trai điều chỉnh được, thêu logo tối giản và có lỗ thoáng khí.", image: "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=1200&q=85" },
  { name: "Túi tote Canvas", category: "Phụ kiện", basePrice: 249000, weight: 310, length: 34, width: 28, height: 5, material: "Canvas 16oz", description: "Túi tote chịu tải tốt, có ngăn trong và phù hợp mang laptop đến 14 inch.", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85" },
  { name: "Tất thể thao Crew", category: "Phụ kiện", basePrice: 99000, weight: 90, length: 20, width: 12, height: 3, material: "Cotton combed", description: "Tất cổ trung có vùng đệm bàn chân, bán theo cặp và phù hợp vận động nhẹ.", image: "https://images.unsplash.com/photo-1582966772680-860e372bb558?auto=format&fit=crop&w=1200&q=85" },
  { name: "Áo blazer Nova", category: "Áo khoác", basePrice: 799000, weight: 680, length: 42, width: 32, height: 8, material: "Poly-viscose dệt chéo", description: "Blazer cấu trúc nhẹ, phù hợp môi trường công sở hiện đại và các dịp trang trọng.", image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=85" },
  { name: "Áo knit Rib", category: "Áo", basePrice: 369000, weight: 330, length: 30, width: 24, height: 5, material: "Cotton knit gân", description: "Áo dệt kim gân co giãn nhẹ, cổ tròn và form ôm vừa dễ mặc.", image: "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1200&q=85" },
  { name: "Quần culottes Ease", category: "Quần", basePrice: 439000, weight: 390, length: 35, width: 27, height: 6, material: "Rayon twill", description: "Quần culottes ống rộng, cạp cao và rủ mềm cho trang phục hằng ngày.", image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=85" },
  { name: "Áo gile Utility", category: "Áo khoác", basePrice: 489000, weight: 540, length: 38, width: 28, height: 7, material: "Ripstop cotton nylon", description: "Áo gile nhiều túi, thiết kế tiện dụng để phối lớp trong những ngày chuyển mùa.", image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=1200&q=85" },
]

const palettes = [
  { color: "Đen", code: "BLK" },
  { color: "Trắng", code: "WHT" },
  { color: "Xanh navy", code: "NVY" },
  { color: "Nâu be", code: "BEI" },
]

const sizes = ["S", "M", "L", "XL"]

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

export default async function reseedTestCatalog({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)
  const inventoryService = container.resolve(Modules.INVENTORY)

  const existingProducts = await productService.listProducts({}, { take: 1000 })
  const existingCategories = await productService.listProductCategories({}, { take: 1000 })
  const existingInventoryItems = await inventoryService.listInventoryItems({}, { take: 5000 })

  logger.info(`Removing ${existingProducts.length} products, ${existingCategories.length} categories, and ${existingInventoryItems.length} inventory items`)

  if (existingProducts.length) {
    await productService.deleteProducts(existingProducts.map((product) => product.id))
  }
  if (existingCategories.length) {
    await productService.deleteProductCategories(existingCategories.map((category) => category.id))
  }
  if (existingInventoryItems.length) {
    await inventoryService.deleteInventoryItems(existingInventoryItems.map((item) => item.id))
  }

  const { data: salesChannels } = await query.graph({ entity: "sales_channel", fields: ["id"] })
  const { data: shippingProfiles } = await query.graph({ entity: "shipping_profile", fields: ["id"] })
  const { data: stockLocations } = await query.graph({ entity: "stock_location", fields: ["id"] })
  const salesChannel = salesChannels[0]
  const shippingProfile = shippingProfiles[0]
  const stockLocation = stockLocations[0]

  if (!salesChannel || !shippingProfile || !stockLocation) {
    throw new Error("The default sales channel, shipping profile, and stock location must exist before catalog reseeding")
  }

  const collectionDefinitions = [
    { title: "Bán chạy nhất", handle: "ban-chay-nhat" },
    { title: "Khuyến mãi Hot", handle: "khuyen-mai-hot" },
    { title: "Mẫu mới về", handle: "mau-moi-ve" },
    { title: "Sản phẩm nổi bật", handle: "san-pham-noi-bat" },
  ]
  let collections = await productService.listProductCollections({}, { take: 100 })
  for (const definition of collectionDefinitions) {
    if (!collections.some((collection) => collection.handle === definition.handle)) {
      await productService.createProductCollections([definition])
    }
  }
  collections = await productService.listProductCollections({}, { take: 100 })
  const storefrontCollections = collectionDefinitions.map((definition) => {
    const collection = collections.find((item) => item.handle === definition.handle)
    if (!collection) {
      throw new Error(`Collection ${definition.handle} could not be created`)
    }
    return collection
  })

  const categoryNames = Array.from(new Set(catalog.map((entry) => entry.category)))
  const { result: categories } = await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: categoryNames.map((name) => ({
        name,
        handle: slugify(name),
        is_active: true,
      })),
    },
  })

  const products: CreateProductWorkflowInputDTO[] = Array.from({ length: 80 }, (_, index) => {
    const definition = catalog[index % catalog.length]
    const collectionNumber = Math.floor(index / catalog.length) + 1
    const category = categories.find((item) => item.name === definition.category)
    const price = definition.basePrice + (index % 4) * 15000
    const handle = `${slugify(definition.name)}-${String(collectionNumber).padStart(2, "0")}`

    return {
      title: `${definition.name} ${collectionNumber}`,
      subtitle: `${definition.material} · Bộ sưu tập test ${collectionNumber}`,
      description: definition.description,
      handle,
      status: ProductStatus.PUBLISHED,
      collection_id: storefrontCollections[index % storefrontCollections.length].id,
      category_ids: category ? [category.id] : [],
      shipping_profile_id: shippingProfile.id,
      weight: definition.weight,
      length: definition.length,
      width: definition.width,
      height: definition.height,
      metadata: {
        brand: "Synapse Studio",
        care: "Giặt máy nước lạnh, không dùng chất tẩy, phơi nơi thoáng mát.",
        country_of_origin: "Việt Nam",
        material: definition.material,
        test_catalog: true,
      },
      images: [{ url: definition.image }],
      options: [
        { title: "Kích cỡ", values: sizes, is_exclusive: true },
        {
          title: "Màu sắc",
          values: palettes.map((palette) => palette.color),
          is_exclusive: true,
        },
      ],
      variants: sizes.map((size, sizeIndex) => {
        const palette = palettes[sizeIndex]
        const variantWeight = definition.weight + sizeIndex * 25
        return {
          title: `${size} / ${palette.color}`,
          sku: `SYN-${String(index + 1).padStart(3, "0")}-${size}-${palette.code}`,
          ean: `893${String(1000000000 + index * 10 + sizeIndex).slice(-10)}`,
          options: { "Kích cỡ": size, "Màu sắc": palette.color },
          prices: [{ amount: price + sizeIndex * 5000, currency_code: "vnd" }],
          manage_inventory: true,
          allow_backorder: false,
          weight: variantWeight,
          length: definition.length,
          width: definition.width,
          height: definition.height,
          metadata: {
            color_code: palette.code,
            packaging_weight_g: 40,
            test_catalog: true,
          },
        }
      }),
      sales_channels: [{ id: salesChannel.id }],
    }
  })

  const { result: createdProducts } = await createProductsWorkflow(container).run({
    input: { products },
  })

  if (createdProducts.length !== 80) {
    throw new Error(`Expected 80 products but created ${createdProducts.length}`)
  }

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  })
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item, index) => ({
        inventory_item_id: item.id,
        location_id: stockLocation.id,
        stocked_quantity: 12 + (index % 89),
      })),
    },
  })

  logger.info(`Catalog reseed complete: ${createdProducts.length} products and ${createdProducts.length * sizes.length} weighted variants`)
}
