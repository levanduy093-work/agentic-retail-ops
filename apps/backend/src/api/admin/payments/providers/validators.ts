import { z } from "@medusajs/framework/zod"

export type ConfigureSepayProviderType = z.infer<typeof ConfigureSepayProvider>
export const ConfigureSepayProvider = z.object({
  code: z.string().optional(),
  api_key: z.string().optional(),
  account_number: z.string().optional(),
  bank_code: z.string().optional(),
  account_holder_name: z.string().optional(),
  environment: z.enum(["sandbox", "production"]).default("production"),
  is_enabled: z.boolean().default(false),
  is_timeout_enabled: z.boolean().default(true),
  timeout_minutes: z.number().int().min(1).max(1440).default(15),
  display_title: z.string().default("VietQR / Chuyển khoản ngân hàng"),
  order_prefix: z.string().default("DH"),
})

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

export type ConfigurePaymentProviderType = z.infer<typeof ConfigurePaymentProvider>
export const ConfigurePaymentProvider = z.object({
  code: z.string().optional(),
  // SePay fields
  account_number: z.string().optional(),
  bank_code: z.string().optional(),
  account_holder_name: z.string().optional(),
  // PayOS fields
  client_id: z.string().optional(),
  checksum_key: z.string().optional(),
  // Shared fields
  api_key: z.string().optional(),
  environment: z.enum(["sandbox", "production"]).default("production"),
  is_enabled: z.boolean().default(false),
  is_timeout_enabled: z.boolean().default(true),
  timeout_minutes: z.number().int().min(1).max(1440).default(15),
  display_title: z.string().default("VietQR / Chuyển khoản ngân hàng"),
  order_prefix: z.string().default("DH"),
})

export type TestPaymentProviderType = z.infer<typeof TestPaymentProvider>
export const TestPaymentProvider = z.object({
  code: z.string().optional(),
  client_id: z.string().optional(),
  api_key: z.string().optional(),
  checksum_key: z.string().optional(),
  account_number: z.string().optional(),
  bank_code: z.string().optional(),
  environment: z.enum(["sandbox", "production"]).default("production"),
})

export type TestPayosProviderType = z.infer<typeof TestPayosProvider>
export const TestPayosProvider = TestPaymentProvider
