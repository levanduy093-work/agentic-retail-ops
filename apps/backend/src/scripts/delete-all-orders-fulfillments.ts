import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function deleteAllOrdersAndFulfillments({ container }: ExecArgs) {
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  if (!pgConnection) {
    throw new Error("PostgreSQL connection not found in container")
  }

  console.log("=== BẮT ĐẦU XÓA TOÀN BỘ ĐƠN HÀNG VÀ VẬN ĐƠN ===")

  await pgConnection.transaction(async (trx) => {
    // 1. Link tables
    console.log("1. Xóa các bảng liên kết (Links)...")
    await trx("order_fulfillment").del()
    await trx("order_cart").del()
    await trx("order_payment_collection").del()
    await trx("cart_payment_collection").del()

    // 2. Order sub-tables
    console.log("2. Xóa dữ liệu chi tiết đơn hàng (Order items, changes, shipping, summaries)...")
    await trx("order_line_item_tax_line").del()
    await trx("order_line_item_adjustment").del()
    await trx("order_line_item").del()
    await trx("order_item").del()
    await trx("order_shipping_method_tax_line").del()
    await trx("order_shipping_method_adjustment").del()
    await trx("order_shipping_method").del()
    await trx("order_shipping").del()
    await trx("order_change_action").del()
    await trx("order_change").del()
    await trx("order_summary").del()
    await trx("order_transaction").del()
    await trx("order_credit_line").del()
    await trx("order_claim_item_image").del()
    await trx("order_claim_item").del()
    await trx("order_claim").del()
    await trx("order_exchange_item").del()
    await trx("order_exchange").del()
    await trx("order_promotion").del()

    // 3. Orders & Order addresses
    console.log("3. Xóa đơn hàng chính (Orders & Order addresses)...")
    await trx("order").del()
    await trx("order_address").del()

    // 4. Fulfillments & labels & addresses
    console.log("4. Xóa vận đơn (Fulfillments, labels, items, delivery addresses)...")
    await trx("fulfillment_label").del()
    await trx("fulfillment_item").del()
    await trx("fulfillment").del()
    await trx("fulfillment_address").del()
    await trx("shipping_webhook_event").del()

    // 5. Payments linked to orders
    console.log("5. Xóa thanh toán đơn hàng (Payments, collections, sessions)...")
    await trx("capture").del()
    await trx("refund").del()
    await trx("payment").del()
    await trx("payment_session").del()
    await trx("payment_collection_payment_providers").del()
    await trx("payment_collection").del()

    // 6. Carts cleanup
    console.log("6. Dọn dẹp giỏ hàng thử nghiệm cũ (Carts)...")
    await trx("cart_line_item_tax_line").del()
    await trx("cart_line_item_adjustment").del()
    await trx("cart_line_item").del()
    await trx("cart_shipping_method_tax_line").del()
    await trx("cart_shipping_method_adjustment").del()
    await trx("cart_shipping_method").del()
    await trx("cart_promotion").del()
    await trx("cart").del()
    await trx("cart_address").del()
  })

  console.log("=== ĐÃ XÓA TOÀN BỘ DỮ LIỆU ĐƠN HÀNG VÀ VẬN ĐƠN THÀNH CÔNG ===")
}
