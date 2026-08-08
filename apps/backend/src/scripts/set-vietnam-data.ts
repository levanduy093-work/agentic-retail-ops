import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function setVietnamData({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const storeModuleService = container.resolve(Modules.STORE);
  const regionModuleService = container.resolve(Modules.REGION);
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);
  const fulfillmentService = container.resolve(Modules.FULFILLMENT);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);

  logger.info("Updating existing data to Vietnam context...");

  // 1. Update Store
  const stores = await storeModuleService.listStores();
  if (stores.length > 0) {
    const store = stores[0];
    await storeModuleService.updateStores(store.id, {
      name: "Cửa hàng mặc định",
      default_region_id: undefined, // Will be set after regions
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
    });
    logger.info("Updated Store.");
  }

  // 2. Update Regions
  const regions = await regionModuleService.listRegions();
  for (const region of regions) {
    await regionModuleService.updateRegions(region.id, {
      name: "Vietnam",
      currency_code: "vnd",
      countries: ["vn"],
    });
  }
  if (stores.length > 0 && regions.length > 0) {
      await storeModuleService.updateStores(stores[0].id, {
          default_region_id: regions[0].id
      });
  }
  logger.info("Updated Regions.");

  // 3. Update Stock Locations
  const locations = await stockLocationService.listStockLocations();
  for (const location of locations) {
    await stockLocationService.updateStockLocations(location.id, {
      name: "Kho hàng Việt Nam",
      address: {
        city: "Hồ Chí Minh",
        country_code: "VN",
        address_1: "Quận 1",
      },
    });
  }
  logger.info("Updated Stock Locations.");

  // 4. Update Sales Channels
  const channels = await salesChannelService.listSalesChannels();
  for (const channel of channels) {
    if (channel.name === "Default Sales Channel") {
      await salesChannelService.updateSalesChannels(channel.id, {
        name: "Kênh bán hàng mặc định",
        description: "Kênh bán hàng mặc định cho Việt Nam",
      });
    }
  }
  logger.info("Updated Sales Channels.");

  logger.info("Successfully updated existing data to Vietnam context!");
}
