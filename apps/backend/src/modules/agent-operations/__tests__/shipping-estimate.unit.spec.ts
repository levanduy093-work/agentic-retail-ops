import { calculateFallbackShippingLeadTime, executeShippingEstimate } from "../shipping-estimate-runtime"
import { VietnamAddressService } from "../../ghn-fulfillment/services/vietnam-address-service"

describe("shipping estimate runtime and Vietnam address extraction", () => {
  it("extracts destination province and district accurately from customer messages", async () => {
    const loc1 = await VietnamAddressService.extractDestinationLocation("Giao hàng đến sóc trăng khoản bao nhiêu ngày vậy sốp")
    expect(loc1?.province?.ProvinceName).toBe("Sóc Trăng")

    const loc2 = await VietnamAddressService.extractDestinationLocation("Ship về Cầu Giấy Hà Nội mất bao lâu")
    expect(loc2?.province?.ProvinceName).toBe("Hà Nội")
    expect(loc2?.district?.DistrictName).toBe("Quận Cầu Giấy")

    const loc3 = await VietnamAddressService.findProvince("đà nẵng")
    expect(loc3?.ProvinceName).toBe("Đà Nẵng")

    const loc4 = await VietnamAddressService.findProvince("hồ chí minh")
    expect(loc4?.ProvinceName).toBe("Hồ Chí Minh")
  })

  it("calculates realistic delivery lead time and fees for Vietnam regions", () => {
    // Sóc Trăng (Southern province ID 251) from TP.HCM (202)
    const socTrang = calculateFallbackShippingLeadTime(251, 202)
    expect(socTrang.leadtime_days).toBe(2)
    expect(socTrang.estimated_fee).toBe(30000)
    expect(socTrang.expected_delivery_date).toMatch(/\d{2}\/\d{2}\/\d{4}/)

    // Nội thành HCM (202)
    const hcm = calculateFallbackShippingLeadTime(202, 202)
    expect(hcm.leadtime_days).toBe(1)
    expect(hcm.estimated_fee).toBe(22000)

    // Hà Nội (Northern province ID 201) from TP.HCM (202)
    const hanoi = calculateFallbackShippingLeadTime(201, 202)
    expect(hanoi.leadtime_days).toBe(3)
    expect(hanoi.estimated_fee).toBe(38000)
  })

  it("executes executeShippingEstimate tool successfully", async () => {
    const result = await executeShippingEstimate(
      { destination_location: "Sóc Trăng" },
      "customer-support-agent"
    )

    expect(result.output.carrier).toBe("Giao Hàng Nhanh (GHN)")
    expect(result.output.destination_province).toBe("Sóc Trăng")
    expect(result.output.leadtime_days).toBeGreaterThanOrEqual(1)
    expect(result.output.leadtime_text).toBeDefined()
    expect(result.output.expected_delivery_date).toBeDefined()
    expect(result.output.summary).toContain("Sóc Trăng")
  })
})
