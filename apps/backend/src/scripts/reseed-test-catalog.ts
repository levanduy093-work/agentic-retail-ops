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
  brand: string
  category: string
  description: string
  height: number
  image: string
  length: number
  material: string
  name: string
  weight: number
  width: number
}

const catalog: CatalogDefinition[] = [
  {
    name: "Intel Core i5-13400F",
    category: "CPU",
    brand: "Intel",
    basePrice: 4890000,
    weight: 150,
    length: 12,
    width: 12,
    height: 8,
    material: "Socket LGA1700 · 10 nhân 16 luồng · 4.6GHz",
    description: "Bộ vi xử lý Intel Core i5-13400F (LGA1700, 10 nhân 16 luồng, Turbo 4.6GHz, 20MB Cache) cấu hình quốc dân cho gaming và làm việc tầm trung.",
    image: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Intel Core i7-14700K",
    category: "CPU",
    brand: "Intel",
    basePrice: 10490000,
    weight: 180,
    length: 14,
    width: 14,
    height: 8,
    material: "Socket LGA1700 · 20 nhân 28 luồng · 5.6GHz",
    description: "Bộ vi xử lý Intel Core i7-14700K (Turbo 5.6GHz, 33MB Cache, Raptor Lake Refresh) tối ưu cho render đồ họa 3D, dựng phim và livestream chuyên nghiệp.",
    image: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "AMD Ryzen 5 7600",
    category: "CPU",
    brand: "AMD",
    basePrice: 5190000,
    weight: 220,
    length: 14,
    width: 14,
    height: 9,
    material: "Socket AM5 · 6 nhân 12 luồng · 5.1GHz",
    description: "Bộ vi xử lý AMD Ryzen 5 7600 kiến trúc Zen 4, tiến trình 5nm, xung nhịp lên đến 5.1GHz kèm tản nhiệt Wraith Stealth chính hãng.",
    image: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "AMD Ryzen 7 7800X3D",
    category: "CPU",
    brand: "AMD",
    basePrice: 11290000,
    weight: 170,
    length: 14,
    width: 14,
    height: 8,
    material: "Socket AM5 · 3D V-Cache 96MB · 8 nhân 16 luồng",
    description: "Vua CPU gaming AMD Ryzen 7 7800X3D công nghệ 3D V-Cache đột phá, hiệu năng chơi game eSports và AAA FPS vượt trội hàng đầu thế giới.",
    image: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Mainboard ASUS ROG Strix B760-A Gaming WiFi",
    category: "Mainboard",
    brand: "ASUS ROG",
    basePrice: 5690000,
    weight: 1600,
    length: 34,
    width: 28,
    height: 8,
    material: "Chipset B760 · DDR5 · ATX · PCIe 5.0",
    description: "Bo mạch chủ ASUS ROG Strix B760-A Gaming WiFi D5 thiết kế màu trắng tuyết sang trọng, 12+1 phase nguồn, PCIe 5.0 và WiFi 6E tốc độ cao.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Mainboard MSI MAG B650 TOMAHAWK WIFI",
    category: "Mainboard",
    brand: "MSI",
    basePrice: 5290000,
    weight: 1700,
    length: 34,
    width: 28,
    height: 8,
    material: "Chipset B650 · DDR5 · ATX · WiFi 6E",
    description: "Bo mạch chủ MSI MAG B650 TOMAHAWK phong cách quân đội hầm hố, tản nhiệt VRM mở rộng, hỗ trợ RAM DDR5 lên đến 7600+ MHz (OC).",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Mainboard GIGABYTE Z790 AORUS ELITE AX",
    category: "Mainboard",
    brand: "GIGABYTE",
    basePrice: 7190000,
    weight: 1800,
    length: 35,
    width: 29,
    height: 8,
    material: "Chipset Z790 · DDR5 · ATX · 16+1+2 Phase",
    description: "Bo mạch chủ cao cấp chuyên ép xung cho CPU Intel thế hệ 13 & 14, 16+1+2 phase nguồn kỹ thuật số, tản nhiệt M.2 Thermal Guard III.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Card màn hình ASUS Dual GeForce RTX 4060 OC 8GB",
    category: "VGA",
    brand: "ASUS",
    basePrice: 8490000,
    weight: 1100,
    length: 28,
    width: 18,
    height: 7,
    material: "NVIDIA RTX 4060 · 8GB GDDR6 · Dual Fan",
    description: "Card đồ họa ASUS Dual RTX 4060 OC trang bị 2 quạt công nghệ Axial-tech, hỗ trợ DLSS 3, Ray Tracing, cân mượt mọi game Full HD / 2K.",
    image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Card màn hình MSI GeForce RTX 4070 SUPER Gaming X Slim 12GB",
    category: "VGA",
    brand: "MSI",
    basePrice: 17890000,
    weight: 1550,
    length: 36,
    width: 20,
    height: 8,
    material: "NVIDIA RTX 4070 SUPER · 12GB GDDR6X · Tri Frozr 3",
    description: "Card đồ họa thiết kế mỏng nhẹ Trio Fan Tri Frozr 3, kiến trúc Ada Lovelace mạnh mẽ, xử lý game 2K Ultra Settings và dựng hình 3D xuất sắc.",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Card màn hình GIGABYTE GeForce RTX 4080 SUPER Gaming OC 16GB",
    category: "VGA",
    brand: "GIGABYTE",
    basePrice: 28990000,
    weight: 2200,
    length: 40,
    width: 22,
    height: 10,
    material: "NVIDIA RTX 4080 SUPER · 16GB GDDR6X · Windforce 3X",
    description: "Quái vật đồ họa cân game 4K Max Settings và tính toán AI, tản nhiệt Windforce 3 quạt 110mm, buồng hơi tiếp xúc trực tiếp GPU.",
    image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Card màn hình Sapphire Pure AMD Radeon RX 7800 XT 16GB",
    category: "VGA",
    brand: "Sapphire",
    basePrice: 15490000,
    weight: 1600,
    length: 35,
    width: 20,
    height: 8,
    material: "AMD Radeon RX 7800 XT · 16GB GDDR6 · White Edition",
    description: "Card đồ họa Radeon RX 7800 XT phiên bản Pure màu trắng tinh khôi, bộ nhớ VRAM khủng 16GB, tối ưu tuyệt vời cho độ phân giải 2K 144Hz+.",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "RAM Corsair Vengeance RGB DDR5 32GB (2x16GB) 6000MHz",
    category: "RAM",
    brand: "Corsair",
    basePrice: 2890000,
    weight: 180,
    length: 18,
    width: 14,
    height: 3,
    material: "DDR5 · 6000MHz · CL30 · Intel XMP & AMD EXPO",
    description: "Kit RAM DDR5 hiệu năng cao với dải LED RGB 10 vùng siêu sáng, tích hợp công nghệ Intel XMP 3.0 và AMD EXPO ép xung ổn định.",
    image: "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "RAM Kingston Fury Beast DDR4 16GB (2x8GB) 3200MHz",
    category: "RAM",
    brand: "Kingston",
    basePrice: 990000,
    weight: 140,
    length: 18,
    width: 14,
    height: 3,
    material: "DDR4 · 3200MHz · CL16 · Nhôm nguyên khối",
    description: "Kit RAM DDR4 quốc dân giá mềm, tản nhiệt nhôm đen nguyên khối tối giản, tự động nhận diện ép xung Plug and Play 3200MHz.",
    image: "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "RAM G.Skill Trident Z5 RGB DDR5 64GB (2x32GB) 6400MHz",
    category: "RAM",
    brand: "G.Skill",
    basePrice: 5890000,
    weight: 220,
    length: 18,
    width: 14,
    height: 4,
    material: "DDR5 · 6400MHz · CL32 · Nhôm xước cao cấp",
    description: "Dòng RAM biểu tượng dành cho hệ thống máy tính cao cấp, dải nhôm xước ánh bạc kết hợp tản nhiệt khí động học sang trọng.",
    image: "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "SSD Samsung 990 PRO M.2 NVMe PCIe Gen 4.0 1TB",
    category: "SSD",
    brand: "Samsung",
    basePrice: 2850000,
    weight: 110,
    length: 15,
    width: 10,
    height: 3,
    material: "PCIe Gen 4.0 x4 · M.2 2280 · Đọc 7450MB/s",
    description: "Ổ cứng SSD NVMe nhanh nhất thế giới tốc độ đọc 7450 MB/s, ghi 6900 MB/s, kiểm soát nhiệt thông minh bằng bộ điều khiển phủ niken cao cấp.",
    image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "SSD Kingston NV2 M.2 PCIe Gen 4.0 NVMe 500GB",
    category: "SSD",
    brand: "Kingston",
    basePrice: 990000,
    weight: 90,
    length: 15,
    width: 10,
    height: 3,
    material: "PCIe Gen 4.0 x4 · M.2 2280 · Đọc 3500MB/s",
    description: "Giải pháp lưu trữ nâng cấp thế hệ mới, tốc độ đọc 3500MB/s, tiêu thụ ít điện năng, tỏa nhiệt thấp, phù hợp cho laptop và máy bàn.",
    image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Nguồn Corsair RM750e 750W 80 Plus Gold ATX 3.0",
    category: "Nguồn máy tính",
    brand: "Corsair",
    basePrice: 2790000,
    weight: 2400,
    length: 30,
    width: 22,
    height: 12,
    material: "Chuẩn ATX 3.0 · Full Modular · 80 Plus Gold",
    description: "Bộ nguồn máy tính chuẩn ATX 3.0 & PCIe 5.0 sẵn cổng 12VHPWR cho card đồ họa RTX 40-series, quạt làm mát 120mm Rifle Bearing êm ái.",
    image: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Nguồn MSI MAG A650BN 650W 80 Plus Bronze",
    category: "Nguồn máy tính",
    brand: "MSI",
    basePrice: 1290000,
    weight: 2100,
    length: 28,
    width: 20,
    height: 11,
    material: "80 Plus Bronze · Mạch DC to DC · Fan 120mm",
    description: "Nguồn máy tính quốc dân cho các cấu hình tầm trung, mạch DC-to-DC ổn định dòng điện, quạt 120mm độ ồn thấp, bảo vệ toàn diện OVP/OCP/OPP.",
    image: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Tản nhiệt nước AIO Thermalright Aqua Elite 360 V3 ARGB",
    category: "Tản nhiệt",
    brand: "Thermalright",
    basePrice: 1490000,
    weight: 2100,
    length: 44,
    width: 24,
    height: 16,
    material: "Rad 360mm nhôm · 3 Fan ARGB 120mm · Pump vô cực",
    description: "Tản nhiệt nước All-in-One 360mm quốc dân, mặt block pump gương vô cực ARGB huyền ảo, cân tốt các CPU Intel Core i7 và Ryzen 7.",
    image: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Vỏ Case Montech King 95 Pro Panoramic Glass",
    category: "Vỏ Case",
    brand: "Montech",
    basePrice: 2990000,
    weight: 9800,
    length: 52,
    width: 34,
    height: 50,
    material: "Kính cường lực Panoramic uốn cong · Kèm 6 Fan ARGB",
    description: "Thùng máy phong cách bể cá toàn cảnh Panoramic không góc chết, tặng kèm 6 quạt ARGB PWM cao cấp, khung thép chắc chắn và luồng gió tối ưu.",
    image: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=1200&q=85",
  },
]

