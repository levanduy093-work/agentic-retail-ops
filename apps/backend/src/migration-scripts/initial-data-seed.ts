import { MedusaContainer } from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductOptionsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  );

  const countries = ["vn"];

  logger.info("Seeding store data...");
  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "Default Sales Channel",
          description: "Created by Medusa",
        },
      ],
    },
  });

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Default Publishable API Key",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  });

  const {
    result: [store],
  } = await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "Default Store",
          supported_currencies: [
            {
              currency_code: "vnd",
              is_default: true,
            },
            {
              currency_code: "usd",
              is_default: false,
            },
          ],
          default_sales_channel_id: defaultSalesChannel.id,
        },
      ],
    },
  });

  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Vietnam",
          currency_code: "vnd",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Vietnam Warehouse",
          address: {
            city: "Ho Chi Minh",
            country_code: "VN",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  // This is created by a migration script in core.
  const { data: shippingProfileResult } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Vietnam Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Vietnam",
        geo_zones: [
          {
            country_code: "vn",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "vnd",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "vnd",
            amount: 10,
          },
          {
            region_id: region.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel.id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding product data...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Điện thoại",
          is_active: true,
        },
        {
          name: "Tủ lạnh",
          is_active: true,
        },
        {
          name: "Tivi",
          is_active: true,
        },
        {
          name: "Laptop",
          is_active: true,
        },
      ],
    },
  });

  const { result: productOptionsResult } = await createProductOptionsWorkflow(
    container
  ).run({
    input: {
      product_options: [
        {
          title: "Phiên bản",
          values: ["Tiêu chuẩn", "Plus", "Pro", "Pro Max"],
        },
        {
          title: "Màu sắc",
          values: ["Đen", "Trắng"],
        },
      ],
    },
  });
  const sizeOption = productOptionsResult.find((o) => o.title === "Phiên bản")!;
  const colorOption = productOptionsResult.find((o) => o.title === "Màu sắc")!;

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "iPhone 15",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Điện thoại")!.id,
          ],
          description:
            "Điện thoại thông minh cao cấp với camera sắc nét, hiệu năng siêu việt.",
          handle: "iphone-15",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800",
            },
            {
              url: "https://images.unsplash.com/photo-1605236453806-6ff3685e219e?q=80&w=800",
            },
            {
              url: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800",
            },
            {
              url: "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?q=80&w=800",
            },
          ],
          options: [
            { id: sizeOption.id },
            { id: colorOption.id },
          ],
          variants: [
            {
              title: "S / Black",
              sku: "IPHONE-S-BLACK",
              options: {
                Size: "Tiêu chuẩn",
                Color: "Đen",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "S / White",
              sku: "IPHONE-S-WHITE",
              options: {
                Size: "Tiêu chuẩn",
                Color: "Trắng",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M / Black",
              sku: "IPHONE-M-BLACK",
              options: {
                Size: "Plus",
                Color: "Đen",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M / White",
              sku: "IPHONE-M-WHITE",
              options: {
                Size: "Plus",
                Color: "Trắng",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L / Black",
              sku: "IPHONE-L-BLACK",
              options: {
                Size: "Pro",
                Color: "Đen",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L / White",
              sku: "IPHONE-L-WHITE",
              options: {
                Size: "Pro",
                Color: "Trắng",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL / Black",
              sku: "IPHONE-XL-BLACK",
              options: {
                Size: "Pro Max",
                Color: "Đen",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL / White",
              sku: "IPHONE-XL-WHITE",
              options: {
                Size: "Pro Max",
                Color: "Trắng",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Tủ lạnh Samsung Inverter",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Tủ lạnh")!.id,
          ],
          description:
            "Tủ lạnh công nghệ Inverter tiết kiệm điện năng, bảo quản thực phẩm luôn tươi ngon.",
          handle: "tu-lanh-samsung",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?q=80&w=800",
            },
            {
              url: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?q=80&w=800",
            },
          ],
          options: [{ id: sizeOption.id }],
          variants: [
            {
              title: "Tiêu chuẩn",
              sku: "SWEATIPHONE-S",
              options: {
                Size: "Tiêu chuẩn",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Plus",
              sku: "SWEATIPHONE-M",
              options: {
                Size: "Plus",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Pro",
              sku: "SWEATIPHONE-L",
              options: {
                Size: "Pro",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Pro Max",
              sku: "SWEATIPHONE-XL",
              options: {
                Size: "Pro Max",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "Smart Tivi Sony 4K",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Tivi")!.id,
          ],
          description:
            "Tivi thông minh độ phân giải 4K sắc nét, tận hưởng thế giới giải trí tại gia.",
          handle: "tivi-sony-4k",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?q=80&w=800",
            },
            {
              url: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?q=80&w=800",
            },
          ],
          options: [{ id: sizeOption.id }],
          variants: [
            {
              title: "Tiêu chuẩn",
              sku: "TV-S",
              options: {
                Size: "Tiêu chuẩn",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Plus",
              sku: "TV-M",
              options: {
                Size: "Plus",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Pro",
              sku: "TV-L",
              options: {
                Size: "Pro",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Pro Max",
              sku: "TV-XL",
              options: {
                Size: "Pro Max",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
        {
          title: "MacBook Pro M3",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Laptop")!.id,
          ],
          description:
            "Laptop cấu hình khủng, thiết kế sang trọng mỏng nhẹ, đáp ứng mọi nhu cầu làm việc.",
          handle: "macbook-pro-m3",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=800",
            },
            {
              url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?q=80&w=800",
            },
          ],
          options: [{ id: sizeOption.id }],
          variants: [
            {
              title: "Tiêu chuẩn",
              sku: "MAC-S",
              options: {
                Size: "Tiêu chuẩn",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Plus",
              sku: "MAC-M",
              options: {
                Size: "Plus",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Pro",
              sku: "MAC-L",
              options: {
                Size: "Pro",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Pro Max",
              sku: "MAC-XL",
              options: {
                Size: "Pro Max",
              },
              prices: [
                {
                  amount: 10,
                  currency_code: "vnd",
                },
                {
                  amount: 15,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel.id,
            },
          ],
        },
      ],
    },
  });
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: stockLocation.id,
        stocked_quantity: 1000000,
        inventory_item_id: item.id,
      })),
    },
  });

  logger.info("Finished seeding inventory levels data.");
}
