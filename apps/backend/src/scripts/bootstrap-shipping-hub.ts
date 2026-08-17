import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

const GHN_PROVIDER_ID = "ghn_ghn"
const GHTK_PROVIDER_ID = "ghtk_ghtk"

export default async function bootstrapShippingHub({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: fulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: [
      "id",
      "name",
      "service_zones.id",
      "service_zones.geo_zones.country_code",
    ],
  })
  const vietnamFulfillmentSet = fulfillmentSets.find((set) => {
    return set.service_zones?.some((zone) => {
      return zone.geo_zones?.some((geoZone) => geoZone.country_code === "vn")
    })
  })

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A shipping profile is required before enabling carriers."
    )
  }

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const vietnamWarehouse =
    stockLocations.find((location) => {
      return /kho.*việt nam|vietnam.*warehouse/i.test(location.name)
    }) ?? (stockLocations.length === 1 ? stockLocations[0] : undefined)
  if (!vietnamWarehouse) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The Vietnam Warehouse stock location is required."
    )
  }

  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const fulfillmentSet =
    vietnamFulfillmentSet ??
    (await fulfillmentModuleService.createFulfillmentSets({
      name: "Giao hàng nội địa Việt Nam",
      type: "shipping",
      service_zones: [
        {
          name: "Việt Nam",
          geo_zones: [{ country_code: "vn", type: "country" }],
        },
      ],
    }))

  const vietnamServiceZone = fulfillmentSet.service_zones?.find((zone) => {
    return zone.geo_zones?.some((geoZone) => geoZone.country_code === "vn")
  })
  if (!vietnamServiceZone?.id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The Vietnam service zone could not be configured."
    )
  }

  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: vietnamWarehouse.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_set_id: fulfillmentSet.id,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.toLowerCase().includes("already")) {
      throw error
    }
  }

  for (const providerId of [GHN_PROVIDER_ID, GHTK_PROVIDER_ID]) {
    try {
      await link.create({
        [Modules.STOCK_LOCATION]: {
          stock_location_id: vietnamWarehouse.id,
        },
        [Modules.FULFILLMENT]: {
          fulfillment_provider_id: providerId,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.toLowerCase().includes("already")) {
        logger.warn(`Could not link provider ${providerId}: ${message}`)
      }
    }
  }

  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "price_type", "data", "type.code"],
  })
  const carrierOptions = [
    {
      code: "ghn-standard",
      data: { carrier_code: "GHN", id: "ghn-standard", service_type_id: 2 },
      description: "GHN tính giá theo địa chỉ và khối lượng thực tế.",
      name: "GHN Tiêu chuẩn",
      provider_id: GHN_PROVIDER_ID,
    },
    {
      code: "ghtk-road",
      data: { carrier_code: "GHTK", id: "ghtk-road", transport: "road" },
      description: "GHTK Chuẩn (Đường bộ) tính giá theo địa chỉ và khối lượng thực tế.",
      name: "GHTK Tiết kiệm (Đường bộ)",
      provider_id: GHTK_PROVIDER_ID,
    },
    {
      code: "ghtk-fly",
      data: { carrier_code: "GHTK", id: "ghtk-fly", transport: "fly" },
      description: "GHTK Nhanh (Đường bay) giao nhanh liên tỉnh.",
      name: "GHTK Nhanh (Đường bay)",
      provider_id: GHTK_PROVIDER_ID,
    },
  ]

  for (const option of carrierOptions) {
    const existing = options.find(
      (candidate) =>
        candidate.provider_id === option.provider_id &&
        candidate.type?.code === option.code
    )
    const input = {
      data: option.data,
      name: option.name,
      price_type: "calculated" as const,
      provider_id: option.provider_id,
      rules: [
        { attribute: "enabled_in_store", operator: "eq" as const, value: "true" },
        { attribute: "is_return", operator: "eq" as const, value: "false" },
      ],
      service_zone_id: vietnamServiceZone.id,
      shipping_profile_id: shippingProfile.id,
      type: {
        code: option.code,
        description: option.description,
        label: option.name,
      },
    }

    if (existing) {
      await updateShippingOptionsWorkflow(container).run({
        input: [{ id: existing.id, ...input }],
      })
    } else {
      await createShippingOptionsWorkflow(container).run({ input: [input] })
    }
  }

  const manualOptions = options.filter(
    (option) => option.provider_id === "manual_manual"
  )
  const unsupportedOptions = options.filter((option) => {
    const isOurCarrier =
      option.provider_id === GHN_PROVIDER_ID ||
      option.provider_id === GHTK_PROVIDER_ID
    return (
      isOurCarrier &&
      !carrierOptions.some((supported) => {
        return (
          supported.provider_id === option.provider_id &&
          supported.code === option.type?.code
        )
      })
    )
  })
  const optionsToDisable = [...manualOptions, ...unsupportedOptions]
  if (optionsToDisable.length) {
    await updateShippingOptionsWorkflow(container).run({
      input: optionsToDisable.map((option) => ({
        id: option.id,
        rules: [
          { attribute: "enabled_in_store", operator: "eq", value: "false" },
          { attribute: "is_return", operator: "eq", value: "false" },
        ],
      })),
    })
  }

  logger.info(
    "[Shipping Hub] Carrier calculated options are active; manual storefront options are disabled."
  )
  console.log(
    JSON.stringify(
      {
        carriers: ["GHN", "GHTK"],
        calculated_options: carrierOptions.map((option) => option.code),
        disabled_options: optionsToDisable.length,
        status: "SHIPPING_HUB_BOOTSTRAPPED",
      },
      null,
      2
    )
  )
}

