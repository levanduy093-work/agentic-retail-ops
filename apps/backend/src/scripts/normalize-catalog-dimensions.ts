import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { IProductModuleService } from "@medusajs/framework/types"

export default async function normalizeCatalogDimensions({ container }: ExecArgs) {
  console.log("\n========================================================")
  console.log("👕 CHUẨN HÓA KÍCH THƯỚC GẬP ĐÓNG GÓI THỰC TẾ CHO CATALOG")
  console.log("========================================================\n")

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule = container.resolve<IProductModuleService>(Modules.PRODUCT)

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

  console.log(`Tìm thấy ${variants.length} biến thể sản phẩm cần chuẩn hóa:`)

  for (const variant of variants) {
    const title = (variant.product?.title || "").toLowerCase()
    let length = 24
    let width = 18
    let height = 2
    let weight = Number(variant.weight) || 200

    if (title.includes("thun") || title.includes("tee")) {
      length = 24
      width = 16
      height = 2
      weight = Math.min(weight, 220) || 180
    } else if (title.includes("cardigan") || title.includes("len")) {
      length = 28
      width = 20
      height = 3.5
      weight = Math.min(weight, 400) || 350
    } else if (title.includes("sơ mi") || title.includes("polo")) {
      length = 26
      width = 18
      height = 2.5
      weight = Math.min(weight, 280) || 240
    } else if (title.includes("hoodie") || title.includes("khoác") || title.includes("blazer")) {
      length = 32
      width = 24
      height = 5
      weight = Math.min(weight, 650) || 550
    } else if (title.includes("jean") || title.includes("kaki") || title.includes("jogger")) {
      length = 28
      width = 20
      height = 3.5
      weight = Math.min(weight, 550) || 450
    } else if (title.includes("váy") || title.includes("đầm") || title.includes("short")) {
      length = 25
      width = 18
      height = 2.5
      weight = Math.min(weight, 350) || 250
    }

    await productModule.updateProductVariants(variant.id, {
      length,
      width,
      height,
      weight,
    })

    console.log(`✓ ${variant.product?.title} (${variant.title}): ${length}x${width}x${height} cm - ${weight}g`)
  }

  console.log("\n========================================================")
  console.log("✅ ĐÃ CHUẨN HÓA XONG TOÀN BỘ KÍCH THƯỚC GẬP ĐÓNG GÓI THỰC TẾ!")
  console.log("========================================================\n")
}
