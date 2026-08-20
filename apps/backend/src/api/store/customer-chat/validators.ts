import { z } from "@medusajs/framework/zod"

export const StoreCreateCustomerChatMessage = z.strictObject({
  attachment_ids: z.array(z.string().trim().min(1)).max(3).optional(),
  client_message_id: z.string().optional(),
  conversation_id: z.string().optional(),
  locale: z.enum(["en", "vi"]).optional(),
  message: z.string().trim().min(1).max(2000),
})

export type StoreCreateCustomerChatMessageType = z.infer<
  typeof StoreCreateCustomerChatMessage
>
