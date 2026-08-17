import { z } from "@medusajs/framework/zod"

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
