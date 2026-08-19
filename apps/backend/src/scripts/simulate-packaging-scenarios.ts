import type { ExecArgs } from "@medusajs/framework/types"
import {
  buildPackingPlan,
  DEFAULT_PACKAGING_PROFILE,
  type PackableItem,
  type PackagingProfile,
} from "../modules/shipping-hub/packing-profile"

export default async function simulatePackagingScenarios({
  container,
}: ExecArgs) {
  console.log("\n================================================================================")
  console.log("🧪 THỰC NGHIỆM CHI TIẾT CÁC KIỂU ĐƠN HÀNG & CƠ CHẾ ĐÓNG GÓI TỰ ĐỘNG")
  console.log("================================================================================\n")

  const scenarios: {
    title: string
    description: string
    items: (PackableItem & { name: string })[]
  }[] = [
    {
      title: "1. ĐƠN 1 SẢN PHẨM NHỎ (1 Áo thun / Phụ kiện)",
      description: "Sản phẩm mỏng nhẹ, kích thước 20x15x2cm, nặng 180g",
      items: [
        { name: "Áo thun basic", length: 20, width: 15, height: 2, quantity: 1, weight: 180 },
      ],
    },
    {
      title: "2. ĐƠN 2 SẢN PHẨM CÙNG LOẠI (2 Áo sơ mi trong 1 túi)",
      description: "2 áo sơ mi, kích thước mỗi cái 25x18x2cm, nặng 200g",
      items: [
        { name: "Áo sơ mi Oxford", length: 25, width: 18, height: 2, quantity: 2, weight: 200 },
      ],
    },
    {
      title: "3. ĐƠN 3 MÓN THỜI TRANG KHÁC NHAU (1 Quần Jean + 1 Sơ mi + 1 Áo thun)",
      description: "Tổng 3 món quần áo thời trang tổng cân nặng 730g",
      items: [
        { name: "Quần Jean Slimfit", length: 30, width: 20, height: 3, quantity: 1, weight: 400 },
        { name: "Áo sơ mi lụa", length: 25, width: 18, height: 2, quantity: 1, weight: 180 },
        { name: "Áo thun in hình", length: 20, width: 15, height: 1.5, quantity: 1, weight: 150 },
      ],
    },
    {
      title: "4. ĐƠN 1 ÁO KHOÁC DÀY / ÁO PHAO ĐẠI HÀN",
      description: "Áo khoác to cồng kềnh, kích thước 40x30x6.5cm, nặng 850g",
      items: [
        { name: "Áo phao chần bông", length: 40, width: 30, height: 6.5, quantity: 1, weight: 850 },
      ],
    },
    {
      title: "5. ĐƠN 5 SẢN PHẨM ĐẦY TÚI LỚN (3 Áo thun + 2 Quần short)",
      description: "5 món thời trang hè (đúng giới hạn 5 SP/kiện), nặng 800g",
      items: [
        { name: "Áo thun cotton", length: 22, width: 16, height: 1.5, quantity: 3, weight: 150 },
        { name: "Quần short đũi", length: 24, width: 18, height: 2, quantity: 2, weight: 175 },
      ],
    },
    {
      title: "6. ĐƠN 1 SẢN PHẨM CỨNG / GIÀY HỘP (Không được ép méo)",
      description: "Hộp giày cứng kích thước 32x20x11cm (Dày 11cm vượt mức nén của túi PE), nặng 850g",
      items: [
        { name: "Giày Sneaker Fullbox", length: 32, width: 20, height: 11, quantity: 1, weight: 850 },
      ],
    },
    {
      title: "7. ĐƠN HỖN HỢP (1 Áo thun + 1 Hộp mỹ phẩm chai thủy tinh)",
      description: "Đơn có 1 món mềm (áo 20x15x2cm) + 1 món cứng dễ vỡ (hộp kem 12x8x8cm)",
      items: [
        { name: "Áo thun nữ", length: 20, width: 15, height: 2, quantity: 1, weight: 150 },
        { name: "Hộp kem dưỡng ẩm", length: 12, width: 8, height: 8, quantity: 1, weight: 250 },
      ],
    },
    {
      title: "8. ĐƠN SỈ 9 SẢN PHẨM (Vượt mốc 5 SP / kiện)",
      description: "Khách mua 9 áo thun -> Hệ thống phải tự động tách thành 2 kiện",
      items: [
        { name: "Áo thun local brand", length: 22, width: 16, height: 2, quantity: 9, weight: 180 },
      ],
    },
    {
      title: "9. ĐƠN NẶNG VƯỢT TẢI (Vượt giới hạn 3.000g / kiện)",
      description: "3 áo khoác da cao cấp nặng 1.200g/cái (Tổng 3.600g > 3.000g)",
      items: [
        { name: "Áo khoác da thật", length: 38, width: 28, height: 4, quantity: 3, weight: 1200 },
      ],
    },
  ]

  for (const scenario of scenarios) {
    console.log(`--------------------------------------------------------------------------------`)
    console.log(`📌 ${scenario.title}`)
    console.log(`   Mô tả: ${scenario.description}`)
    console.log(`   Danh sách sản phẩm trong giỏ:`)
    scenario.items.forEach((item) => {
      console.log(`     • ${item.quantity}x ${item.name} (${item.length}x${item.width}x${item.height}cm - ${item.weight}g/cái)`)
    })

    const plan = buildPackingPlan(scenario.items, DEFAULT_PACKAGING_PROFILE)

    console.log(`\n   📦 KẾT QUẢ ĐÓNG GÓI CỦA HỆ THỐNG: (${plan.length} KIỆN)`)
    plan.forEach((pkg, index) => {
      const isBag = pkg.package_type === "pe_bag"
      const typeLabel = isBag ? "🏷️ Túi niêm phong PE" : pkg.package_type === "carton_box" ? "📦 Hộp Carton" : "📐 Kiện tùy chỉnh"
      const volWeight = Math.round((pkg.length * pkg.width * pkg.height) / 5000 * 1000)
      const billableWeight = Math.max(pkg.weight, volWeight)

      console.log(`     ▶ Kiện ${index + 1}:`)
      console.log(`       - Loại bao bì : ${typeLabel}`)
      console.log(`       - Mã bao bì   : ${pkg.box_code} (${pkg.box_name})`)
      console.log(`       - Số lượng món: ${pkg.item_count} món`)
      console.log(`       - Kích thước  : ${pkg.length} x ${pkg.width} x ${pkg.height} cm`)
      console.log(`       - Trọng lượng : ${pkg.weight}g (Đã gồm bì ${isBag ? "10g" : "80g"})`)
      console.log(`       - Trọng lượng tính cước GHN: ${billableWeight}g (Cân nặng thực ${pkg.weight}g vs Thể tích quy đổi ${volWeight}g)`)
    })
    console.log(``)
  }

  console.log("================================================================================")
  console.log("✅ HOÀN THÀNH TOÀN BỘ 9 KỊCH BẢN THỰC NGHIỆM ĐÓNG GÓI!")
  console.log("================================================================================\n")
}
