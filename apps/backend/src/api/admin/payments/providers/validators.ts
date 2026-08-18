import { z } from "@medusajs/framework/zod"

export type ConfigurePayosProviderType = z.infer<typeof ConfigurePayosProvider>
export const ConfigurePayosProvider = z.object({
  code: z.string().optional(),
  client_id: z.string().optional(),
  api_key: z.string().optional(),
  checksum_key: z.string().optional(),
  environment: z.enum(["sandbox", "production"]).default("sandbox"),
  is_enabled: z.boolean().default(false),
  is_timeout_enabled: z.boolean().default(true),
  timeout_minutes: z.number().int().min(1).max(1440).default(15),
  display_title: z.string().default("VietQR / Chuyển khoản ngân hàng"),
  order_prefix: z.string().default("DH"),
})

export type TestPayosProviderType = z.infer<typeof TestPayosProvider>
export const TestPayosProvider = z.object({
  code: z.string().optional(),
  client_id: z.string().optional(),
  api_key: z.string().optional(),
  checksum_key: z.string().optional(),
  environment: z.enum(["sandbox", "production"]).default("sandbox"),
})

