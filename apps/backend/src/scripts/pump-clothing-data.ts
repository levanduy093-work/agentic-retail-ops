import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function pumpClothingData({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productService = container.resolve(Modules.PRODUCT);
  const inventoryService = container.resolve(Modules.INVENTORY);

  logger.info("Starting pump of 100+ clothing products...");

  // 1. Get or create shipping profile & stock location
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfiles[0];

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  });
  const stockLocation = stockLocations[0];

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
  });
  const defaultSalesChannel = salesChannels[0];

  // 2. Ensure Categories individually
  const categoryDefs = [
    { name: "Áo Nam", handle: "ao-nam-cat" },
    { name: "Áo Nữ", handle: "ao-nu-cat" },
    { name: "Quần Nam", handle: "quan-nam-cat" },
    { name: "Quần Nữ & Váy", handle: "quan-nu-va-vay-cat" },
    { name: "Đồ Thể Thao & Phụ Kiện", handle: "do-the-thao-va-phu-kien-cat" },
  ];

  let categories = await productService.listProductCategories({}, { take: 1000 });

  for (const item of categoryDefs) {
    const exists = categories.find((c) => c.name === item.name || c.handle === item.handle);
    if (!exists) {
      try {
        const { result: createdCats } = await createProductCategoriesWorkflow(container).run({
          input: {
            product_categories: [{ name: item.name, handle: item.handle, is_active: true }],
          },
        });
        categories.push(...createdCats);
      } catch (err: any) {
        logger.warn(`Category creation notice for ${item.name}: ${err.message}`);
      }
    }
  }

  // Refresh categories
  categories = await productService.listProductCategories({}, { take: 1000 });

  // 3. Ensure Collections
  let collections = await productService.listProductCollections({}, { take: 1000 });
  const desiredCollections = [
    { title: "Bán chạy nhất", handle: "ban-chay-nhat" },
    { title: "Khuyến mãi Hot", handle: "khuyen-mai-hot" },
    { title: "Mẫu mới về", handle: "mau-moi-ve" },
    { title: "Sản phẩm nổi bật", handle: "san-pham-noi-bat" },
  ];

  for (const item of desiredCollections) {
    const exists = collections.find(
      (c) => c.handle === item.handle || c.title === item.title
    );
    if (!exists) {
      const [created] = await productService.createProductCollections([item]);
      collections.push(created);
    }
  }

  // 4. Product Options
  const existingOptions = await productService.listProductOptions({}, { take: 1000 });
  let sizeOption = existingOptions.find((o) => o.title === "Size");
  let colorOption = existingOptions.find((o) => o.title === "Color");

  const optionsToCreate = [];
  if (!sizeOption) optionsToCreate.push({ title: "Size", values: ["S", "M", "L", "XL"] });
  if (!colorOption) optionsToCreate.push({ title: "Color", values: ["Black", "White"] });

  if (optionsToCreate.length > 0) {
    const { result: createdOptions } = await createProductOptionsWorkflow(container).run({
      input: { product_options: optionsToCreate },
    });
    if (!sizeOption) sizeOption = createdOptions.find((o) => o.title === "Size");
    if (!colorOption) colorOption = createdOptions.find((o) => o.title === "Color");
  }

  // 5. Categorized Fashion Image Catalog
  const imageCatalog = {
    ao: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=800",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=800",
      "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=800",
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?q=80&w=800",
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800",
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
    ],
    quan: [
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800",
      "https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?q=80&w=800",
      "https://images.unsplash.com/photo-1604176354204-9268737828e4?q=80&w=800",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-front.png",
    ],
    vay: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800",
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=800",
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=800",
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800",
    ],
    phukien: [
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=800",
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=800",
      "https://images.unsplash.com/photo-1527719327859-c6ce80353573?q=80&w=800",
    ],
  };

  // 6. Template Generators for 100 Products
  const types = [
    { prefix: "Áo Thun", cat: "Áo Nam", basePrice: 190000, desc: "Áo thun cotton cao cấp thoáng mát, thấm hút mồ hôi tốt, kiểu dáng trẻ trung." },
    { prefix: "Áo Polo", cat: "Áo Nam", basePrice: 280000, desc: "Áo Polo phong cách lịch lãm, chất liệu vải co giãn 4 chiều vừa vặn cơ thể." },
    { prefix: "Áo Sơ Mi", cat: "Áo Nam", basePrice: 350000, desc: "Áo sơ mi thiết kế công sở sang trọng, dễ phối đồ cùng quần tây hoặc jeans." },
    { prefix: "Áo Hoodie", cat: "Áo Nam", basePrice: 420000, desc: "Áo hoodie nỉ lót bông ấm áp, mũ trùm sâu phong cách streetwear năng động." },
    { prefix: "Áo Khoác", cat: "Áo Nam", basePrice: 550000, desc: "Áo khoác chống gió, chống nước nhẹ, thiết kế nhiều túi tiện lợi." },
    { prefix: "Áo Kiểu", cat: "Áo Nữ", basePrice: 250000, desc: "Áo kiểu nữ thiết kế điệu đà, chất liệu tơ lụa mềm mịn ôm dáng." },
    { prefix: "Áo Crop Top", cat: "Áo Nữ", basePrice: 180000, desc: "Áo crop top nữ phong cách Hàn Quốc cá tính, khoe vóc dáng thon gọn." },
    { prefix: "Áo Cardigan", cat: "Áo Nữ", basePrice: 380000, desc: "Áo cardigan len dệt kim mỏng nhẹ, khoác nhẹ những ngày se lạnh." },
    { prefix: "Quần Jeans", cat: "Quần Nam", basePrice: 480000, desc: "Quần jeans nam chất liệu denim bền đẹp, form dáng đứng tôn dáng." },
    { prefix: "Quần Kaki", cat: "Quần Nam", basePrice: 390000, desc: "Quần kaki nam phong cách tối giản, đường may chỉn chu tinh tế." },
    { prefix: "Quần Jogger", cat: "Quần Nam", basePrice: 320000, desc: "Quần jogger thun năng động, bo gấu gọn gàng thoải mái vận động." },
    { prefix: "Quần Short", cat: "Quần Nam", basePrice: 220000, desc: "Quần short nam chất liệu kaki/thun mát mẻ, phù hợp dạo phố du lịch." },
    { prefix: "Quần Ống Rộng", cat: "Quần Nữ & Váy", basePrice: 360000, desc: "Quần ống rộng hack dáng chuẩn, cạp cao giấu bụng cực tốt." },
    { prefix: "Chân Váy", cat: "Quần Nữ & Váy", basePrice: 290000, desc: "Chân váy chữ A dễ phối áo, phù hợp mặc đi học đi làm hay đi chơi." },
    { prefix: "Đầm Dự Tiệc", cat: "Quần Nữ & Váy", basePrice: 650000, desc: "Đầm dự tiệc thiết kế quyến rũ, chất liệu tơ voan cao cấp nổi bật." },
    { prefix: "Bộ Đồ Thể Thao", cat: "Đồ Thể Thao & Phụ Kiện", basePrice: 490000, desc: "Bộ thể thao co giãn thấm hút mồ hôi chuyên dụng cho tập gym, chạy bộ." },
    { prefix: "Nón Mũ Thời Trang", cat: "Đồ Thể Thao & Phụ Kiện", basePrice: 150000, desc: "Mũ lưỡi trai thêu logo nổi bật, che nắng thời trang năng động." },
    { prefix: "Túi Canvas Tote", cat: "Đồ Thể Thao & Phụ Kiện", basePrice: 180000, desc: "Túi canvas phong cách vintage rộng rãi, đựng vừa laptop và đồ cá nhân." },
  ];

  const styles = [
    "Basic Cotton", "Unisex Streetwear", "Vintage Retro", "Premium Edit",
    "Casual Sporty", "Oversize Fit", "Slim Line", "Korean Style",
    "Minimalist", "Luxury Touch", "Active Move", "Summer Breeze"
  ];

  // Generate 105 distinct clothing products
  const productsToCreate = [];

  for (let i = 0; i < 105; i++) {
    const typeObj = types[i % types.length];
    const styleStr = styles[i % styles.length];
    const category = categories.find((c) => c.name === typeObj.cat) || categories[0];
    const rawTitle = `${typeObj.prefix} ${styleStr} Vol.${Math.floor(i / types.length) + 1}`;
    const handle = `pump4-${slugify(rawTitle)}-${i + 1}`;
    const price = typeObj.basePrice + (i % 7) * 20000;
    const usdPrice = Math.round(price / 25000);

    let pool = imageCatalog.ao;
    if (typeObj.prefix.startsWith("Quần")) pool = imageCatalog.quan;
    else if (typeObj.prefix.includes("Váy") || typeObj.prefix.includes("Đầm")) pool = imageCatalog.vay;
    else if (typeObj.cat.includes("Phụ Kiện") || typeObj.prefix.includes("Nón") || typeObj.prefix.includes("Túi")) pool = imageCatalog.phukien;

    const img1 = pool[i % pool.length];
    const img2 = pool[(i + 1) % pool.length];

    productsToCreate.push({
      title: rawTitle,
      category_ids: category ? [category.id] : [],
      description: `${typeObj.desc} Thiết kế thuộc BST ${styleStr}.`,
      handle,
      weight: 350 + (i % 5) * 50,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile?.id,
      images: [{ url: img1 }, { url: img2 }],
      options: [{ id: sizeOption!.id }, { id: colorOption!.id }],
      variants: [
        {
          title: "S / Black",
          sku: `PUMP4-${i + 1}-S-BLK`,
          options: { Size: "S", Color: "Black" },
          prices: [{ amount: price, currency_code: "vnd" }, { amount: usdPrice, currency_code: "usd" }],
        },
        {
          title: "M / Black",
          sku: `PUMP4-${i + 1}-M-BLK`,
          options: { Size: "M", Color: "Black" },
          prices: [{ amount: price, currency_code: "vnd" }, { amount: usdPrice, currency_code: "usd" }],
        },
        {
          title: "L / White",
          sku: `PUMP4-${i + 1}-L-WHT`,
          options: { Size: "L", Color: "White" },
          prices: [{ amount: price, currency_code: "vnd" }, { amount: usdPrice, currency_code: "usd" }],
        },
        {
          title: "XL / White",
          sku: `PUMP4-${i + 1}-XL-WHT`,
          options: { Size: "XL", Color: "White" },
          prices: [{ amount: price, currency_code: "vnd" }, { amount: usdPrice, currency_code: "usd" }],
        },
      ],
      sales_channels: defaultSalesChannel ? [{ id: defaultSalesChannel.id }] : [],
    });
  }

  logger.info(`Generated ${productsToCreate.length} product schemas. Inserting into Medusa in batches...`);

  // Batch insert products (batch size = 15)
  const batchSize = 15;
  const createdAllProducts = [];

  for (let b = 0; b < productsToCreate.length; b += batchSize) {
    const batch = productsToCreate.slice(b, b + batchSize);
    logger.info(`Inserting batch ${Math.floor(b / batchSize) + 1} / ${Math.ceil(productsToCreate.length / batchSize)}...`);
    const { result: createdBatch } = await createProductsWorkflow(container).run({
      input: { products: batch },
    });
    createdAllProducts.push(...createdBatch);
  }

  logger.info(`Successfully created ${createdAllProducts.length} clothing products in DB!`);

  // 7. Assign products evenly to Collections
  logger.info("Assigning created products to storefront collections...");
  for (let i = 0; i < createdAllProducts.length; i++) {
    const product = createdAllProducts[i];
    const targetCollection = collections[i % collections.length];
    if (product && targetCollection) {
      await productService.updateProducts(product.id, {
        collection_id: targetCollection.id,
      });
    }
  }

  // 8. Seed Inventory Levels (Safely wrapped)
  if (stockLocation) {
    logger.info("Seeding inventory levels for all new variants...");
    try {
      const { data: inventoryItems } = await query.graph({
        entity: "inventory_item",
        fields: ["id"],
      });

      const [existingLevels] = await inventoryService.listInventoryLevels({
        location_id: stockLocation.id,
      });
      const existingItemIds = new Set(
        Array.isArray(existingLevels) ? existingLevels.map((l) => l.inventory_item_id) : []
      );

      const itemsToCreate = inventoryItems.filter(
        (item) => !existingItemIds.has(item.id)
      );

      if (itemsToCreate.length > 0) {
        await createInventoryLevelsWorkflow(container).run({
          input: {
            inventory_levels: itemsToCreate.map((item) => ({
              location_id: stockLocation.id,
              stocked_quantity: 1000,
              inventory_item_id: item.id,
            })),
          },
        });
      }
    } catch (e: any) {
      logger.warn(`Inventory level creation notice: ${e.message}`);
    }
  }

  logger.info(`Successfully finished pumping ${createdAllProducts.length} clothing products into Medusa DB!`);
}
