import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { AGENT_TOOL_REGISTRY } from "./tool-registry"
import { executeAgentTool } from "./tool-executor"
import {
  ShippingEstimateInput,
  ShippingEstimateOutput,
} from "./tools/shipping-tools"
import { VietnamAddressService } from "../ghn-fulfillment/services/vietnam-address-service"
import { GhnSettingsStore } from "../ghn-fulfillment/services/ghn-settings-store"
import { GhnClient } from "../ghn-fulfillment/ghn-client"

// Standard GHN service type IDs
const GHN_STANDARD_SERVICE_ID = 53320 // Chuẩn E-commerce

// Region mapping for Vietnam provinces
// 1 = Northern (Hà Nội, Hải Phòng, ...), 2 = Central (Đà Nẵng, Huế, ...), 3 = Southern & Mekong (TP.HCM, Cần Thơ, Sóc Trăng, ...)
const SOUTHERN_PROVINCE_IDS = new Set([
  202, // TP.HCM
  205, // Cần Thơ
  206, // An Giang
  207, // Bà Rịa - Vũng Tàu
  210, // Bạc Liêu
  212, // Bến Tre
  214, // Bình Dương
  215, // Bình Phước
  216, // Bình Thuận
  217, // Cà Mau
  222, // Đồng Nai
  223, // Đồng Tháp
  229, // Hậu Giang
  233, // Kiên Giang
  239, // Long An
  251, // Sóc Trăng
  253, // Tây Ninh
  258, // Tiền Giang
  259, // Trà Vinh
  261, // Vĩnh Long
])

const CENTRAL_PROVINCE_IDS = new Set([
  203, // Đà Nẵng
  213, // Bình Định
  219, // Đắk Lắk
  220, // Đắk Nông
  224, // Gia Lai
  227, // Hà Tĩnh
  232, // Khánh Hòa
  234, // Kon Tum
  236, // Lâm Đồng
  241, // Nghệ An
  243, // Ninh Thuận
  245, // Phú Yên
  246, // Quảng Bình
  247, // Quảng Nam
  248, // Quảng Ngãi
  250, // Quảng Trị
  256, // Thanh Hóa
  257, // Thừa Thiên Huế
])

export function calculateFallbackShippingLeadTime(
  destinationProvinceId: number,
  originProvinceId = 202 // Default origin: TP. Hồ Chí Minh
) {
  const isSameProvince = destinationProvinceId === originProvinceId
  const isDestinationSouth = SOUTHERN_PROVINCE_IDS.has(destinationProvinceId)
  const isDestinationCentral = CENTRAL_PROVINCE_IDS.has(destinationProvinceId)

  let leadtimeDays = 3
  let fee = 30000

  if (isSameProvince) {
    // Nội thành TP.HCM
    leadtimeDays = 1
    fee = 22000
  } else if (originProvinceId === 202 && isDestinationSouth) {
    // Cùng miền Nam / Miền Tây (Sóc Trăng, Cần Thơ, Bến Tre...)
    leadtimeDays = 2
    fee = 30000
  } else if (isDestinationCentral) {
    // Miền Trung (Đà Nẵng, Khánh Hòa...)
    leadtimeDays = 3
    fee = 35000
  } else {
    // Miền Bắc (Hà Nội, Hải Phòng...)
    leadtimeDays = 3
    fee = 38000
  }

  // Calculate expected date (today + leadtimeDays, skip Sundays)
  const targetDate = new Date()
  let addedDays = 0
  while (addedDays < leadtimeDays) {
    targetDate.setDate(targetDate.getDate() + 1)
    if (targetDate.getDay() !== 0) {
      // Not Sunday
      addedDays++
    }
  }

  const expectedDateFormatted = targetDate.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return {
    estimated_fee: fee,
    expected_delivery_date: expectedDateFormatted,
    leadtime_days: leadtimeDays,
  }
}

