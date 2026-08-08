import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function completeVietnamData({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const taxModuleService = container.resolve(Modules.TAX);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  logger.info("Updating Tax Regions...");
  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
  });

  for (const tr of taxRegions) {
    if (tr.country_code !== "vn") {
      try {
        await taxModuleService.updateTaxRegions({
          id: tr.id,
          country_code: "vn",
        });
      } catch (e) {
        logger.error(`Could not update tax region ${tr.id}`, e);
      }
    }
  }

  logger.info("Updating Shipping Options & Fulfillment Sets...");
  const { data: fulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "name"],
  });

  for (const fSet of fulfillmentSets) {
    if (fSet.name.includes("European Warehouse")) {
      await fulfillmentModuleService.updateFulfillmentSets({
        id: fSet.id,
        name: "Giao hàng từ kho Việt Nam",
      });
    }
  }

  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name"],
  });

  for (const option of shippingOptions) {
    let newName = option.name;
    if (option.name === "Standard Shipping") newName = "Giao hàng tiêu chuẩn";
    if (option.name === "Express Shipping") newName = "Giao hàng hỏa tốc";

    if (newName !== option.name) {
      await fulfillmentModuleService.updateShippingOptions({
        id: option.id,
        name: newName,
      });
    }
  }

  logger.info("Successfully completed Vietnam data update!");
}
