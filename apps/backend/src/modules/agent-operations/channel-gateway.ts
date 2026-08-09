import { MedusaError } from "@medusajs/framework/utils"
import { ConversationChannel } from "./types"

export type ChannelDeliveryInput = {
  body: string
  idempotency_key: string
  message_id: string
  recipient_ref: string
  structured_content?: Record<string, unknown>
}

export type ChannelDeliveryReceipt = {
  external_message_id: string
  status: "DELIVERED"
}

export type ChannelAdapter = {
  channel: ConversationChannel
  deliver(input: ChannelDeliveryInput): Promise<ChannelDeliveryReceipt>
}

export class InAppChannelAdapter implements ChannelAdapter {
  channel = "IN_APP" as const

  async deliver(input: ChannelDeliveryInput) {
    return {
      external_message_id: input.message_id,
      status: "DELIVERED" as const,
    }
  }
}

export class DisabledExternalChannelAdapter implements ChannelAdapter {
  constructor(public channel: ConversationChannel) {}

  async deliver(
    _input: ChannelDeliveryInput
  ): Promise<ChannelDeliveryReceipt> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Channel ${this.channel} has no enabled delivery adapter.`
    )
  }
}

export function createChannelAdapter(channel: ConversationChannel) {
  return channel === "IN_APP"
    ? new InAppChannelAdapter()
    : new DisabledExternalChannelAdapter(channel)
}
