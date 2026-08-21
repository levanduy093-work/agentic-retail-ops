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
  signalTyping?(recipientRef: string): Promise<void>
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

type TelegramProductMedia = {
  image_url: string
  product_id: string
  product_url?: string | null
  title: string
}

function isPublicTelegramMediaUrl(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLocaleLowerCase()
    if (url.protocol !== "https:" || url.username || url.password) return false
    return !(
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      /^127\./u.test(hostname) ||
      /^10\./u.test(hostname) ||
      /^192\.168\./u.test(hostname) ||
      /^169\.254\./u.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./u.test(hostname)
    )
  } catch {
    return false
  }
}

function getTelegramProductMedia(
  structuredContent: Record<string, unknown> | undefined
): TelegramProductMedia[] {
  const candidate = structuredContent?.product_media
  if (!Array.isArray(candidate)) return []
  const seenUrls = new Set<string>()
  return candidate.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const media = item as Record<string, unknown>
    if (
      !isPublicTelegramMediaUrl(media.image_url) ||
      typeof media.product_id !== "string" ||
      typeof media.title !== "string" ||
      seenUrls.has(media.image_url)
    ) {
      return []
    }
    seenUrls.add(media.image_url)
    return [
      {
        image_url: media.image_url,
        product_id: media.product_id,
        product_url:
          isPublicTelegramMediaUrl(media.product_url)
            ? media.product_url
            : null,
        title: media.title.slice(0, 200),
      },
    ]
  }).slice(0, 3)
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

  async signalTyping(recipientRef: string): Promise<void> {
    try {
      await this.fetcher(
        `${this.apiBaseUrl}/bot${this.botToken}/sendChatAction`,
        {
          body: JSON.stringify({ action: "typing", chat_id: recipientRef }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(3_000),
        }
      )
    } catch {
      // Typing is advisory. It must never block a customer response.
    }
  }

  private async sendProductMedia(input: ChannelDeliveryInput) {
    const media = getTelegramProductMedia(input.structured_content)
    if (!media.length) return
    const method = media.length === 1 ? "sendPhoto" : "sendMediaGroup"
    const body =
      media.length === 1
        ? {
            caption: media[0].title,
            chat_id: input.recipient_ref,
            photo: media[0].image_url,
          }
        : {
            chat_id: input.recipient_ref,
            media: media.map((item) => ({
              caption: item.title,
              media: item.image_url,
              type: "photo",
            })),
          }
    try {
      const response = await this.fetcher(
        `${this.apiBaseUrl}/bot${this.botToken}/${method}`,
        {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(6_000),
        }
      )
      const payload = (await response.json()) as TelegramSendMessageResponse
      if (!response.ok || !payload.ok) return
    } catch {
      // Product media is an enhancement. Text delivery remains authoritative.
    }
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

    await this.sendProductMedia(input)

    return {
      external_message_id: String(payload.result.message_id),
      status: "DELIVERED",
    }
  }
}

export type ZaloChannelAdapterOptions = {
  access_token: string
  api_base_url?: string
  fetch?: typeof fetch
}

export class ZaloChannelAdapter implements ChannelAdapter {
  channel = "ZALO" as const
  private readonly apiBaseUrl: string
  private readonly accessToken: string
  private readonly fetcher: typeof fetch

  constructor(options: ZaloChannelAdapterOptions) {
    this.apiBaseUrl = (
      options.api_base_url ?? "https://openapi.zalo.me"
    ).replace(/\/$/, "")
    this.accessToken = options.access_token
    this.fetcher = options.fetch ?? fetch
  }

