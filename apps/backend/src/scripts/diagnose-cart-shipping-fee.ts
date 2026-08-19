import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getGhnSettings } from "../modules/shipping-hub/ghn-connection"
import { buildPackingPlan } from "../modules/shipping-hub/packing-profile"
import { GhnClient } from "../modules/ghn-fulfillment/ghn-client"

export default async function diagnoseCartShippingFee({ container }: ExecArgs) {
  console.log("\n========================================================")
  console.log("📦 KIỂM TRA PHÍ SHIP & RULE ĐÓNG GÓI CHO GIỎ HÀNG")
  console.log("========================================================\n")

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const ghnSettings = await getGhnSettings(container)

  console.log("1. CẤU HÌNH GHN & KHO HÀNG:")
  console.log(`   - Environment: ${ghnSettings.environment}`)
  console.log(`   - Kho gửi (From District / Ward): District ${ghnSettings.sender_district_id} / Ward ${ghnSettings.sender_ward_code}`)
  console.log(`   - Default Dimensions: ${ghnSettings.default_length}x${ghnSettings.default_width}x${ghnSettings.default_height}cm, ${ghnSettings.default_weight}g`)
  console.log(`   - Packaging Strategy: ${ghnSettings.packing_profile?.strategy || "hybrid_auto"}`)
  console.log(`   - Max Items/Package: ${ghnSettings.packing_profile?.max_items_per_package}`)
  console.log(`   - Max Weight/Package: ${ghnSettings.packing_profile?.max_weight_per_package}g`)
  console.log(`   - Túi PE:`, ghnSettings.packing_profile?.bags?.map(b => `${b.code} (${b.length}x${b.width}cm)`))
  console.log(`   - Hộp Carton:`, ghnSettings.packing_profile?.boxes?.map(b => `${b.code} (${b.length}x${b.width}x${b.height}cm)`))

  // Lấy các sản phẩm trong giỏ hàng
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "sku",
      "weight",
      "length",
      "width",
      "height",
      "product.title",
      "product.id",
    ],
  })

  // 5 sản phẩm trong giỏ hàng:
  // 1. Áo blazer Nova 1 (Variant: L / Xanh navy)
  // 2. Quần short Resort 1 (Variant: XL / Nâu be)
  // 3. Túi tote Canvas 1 (Variant: XL / Nâu be)
  // 4. Áo knit Rib 1 (Variant: L / Xanh navy)
  // 5. Áo thun Essential 1 (Variant: S / Đen)
  const targetKeywords = [
    { prod: "blazer", variant: "L" },
    { prod: "short", variant: "XL" },
    { prod: "tote", variant: "XL" },
    { prod: "knit", variant: "L" },
    { prod: "essential", variant: "S" },
  ]

  console.log("\n2. THÔNG SỐ CÁC SẢN PHẨM TRONG DATABASE:")
  const cartItems: any[] = []

  for (const target of targetKeywords) {
    const matched = variants.find(
      (v) =>
        v.product?.title?.toLowerCase().includes(target.prod.toLowerCase()) &&
        (target.variant ? v.title?.toLowerCase().includes(target.variant.toLowerCase()) : true)
    ) || variants.find((v) => v.product?.title?.toLowerCase().includes(target.prod.toLowerCase()))

    if (matched) {
      const length = matched.length || 20
      const width = matched.width || 15
      const height = matched.height || 3
      const weight = matched.weight || 300
      console.log(`   ✓ ${matched.product?.title} - Phân loại: ${matched.title}`)
      console.log(`     * Kích thước: ${length}x${width}x${height} cm | Trọng lượng: ${weight}g`)
      cartItems.push({
        name: `${matched.product?.title} (${matched.title})`,
        length,
        width,
        height,
        weight,
        quantity: 1,
      })
    } else {
      console.log(`   ✗ Không tìm thấy sản phẩm khớp với keyword: "${target.prod}"`)
    }
  }

  // Lấy các giỏ hàng gần nhất
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "total",
      "subtotal",
      "shipping_total",
      "items.title",
      "items.quantity",
      "items.unit_price",
      "items.variant.title",
      "items.variant.weight",
      "items.variant.length",
      "items.variant.width",
      "items.variant.height",
      "shipping_address.*",
      "shipping_methods.*",
    ],
    pagination: { order: { created_at: "DESC" }, take: 2 },
  })

  console.log("\n3. KIỂM TRA GIỎ HÀNG THỰC TẾ TRONG DATABASE:")
  let activeCart = carts[0]
  if (carts.length) {
    for (const c of carts) {
      console.log(`   - Cart ID: ${c.id}`)
      console.log(`     * Địa chỉ: ${c.shipping_address?.address_1}, ${c.shipping_address?.city}, ${c.shipping_address?.province}`)
      console.log(`     * Metadata GHN: District ID=${c.shipping_address?.metadata?.ghn_district_id}, Ward Code=${c.shipping_address?.metadata?.ghn_ward_code}`)
      console.log(`     * Số lượng sản phẩm trong cart: ${c.items?.length}`)
      c.items?.forEach((it: any) => {
        console.log(`       + ${it.title} (${it.variant?.title}) x ${it.quantity}: ${it.variant?.length}x${it.variant?.width}x${it.variant?.height}cm, ${it.variant?.weight}g`)
      })
      console.log(`     * Phí ship lưu trong Cart:`, c.shipping_methods?.map((m: any) => `${m.name}: ${m.amount} đ`))
    }
  }

  // 4. Chạy thuật toán đóng gói (Packing Algorithm)
  console.log("\n4. THUẬT TOÁN ĐÓNG GÓI (PACKING PLAN):")
  const itemsToPack = activeCart?.items && activeCart.items.length > 0
    ? activeCart.items.map((it: any) => ({
        length: it.variant?.length || 20,
        width: it.variant?.width || 15,
        height: it.variant?.height || 3,
        weight: it.variant?.weight || 300,
        quantity: it.quantity,
        name: it.title,
      }))
    : cartItems

  const packages = buildPackingPlan(itemsToPack, ghnSettings.packing_profile)
  console.log(`   - Tổng số món cần đóng: ${itemsToPack.reduce((s: number, it: any) => s + (it.quantity || 1), 0)} món`)
  console.log(`   - Số lượng kiện được tạo ra: ${packages.length} kiện`)
  packages.forEach((pkg, i) => {
    const volWeight = Math.round((pkg.length * pkg.width * pkg.height) / 5)
    console.log(`   📦 KIỆN ${i + 1}: [${pkg.package_type?.toUpperCase()}] Mã: ${pkg.box_code} (${pkg.box_name || pkg.box_code})`)
    console.log(`      * Kích thước kiện: ${pkg.length} x ${pkg.width} x ${pkg.height} cm`)
    console.log(`      * Trọng lượng thực tế (gồm bao bì): ${pkg.weight} g`)
    console.log(`      * Trọng lượng quy đổi thể tích: ${volWeight} g`)
    console.log(`      * Số món trong kiện: ${pkg.item_count} món`)
  })

  // 5. Gọi Live API GHN tính cước thực tế
  const ghnClient = new GhnClient({
    apiToken: ghnSettings.api_token,
    shopId: ghnSettings.shop_id,
    environment: ghnSettings.environment,
  })

  console.log("\n5. GỌI LIVE API GHN TÍNH CƯỚC THỰC TẾ:")

  // Địa chỉ đích: Lấy từ cart hoặc Thạnh Trị, Sóc Trăng
  const toDistrict = Number(activeCart?.shipping_address?.metadata?.ghn_district_id) || 2244
  const toWard = activeCart?.shipping_address?.metadata?.ghn_ward_code ? String(activeCart.shipping_address.metadata.ghn_ward_code) : "610301"

  console.log(`   --- TUYẾN GIAO HÀNG: Từ Kho (${ghnSettings.sender_district_id}/${ghnSettings.sender_ward_code}) -> Đích (District ${toDistrict} / Ward ${toWard}) ---`)

  try {
    let totalFee = 0
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i]
      const feeRes = await ghnClient.calculateFee({
        from_district_id: ghnSettings.sender_district_id || 1442,
        from_ward_code: ghnSettings.sender_ward_code || "20101",
        to_district_id: toDistrict,
        to_ward_code: toWard,
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        weight: pkg.weight,
        service_type_id: 2,
      })
      console.log(`   * Kiện ${i + 1} (${pkg.box_code}, ${pkg.length}x${pkg.width}x${pkg.height}cm, ${pkg.weight}g):`)
      console.log(`     - Cước dịch vụ chính: ${feeRes.service_fee?.toLocaleString("vi-VN")} đ`)
      console.log(`     - Tổng cước kiện ${i + 1}: ${feeRes.total?.toLocaleString("vi-VN")} đ`)
      totalFee += feeRes.total
    }
    console.log(`   ----------------------------------------------------`)
    console.log(`   ==> TỔNG PHÍ VẬN CHUYỂN TÍNH ĐƯỢC TỪ GHN API: ${totalFee.toLocaleString("vi-VN")} đ`)
  } catch (err: any) {
    console.log(`   ✗ Lỗi khi gọi GHN API: ${err.message}`)
  }

  console.log("\n========================================================")
}

