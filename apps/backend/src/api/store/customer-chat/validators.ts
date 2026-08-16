import { z } from "@medusajs/framework/zod"

export const StoreCreateCustomerChatMessage = z.strictObject({
  client_message_id: z.string().optional(),
  conversation_id: z.string().optional(),
  customer_email: z.string().email().optional(),
  customer_id: z.string().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  locale: z.enum(["en", "vi"]).optional(),
  message: z.string().trim().min(1).max(2000),
})

export type StoreCreateCustomerChatMessageType = z.infer<
  typeof StoreCreateCustomerChatMessage
>
