import { HttpTypes } from "@medusajs/types"

const englishCategoryNames: Record<string, string> = {
  "ao-nam-nu": "Men's & Women's Clothing",
  "ao-ni-hoodie": "Sweatshirts & Hoodies",
  "quan-dai-jeans": "Long Pants & Jeans",
  "quan-kra-merch": "Shorts & Merch",
  "áo-nam-&-nữ": "Men's & Women's Clothing",
  "áo-nỉ-&-hoodie": "Sweatshirts & Hoodies",
  "quần-dài-&-jeans": "Long Pants & Jeans",
  "quần-kra-&-merch": "Shorts & Merch",
  "ao-nam-cat": "Men's Tops",
  "ao-nu-cat": "Women's Tops",
  "quan-nam-cat": "Men's Pants",
  "quan-nu-va-vay-cat": "Women's Pants & Skirts",
  "do-the-thao-va-phu-kien-cat": "Sportswear & Accessories",
  "áo-nam": "Men's Tops",
  "áo-nữ": "Women's Tops",
  "quần-nam": "Men's Pants",
  "quần-nữ-&-váy": "Women's Pants & Skirts",
  "đồ-thể-thao-&-phụ-kiện": "Sportswear & Accessories",
}

const englishCollectionNames: Record<string, string> = {
  "ban-chay-nhat": "Best Sellers",
  "khuyen-mai-hot": "Hot Deals",
  "mau-moi-ve": "New Arrivals",
  "san-pham-noi-bat": "Featured Products",
}

const englishProductNames: Record<string, string> = {
  "ao-hoodie-oversize": "Oversized Hoodie",
  "ao-polo-nam-premium": "Premium Men's Polo Shirt",
  "quan-jeans-denim-classic": "Classic Denim Jeans",
  "ao-so-mi-vintage": "Vintage Long-Sleeve Shirt",
}

const productTitlePrefixes: Array<[string, string]> = [
  ["Bộ Đồ Thể Thao", "Sportswear Set"],
  ["Nón Mũ Thời Trang", "Fashion Cap"],
  ["Túi Canvas Tote", "Canvas Tote Bag"],
  ["Quần Ống Rộng", "Wide-Leg Pants"],
  ["Quần Jogger", "Joggers"],
  ["Quần Jeans", "Jeans"],
  ["Quần Kaki", "Chinos"],
  ["Quần Short", "Shorts"],
  ["Chân Váy", "A-Line Skirt"],
  ["Đầm Dự Tiệc", "Evening Dress"],
  ["Áo Crop Top", "Crop Top"],
  ["Áo Cardigan", "Cardigan"],
  ["Áo Hoodie", "Hoodie"],
  ["Áo Khoác", "Jacket"],
  ["Áo Polo", "Polo Shirt"],
  ["Áo Sơ Mi", "Shirt"],
  ["Áo Thun", "T-Shirt"],
  ["Áo Kiểu", "Blouse"],
]

const productDescriptionPrefixes: Array<[string, string]> = [
  [
    "Áo thun cotton cao cấp thoáng mát, thấm hút mồ hôi tốt, kiểu dáng trẻ trung.",
    "Premium breathable cotton T-shirt with excellent moisture absorption and a youthful fit.",
  ],
  [
    "Áo Polo phong cách lịch lãm, chất liệu vải co giãn 4 chiều vừa vặn cơ thể.",
    "Smart polo shirt in four-way stretch fabric for a comfortable, close fit.",
  ],
  [
    "Áo sơ mi thiết kế công sở sang trọng, dễ phối đồ cùng quần tây hoặc jeans.",
    "Refined office shirt that pairs easily with tailored pants or jeans.",
  ],
  [
    "Áo hoodie nỉ lót bông ấm áp, mũ trùm sâu phong cách streetwear năng động.",
    "Warm fleece-lined hoodie with a deep hood and an energetic streetwear look.",
  ],
  [
    "Áo khoác chống gió, chống nước nhẹ, thiết kế nhiều túi tiện lợi.",
    "Wind-resistant, water-repellent jacket with practical multi-pocket detailing.",
  ],
  [
    "Áo kiểu nữ thiết kế điệu đà, chất liệu tơ lụa mềm mịn ôm dáng.",
    "Feminine blouse in soft, smooth silk-blend fabric with a flattering fit.",
  ],
  [
    "Áo crop top nữ phong cách Hàn Quốc cá tính, khoe vóc dáng thon gọn.",
    "Korean-inspired crop top with a bold silhouette and flattering cut.",
  ],
  [
    "Áo cardigan len dệt kim mỏng nhẹ, khoác nhẹ những ngày se lạnh.",
    "Lightweight knitted cardigan for comfortably cool days.",
  ],
  [
    "Quần jeans nam chất liệu denim bền đẹp, form dáng đứng tôn dáng.",
    "Durable men's denim jeans with a structured, flattering fit.",
  ],
  [
    "Quần kaki nam phong cách tối giản, đường may chỉn chu tinh tế.",
    "Minimal men's chinos with clean lines and refined stitching.",
  ],
  [
    "Quần jogger thun năng động, bo gấu gọn gàng thoải mái vận động.",
    "Stretch joggers with neat cuffs for easy, unrestricted movement.",
  ],
  [
    "Quần short nam chất liệu kaki/thun mát mẻ, phù hợp dạo phố du lịch.",
    "Breathable men's shorts in chino or jersey fabric, ideal for casual outings and travel.",
  ],
  [
    "Quần ống rộng hack dáng chuẩn, cạp cao giấu bụng cực tốt.",
    "High-waisted wide-leg pants designed to create a balanced, flattering silhouette.",
  ],
  [
    "Chân váy chữ A dễ phối áo, phù hợp mặc đi học đi làm hay đi chơi.",
    "Versatile A-line skirt for school, work, or casual outings.",
  ],
  [
    "Đầm dự tiệc thiết kế quyến rũ, chất liệu tơ voan cao cấp nổi bật.",
    "Elegant evening dress in premium chiffon with a striking silhouette.",
  ],
  [
    "Bộ thể thao co giãn thấm hút mồ hôi chuyên dụng cho tập gym, chạy bộ.",
    "Stretch, moisture-wicking sportswear set designed for gym sessions and running.",
  ],
  [
    "Mũ lưỡi trai thêu logo nổi bật, che nắng thời trang năng động.",
    "Embroidered baseball cap offering sun protection with a sporty look.",
  ],
  [
    "Túi canvas phong cách vintage rộng rãi, đựng vừa laptop và đồ cá nhân.",
    "Spacious vintage-style canvas tote sized for a laptop and daily essentials.",
  ],
]