export async function executeShippingEstimate(
  input: z.input<typeof ShippingEstimateInput>,
  actorId: string
) {
  const parsedInput = ShippingEstimateInput.parse(input)
  return executeAgentTool<ShippingEstimateInput, ShippingEstimateOutput>(
    AGENT_TOOL_REGISTRY,
    {
      authority: {
        actor_id: actorId,
        granted_permissions: ["agent_fulfillment:read"],
        mode: "DIRECT",
      },
      input: parsedInput,
      tool_name: "shipping.estimate_delivery",
      tool_version: "1.0.0",
    },
    async (parsedInput) => {
      // 1. Resolve destination province & district
      const location =
        await VietnamAddressService.extractDestinationLocation(
          parsedInput.destination_location
        )

      let province = location?.province
      let district = location?.district

      if (!province) {
        province =
          (await VietnamAddressService.findProvince(
            parsedInput.destination_location
          )) || undefined
      }

      if (!province) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Không tìm thấy tỉnh/thành phố phù hợp với '${parsedInput.destination_location}' tại Việt Nam.`
        )
      }

      // Default district if not extracted
      if (!district) {
        const districts = await VietnamAddressService.getDistricts(
          province.ProvinceID
        )
        district = districts[0]
      }

      const fromProvinceName = "TP. Hồ Chí Minh"
      const fromDistrictId = 1442 // Default warehouse: Quận 1, TP.HCM
      const toDistrictId = district?.DistrictID || (province.ProvinceID * 10 + 1)

      let leadtimeDays = 3
      let expectedDeliveryDate: string | null = null
      let estimatedFee = 32000

      // 2. Try GHN live API
      try {
        const ghnConfig = GhnSettingsStore.getGhnConfig()
        if (ghnConfig?.apiToken) {
          const ghnClient = new GhnClient(ghnConfig)

          // Parallel query: leadtime & fee
          const [leadtimeRes, feeRes] = await Promise.allSettled([
            ghnClient.getLeadTime({
              from_district_id: fromDistrictId,
              service_id: GHN_STANDARD_SERVICE_ID,
              to_district_id: toDistrictId,
            }),
            ghnClient.calculateFee({
              from_district_id: fromDistrictId,
              service_type_id: 2,
              to_district_id: toDistrictId,
              weight: parsedInput.weight || 150,
            }),
          ])

          if (leadtimeRes.status === "fulfilled" && leadtimeRes.value.leadtime_days) {
            leadtimeDays = leadtimeRes.value.leadtime_days
            expectedDeliveryDate = leadtimeRes.value.expected_delivery_date || null
          }

          if (feeRes.status === "fulfilled" && feeRes.value.total) {
            estimatedFee = feeRes.value.total
          }
        }
      } catch {
        // Fallback gracefully to SLA calculation
      }

      // If live API did not provide expected date, compute via SLA
      if (!expectedDeliveryDate) {
        const fallback = calculateFallbackShippingLeadTime(province.ProvinceID)
        leadtimeDays = leadtimeDays || fallback.leadtime_days
        expectedDeliveryDate = fallback.expected_delivery_date
        if (!estimatedFee) {
          estimatedFee = fallback.estimated_fee
        }
      }

      const leadtimeText =
        leadtimeDays === 1
          ? "1 - 2 ngày"
          : `${leadtimeDays} - ${leadtimeDays + 1} ngày`
      const feeFormatted = `${estimatedFee.toLocaleString("vi-VN")} đ`
      const districtLabel = district?.DistrictName ? `${district.DistrictName}, ` : ""
      const summary = `Thời gian giao hàng đến ${districtLabel}${province.ProvinceName} qua Giao Hàng Nhanh (GHN) khoảng ${leadtimeText} làm việc (dự kiến nhận ${expectedDeliveryDate}), phí ship khoảng ${feeFormatted}.`

      return {
        carrier: "Giao Hàng Nhanh (GHN)",
        destination_district: district?.DistrictName || null,
        destination_province: province.ProvinceName,
        estimated_fee: estimatedFee,
        estimated_fee_formatted: feeFormatted,
        expected_delivery_date: expectedDeliveryDate,
        from_location: `Kho ${fromProvinceName}`,
        leadtime_days: leadtimeDays,
        leadtime_text: leadtimeText,
        summary,
      }
    }
  )
}
