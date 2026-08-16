import { MedusaContainer } from "@medusajs/framework";
import type { ProductTypes } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function resetToClothing({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const productService = container.resolve(Modules.PRODUCT);
  const inventoryService = container.resolve(Modules.INVENTORY);

  logger.info("Cleaning up existing products, categories, and inventory items...");

  // Delete existing products
  const existingProducts = await productService.listProducts({});
  if (existingProducts.length > 0) {
    const productIds = existingProducts.map((p) => p.id);
    await productService.deleteProducts(productIds);
    logger.info(`Deleted ${productIds.length} existing products.`);
  }

  // Delete existing categories
  const existingCategories = await productService.listProductCategories({});
  if (existingCategories.length > 0) {
    const categoryIds = existingCategories.map((c) => c.id);
    await productService.deleteProductCategories(categoryIds);
    logger.info(`Deleted ${categoryIds.length} existing categories.`);
  }

  // Delete existing inventory items
  const existingInventoryItems = await inventoryService.listInventoryItems({});
  if (existingInventoryItems.length > 0) {
    const itemIds = existingInventoryItems.map((i) => i.id);
    await inventoryService.deleteInventoryItems(itemIds);
    logger.info(`Deleted ${itemIds.length} existing inventory items.`);
  }

  // Retrieve existing default sales channel
  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
  });
  const defaultSalesChannel = salesChannels[0];

  // Retrieve existing shipping profile
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfiles[0];

  // Retrieve existing stock location
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  });
  const stockLocation = stockLocations[0];

  logger.info("Seeding clothing product categories...");
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Áo nam & nữ",
          is_active: true,
        },
        {
          name: "Áo nỉ & Hoodie",
          is_active: true,
        },
        {
          name: "Quần dài & Jeans",
          is_active: true,
        },
        {
          name: "Quần kra & Merch",
          is_active: true,
        },
      ],
    },
  });

  logger.info("Ensuring clothing product collections...");
  let collections = await productService.listProductCollections({});
  const desiredCollections = [
    { title: "Bán chạy nhất", handle: "ban-chay-nhat" },
    { title: "Khuyến mãi Hot", handle: "khuyen-mai-hot" },
    { title: "Mẫu mới về", handle: "mau-moi-ve" },
    { title: "Sản phẩm nổi bật", handle: "san-pham-noi-bat" },
  ];

  const thietBiMoi = collections.find((c) => c.handle === "thiet-bi-moi" || c.title === "Thiết bị mới");
  if (thietBiMoi) {
    await productService.updateProductCollections(thietBiMoi.id, {
      title: "Mẫu mới về",
      handle: "mau-moi-ve",
    });
  }

  collections = await productService.listProductCollections({});
  for (const item of desiredCollections) {
    const exists = collections.find((c) => c.handle === item.handle || c.title === item.title);
    if (!exists) {
      await productService.createProductCollections([item]);
    }
  }
  collections = await productService.listProductCollections({});

  const banChay = collections.find((c) => c.handle === "ban-chay-nhat") || collections[0];
  const khuyenMai = collections.find((c) => c.handle === "khuyen-mai-hot") || collections[1];
  const mauMoi = collections.find((c) => c.handle === "mau-moi-ve") || collections[2];
  const noiBat = collections.find((c) => c.handle === "san-pham-noi-bat") || collections[3];

  logger.info("Checking product options...");
  const existingOptions = await productService.listProductOptions({});
  let sizeOption = existingOptions.find((o) => o.title === "Size");
  let colorOption = existingOptions.find((o) => o.title === "Color");

  const optionsToCreate: ProductTypes.CreateProductOptionDTO[] = [];
  if (!sizeOption) {
    optionsToCreate.push({
      title: "Size",
      values: ["S", "M", "L", "XL"],
    });
  }
  if (!colorOption) {
    optionsToCreate.push({
      title: "Color",
      values: ["Black", "White"],
    });
  }

  if (optionsToCreate.length > 0) {
    const { result: createdOptions } = await createProductOptionsWorkflow(
      container
    ).run({
      input: {
        product_options: optionsToCreate,
      },
    });
    if (!sizeOption) sizeOption = createdOptions.find((o) => o.title === "Size");
    if (!colorOption) colorOption = createdOptions.find((o) => o.title === "Color");
  }

  logger.info("Seeding clothing products...");
  const { result: createdProducts } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Medusa T-Shirt",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Áo nam & nữ")!.id,
          ],
          description:
            "Reimagine the feeling of a classic T-shirt. With our cotton T-shirts, everyday essentials no longer have to be ordinary.",
          handle: "t-shirt",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile?.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-back.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-back.png",
            },
          ],
          options: [{ id: sizeOption!.id }, { id: colorOption!.id }],
          variants: [
            {
              title: "S / Black",
              sku: "SHIRT-S-BLACK",
              options: { Size: "S", Color: "Black" },
              prices: [{ amount: 250000, currency_code: "vnd" }, { amount: 10, currency_code: "usd" }],
            },
            {
              title: "M / Black",
              sku: "SHIRT-M-BLACK",
              options: { Size: "M", Color: "Black" },
              prices: [{ amount: 250000, currency_code: "vnd" }, { amount: 10, currency_code: "usd" }],
            },
            {
              title: "L / Black",
              sku: "SHIRT-L-BLACK",
              options: { Size: "L", Color: "Black" },
              prices: [{ amount: 250000, currency_code: "vnd" }, { amount: 10, currency_code: "usd" }],
            },
          ],
          sales_channels: defaultSalesChannel ? [{ id: defaultSalesChannel.id }] : [],
        },
        {
          title: "Medusa Sweatshirt",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Áo nỉ & Hoodie")!.id,
          ],
          description:
            "Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirts, everyday essentials no longer have to be ordinary.",
          handle: "sweatshirt",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile?.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-back.png",
            },
          ],
          options: [{ id: sizeOption!.id }],
          variants: [
            {
              title: "S",
              sku: "SWEATSHIRT-S",
              options: { Size: "S" },
              prices: [{ amount: 350000, currency_code: "vnd" }, { amount: 15, currency_code: "usd" }],
            },
            {
              title: "M",
              sku: "SWEATSHIRT-M",
              options: { Size: "M" },
              prices: [{ amount: 350000, currency_code: "vnd" }, { amount: 15, currency_code: "usd" }],
            },
          ],
          sales_channels: defaultSalesChannel ? [{ id: defaultSalesChannel.id }] : [],
        },
        {
          title: "Medusa Sweatpants",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Quần dài & Jeans")!.id,
          ],
          description:
            "Reimagine the feeling of classic sweatpants. With our cotton sweatpants, everyday essentials no longer have to be ordinary.",
          handle: "sweatpants",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile?.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-back.png",
            },
          ],
          options: [{ id: sizeOption!.id }],
          variants: [
            {
              title: "S",
              sku: "SWEATPANTS-S",
              options: { Size: "S" },
              prices: [{ amount: 320000, currency_code: "vnd" }, { amount: 14, currency_code: "usd" }],
            },
            {
              title: "M",
              sku: "SWEATPANTS-M",
              options: { Size: "M" },
              prices: [{ amount: 320000, currency_code: "vnd" }, { amount: 14, currency_code: "usd" }],
            },
          ],
          sales_channels: defaultSalesChannel ? [{ id: defaultSalesChannel.id }] : [],
        },
        {
          title: "Medusa Shorts",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Quần kra & Merch")!.id,
          ],
          description:
            "Reimagine the feeling of classic shorts. With our cotton shorts, everyday essentials no longer have to be ordinary.",
          handle: "shorts",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile?.id,
          images: [
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-front.png",
            },
            {
              url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-back.png",
            },
          ],
          options: [{ id: sizeOption!.id }],
          variants: [
            {
              title: "S",
              sku: "SHORTS-S",
              options: { Size: "S" },
              prices: [{ amount: 200000, currency_code: "vnd" }, { amount: 9, currency_code: "usd" }],
            },
            {
              title: "M",
              sku: "SHORTS-M",
              options: { Size: "M" },
              prices: [{ amount: 200000, currency_code: "vnd" }, { amount: 9, currency_code: "usd" }],
            },
          ],
          sales_channels: defaultSalesChannel ? [{ id: defaultSalesChannel.id }] : [],
        },
        {
          title: "Áo Hoodie Oversize",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Áo nỉ & Hoodie")!.id,
          ],
          description: "Áo hoodie phong cách streetwear năng động, chất liệu nỉ bông dầy dặn giữ ấm tốt.",
          handle: "ao-hoodie-oversize",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile?.id,
          images: [
            { url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?q=80&w=800" },
          ],
          options: [{ id: sizeOption!.id }],
          variants: [
            {
              title: "M",
              sku: "HOODIE-M",
              options: { Size: "M" },
              prices: [{ amount: 450000, currency_code: "vnd" }, { amount: 18, currency_code: "usd" }],
            },
            {
              title: "L",
              sku: "HOODIE-L",
              options: { Size: "L" },
              prices: [{ amount: 450000, currency_code: "vnd" }, { amount: 18, currency_code: "usd" }],
            },
          ],
          sales_channels: defaultSalesChannel ? [{ id: defaultSalesChannel.id }] : [],
        },
        {
          title: "Áo Polo Nam Premium",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Áo nam & nữ")!.id,
          ],
          description: "Áo Polo cổ bẻ chất liệu Pique cotton thoáng khí, lịch lãm phù hợp đi làm và đi chơi.",
          handle: "ao-polo-nam-premium",
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile?.id,
          images: [
            { url: "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?q=80&w=800" },
          ],
          options: [{ id: sizeOption!.id }],
          variants: [
            {
              title: "M",
              sku: "POLO-M",
              options: { Size: "M" },
              prices: [{ amount: 290000, currency_code: "vnd" }, { amount: 12, currency_code: "usd" }],
            },
            {
              title: "L",
              sku: "POLO-L",
              options: { Size: "L" },
              prices: [{ amount: 290000, currency_code: "vnd" }, { amount: 12, currency_code: "usd" }],
            },
          ],
          sales_channels: defaultSalesChannel ? [{ id: defaultSalesChannel.id }] : [],
        },
        {
          title: "Quần Jeans Denim Classic",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Quần dài & Jeans")!.id,
          ],
          description: "Quần jeans chất liệu denim co giãn nhẹ, form dáng ôm vừa vặn thời trang.",
          handle: "quan-jeans-denim-classic",
          weight: 600,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile?.id,
          images: [
            { url: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800" },
          ],
          options: [{ id: sizeOption!.id }],
          variants: [
            {
              title: "M",
              sku: "JEANS-M",
              options: { Size: "M" },
              prices: [{ amount: 490000, currency_code: "vnd" }, { amount: 20, currency_code: "usd" }],
            },
            {
              title: "L",
              sku: "JEANS-L",
              options: { Size: "L" },
              prices: [{ amount: 490000, currency_code: "vnd" }, { amount: 20, currency_code: "usd" }],
            },
          ],
          sales_channels: defaultSalesChannel ? [{ id: defaultSalesChannel.id }] : [],
        },
        {
          title: "Áo Sơ Mi Tay Dài Vintage",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Áo nam & nữ")!.id,
          ],
          description: "Áo sơ mi vải đũi cao cấp mềm mịn, phong cách khoẻ khoắn tươi trẻ.",
          handle: "ao-so-mi-vintage",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile?.id,
          images: [
            { url: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800" },
          ],
          options: [{ id: sizeOption!.id }],
          variants: [
            {
              title: "M",
              sku: "SOMIVIN-M",
              options: { Size: "M" },
              prices: [{ amount: 380000, currency_code: "vnd" }, { amount: 16, currency_code: "usd" }],
            },
            {
              title: "L",
              sku: "SOMIVIN-L",
              options: { Size: "L" },
              prices: [{ amount: 380000, currency_code: "vnd" }, { amount: 16, currency_code: "usd" }],
            },
          ],
          sales_channels: defaultSalesChannel ? [{ id: defaultSalesChannel.id }] : [],
        },
      ],
    },
  });
  logger.info("Finished seeding clothing products.");

  // Assign created products evenly to the 4 collections so that ALL sections show products
  for (let i = 0; i < createdProducts.length; i++) {
    const product = createdProducts[i];
    const targetCollection = collections[i % collections.length];
    if (product && targetCollection) {
      await productService.updateProducts(product.id, {
        collection_id: targetCollection.id,
      });
      logger.info(`Assigned ${product.title} to collection '${targetCollection.title}'`);
    }
  }

  if (stockLocation) {
    logger.info("Seeding inventory levels...");
    const { data: inventoryItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id"],
    });

    const existingLevels = await inventoryService.listInventoryLevels({
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
            stocked_quantity: 1000000,
            inventory_item_id: item.id,
          })),
        },
      });
    }
    logger.info("Finished seeding inventory levels data.");
  }

  logger.info("Successfully reset store data back to clothing catalog!");
}