const exactEnglishDescriptions: Record<string, string> = {
  "Áo hoodie phong cách streetwear năng động, chất liệu nỉ bông dầy dặn giữ ấm tốt.":
    "Streetwear-inspired hoodie in thick, warm fleece.",
  "Áo Polo cổ bẻ chất liệu Pique cotton thoáng khí, lịch lãm phù hợp đi làm và đi chơi.":
    "Breathable pique-cotton polo shirt with a smart look for work or leisure.",
  "Quần jeans chất liệu denim co giãn nhẹ, form dáng ôm vừa vặn thời trang.":
    "Light-stretch denim jeans with a comfortable, modern slim fit.",
  "Áo sơ mi vải đũi cao cấp mềm mịn, phong cách khoẻ khoắn tươi trẻ.":
    "Soft premium linen-blend shirt with a fresh, confident look.",
}

const translateProductTitle = (handle: string, title: string) => {
  const exactTranslation = englishProductNames[handle]

  if (exactTranslation) {
    return exactTranslation
  }

  const prefix = productTitlePrefixes.find(([source]) =>
    title.startsWith(`${source} `)
  )

  return prefix ? title.replace(prefix[0], prefix[1]) : title
}

const translateProductDescription = (description: string | null) => {
  if (!description) {
    return description
  }

  const exactTranslation = exactEnglishDescriptions[description]

  if (exactTranslation) {
    return exactTranslation
  }

  const prefix = productDescriptionPrefixes.find(([source]) =>
    description.startsWith(source)
  )

  if (!prefix) {
    return description
  }

  const collectionMatch = description.match(/Thiết kế thuộc BST (.+)\.$/)
  const collectionText = collectionMatch
    ? ` Part of the ${collectionMatch[1]} collection.`
    : ""

  return `${prefix[1]}${collectionText}`
}

export const localizeCategory = <T extends HttpTypes.StoreProductCategory>(
  category: T,
  locale: string | null
): T => {
  if (locale !== "en") {
    return category
  }

  return {
    ...category,
    name: englishCategoryNames[category.handle] ?? category.name,
    category_children: category.category_children?.map((child) =>
      localizeCategory(child, locale)
    ),
    parent_category: category.parent_category
      ? localizeCategory(category.parent_category, locale)
      : category.parent_category,
  }
}

export const localizeCollection = <T extends HttpTypes.StoreCollection>(
  collection: T,
  locale: string | null
): T => {
  if (locale !== "en") {
    return collection
  }

  return {
    ...collection,
    title: englishCollectionNames[collection.handle] ?? collection.title,
  }
}

export const localizeProduct = <T extends HttpTypes.StoreProduct>(
  product: T,
  locale: string | null
): T => {
  if (locale !== "en") {
    return product
  }

  return {
    ...product,
    title: translateProductTitle(product.handle, product.title),
    description: translateProductDescription(product.description),
    collection: product.collection
      ? localizeCollection(product.collection, locale)
      : product.collection,
  }
}
