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

export type TelegramChannelAdapterOptions = {
  api_base_url?: string
  bot_token: string
  fetch?: typeof fetch
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

type TelegramSendMessageResponse = {
  description?: string
  ok: boolean
  result?: { message_id: number }
}

export class TelegramChannelAdapter implements ChannelAdapter {
  channel = "TELEGRAM" as const
  private readonly apiBaseUrl: string
  private readonly botToken: string
  private readonly fetcher: typeof fetch

  constructor(options: TelegramChannelAdapterOptions) {
    this.apiBaseUrl = (
      options.api_base_url ?? "https://api.telegram.org"
    ).replace(/\/$/, "")
    this.botToken = options.bot_token
    this.fetcher = options.fetch ?? fetch
  }

  async deliver(
    input: ChannelDeliveryInput
  ): Promise<ChannelDeliveryReceipt> {
    const response = await this.fetcher(
      `${this.apiBaseUrl}/bot${this.botToken}/sendMessage`,
      {
        body: JSON.stringify({
          chat_id: input.recipient_ref,
          text: input.body,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      }
    )
    const payload = (await response.json()) as TelegramSendMessageResponse

    if (!response.ok || !payload.ok || !payload.result) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Telegram delivery failed: ${payload.description ?? `HTTP ${response.status}`}`
      )
    }

    return {
      external_message_id: String(payload.result.message_id),
      status: "DELIVERED",
    }
  }
}

export function createChannelAdapter(
  channel: ConversationChannel,
  options?: { telegram?: TelegramChannelAdapterOptions }
) {
  if (channel === "IN_APP") {
    return new InAppChannelAdapter()
  }
  if (channel === "TELEGRAM" && options?.telegram) {
    return new TelegramChannelAdapter(options.telegram)
  }

  return new DisabledExternalChannelAdapter(channel)
}