  async deliver(input: ChannelDeliveryInput): Promise<ChannelDeliveryReceipt> {
    const response = await this.fetcher(
      `${this.apiBaseUrl}/v3.0/oa/message/cs`,
      {
        body: JSON.stringify({
          message: { text: input.body },
          recipient: { user_id: input.recipient_ref },
        }),
        headers: {
          access_token: this.accessToken,
          "content-type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      }
    )
    const payload = (await response.json()) as { error?: number; message?: string; data?: { message_id?: string } }

    if (!response.ok || (payload.error && payload.error !== 0)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Zalo delivery failed: ${payload.message ?? `HTTP ${response.status}`}`
      )
    }

    return {
      external_message_id: payload.data?.message_id ?? input.message_id,
      status: "DELIVERED",
    }
  }
}

export type FacebookMessengerChannelAdapterOptions = {
  api_base_url?: string
  fetch?: typeof fetch
  page_access_token: string
}

export class FacebookMessengerChannelAdapter implements ChannelAdapter {
  channel = "MESSENGER" as const
  private readonly apiBaseUrl: string
  private readonly pageAccessToken: string
  private readonly fetcher: typeof fetch

  constructor(options: FacebookMessengerChannelAdapterOptions) {
    this.apiBaseUrl = (
      options.api_base_url ?? "https://graph.facebook.com/v19.0"
    ).replace(/\/$/, "")
    this.pageAccessToken = options.page_access_token
    this.fetcher = options.fetch ?? fetch
  }

  async signalTyping(recipientRef: string): Promise<void> {
    try {
      await this.fetcher(
        `${this.apiBaseUrl}/me/messages?access_token=${encodeURIComponent(this.pageAccessToken)}`,
        {
          body: JSON.stringify({
            recipient: { id: recipientRef },
            sender_action: "typing_on",
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(3_000),
        }
      )
    } catch {
      // Typing is advisory. It must never block a customer response.
    }
  }

  async deliver(input: ChannelDeliveryInput): Promise<ChannelDeliveryReceipt> {
    const response = await this.fetcher(
      `${this.apiBaseUrl}/me/messages?access_token=${encodeURIComponent(this.pageAccessToken)}`,
      {
        body: JSON.stringify({
          message: { text: input.body },
          messaging_type: "RESPONSE",
          recipient: { id: input.recipient_ref },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      }
    )
    const payload = (await response.json()) as { error?: { message?: string }; message_id?: string }

    if (!response.ok || payload.error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Facebook Messenger delivery failed: ${payload.error?.message ?? `HTTP ${response.status}`}`
      )
    }

    return {
      external_message_id: payload.message_id ?? input.message_id,
      status: "DELIVERED",
    }
  }
}

export type EmailChannelAdapterOptions = {
  fetch?: typeof fetch
  from_email: string
  send_email_fn?: (input: { body: string; recipient: string; subject?: string }) => Promise<{ message_id: string }>
}

export class EmailChannelAdapter implements ChannelAdapter {
  channel = "EMAIL" as const
  private readonly fromEmail: string
  private readonly sendEmailFn?: (input: { body: string; recipient: string; subject?: string }) => Promise<{ message_id: string }>

  constructor(options: EmailChannelAdapterOptions) {
    this.fromEmail = options.from_email
    this.sendEmailFn = options.send_email_fn
  }

  async deliver(input: ChannelDeliveryInput): Promise<ChannelDeliveryReceipt> {
    if (this.sendEmailFn) {
      const result = await this.sendEmailFn({
        body: input.body,
        recipient: input.recipient_ref,
        subject: (input.structured_content?.subject as string) ?? "Thông báo từ cửa hàng",
      })
      return {
        external_message_id: result.message_id,
        status: "DELIVERED",
      }
    }

    return {
      external_message_id: input.message_id,
      status: "DELIVERED",
    }
  }
}

export function createChannelAdapter(
  channel: ConversationChannel,
  options?: {
    email?: EmailChannelAdapterOptions
    messenger?: FacebookMessengerChannelAdapterOptions
    telegram?: TelegramChannelAdapterOptions
    zalo?: ZaloChannelAdapterOptions
  }
): ChannelAdapter {
  if (channel === "IN_APP") {
    return new InAppChannelAdapter()
  }
  if (channel === "TELEGRAM" && options?.telegram) {
    return new TelegramChannelAdapter(options.telegram)
  }
  if (channel === "ZALO" && options?.zalo) {
    return new ZaloChannelAdapter(options.zalo)
  }
  if (channel === "MESSENGER" && options?.messenger) {
    return new FacebookMessengerChannelAdapter(options.messenger)
  }
  if (channel === "EMAIL" && options?.email) {
    return new EmailChannelAdapter(options.email)
  }

  return new DisabledExternalChannelAdapter(channel)
}
