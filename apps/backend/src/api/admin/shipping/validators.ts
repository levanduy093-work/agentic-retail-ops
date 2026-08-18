import { z } from "@medusajs/framework/zod"

export const ConfigurePackagingProfile = z.object({
  packaging_weight: z.number().positive().max(5000),
  max_items_per_package: z.number().int().positive().max(100),
  max_weight_per_package: z.number().positive().max(50000),
  boxes: z.array(
    z.object({
      code: z.string().trim().min(1).max(20),
      length: z.number().positive().max(200),
      width: z.number().positive().max(200),
      height: z.number().positive().max(200),
    })
  ).min(1).max(10),
})

export type ConfigurePackagingProfile = z.infer<typeof ConfigurePackagingProfile>

export const ConfigureGhnCarrier = z.object({
  api_token: z.string().trim().min(1).optional(),
  base_url: z.string().trim().url().optional(),
  client_id: z.number().int().positive().optional(),
  default_height: z.number().positive().optional(),
  default_length: z.number().positive().optional(),
  default_weight: z.number().positive().optional(),
  default_width: z.number().positive().optional(),
  environment: z.enum(["sandbox", "production"]).optional(),
  is_enabled: z.boolean().optional(),
  is_insured: z.boolean().optional(),
  payment_type_id: z.number().int().min(1).max(2).optional(),
  required_note: z
    .enum(["KHONGCHOXEMHANG", "CHOXEMHANGKHONGTHU", "CHOTOT"])
    .optional(),
  sender_address: z.string().trim().min(3).optional(),
  sender_district_id: z.number().int().positive().optional(),
  sender_name: z.string().trim().min(2).optional(),
  sender_phone: z.string().trim().min(8).optional(),
  sender_province_id: z.number().int().positive().optional(),
  sender_ward_code: z.string().trim().min(1).optional(),
  shop_id: z.number().int().positive().optional(),
})

export type ConfigureGhnCarrier = z.infer<typeof ConfigureGhnCarrier>

export const TestGhnCarrier = ConfigureGhnCarrier.extend({
  api_token: z.string().trim().min(1).optional(),
  shop_id: z.number().int().positive().optional(),
})

export type TestGhnCarrier = z.infer<typeof TestGhnCarrier>
