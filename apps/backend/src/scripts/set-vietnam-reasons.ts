import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function setVietnamReasons({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const paymentModuleService = container.resolve(Modules.PAYMENT);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  
  logger.info("Fetching existing refund reasons...");
  const { data: refundReasons } = await query.graph({
    entity: "refund_reason",
    fields: ["id", "label", "description"],
  });

  for (const reason of refundReasons) {
    let label = reason.label;
    let description = reason.description;

    if (reason.label === "Shipping Issue" || reason.label === "Lỗi vận chuyển") {
        label = "Lỗi vận chuyển";
        description = "Hoàn tiền do thất lạc, chậm trễ hoặc giao nhầm";
    } else if (reason.label === "Customer Care Adjustment" || reason.label === "Điều chỉnh CSKH") {
        label = "Điều chỉnh CSKH";
        description = "Hoàn tiền như một khoản bồi thường cho sự cố";
    } else if (reason.label === "Pricing Error" || reason.label === "Lỗi giá") {
        label = "Lỗi giá";
        description = "Hoàn tiền để khắc phục lỗi giá hoặc sai chiết khấu";
    }

    try {
        await paymentModuleService.updateRefundReasons({
            id: reason.id,
            label,
            description
        });
    } catch(e) {
        logger.error(`Failed to update refund reason ${reason.id}`, e);
    }
  }

  logger.info("Successfully translated refund reasons!");
}