const editions = [
  { name: "Tiêu chuẩn (Standard)", code: "STD", priceOffset: 0 },
  { name: "Bản Trắng (White Edition)", code: "WHT", priceOffset: 150000 },
  { name: "Gaming OC Edition", code: "OC", priceOffset: 250000 },
  { name: "Gói VIP Bảo hành tận nơi", code: "VIP", priceOffset: 350000 },
]

const warranties = [
  "36 tháng chính hãng",
  "24 tháng chính hãng",
  "36 tháng + Đổi mới 30 ngày",
  "Bảo hành 5 năm",
]

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
    { title: "Linh kiện Bán chạy nhất", handle: "ban-chay-nhat" },
    { title: "Khuyến mãi Hot", handle: "khuyen-mai-hot" },
    { title: "Linh kiện Mới về", handle: "mau-moi-ve" },
    { title: "High-end & AI Workstation", handle: "san-pham-noi-bat" },
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
    const price = definition.basePrice + (index % 4) * 50000
    const handle = `${slugify(definition.name)}-${String(collectionNumber).padStart(2, "0")}`

    return {
      title: `${definition.name} (Rev ${collectionNumber})`,
      subtitle: `${definition.material} · ${definition.brand}`,
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
        brand: definition.brand,
        warranty_policy: "Bảo hành chính hãng 12-36 tháng, 1 đổi 1 trong 30 ngày nếu lỗi do NSX.",
        country_of_origin: "Chính Hãng",
        specs: definition.material,
        test_catalog: true,
      },
      images: [{ url: definition.image }],
      thumbnail: definition.image,
      options: [
        {
          title: "Phiên bản",
          values: editions.map((item) => item.name),
          is_exclusive: true,
        },
        {
          title: "Bảo hành",
          values: warranties,
          is_exclusive: true,
        },
      ],
      variants: editions.map((edition, edIndex) => {
        const warranty = warranties[edIndex]
        const variantWeight = definition.weight + edIndex * 50
        return {
          title: `${edition.name} / ${warranty}`,
          sku: `PC-${String(index + 1).padStart(3, "0")}-${edition.code}`,
          ean: `893${String(2000000000 + index * 10 + edIndex).slice(-10)}`,
          options: { "Phiên bản": edition.name, "Bảo hành": warranty },
          prices: [{ amount: price + edition.priceOffset, currency_code: "vnd" }],
          manage_inventory: true,
          allow_backorder: false,
          weight: variantWeight,
          length: definition.length,
          width: definition.width,
          height: definition.height,
          metadata: {
            edition_code: edition.code,
            packaging_weight_g: 100,
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
        stocked_quantity: 10 + (index % 50),
      })),
    },
  })

  logger.info(
    `Catalog reseed complete: ${createdProducts.length} PC hardware products and ${createdProducts.length * editions.length} variants created.`
  )
}
