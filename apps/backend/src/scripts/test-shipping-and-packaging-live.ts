import type { ExecArgs } from "@medusajs/framework/types"
import { getGhnSettings } from "../modules/shipping-hub/ghn-connection"
import { GhnClient } from "../modules/ghn-fulfillment/ghn-client"
import {
  buildPackingPlan,
  DEFAULT_PACKAGING_PROFILE,
  type PackagingProfile,
} from "../modules/shipping-hub/packing-profile"
import { configurePackagingProfileWorkflow } from "../workflows/shipping-hub/configure-packaging-profile"

export default async function testShippingAndPackagingLive({
  container,
}: ExecArgs) {
  console.log("\n========================================================")
  console.log("📦 KIỂM THỬ HỆ THỐNG ĐÓNG GÓI (TÚI PE & CARTON) & GHN LIVE API")
  console.log("========================================================\n")

  // 1. Load settings & initialize GHN Client
  const ghnSettings = await getGhnSettings(container)
  console.log("1. THÔNG TIN CẤU HÌNH GHN HIỆN TẠI:")
  console.log(`   - Environment: ${ghnSettings.environment}`)
  console.log(`   - Shop ID: ${ghnSettings.shop_id || "Chưa cấu hình"}`)
  console.log(`   - Sender Name: ${ghnSettings.sender_name || "Chưa cấu hình"}`)
  console.log(`   - Sender Phone: ${ghnSettings.sender_phone || "Chưa cấu hình"}`)
  console.log(`   - API Token: ${ghnSettings.api_token ? "✓ Đã lưu (bảo mật)" : "✗ Chưa có token"}`)

  const ghnClient = new GhnClient({
    apiToken: ghnSettings.api_token,
    shopId: ghnSettings.shop_id,
    environment: ghnSettings.environment,
  })

  // 2. Kiểm tra kết nối GHN Live API
  console.log("\n2. KIỂM TRA KẾT NỐI LIVE API GHN:")
  let ghnConnected = false
  try {
    const provinces = await ghnClient.getProvinces()
    console.log(`   ✓ Kết nối GHN thành công! Lấy được ${provinces.length} tỉnh/thành phố từ GHN.`)
    ghnConnected = true
  } catch (error: any) {
    console.log(`   ✗ Lỗi kết nối GHN API: ${error.message}`)
  }

  // 3. Thiết lập thông số Đóng gói Chuẩn thực tế tối ưu cho Shop
  console.log("\n3. THIẾT LẬP THÔNG SỐ ĐÓNG GÓI CHUẨN THỰC TẾ (REALISTIC PRESETS):")
  const realisticProfile: PackagingProfile = {
    strategy: "hybrid_auto",
    packaging_weight: 80, // Hộp carton 80g
    bag_packaging_weight: 10, // Túi PE 10g
    max_items_per_package: 5,
    max_weight_per_package: 3000,
    bags: [
      {
        code: "PE-17x30",
        name: "Túi PE 17x30cm (1 áo thun / phụ kiện nhỏ)",
        length: 30,
        width: 17,
        max_thickness: 4,
        max_items: 1,
      },
      {
        code: "PE-25x35",
        name: "Túi PE 25x35cm (1-2 áo sơ mi / quần jean)",
        length: 35,
        width: 25,
        max_thickness: 5,
        max_items: 2,
      },
      {
        code: "PE-28x42",
        name: "Túi PE 28x42cm (2-3 áo / set đồ ngủ)",
        length: 42,
        width: 28,
        max_thickness: 6,
        max_items: 3,
      },
      {
        code: "PE-32x45",
        name: "Túi PE 32x45cm (Áo khoác / Váy dày / Giày mềm)",
        length: 45,
        width: 32,
        max_thickness: 7,
        max_items: 5,
      },
      {
        code: "PE-38x52",
        name: "Túi PE 38x52cm (Combo lớn / Áo phao / Balo)",
        length: 52,
        width: 38,
        max_thickness: 8,
        max_items: 8,
      },
    ],
    boxes: [
      {
        code: "S",
        name: "Hộp Carton S (25x18x8cm - Hàng nhỏ, mỹ phẩm)",
        length: 25,
        width: 18,
        height: 8,
        max_items: 2,
      },
      {
        code: "M",
        name: "Hộp Carton M (35x25x12cm - Hàng vừa, phụ kiện)",
        length: 35,
        width: 25,
        height: 12,
        max_items: 4,
      },
      {
        code: "L",
        name: "Hộp Carton L (45x35x18cm - Hàng lớn, giày hộp)",
        length: 45,
        width: 35,
        height: 18,
        max_items: 6,
      },
      {
        code: "XL",
        name: "Hộp Carton XL (55x40x25cm - Combo nhiều món)",
        length: 55,
        width: 40,
        height: 25,
        max_items: 10,
      },
    ],
  }

  // Lưu cấu hình vào database
  await configurePackagingProfileWorkflow(container).run({
    input: realisticProfile,
  })
  console.log("   ✓ Đã cập nhật cấu hình đóng gói chuẩn vào Database và Runtime của Shop!")

  // 4. Kiểm thử các kịch bản Đóng gói (Packaging Scenarios)
  console.log("\n4. THỬ NGHIỆM CƠ CHẾ ĐÓNG GÓI TỰ ĐỘNG:")

  // Kịch bản 1: 1 Áo thun (20x15x2cm, 200g)
  const tshirtItem = [{ length: 20, width: 15, height: 2, quantity: 1, weight: 200 }]
  const planTshirtAuto = buildPackingPlan(tshirtItem, realisticProfile)
  const planTshirtCarton = buildPackingPlan(tshirtItem, { ...realisticProfile, strategy: "carton_only" })

  console.log("\n   [Kịch bản 1: Khách mua 1 Áo thun (200g)]")
  console.log(`   - Chế độ Tự động (Túi PE):`)
  console.log(`     * Loại bao bì: ${planTshirtAuto[0].package_type === "pe_bag" ? "Túi niêm phong PE" : "Hộp Carton"}`)
  console.log(`     * Mã bao bì: ${planTshirtAuto[0].box_code} (${planTshirtAuto[0].box_name})`)
  console.log(`     * Kích thước kiện: ${planTshirtAuto[0].length}x${planTshirtAuto[0].width}x${planTshirtAuto[0].height} cm`)
  console.log(`     * Khối lượng kiện (cả bì 10g): ${planTshirtAuto[0].weight} g`)
  const volWeightPE = Math.round((planTshirtAuto[0].length * planTshirtAuto[0].width * planTshirtAuto[0].height) / 5000 * 1000)
  console.log(`     * Trọng lượng quy đổi thể tích: ${volWeightPE} g (Thực tế tính theo ${Math.max(planTshirtAuto[0].weight, volWeightPE)}g)`)

  console.log(`   - Nếu ép đóng Hộp Carton:`)
  console.log(`     * Loại bao bì: Hộp Carton`)
  console.log(`     * Mã bao bì: ${planTshirtCarton[0].box_code} (${planTshirtCarton[0].box_name})`)
  console.log(`     * Kích thước kiện: ${planTshirtCarton[0].length}x${planTshirtCarton[0].width}x${planTshirtCarton[0].height} cm`)
  console.log(`     * Khối lượng kiện (cả bì 80g): ${planTshirtCarton[0].weight} g`)
  const volWeightBox = Math.round((planTshirtCarton[0].length * planTshirtCarton[0].width * planTshirtCarton[0].height) / 5000 * 1000)
  console.log(`     * Trọng lượng quy đổi thể tích: ${volWeightBox} g (Bị tính cước ở mức ${Math.max(planTshirtCarton[0].weight, volWeightBox)}g)`)

  // Kịch bản 2: 1 Giày hộp / Mỹ phẩm cứng (32x22x12cm, 850g)
  const shoeItem = [{ length: 32, width: 22, height: 12, quantity: 1, weight: 850 }]
  const planShoe = buildPackingPlan(shoeItem, realisticProfile)
  console.log("\n   [Kịch bản 2: Khách mua 1 Giày hộp / Đồ cứng (32x22x12cm, 850g)]")
  console.log(`   - Loại bao bì tự chọn: ${planShoe[0].package_type === "pe_bag" ? "Túi PE" : "Hộp Carton"}`)
  console.log(`   - Mã bao bì: ${planShoe[0].box_code} (${planShoe[0].box_name})`)
  console.log(`   - Kích thước kiện: ${planShoe[0].length}x${planShoe[0].width}x${planShoe[0].height} cm`)
  console.log(`   - Khối lượng kiện: ${planShoe[0].weight} g`)

  // Kịch bản 3: Đơn hàng 7 món áo (vượt quá giới hạn 5 SP/kiện)
  const bulkItems = [{ length: 25, width: 20, height: 2, quantity: 7, weight: 200 }]
  const planBulk = buildPackingPlan(bulkItems, realisticProfile)
  console.log("\n   [Kịch bản 3: Khách mua 7 áo thun (Vượt giới hạn 5 SP/kiện)]")
  console.log(`   - Tự động tách thành ${planBulk.length} kiện hàng:`)
  planBulk.forEach((pkg, idx) => {
    console.log(`     * Kiện ${idx + 1}: ${pkg.box_name}, chứa ${pkg.item_count} món, nặng ${pkg.weight}g, kích thước ${pkg.length}x${pkg.width}x${pkg.height}cm`)
  })

  // 5. Gọi Live API GHN tính cước thực tế để so sánh chi phí vận chuyển
  if (ghnConnected && ghnSettings.api_token) {
    console.log("\n5. GỌI LIVE API GHN TÍNH CƯỚC THỰC TẾ (TP.HCM -> HÀ NỘI):")
    try {
      // Get districts in Hanoi (ProvinceID 201)
      const hanoiDistricts = await ghnClient.getDistricts(201)
      const targetDistrict = hanoiDistricts[0] || { DistrictID: 1482, DistrictName: "Quận Ba Đình" }
      const hanoiWards = await ghnClient.getWards(targetDistrict.DistrictID)
      const targetWard = hanoiWards[0] || { WardCode: "1A0101", WardName: "Phường Phúc Xá" }

      console.log(`   - Tuyến gửi: Quận 1, TP.HCM (1442) -> ${targetDistrict.DistrictName}, Hà Nội (${targetWard.WardName} - ${targetWard.WardCode})`)

      // 5.1 Cước cho Túi PE (1 Áo thun)
      const feePE = await ghnClient.calculateFee({
        from_district_id: 1442,
        from_ward_code: "20101",
        to_district_id: targetDistrict.DistrictID,
        to_ward_code: targetWard.WardCode,
        length: planTshirtAuto[0].length,
        width: planTshirtAuto[0].width,
        height: planTshirtAuto[0].height,
        weight: planTshirtAuto[0].weight,
        insurance_value: 200000,
        service_type_id: 2,
      })

      // 5.2 Cước cho Hộp Carton (1 Áo thun)
      const feeCarton = await ghnClient.calculateFee({
        from_district_id: 1442,
        from_ward_code: "20101",
        to_district_id: targetDistrict.DistrictID,
        to_ward_code: targetWard.WardCode,
        length: planTshirtCarton[0].length,
        width: planTshirtCarton[0].width,
        height: planTshirtCarton[0].height,
        weight: planTshirtCarton[0].weight,
        insurance_value: 200000,
        service_type_id: 2,
      })

      // 5.3 Cước cho Hộp Giày
      const feeShoe = await ghnClient.calculateFee({
        from_district_id: 1442,
        from_ward_code: "20101",
        to_district_id: targetDistrict.DistrictID,
        to_ward_code: targetWard.WardCode,
        length: planShoe[0].length,
        width: planShoe[0].width,
        height: planShoe[0].height,
        weight: planShoe[0].weight,
        insurance_value: 500000,
        service_type_id: 2,
      })

      console.log(`   ------------------------------------------------------------`)
      console.log(`   📦 1 Áo thun đóng TÚI PE (${planTshirtAuto[0].box_code}):`)
      console.log(`      * Kích thước & Trọng lượng: ${planTshirtAuto[0].length}x${planTshirtAuto[0].width}x${planTshirtAuto[0].height}cm - ${planTshirtAuto[0].weight}g`)
      console.log(`      * Trọng lượng quy đổi thể tích: ${volWeightPE}g`)
      console.log(`      * Cước vận chuyển GHN: ${feePE.total.toLocaleString("vi-VN")} đ`)
      console.log(`\n   📦 1 Áo thun đóng HỘP CARTON (${planTshirtCarton[0].box_code}):`)
      console.log(`      * Kích thước & Trọng lượng: ${planTshirtCarton[0].length}x${planTshirtCarton[0].width}x${planTshirtCarton[0].height}cm - ${planTshirtCarton[0].weight}g`)
      console.log(`      * Trọng lượng quy đổi thể tích: ${volWeightBox}g`)
      console.log(`      * Cước vận chuyển GHN: ${feeCarton.total.toLocaleString("vi-VN")} đ`)

      const diff = feeCarton.total - feePE.total
      if (diff > 0) {
        console.log(`\n      🎉 KẾT QUẢ: TIẾT KIỆM ĐƯỢC ${diff.toLocaleString("vi-VN")} đ / đơn hàng (${Math.round((diff / feeCarton.total) * 100)}%) khi dùng Túi PE!`)
      } else {
        console.log(`\n      ℹ️ Tuyến đường và trọng lượng đều nằm trong nấc cước chuẩn liên tỉnh tối thiểu của GHN (${feePE.total.toLocaleString("vi-VN")} đ).`)
      }

      // 5.4 Cước cho Combo 3 áo khoác/set đồ (PE-32x45 vs Hộp Carton L)
      const comboItems = [{ length: 30, width: 25, height: 2, quantity: 3, weight: 250 }]
      const planComboPE = buildPackingPlan(comboItems, realisticProfile)
      const planComboBox = buildPackingPlan(comboItems, { ...realisticProfile, strategy: "carton_only" })

      const feeComboPE = await ghnClient.calculateFee({
        from_district_id: 1442,
        from_ward_code: "20101",
        to_district_id: targetDistrict.DistrictID,
        to_ward_code: targetWard.WardCode,
        length: planComboPE[0].length,
        width: planComboPE[0].width,
        height: planComboPE[0].height,
        weight: planComboPE[0].weight,
        insurance_value: 600000,
        service_type_id: 2,
      })

      const feeComboBox = await ghnClient.calculateFee({
        from_district_id: 1442,
        from_ward_code: "20101",
        to_district_id: targetDistrict.DistrictID,
        to_ward_code: targetWard.WardCode,
        length: planComboBox[0].length,
        width: planComboBox[0].width,
        height: planComboBox[0].height,
        weight: planComboBox[0].weight,
        insurance_value: 600000,
        service_type_id: 2,
      })

      const volComboPE = Math.round((planComboPE[0].length * planComboPE[0].width * planComboPE[0].height) / 5000 * 1000)
      const volComboBox = Math.round((planComboBox[0].length * planComboBox[0].width * planComboBox[0].height) / 5000 * 1000)

      console.log(`\n   📦 Combo 3 món Thời trang đóng TÚI PE (${planComboPE[0].box_code}):`)
      console.log(`      * Kích thước & Trọng lượng: ${planComboPE[0].length}x${planComboPE[0].width}x${planComboPE[0].height}cm - ${planComboPE[0].weight}g`)
      console.log(`      * Trọng lượng quy đổi thể tích: ${volComboPE}g`)
      console.log(`      * Cước vận chuyển GHN: ${feeComboPE.total.toLocaleString("vi-VN")} đ`)

      console.log(`\n   📦 Combo 3 món Thời trang đóng HỘP CARTON (${planComboBox[0].box_code}):`)
      console.log(`      * Kích thước & Trọng lượng: ${planComboBox[0].length}x${planComboBox[0].width}x${planComboBox[0].height}cm - ${planComboBox[0].weight}g`)
      console.log(`      * Trọng lượng quy đổi thể tích: ${volComboBox}g (Bị tính cước ở mức ${(volComboBox/1000).toFixed(2)}kg)`)
      console.log(`      * Cước vận chuyển GHN: ${feeComboBox.total.toLocaleString("vi-VN")} đ`)

      const comboDiff = feeComboBox.total - feeComboPE.total
      if (comboDiff > 0) {
        console.log(`\n      🎉 TIẾT KIỆM ĐƯỢC: ${comboDiff.toLocaleString("vi-VN")} đ / đơn (${Math.round((comboDiff / feeComboBox.total) * 100)}%) khi dùng Túi niêm phong PE thay vì Hộp Carton!`)
      }

      console.log(`\n   📦 1 Hộp Giày / Đồ cứng (${planShoe[0].box_code}):`)
      console.log(`      * Kích thước & Trọng lượng: ${planShoe[0].length}x${planShoe[0].width}x${planShoe[0].height}cm - ${planShoe[0].weight}g`)
      console.log(`      * Cước vận chuyển GHN: ${feeShoe.total.toLocaleString("vi-VN")} đ`)
      console.log(`   ------------------------------------------------------------`)
    } catch (err: any) {
      console.log(`   ✗ Lỗi khi gọi tính cước GHN: ${err.message}`)
    }
  }

  console.log("\n========================================================")
  console.log("✅ HOÀN THÀNH KIỂM THỬ HỆ THỐNG VẬN CHUYỂN & ĐÓNG GÓI!")
  console.log("========================================================\n")
}
