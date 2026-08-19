import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getGhnSettings } from "../modules/shipping-hub/ghn-connection"
import { buildPackingPlan } from "../modules/shipping-hub/packing-profile"
import { GhnClient } from "../modules/ghn-fulfillment/ghn-client"

export default async function diagnoseCartShippingFee({ container }: ExecArgs) {
  console.log("\n========================================================")
  console.log("🔍 CHẨN ĐOÁN: TẠI SAO ĐƠN 2 ÁO BỊ TÍNH CƯỚC 40.700 Đ?")
  console.log("========================================================\n")

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const ghnSettings = await getGhnSettings(container)

  // 1. Tìm thông tin 2 sản phẩm trong DB
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "title",
      "weight",
      "length",
      "width",
      "height",
      "product.title",
      "product.id",
    ],
  })

  const tshirt = variants.find(v => v.product?.title?.toLowerCase().includes("thun essential") && v.title?.includes("S"))
    || variants.find(v => v.product?.title?.toLowerCase().includes("thun essential"))
    || variants[0]

  const cardigan = variants.find(v => v.product?.title?.toLowerCase().includes("cardigan merino") && v.title?.includes("S"))
    || variants.find(v => v.product?.title?.toLowerCase().includes("cardigan merino"))
    || variants[1]

  console.log("1. THÔNG SỐ SẢN PHẨM TRONG DATABASE:")
  console.log(`   - Sản phẩm 1: ${tshirt?.product?.title} (${tshirt?.title})`)
  console.log(`     * Kích thước: ${tshirt?.length}x${tshirt?.width}x${tshirt?.height} cm, Trọng lượng: ${tshirt?.weight}g`)
  console.log(`   - Sản phẩm 2: ${cardigan?.product?.title} (${cardigan?.title})`)
  console.log(`     * Kích thước: ${cardigan?.length}x${cardigan?.width}x${cardigan?.height} cm, Trọng lượng: ${cardigan?.weight}g`)

  // 2. Chạy thuật toán đóng gói
  const items = [
    {
      name: tshirt?.product?.title,
      length: tshirt?.length || 20,
      width: tshirt?.width || 15,
      height: tshirt?.height || 2,
      weight: tshirt?.weight || 200,
      quantity: 1,
    },
    {
      name: cardigan?.product?.title,
      length: cardigan?.length || 36,
      width: cardigan?.width || 28,
      height: cardigan?.height || 7,
      weight: cardigan?.weight || 485,
      quantity: 1,
    },
  ]

  const packages = buildPackingPlan(items, ghnSettings.packing_profile)

  console.log("\n2. KẾT QUẢ ĐÓNG GÓI:")
  console.log(`   - Số lượng kiện được tạo ra: ${packages.length} kiện`)
  packages.forEach((pkg, i) => {
    console.log(`   - Kiện ${i + 1}: ${pkg.package_type} - ${pkg.box_code} (${pkg.box_name})`)
    console.log(`     * Kích thước: ${pkg.length}x${pkg.width}x${pkg.height} cm, Trọng lượng: ${pkg.weight}g, Số món: ${pkg.item_count}`)
  })

  // 3. Kiểm tra tính cước GHN từ Quận 1 sang Gò Vấp
  const ghnClient = new GhnClient({
    apiToken: ghnSettings.api_token,
    shopId: ghnSettings.shop_id,
    environment: ghnSettings.environment,
  })

  // Gò Vấp = district 1444, Phường 5 = ward 20305 (hoặc tìm theo GHN)
  try {
    const goVapDistricts = await ghnClient.getDistricts(202) // TP.HCM
    const goVap = goVapDistricts.find(d => d.DistrictName.includes("Gò Vấp")) || { DistrictID: 1444 }
    const goVapWards = await ghnClient.getWards(goVap.DistrictID)
    const ward5 = goVapWards.find(w => w.WardName.includes("5")) || goVapWards[0]

    console.log(`\n3. TÍNH CƯỚC GHN (Kho Q1 -> Gò Vấp, ${ward5.WardName}):`)
    let totalCalculated = 0
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i]
      const fee = await ghnClient.calculateFee({
        from_district_id: 1442,
        from_ward_code: "20101",
        to_district_id: goVap.DistrictID,
        to_ward_code: ward5.WardCode,
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        weight: pkg.weight,
        service_type_id: 2,
      })
      console.log(`   - Kiện ${i + 1}: ${fee.total.toLocaleString("vi-VN")} đ`)
      totalCalculated += fee.total
    }
    console.log(`   ==> TỔNG CƯỚC VẬN CHUYỂN: ${totalCalculated.toLocaleString("vi-VN")} đ`)
  } catch (err: any) {
    console.log(`   ✗ Lỗi tính cước GHN: ${err.message}`)
  }

  console.log("\n========================================================")
}
