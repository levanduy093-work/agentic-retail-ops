import {
  Avatar,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  StatusBadge,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { FacebookMessengerIcon, TelegramIcon, TikTokIcon, ZaloIcon, ClipboardCopyIcon } from "../../lib/icons"
import { sdk } from "../../lib/sdk"

type ChannelStatus = {
  account_ref: string
  allow_unmapped_users: boolean
  bot_id: string | null
  bot_username: string | null
  channel: "TELEGRAM" | "ZALO" | "MESSENGER" | "TIKTOK"
  configured: boolean
  identities: Array<{ chat_id?: string; psid?: string; tiktok_user_id?: string; user_id: string; zalo_user_id?: string }>
  oa_avatar?: string | null
  public_base_url: string | null
  secret_hint: string | null
  security: {
    burst_limit?: number
    daily_limit?: number
    max_message_characters?: number
  } | null
  status: "ACTIVE" | "DISABLED"
  updated_at: string | null
  verify_token?: string | null
  webhook_url: string | null
}

type ChannelListResponse = {
  channels: ChannelStatus[]
  count: number
}

type TelegramTestResponse = {
  bot: {
    first_name: string
    id: number
    is_bot: boolean
    username?: string
  }
  ok: boolean
}

type ZaloTestResponse = {
  oa: {
    avatar?: string
    description?: string
    name: string
    oa_id: string
  }
  ok: boolean
}

type FacebookTestResponse = {
  ok: boolean
  page: {
    avatar?: string
    page_id: string
    page_name: string
  }
}

type TikTokTestResponse = {
  account: {
    account_id: string
    account_name: string
    avatar?: string
  }
  ok: boolean
}

type ChatChannelsContentProps = {
  embedded?: boolean
}

export const ChatChannelsContent = ({
  embedded = false,
}: ChatChannelsContentProps) => {
  const { t } = useTranslation()
  const confirm = usePrompt()
  const queryClient = useQueryClient()

  const [selectedTelegram, setSelectedTelegram] = useState<ChannelStatus | null>(null)
  const [selectedZalo, setSelectedZalo] = useState<ChannelStatus | null>(null)
  const [selectedMessenger, setSelectedMessenger] = useState<ChannelStatus | null>(null)
  const [selectedTikTok, setSelectedTikTok] = useState<ChannelStatus | null>(null)

  const [telegramTestResult, setTelegramTestResult] = useState<string | null>(null)
  const [telegramTestLoading, setTelegramTestLoading] = useState(false)

  const [zaloTestResult, setZaloTestResult] = useState<string | null>(null)
  const [zaloTestLoading, setZaloTestLoading] = useState(false)

  const [messengerTestResult, setMessengerTestResult] = useState<string | null>(null)
  const [messengerTestLoading, setMessengerTestLoading] = useState(false)

  const [tiktokTestResult, setTikTokTestResult] = useState<string | null>(null)
  const [tiktokTestLoading, setTikTokTestLoading] = useState(false)

  const [telegramForm, setTelegramForm] = useState({
    allow_unmapped_users: true,
    api_base_url: "https://api.telegram.org",
    bot_token: "",
    burst_limit: 6,
    daily_limit: 100,
    public_base_url: "",
  })

  const [zaloForm, setZaloForm] = useState({
    access_token: "",
    allow_unmapped_users: true,
    api_base_url: "https://openapi.zalo.me",
    app_id: "",
    burst_limit: 6,
    daily_limit: 100,
    oa_secret_key: "",
    public_base_url: "",
    refresh_token: "",
    secret_key: "",
  })

  const [messengerForm, setMessengerForm] = useState({
    allow_unmapped_users: true,
    api_base_url: "https://graph.facebook.com/v19.0",
    app_id: "",
    app_secret: "",
    burst_limit: 6,
    daily_limit: 100,
    page_access_token: "",
    public_base_url: "",
    verify_token: "",
  })

  const [tiktokForm, setTikTokForm] = useState({
    access_token: "",
    allow_unmapped_users: true,
    api_base_url: "https://open.tiktokapis.com",
    burst_limit: 6,
    client_key: "",
    client_secret: "",
    daily_limit: 100,
    public_base_url: "",
    refresh_token: "",
    webhook_secret: "",
  })

  const channelsQuery = useQuery({
    queryFn: () =>
      sdk.client.fetch<ChannelListResponse>(
        "/admin/agent-operations/channels"
      ),
    queryKey: ["agent-channels"],
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["agent-channels"] })

  const telegramChannel = channelsQuery.data?.channels.find(
    (c) => c.channel === "TELEGRAM"
  )
  const zaloChannel = channelsQuery.data?.channels.find(
    (c) => c.channel === "ZALO"
  )
  const messengerChannel = channelsQuery.data?.channels.find(
    (c) => c.channel === "MESSENGER"
  )
  const tiktokChannel = channelsQuery.data?.channels.find(
    (c) => c.channel === "TIKTOK"
  )

  const openTelegramDrawer = (channel?: ChannelStatus) => {
    setTelegramTestResult(null)
    const current = channel ?? telegramChannel
    setSelectedTelegram(current ?? null)
    const defaultUrl =
      current?.public_base_url &&
      !current.public_base_url.includes("invalid") &&
      !current.public_base_url.includes("webhooks/")
        ? current.public_base_url
        : typeof window !== "undefined"
          ? window.location.origin
          : ""

    setTelegramForm({
      allow_unmapped_users: current?.allow_unmapped_users ?? true,
      api_base_url: "https://api.telegram.org",
      bot_token: "",
      burst_limit: current?.security?.burst_limit ?? 6,
      daily_limit: current?.security?.daily_limit ?? 100,
      public_base_url: defaultUrl,
    })
  }

  const openZaloDrawer = (channel?: ChannelStatus) => {
    setZaloTestResult(null)
    const current = channel ?? zaloChannel
    setSelectedZalo(current ?? null)
    const defaultUrl =
      current?.public_base_url &&
      !current.public_base_url.includes("invalid") &&
      !current.public_base_url.includes("webhooks/")
        ? current.public_base_url
        : typeof window !== "undefined"
          ? window.location.origin
          : ""

    setZaloForm({
      access_token: "",
      allow_unmapped_users: current?.allow_unmapped_users ?? true,
      api_base_url: "https://openapi.zalo.me",
      app_id: "",
      burst_limit: current?.security?.burst_limit ?? 6,
      daily_limit: current?.security?.daily_limit ?? 100,
      oa_secret_key: "",
      public_base_url: defaultUrl,
      refresh_token: "",
      secret_key: "",
    })
  }

  const openMessengerDrawer = (channel?: ChannelStatus) => {
    setMessengerTestResult(null)
    const current = channel ?? messengerChannel
    setSelectedMessenger(current ?? null)
    const defaultUrl =
      current?.public_base_url &&
      !current.public_base_url.includes("invalid") &&
      !current.public_base_url.includes("webhooks/")
        ? current.public_base_url
        : typeof window !== "undefined"
          ? window.location.origin
          : ""

    setMessengerForm({
      allow_unmapped_users: current?.allow_unmapped_users ?? true,
      api_base_url: "https://graph.facebook.com/v19.0",
      app_id: "",
      app_secret: "",
      burst_limit: current?.security?.burst_limit ?? 6,
      daily_limit: current?.security?.daily_limit ?? 100,
      page_access_token: "",
      public_base_url: defaultUrl,
      verify_token: current?.verify_token ?? "",
    })
  }

  const openTikTokDrawer = (channel?: ChannelStatus) => {
    setTikTokTestResult(null)
    const current = channel ?? tiktokChannel
    setSelectedTikTok(current ?? null)
    const defaultUrl =
      current?.public_base_url &&
      !current.public_base_url.includes("invalid") &&
      !current.public_base_url.includes("webhooks/")
        ? current.public_base_url
        : typeof window !== "undefined"
          ? window.location.origin
          : ""

    setTikTokForm({
      access_token: "",
      allow_unmapped_users: current?.allow_unmapped_users ?? true,
      api_base_url: "https://open.tiktokapis.com",
      burst_limit: current?.security?.burst_limit ?? 6,
      client_key: "",
      client_secret: "",
      daily_limit: current?.security?.daily_limit ?? 100,
      public_base_url: defaultUrl,
      refresh_token: "",
      webhook_secret: "",
    })
  }

  const testTelegramBotMutation = useMutation({
    mutationFn: async () => {
      const token = telegramForm.bot_token.trim()
      if (!token && !telegramChannel?.configured) {
        throw new Error(t("knowledgeHub.chatChannels.telegram.fields.botTokenPlaceholder"))
      }
      setTelegramTestLoading(true)
      setTelegramTestResult(null)
      try {
        const res = await sdk.client.fetch<TelegramTestResponse>(
          "/admin/agent-operations/channels/telegram/test",
          {
            body: {
              account_ref: "primary",
              api_base_url: telegramForm.api_base_url,
              ...(token ? { bot_token: token } : {}),
              tenant_id: "default",
            },
            method: "POST",
          }
        )
        const msg = t("knowledgeHub.chatChannels.testSuccess", {
          id: res.bot.id,
          name: res.bot.first_name,
          username: res.bot.username ?? "N/A",
        })
        setTelegramTestResult(msg)
        toast.success(msg)
      } catch (err: any) {
        const errMsg = err?.message || t("knowledgeHub.chatChannels.testError")
        setTelegramTestResult(errMsg)
        toast.error(errMsg)
      } finally {
        setTelegramTestLoading(false)
      }
    },
  })

  const saveTelegramMutation = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch("/admin/agent-operations/channels/telegram", {
        body: {
          account_ref: "primary",
          allow_unmapped_users: telegramForm.allow_unmapped_users,
          api_base_url: telegramForm.api_base_url,
          ...(telegramForm.bot_token.trim() ? { bot_token: telegramForm.bot_token.trim() } : {}),
          public_base_url: telegramForm.public_base_url.trim(),
          security: {
            burst_limit: Number(telegramForm.burst_limit),
            daily_limit: Number(telegramForm.daily_limit),
          },
          tenant_id: "default",
        },
        method: "POST",
      })
    },
    onError: (err: any) => {
      toast.error(err?.message || t("knowledgeHub.chatChannels.saveError"))
    },
    onSuccess: async () => {
      setSelectedTelegram(null)
      setTelegramForm((cur) => ({ ...cur, bot_token: "" }))
      await refresh()
      toast.success(t("knowledgeHub.chatChannels.saveSuccess"))
    },
  })

  const disconnectTelegramMutation = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch(
        "/admin/agent-operations/channels/telegram/disconnect",
        {
          body: {
            account_ref: "primary",
            tenant_id: "default",
          },
          method: "POST",
        }
      )
    },
    onError: () => toast.error(t("knowledgeHub.chatChannels.disconnectError")),
    onSuccess: async () => {
      await refresh()
      toast.success(t("knowledgeHub.chatChannels.disconnectSuccess"))
    },
  })

  const handleDisconnectTelegram = async () => {
    const ok = await confirm({
      cancelText: t("knowledgeHub.cancel"),
      confirmText: t("knowledgeHub.chatChannels.telegram.disconnectAction"),
      description: t("knowledgeHub.chatChannels.disconnectConfirm"),
      title: t("knowledgeHub.chatChannels.telegram.disconnectAction"),
      variant: "danger",
    })
    if (ok) {
      disconnectTelegramMutation.mutate()
    }
  }

  const testZaloMutation = useMutation({
    mutationFn: async () => {
      const token = zaloForm.access_token.trim()
      if (!token && !zaloChannel?.configured) {
        throw new Error(t("knowledgeHub.chatChannels.zalo.fields.accessTokenPlaceholder"))
      }
      setZaloTestLoading(true)
      setZaloTestResult(null)
      try {
        const res = await sdk.client.fetch<ZaloTestResponse>(
          "/admin/agent-operations/channels/zalo/test",
          {
            body: {
              ...(token ? { access_token: token } : {}),
              account_ref: "primary",
              api_base_url: zaloForm.api_base_url,
              tenant_id: "default",
            },
            method: "POST",
          }
        )
        const msg = t("knowledgeHub.chatChannels.zalo.testSuccess", {
          id: res.oa.oa_id,
          name: res.oa.name,
        })
        setZaloTestResult(msg)
        toast.success(msg)
      } catch (err: any) {
        const errMsg = err?.message || t("knowledgeHub.chatChannels.zalo.testError")
        setZaloTestResult(errMsg)
        toast.error(errMsg)
      } finally {
        setZaloTestLoading(false)
      }
    },
  })

  const saveZaloMutation = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch("/admin/agent-operations/channels/zalo", {
        body: {
          ...(zaloForm.access_token.trim() ? { access_token: zaloForm.access_token.trim() } : {}),
          account_ref: "primary",
          allow_unmapped_users: zaloForm.allow_unmapped_users,
          api_base_url: zaloForm.api_base_url,
          app_id: zaloForm.app_id.trim(),
          ...(zaloForm.oa_secret_key.trim() ? { oa_secret_key: zaloForm.oa_secret_key.trim() } : {}),
          public_base_url: zaloForm.public_base_url.trim(),
          ...(zaloForm.refresh_token.trim() ? { refresh_token: zaloForm.refresh_token.trim() } : {}),
          secret_key: zaloForm.secret_key.trim(),
          security: {
            burst_limit: Number(zaloForm.burst_limit),
            daily_limit: Number(zaloForm.daily_limit),
          },
          tenant_id: "default",
        },
        method: "POST",
      })
    },
    onError: (err: any) => {
      toast.error(err?.message || t("knowledgeHub.chatChannels.saveError"))
    },
    onSuccess: async () => {
      setSelectedZalo(null)
      setZaloForm((cur) => ({ ...cur, access_token: "", refresh_token: "" }))
      await refresh()
      toast.success(t("knowledgeHub.chatChannels.saveSuccess"))
    },
  })

  const disconnectZaloMutation = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch(
        "/admin/agent-operations/channels/zalo/disconnect",
        {
          body: {
            account_ref: "primary",
            tenant_id: "default",
          },
          method: "POST",
        }
      )
    },
    onError: () => toast.error(t("knowledgeHub.chatChannels.disconnectError")),
    onSuccess: async () => {
      await refresh()
      toast.success(t("knowledgeHub.chatChannels.disconnectSuccess"))
    },
  })

  const handleDisconnectZalo = async () => {
    const ok = await confirm({
      cancelText: t("knowledgeHub.cancel"),
      confirmText: t("knowledgeHub.chatChannels.zalo.disconnectAction"),
      description: t("knowledgeHub.chatChannels.disconnectConfirm"),
      title: t("knowledgeHub.chatChannels.zalo.disconnectAction"),
      variant: "danger",
    })
    if (ok) {
      disconnectZaloMutation.mutate()
    }
  }

  const handleTelegramSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveTelegramMutation.mutate()
  }

  const handleZaloSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveZaloMutation.mutate()
  }

  const testMessengerMutation = useMutation({
    mutationFn: async () => {
      const token = messengerForm.page_access_token.trim()
      if (!token && !messengerChannel?.configured) {
        throw new Error(t("knowledgeHub.chatChannels.messenger.fields.pageAccessTokenPlaceholder"))
      }
      setMessengerTestLoading(true)
      setMessengerTestResult(null)
      try {
        const res = await sdk.client.fetch<FacebookTestResponse>(
          "/admin/agent-operations/channels/messenger/test",
          {
            body: {
              ...(token ? { page_access_token: token } : {}),
              account_ref: "primary",
              api_base_url: messengerForm.api_base_url,
              tenant_id: "default",
            },
            method: "POST",
          }
        )
        const msg = t("knowledgeHub.chatChannels.messenger.testSuccess", {
          id: res.page.page_id,
          name: res.page.page_name,
        })
        setMessengerTestResult(msg)
        toast.success(msg)
      } catch (err: any) {
        const errMsg = err?.message || t("knowledgeHub.chatChannels.messenger.testError")
        setMessengerTestResult(errMsg)
        toast.error(errMsg)
      } finally {
        setMessengerTestLoading(false)
      }
    },
  })

  const saveMessengerMutation = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch("/admin/agent-operations/channels/messenger", {
        body: {
          account_ref: "primary",
          allow_unmapped_users: messengerForm.allow_unmapped_users,
          api_base_url: messengerForm.api_base_url,
          app_id: messengerForm.app_id.trim() || undefined,
          ...(messengerForm.app_secret.trim() ? { app_secret: messengerForm.app_secret.trim() } : {}),
          ...(messengerForm.page_access_token.trim() ? { page_access_token: messengerForm.page_access_token.trim() } : {}),
          public_base_url: messengerForm.public_base_url.trim(),
          security: {
            burst_limit: Number(messengerForm.burst_limit),
            daily_limit: Number(messengerForm.daily_limit),
          },
          tenant_id: "default",
          ...(messengerForm.verify_token.trim() ? { verify_token: messengerForm.verify_token.trim() } : {}),
        },
        method: "POST",
      })
    },
    onError: (err: any) => {
      toast.error(err?.message || t("knowledgeHub.chatChannels.saveError"))
    },
    onSuccess: async () => {
      setSelectedMessenger(null)
      setMessengerForm((cur) => ({ ...cur, page_access_token: "" }))
      await refresh()
      toast.success(t("knowledgeHub.chatChannels.saveSuccess"))
    },
  })

  const disconnectMessengerMutation = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch(
        "/admin/agent-operations/channels/messenger/disconnect",
        {
          body: {
            account_ref: "primary",
            tenant_id: "default",
          },
          method: "POST",
        }
      )
    },
    onError: () => toast.error(t("knowledgeHub.chatChannels.disconnectError")),
    onSuccess: async () => {
      await refresh()
      toast.success(t("knowledgeHub.chatChannels.disconnectSuccess"))
    },
  })

  const handleDisconnectMessenger = async () => {
    const ok = await confirm({
      cancelText: t("knowledgeHub.cancel"),
      confirmText: t("knowledgeHub.chatChannels.messenger.disconnectAction"),
      description: t("knowledgeHub.chatChannels.disconnectConfirm"),
      title: t("knowledgeHub.chatChannels.messenger.disconnectAction"),
      variant: "danger",
    })
    if (ok) {
      disconnectMessengerMutation.mutate()
    }
  }

  const handleMessengerSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveMessengerMutation.mutate()
  }

  const testTikTokMutation = useMutation({
    mutationFn: async () => {
      const token = tiktokForm.access_token.trim()
      if (!token && !tiktokChannel?.configured) {
        throw new Error(t("knowledgeHub.chatChannels.tiktok.fields.accessTokenPlaceholder"))
      }
      setTikTokTestLoading(true)
      setTikTokTestResult(null)
      try {
        const res = await sdk.client.fetch<TikTokTestResponse>(
          "/admin/agent-operations/channels/tiktok/test",
          {
            body: {
              ...(token ? { access_token: token } : {}),
              account_ref: "primary",
              api_base_url: tiktokForm.api_base_url,
              tenant_id: "default",
            },
            method: "POST",
          }
        )
        const msg = t("knowledgeHub.chatChannels.tiktok.testSuccess", {
          id: res.account.account_id,
          name: res.account.account_name,
        })
        setTikTokTestResult(msg)
        toast.success(msg)
      } catch (err: any) {
        const errMsg = err?.message || t("knowledgeHub.chatChannels.tiktok.testError")
        setTikTokTestResult(errMsg)
        toast.error(errMsg)
      } finally {
        setTikTokTestLoading(false)
      }
    },
  })

  const saveTikTokMutation = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch("/admin/agent-operations/channels/tiktok", {
        body: {
          ...(tiktokForm.access_token.trim() ? { access_token: tiktokForm.access_token.trim() } : {}),
          account_ref: "primary",
          allow_unmapped_users: tiktokForm.allow_unmapped_users,
          api_base_url: tiktokForm.api_base_url,
          client_key: tiktokForm.client_key.trim() || undefined,
          ...(tiktokForm.client_secret.trim() ? { client_secret: tiktokForm.client_secret.trim() } : {}),
          public_base_url: tiktokForm.public_base_url.trim(),
          ...(tiktokForm.refresh_token.trim() ? { refresh_token: tiktokForm.refresh_token.trim() } : {}),
          security: {
            burst_limit: Number(tiktokForm.burst_limit),
            daily_limit: Number(tiktokForm.daily_limit),
          },
          tenant_id: "default",
          ...(tiktokForm.webhook_secret.trim() ? { webhook_secret: tiktokForm.webhook_secret.trim() } : {}),
        },
        method: "POST",
      })
    },
    onError: (err: any) => {
      toast.error(err?.message || t("knowledgeHub.chatChannels.saveError"))
    },
    onSuccess: async () => {
      setSelectedTikTok(null)
      setTikTokForm((cur) => ({ ...cur, access_token: "" }))
      await refresh()
      toast.success(t("knowledgeHub.chatChannels.saveSuccess"))
    },
  })

  const disconnectTikTokMutation = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch(
        "/admin/agent-operations/channels/tiktok/disconnect",
        {
          body: {
            account_ref: "primary",
            tenant_id: "default",
          },
          method: "POST",
        }
      )
    },
    onError: () => toast.error(t("knowledgeHub.chatChannels.disconnectError")),
    onSuccess: async () => {
      await refresh()
      toast.success(t("knowledgeHub.chatChannels.disconnectSuccess"))
    },
  })

  const handleDisconnectTikTok = async () => {
    const ok = await confirm({
      cancelText: t("knowledgeHub.cancel"),
      confirmText: t("knowledgeHub.chatChannels.tiktok.disconnectAction"),
      description: t("knowledgeHub.chatChannels.disconnectConfirm"),
      title: t("knowledgeHub.chatChannels.tiktok.disconnectAction"),
      variant: "danger",
    })
    if (ok) {
      disconnectTikTokMutation.mutate()
    }
  }

  const handleTikTokSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveTikTokMutation.mutate()
  }

  return (
    <div className="flex flex-col gap-y-4">
      {!embedded && (
        <Container className="p-6">
          <Heading level="h1">{t("knowledgeHub.chatChannels.title")}</Heading>
          <Text className="mt-1 text-ui-fg-subtle" size="small">
            {t("knowledgeHub.chatChannels.subtitle")}
          </Text>
        </Container>
      )}

      {/* Main Channel List */}
      <Container className="p-0">
        <div className="border-b px-6 py-4">
          <Text leading="compact" size="small" weight="plus">
            {t("knowledgeHub.chatChannels.title")}
          </Text>
          <Text className="text-ui-fg-subtle" leading="compact" size="small">
            {t("knowledgeHub.chatChannels.subtitle")}
          </Text>
        </div>

        {channelsQuery.isLoading ? (
          <Text className="px-6 py-8 text-ui-fg-subtle" size="small">
            {t("knowledgeHub.chatChannels.loading")}
          </Text>
        ) : (
          <div className="divide-y">
            {/* Telegram Channel Item */}
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#229ED9] shadow-sm border border-sky-100">
                  <TelegramIcon size={24} color="#229ED9" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Text weight="plus">
                      {t("knowledgeHub.chatChannels.telegram.name")}
                    </Text>
                    <StatusBadge
                      className="shrink-0 whitespace-nowrap"
                      color={
                        telegramChannel?.status === "ACTIVE"
                          ? "green"
                          : telegramChannel?.configured
                            ? "orange"
                            : "grey"
                      }
                    >
                      {telegramChannel?.status === "ACTIVE"
                        ? t("knowledgeHub.chatChannels.status.active")
                        : t("knowledgeHub.chatChannels.status.disabled")}
                    </StatusBadge>
                  </div>
                  <Text className="mt-1 text-ui-fg-subtle" size="small">
                    {t("knowledgeHub.chatChannels.telegram.description")}
                  </Text>

                  {telegramChannel?.configured && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ui-fg-muted">
                      {telegramChannel.bot_username && (
                        <span>
                          Bot:{" "}
                          <strong className="text-ui-fg-base">
                            @{telegramChannel.bot_username}
                          </strong>
                        </span>
                      )}
                      {telegramChannel.secret_hint && (
                        <span>
                          Token:{" "}
                          <span className="font-mono text-ui-fg-subtle">
                            {telegramChannel.secret_hint}
                          </span>
                          <span className="ml-1 rounded bg-ui-bg-subtle px-1 py-0.5 text-[10px] text-ui-fg-muted border">
                            AES-256
                          </span>
                        </span>
                      )}
                      {telegramChannel.webhook_url && (
                        <span className="truncate max-w-xs">
                          Webhook:{" "}
                          <span className="font-mono text-ui-fg-subtle">
                            {telegramChannel.webhook_url}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {telegramChannel?.status === "ACTIVE" && (
                  <Button
                    disabled={disconnectTelegramMutation.isPending}
                    onClick={handleDisconnectTelegram}
                    size="small"
                    variant="danger"
                  >
                    {t("knowledgeHub.chatChannels.telegram.disconnectAction")}
                  </Button>
                )}
                <Button
                  onClick={() => openTelegramDrawer(telegramChannel)}
                  size="small"
                  variant="secondary"
                >
                  {t("knowledgeHub.chatChannels.telegram.configureAction")}
                </Button>
              </div>
            </div>

            {/* Zalo OA Channel Item */}
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                {zaloChannel?.oa_avatar ? (
                  <Avatar
                    className="h-12 w-12 shrink-0 rounded-xl border shadow-sm"
                    fallback="Zalo"
                    src={zaloChannel.oa_avatar}
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0068FF] shadow-sm border border-blue-100">
                    <ZaloIcon size={24} color="#0068FF" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Text weight="plus">
                      {t("knowledgeHub.chatChannels.zalo.name")}
                    </Text>
                    <StatusBadge
                      className="shrink-0 whitespace-nowrap"
                      color={
                        zaloChannel?.status === "ACTIVE"
                          ? "green"
                          : zaloChannel?.configured
                            ? "orange"
                            : "grey"
                      }
                    >
                      {zaloChannel?.status === "ACTIVE"
                        ? t("knowledgeHub.chatChannels.status.active")
                        : t("knowledgeHub.chatChannels.status.disabled")}
                    </StatusBadge>
                  </div>
                  <Text className="mt-1 text-ui-fg-subtle" size="small">
                    {t("knowledgeHub.chatChannels.zalo.description")}
                  </Text>

                  {zaloChannel?.configured && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ui-fg-muted">
                      {zaloChannel.bot_username && (
                        <span>
                          OA:{" "}
                          <strong className="text-ui-fg-base">
                            @{zaloChannel.bot_username}
                          </strong>
                        </span>
                      )}
                      {zaloChannel.secret_hint && (
                        <span>
                          Info:{" "}
                          <span className="font-mono text-ui-fg-subtle">
                            {zaloChannel.secret_hint}
                          </span>
                          <span className="ml-1 rounded bg-ui-bg-subtle px-1 py-0.5 text-[10px] text-ui-fg-muted border">
                            AES-256
                          </span>
                        </span>
                      )}
                      {zaloChannel.webhook_url && (
                        <span className="truncate max-w-xs">
                          Webhook:{" "}
                          <span className="font-mono text-ui-fg-subtle">
                            {zaloChannel.webhook_url}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {zaloChannel?.status === "ACTIVE" && (
                  <Button
                    disabled={disconnectZaloMutation.isPending}
                    onClick={handleDisconnectZalo}
                    size="small"
                    variant="danger"
                  >
                    {t("knowledgeHub.chatChannels.zalo.disconnectAction")}
                  </Button>
                )}
                <Button
                  onClick={() => openZaloDrawer(zaloChannel)}
                  size="small"
                  variant="secondary"
                >
                  {t("knowledgeHub.chatChannels.zalo.configureAction")}
                </Button>
              </div>
            </div>

            {/* Facebook Messenger Channel Item */}
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                {messengerChannel?.oa_avatar ? (
                  <Avatar
                    className="h-12 w-12 shrink-0 rounded-xl border shadow-sm"
                    fallback="Messenger"
                    src={messengerChannel.oa_avatar}
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0084FF] shadow-sm border border-blue-100">
                    <FacebookMessengerIcon size={24} color="#0084FF" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Text weight="plus">
                      {t("knowledgeHub.chatChannels.messenger.name")}
                    </Text>
                    <StatusBadge
                      className="shrink-0 whitespace-nowrap"
                      color={
                        messengerChannel?.status === "ACTIVE"
                          ? "green"
                          : messengerChannel?.configured
                            ? "orange"
                            : "grey"
                      }
                    >
                      {messengerChannel?.status === "ACTIVE"
                        ? t("knowledgeHub.chatChannels.status.active")
                        : t("knowledgeHub.chatChannels.status.disabled")}
                    </StatusBadge>
                  </div>
                  <Text className="mt-1 text-ui-fg-subtle" size="small">
                    {t("knowledgeHub.chatChannels.messenger.description")}
                  </Text>

                  {messengerChannel?.configured && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ui-fg-muted">
                      {messengerChannel.bot_username && (
                        <span>
                          Fanpage:{" "}
                          <strong className="text-ui-fg-base">
                            {messengerChannel.bot_username}
                          </strong>
                        </span>
                      )}
                      {messengerChannel.secret_hint && (
                        <span>
                          Info:{" "}
                          <span className="font-mono text-ui-fg-subtle">
                            {messengerChannel.secret_hint}
                          </span>
                          <span className="ml-1 rounded bg-ui-bg-subtle px-1 py-0.5 text-[10px] text-ui-fg-muted border">
                            AES-256
                          </span>
                        </span>
                      )}
                      {messengerChannel.webhook_url && (
                        <span className="truncate max-w-xs">
                          Webhook:{" "}
                          <span className="font-mono text-ui-fg-subtle">
                            {messengerChannel.webhook_url}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {messengerChannel?.status === "ACTIVE" && (
                  <Button
                    disabled={disconnectMessengerMutation.isPending}
                    onClick={handleDisconnectMessenger}
                    size="small"
                    variant="danger"
                  >
                    {t("knowledgeHub.chatChannels.messenger.disconnectAction")}
                  </Button>
                )}
                <Button
                  onClick={() => openMessengerDrawer(messengerChannel)}
                  size="small"
                  variant="secondary"
                >
                  {t("knowledgeHub.chatChannels.messenger.configureAction")}
                </Button>
              </div>
            </div>

            {/* TikTok Channel Item */}
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                {tiktokChannel?.oa_avatar ? (
                  <Avatar
                    className="h-12 w-12 shrink-0 rounded-xl border shadow-sm"
                    fallback="TikTok"
                    src={tiktokChannel.oa_avatar}
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-sm border border-neutral-800">
                    <TikTokIcon size={24} color="#ffffff" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Text weight="plus">
                      {t("knowledgeHub.chatChannels.tiktok.name")}
                    </Text>
                    <StatusBadge
                      className="shrink-0 whitespace-nowrap"
                      color={
                        tiktokChannel?.status === "ACTIVE"
                          ? "green"
                          : tiktokChannel?.configured
                            ? "orange"
                            : "grey"
                      }
                    >
                      {tiktokChannel?.status === "ACTIVE"
                        ? t("knowledgeHub.chatChannels.status.active")
                        : t("knowledgeHub.chatChannels.status.disabled")}
                    </StatusBadge>
                  </div>
                  <Text className="mt-1 text-ui-fg-subtle" size="small">
                    {t("knowledgeHub.chatChannels.tiktok.description")}
                  </Text>

                  {tiktokChannel?.configured && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ui-fg-muted">
                      {tiktokChannel.bot_username && (
                        <span>
                          Account:{" "}
                          <strong className="text-ui-fg-base">
                            {tiktokChannel.bot_username}
                          </strong>
                        </span>
                      )}
                      {tiktokChannel.secret_hint && (
                        <span>
                          Info:{" "}
                          <span className="font-mono text-ui-fg-subtle">
                            {tiktokChannel.secret_hint}
                          </span>
                          <span className="ml-1 rounded bg-ui-bg-subtle px-1 py-0.5 text-[10px] text-ui-fg-muted border">
                            AES-256
                          </span>
                        </span>
                      )}
                      {tiktokChannel.webhook_url && (
                        <span className="truncate max-w-xs">
                          Webhook:{" "}
                          <span className="font-mono text-ui-fg-subtle">
                            {tiktokChannel.webhook_url}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {tiktokChannel?.status === "ACTIVE" && (
                  <Button
                    disabled={disconnectTikTokMutation.isPending}
                    onClick={handleDisconnectTikTok}
                    size="small"
                    variant="danger"
                  >
                    {t("knowledgeHub.chatChannels.tiktok.disconnectAction")}
                  </Button>
                )}
                <Button
                  onClick={() => openTikTokDrawer(tiktokChannel)}
                  size="small"
                  variant="secondary"
                >
                  {t("knowledgeHub.chatChannels.tiktok.configureAction")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Container>

      {/* Drawer: Configure Telegram */}
      <Drawer
        onOpenChange={(open) => {
          if (!open) setSelectedTelegram(null)
        }}
        open={Boolean(selectedTelegram)}
      >
        <Drawer.Content className="overflow-y-auto">
          <Drawer.Header>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#229ED9]/10 text-[#229ED9]">
                <TelegramIcon size={18} />
              </div>
              <Drawer.Title>
                {t("knowledgeHub.chatChannels.telegram.drawerTitle")}
              </Drawer.Title>
            </div>
            <Drawer.Description>
              {t("knowledgeHub.chatChannels.telegram.drawerHint")}
            </Drawer.Description>
          </Drawer.Header>

          <form onSubmit={handleTelegramSubmit}>
            <Drawer.Body className="space-y-4">
              {selectedTelegram?.configured && selectedTelegram?.secret_hint && (
                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 flex items-start gap-3">
                  <div className="rounded-md bg-ui-bg-base p-1.5 border shadow-2xs text-[#229ED9] shrink-0 mt-0.5">
                    <TelegramIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <Text size="small" weight="plus" className="text-ui-fg-base truncate">
                        {selectedTelegram.secret_hint}
                      </Text>
                      <StatusBadge className="shrink-0 whitespace-nowrap" color="green">
                        {t("knowledgeHub.chatChannels.status.active")}
                      </StatusBadge>
                    </div>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t("knowledgeHub.chatChannels.telegram.fields.botTokenStoredHint", {
                        hint: selectedTelegram.secret_hint,
                      })}
                    </Text>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between min-h-[22px]">
                  <Label htmlFor="telegram-bot-token" size="small" weight="plus">
                    {t("knowledgeHub.chatChannels.telegram.fields.botToken")}
                  </Label>
                  {selectedTelegram?.configured ? (
                    <span className="rounded bg-ui-bg-subtle px-1.5 py-0.5 text-[10px] font-mono text-ui-fg-muted border">
                      AES-256
                    </span>
                  ) : (
                    <span className="text-[11px] text-ui-fg-error">* {t("knowledgeHub.required", "Bắt buộc")}</span>
                  )}
                </div>
                <Input
                  autoComplete="off"
                  id="telegram-bot-token"
                  onChange={(e) =>
                    setTelegramForm((cur) => ({ ...cur, bot_token: e.target.value }))
                  }
                  placeholder={
                    selectedTelegram?.configured
                      ? t(
                          "knowledgeHub.chatChannels.telegram.fields.botTokenPlaceholderConfigured"
                        )
                      : t(
                          "knowledgeHub.chatChannels.telegram.fields.botTokenPlaceholder"
                        )
                  }
                  type="password"
                  value={telegramForm.bot_token}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button
                    disabled={
                      telegramTestLoading ||
                      (!telegramForm.bot_token.trim() && !selectedTelegram?.configured)
                    }
                    isLoading={telegramTestLoading}
                    onClick={() => testTelegramBotMutation.mutate()}
                    size="small"
                    type="button"
                    variant="secondary"
                  >
                    {t("knowledgeHub.chatChannels.telegram.testAction")}
                  </Button>
                  {telegramTestResult && (
                    <Text
                      className={
                        telegramTestResult.includes("thành công") || telegramTestResult.includes("Successfully")
                          ? "text-ui-fg-interactive text-xs font-medium"
                          : "text-ui-fg-error text-xs font-medium"
                      }
                      size="small"
                    >
                      {telegramTestResult}
                    </Text>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="telegram-public-url" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.telegram.fields.publicBaseUrl")}
                    </Label>
                    <span className="text-[11px] text-ui-fg-interactive font-medium">HTTPS</span>
                  </div>
                  <Input
                    id="telegram-public-url"
                    onChange={(e) =>
                      setTelegramForm((cur) => ({
                        ...cur,
                        public_base_url: e.target.value,
                      }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.telegram.fields.publicBaseUrlPlaceholder"
                    )}
                    required
                    type="url"
                    value={telegramForm.public_base_url}
                  />
                  <Text className="text-ui-fg-subtle" size="xsmall">
                    {t(
                      "knowledgeHub.chatChannels.telegram.fields.publicBaseUrlHint"
                    )}
                  </Text>
                </div>

                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Text className="text-ui-fg-base" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.telegram.webhookUrl")}
                    </Text>
                    <Button
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        const base = telegramForm.public_base_url.trim().replace(/\/$/, "") || "https://trendhub.sbs"
                        const url = `${base}/api/store/telegram/webhook`
                        navigator.clipboard.writeText(url)
                        toast.success(t("knowledgeHub.chatChannels.telegram.webhookCopied"))
                      }}
                      size="small"
                      type="button"
                      variant="secondary"
                    >
                      <ClipboardCopyIcon className="mr-1" size={12} />
                      {t("knowledgeHub.chatChannels.telegram.copyWebhookUrl")}
                    </Button>
                  </div>
                  <div className="rounded bg-ui-bg-base px-2.5 py-1.5 border font-mono text-xs text-ui-fg-subtle break-all select-all">
                    {`${(telegramForm.public_base_url.trim().replace(/\/$/, "") || "https://trendhub.sbs")}/api/store/telegram/webhook`}
                  </div>
                  <Text className="text-ui-fg-muted" size="xsmall">
                    {t("knowledgeHub.chatChannels.telegram.webhookUrlHint")}
                  </Text>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Text size="small" weight="plus">
                  {t(
                    "knowledgeHub.chatChannels.telegram.fields.rateLimitTitle"
                  )}
                </Text>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="min-h-[22px] flex items-center">
                      <Label htmlFor="telegram-burst-limit" size="small">
                        {t(
                          "knowledgeHub.chatChannels.telegram.fields.burstLimit"
                        )}
                      </Label>
                    </div>
                    <Input
                      id="telegram-burst-limit"
                      min={1}
                      onChange={(e) =>
                        setTelegramForm((cur) => ({
                          ...cur,
                          burst_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={telegramForm.burst_limit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="min-h-[22px] flex items-center">
                      <Label htmlFor="telegram-daily-limit" size="small">
                        {t(
                          "knowledgeHub.chatChannels.telegram.fields.dailyLimit"
                        )}
                      </Label>
                    </div>
                    <Input
                      id="telegram-daily-limit"
                      min={1}
                      onChange={(e) =>
                        setTelegramForm((cur) => ({
                          ...cur,
                          daily_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={telegramForm.daily_limit}
                    />
                  </div>
                </div>
              </div>
            </Drawer.Body>

            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button size="small" type="button" variant="secondary">
                  {t("knowledgeHub.cancel")}
                </Button>
              </Drawer.Close>
              <Button
                disabled={
                  saveTelegramMutation.isPending ||
                  (!telegramForm.bot_token.trim() && !selectedTelegram?.configured) ||
                  !telegramForm.public_base_url.trim()
                }
                isLoading={saveTelegramMutation.isPending}
                size="small"
                type="submit"
              >
                {t("knowledgeHub.saveDraft")}
              </Button>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>

      {/* Drawer: Configure Zalo OA */}
      <Drawer
        onOpenChange={(open) => {
          if (!open) setSelectedZalo(null)
        }}
        open={Boolean(selectedZalo)}
      >
        <Drawer.Content className="overflow-y-auto">
          <Drawer.Header>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0068FF]/10 text-[#0068FF]">
                <ZaloIcon size={18} />
              </div>
              <Drawer.Title>
                {t("knowledgeHub.chatChannels.zalo.drawerTitle")}
              </Drawer.Title>
            </div>
            <Drawer.Description>
              {t("knowledgeHub.chatChannels.zalo.drawerHint")}
            </Drawer.Description>
          </Drawer.Header>

          <form onSubmit={handleZaloSubmit}>
            <Drawer.Body className="space-y-4">
              {selectedZalo?.configured && selectedZalo?.secret_hint && (
                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 flex items-start gap-3">
                  <div className="rounded-md bg-ui-bg-base p-1.5 border shadow-2xs text-[#0068FF] shrink-0 mt-0.5">
                    <ZaloIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <Text size="small" weight="plus" className="text-ui-fg-base truncate">
                        {selectedZalo.secret_hint}
                      </Text>
                      <StatusBadge className="shrink-0 whitespace-nowrap" color="green">
                        {t("knowledgeHub.chatChannels.status.active")}
                      </StatusBadge>
                    </div>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t("knowledgeHub.chatChannels.zalo.fields.accessTokenStoredHint", {
                        hint: selectedZalo.secret_hint,
                      })}
                    </Text>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="zalo-app-id" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.zalo.fields.appId")}
                    </Label>
                  </div>
                  <Input
                    id="zalo-app-id"
                    onChange={(e) =>
                      setZaloForm((cur) => ({ ...cur, app_id: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.zalo.fields.appIdPlaceholder"
                    )}
                    required
                    value={zaloForm.app_id}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="zalo-secret-key" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.zalo.fields.secretKey")}
                    </Label>
                  </div>
                  <Input
                    autoComplete="off"
                    id="zalo-secret-key"
                    onChange={(e) =>
                      setZaloForm((cur) => ({ ...cur, secret_key: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.zalo.fields.secretKeyPlaceholder"
                    )}
                    required
                    type="password"
                    value={zaloForm.secret_key}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between min-h-[22px]">
                  <Label htmlFor="zalo-access-token" size="small" weight="plus">
                    {t("knowledgeHub.chatChannels.zalo.fields.accessToken")}
                  </Label>
                  {selectedZalo?.configured ? (
                    <span className="rounded bg-ui-bg-subtle px-1.5 py-0.5 text-[10px] font-mono text-ui-fg-muted border">
                      AES-256
                    </span>
                  ) : (
                    <span className="text-[11px] text-ui-fg-error">* {t("knowledgeHub.required", "Bắt buộc")}</span>
                  )}
                </div>
                <Input
                  autoComplete="off"
                  id="zalo-access-token"
                  onChange={(e) =>
                    setZaloForm((cur) => ({ ...cur, access_token: e.target.value }))
                  }
                  placeholder={
                    selectedZalo?.configured
                      ? t(
                          "knowledgeHub.chatChannels.zalo.fields.accessTokenPlaceholderConfigured"
                        )
                      : t(
                          "knowledgeHub.chatChannels.zalo.fields.accessTokenPlaceholder"
                        )
                  }
                  type="password"
                  value={zaloForm.access_token}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button
                    disabled={
                      zaloTestLoading ||
                      (!zaloForm.access_token.trim() && !selectedZalo?.configured)
                    }
                    isLoading={zaloTestLoading}
                    onClick={() => testZaloMutation.mutate()}
                    size="small"
                    type="button"
                    variant="secondary"
                  >
                    {t("knowledgeHub.chatChannels.zalo.testAction")}
                  </Button>
                  {zaloTestResult && (
                    <Text
                      className={
                        zaloTestResult.includes("thành công") || zaloTestResult.includes("Successfully")
                          ? "text-ui-fg-interactive text-xs font-medium"
                          : "text-ui-fg-error text-xs font-medium"
                      }
                      size="small"
                    >
                      {zaloTestResult}
                    </Text>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="zalo-refresh-token" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.zalo.fields.refreshToken")}
                    </Label>
                  </div>
                  <Input
                    autoComplete="off"
                    id="zalo-refresh-token"
                    onChange={(e) =>
                      setZaloForm((cur) => ({ ...cur, refresh_token: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.zalo.fields.refreshTokenPlaceholder"
                    )}
                    type="password"
                    value={zaloForm.refresh_token}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="zalo-oa-secret-key" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.zalo.fields.oaSecretKey")}
                    </Label>
                  </div>
                  <Input
                    autoComplete="off"
                    id="zalo-oa-secret-key"
                    onChange={(e) =>
                      setZaloForm((cur) => ({ ...cur, oa_secret_key: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.zalo.fields.oaSecretKeyPlaceholder"
                    )}
                    type="password"
                    value={zaloForm.oa_secret_key}
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="zalo-public-url" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.zalo.fields.publicBaseUrl")}
                    </Label>
                    <span className="text-[11px] text-ui-fg-interactive font-medium">HTTPS</span>
                  </div>
                  <Input
                    id="zalo-public-url"
                    onChange={(e) =>
                      setZaloForm((cur) => ({
                        ...cur,
                        public_base_url: e.target.value,
                      }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.zalo.fields.publicBaseUrlPlaceholder"
                    )}
                    required
                    type="url"
                    value={zaloForm.public_base_url}
                  />
                  <Text className="text-ui-fg-subtle" size="xsmall">
                    {t(
                      "knowledgeHub.chatChannels.zalo.fields.publicBaseUrlHint"
                    )}
                  </Text>
                </div>

                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Text className="text-ui-fg-base" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.zalo.webhookUrl")}
                    </Text>
                    <Button
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        const base = zaloForm.public_base_url.trim().replace(/\/$/, "") || "https://trendhub.sbs"
                        const url = `${base}/api/store/zalo/webhook`
                        navigator.clipboard.writeText(url)
                        toast.success(t("knowledgeHub.chatChannels.zalo.webhookCopied"))
                      }}
                      size="small"
                      type="button"
                      variant="secondary"
                    >
                      <ClipboardCopyIcon className="mr-1" size={12} />
                      {t("knowledgeHub.chatChannels.zalo.copyWebhookUrl")}
                    </Button>
                  </div>
                  <div className="rounded bg-ui-bg-base px-2.5 py-1.5 border font-mono text-xs text-ui-fg-subtle break-all select-all">
                    {`${(zaloForm.public_base_url.trim().replace(/\/$/, "") || "https://trendhub.sbs")}/api/store/zalo/webhook`}
                  </div>
                  <Text className="text-ui-fg-muted" size="xsmall">
                    {t("knowledgeHub.chatChannels.zalo.webhookUrlHint")}
                  </Text>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Text size="small" weight="plus">
                  {t(
                    "knowledgeHub.chatChannels.zalo.fields.rateLimitTitle"
                  )}
                </Text>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="min-h-[22px] flex items-center">
                      <Label htmlFor="zalo-burst-limit" size="small">
                        {t(
                          "knowledgeHub.chatChannels.zalo.fields.burstLimit"
                        )}
                      </Label>
                    </div>
                    <Input
                      id="zalo-burst-limit"
                      min={1}
                      onChange={(e) =>
                        setZaloForm((cur) => ({
                          ...cur,
                          burst_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={zaloForm.burst_limit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="min-h-[22px] flex items-center">
                      <Label htmlFor="zalo-daily-limit" size="small">
                        {t(
                          "knowledgeHub.chatChannels.zalo.fields.dailyLimit"
                        )}
                      </Label>
                    </div>
                    <Input
                      id="zalo-daily-limit"
                      min={1}
                      onChange={(e) =>
                        setZaloForm((cur) => ({
                          ...cur,
                          daily_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={zaloForm.daily_limit}
                    />
                  </div>
                </div>
              </div>
            </Drawer.Body>

            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button size="small" type="button" variant="secondary">
                  {t("knowledgeHub.cancel")}
                </Button>
              </Drawer.Close>
              <Button
                disabled={
                  saveZaloMutation.isPending ||
                  (!zaloForm.access_token.trim() && !selectedZalo?.configured) ||
                  !zaloForm.public_base_url.trim() ||
                  !zaloForm.app_id.trim() ||
                  !zaloForm.secret_key.trim()
                }
                isLoading={saveZaloMutation.isPending}
                size="small"
                type="submit"
              >
                {t("knowledgeHub.saveDraft")}
              </Button>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>

      {/* Drawer: Configure Facebook Messenger */}
      <Drawer
        onOpenChange={(open) => {
          if (!open) setSelectedMessenger(null)
        }}
        open={Boolean(selectedMessenger)}
      >
        <Drawer.Content className="overflow-y-auto">
          <Drawer.Header>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0084FF]/10 text-[#0084FF]">
                <FacebookMessengerIcon size={18} />
              </div>
              <Drawer.Title>
                {t("knowledgeHub.chatChannels.messenger.drawerTitle")}
              </Drawer.Title>
            </div>
            <Drawer.Description>
              {t("knowledgeHub.chatChannels.messenger.drawerHint")}
            </Drawer.Description>
          </Drawer.Header>

          <form onSubmit={handleMessengerSubmit}>
            <Drawer.Body className="space-y-4">
              {selectedMessenger?.configured && (
                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 flex items-start gap-3">
                  <div className="rounded-md bg-ui-bg-base p-1.5 border shadow-2xs text-[#0084FF] shrink-0 mt-0.5">
                    <FacebookMessengerIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <Text size="small" weight="plus" className="text-ui-fg-base truncate">
                        {selectedMessenger.secret_hint || t("knowledgeHub.chatChannels.messenger.connectedCardTitle")}
                      </Text>
                      <StatusBadge className="shrink-0 whitespace-nowrap" color="green">
                        {t("knowledgeHub.chatChannels.status.active")}
                      </StatusBadge>
                    </div>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t("knowledgeHub.chatChannels.messenger.fields.pageAccessTokenStoredHint", {
                        hint: selectedMessenger.secret_hint || "Meta Fanpage",
                      })}
                    </Text>
                  </div>
                </div>
              )}

              {/* Section 1: Page Access Token & Test Connection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between min-h-[22px]">
                  <Label htmlFor="fb-page-token" size="small" weight="plus">
                    {t("knowledgeHub.chatChannels.messenger.fields.pageAccessToken")}
                  </Label>
                  {selectedMessenger?.configured ? (
                    <span className="rounded bg-ui-bg-subtle px-1.5 py-0.5 text-[10px] font-mono text-ui-fg-muted border">
                      AES-256
                    </span>
                  ) : (
                    <span className="text-[11px] text-ui-fg-error">* {t("knowledgeHub.required", "Bắt buộc")}</span>
                  )}
                </div>
                <Input
                  autoComplete="off"
                  id="fb-page-token"
                  onChange={(e) =>
                    setMessengerForm((cur) => ({ ...cur, page_access_token: e.target.value }))
                  }
                  placeholder={
                    selectedMessenger?.configured
                      ? t(
                          "knowledgeHub.chatChannels.messenger.fields.pageAccessTokenPlaceholderConfigured"
                        )
                      : t(
                          "knowledgeHub.chatChannels.messenger.fields.pageAccessTokenPlaceholder"
                        )
                  }
                  type="password"
                  value={messengerForm.page_access_token}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button
                    disabled={
                      messengerTestLoading ||
                      (!messengerForm.page_access_token.trim() && !selectedMessenger?.configured)
                    }
                    isLoading={messengerTestLoading}
                    onClick={() => testMessengerMutation.mutate()}
                    size="small"
                    type="button"
                    variant="secondary"
                  >
                    {t("knowledgeHub.chatChannels.messenger.testAction")}
                  </Button>
                  {messengerTestResult && (
                    <Text
                      className={
                        messengerTestResult.includes("thành công") || messengerTestResult.includes("Successfully")
                          ? "text-ui-fg-interactive text-xs font-medium"
                          : "text-ui-fg-error text-xs font-medium"
                      }
                      size="small"
                    >
                      {messengerTestResult}
                    </Text>
                  )}
                </div>
              </div>

              {/* Section 2: Meta App Credentials (2 Columns Aligned) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="fb-app-id" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.messenger.fields.appId")}
                    </Label>
                    <span className="text-[11px] text-ui-fg-subtle">
                      {t("knowledgeHub.chatChannels.messenger.fields.appIdOptional")}
                    </span>
                  </div>
                  <Input
                    id="fb-app-id"
                    onChange={(e) =>
                      setMessengerForm((cur) => ({ ...cur, app_id: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.messenger.fields.appIdPlaceholder"
                    )}
                    value={messengerForm.app_id}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="fb-app-secret" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.messenger.fields.appSecret")}
                    </Label>
                    <span className="text-[11px] text-ui-fg-subtle font-mono">
                      HMAC
                    </span>
                  </div>
                  <Input
                    autoComplete="off"
                    id="fb-app-secret"
                    onChange={(e) =>
                      setMessengerForm((cur) => ({ ...cur, app_secret: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.messenger.fields.appSecretPlaceholder"
                    )}
                    type="password"
                    value={messengerForm.app_secret}
                  />
                </div>
              </div>

              {/* Section 3: Webhook Configuration */}
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="fb-public-url" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.messenger.fields.publicBaseUrl")}
                    </Label>
                    <span className="text-[11px] text-ui-fg-interactive font-medium">HTTPS</span>
                  </div>
                  <Input
                    id="fb-public-url"
                    onChange={(e) =>
                      setMessengerForm((cur) => ({
                        ...cur,
                        public_base_url: e.target.value,
                      }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.messenger.fields.publicBaseUrlPlaceholder"
                    )}
                    required
                    type="url"
                    value={messengerForm.public_base_url}
                  />
                  <Text className="text-ui-fg-subtle" size="xsmall">
                    {t(
                      "knowledgeHub.chatChannels.messenger.fields.publicBaseUrlHint"
                    )}
                  </Text>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="fb-verify-token" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.messenger.fields.verifyToken")}
                    </Label>
                    <button
                      className="text-[11px] text-ui-fg-interactive hover:underline cursor-pointer font-medium"
                      onClick={() => {
                        const rand = "fb_verify_" + Math.random().toString(36).slice(2, 12)
                        setMessengerForm((cur) => ({ ...cur, verify_token: rand }))
                      }}
                      type="button"
                    >
                      {t("knowledgeHub.chatChannels.messenger.generateToken")}
                    </button>
                  </div>
                  <Input
                    autoComplete="off"
                    id="fb-verify-token"
                    onChange={(e) =>
                      setMessengerForm((cur) => ({ ...cur, verify_token: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.messenger.fields.verifyTokenPlaceholder"
                    )}
                    value={messengerForm.verify_token}
                  />
                  <Text className="text-ui-fg-subtle" size="xsmall">
                    {t("knowledgeHub.chatChannels.messenger.fields.verifyTokenHint")}
                  </Text>
                </div>

                {/* Webhook Callback URL Copy Box */}
                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Text className="text-ui-fg-base" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.messenger.webhookUrl")}
                    </Text>
                    <Button
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        const base = messengerForm.public_base_url.trim().replace(/\/$/, "") || "https://trendhub.sbs"
                        const url = `${base}/api/store/messenger/webhook`
                        navigator.clipboard.writeText(url)
                        toast.success(t("knowledgeHub.chatChannels.messenger.webhookCopied"))
                      }}
                      size="small"
                      type="button"
                      variant="secondary"
                    >
                      <ClipboardCopyIcon className="mr-1" size={12} />
                      {t("knowledgeHub.chatChannels.messenger.copyWebhookUrl")}
                    </Button>
                  </div>
                  <div className="rounded bg-ui-bg-base px-2.5 py-1.5 border font-mono text-xs text-ui-fg-subtle break-all select-all">
                    {`${(messengerForm.public_base_url.trim().replace(/\/$/, "") || "https://trendhub.sbs")}/api/store/messenger/webhook`}
                  </div>
                  <Text className="text-ui-fg-muted" size="xsmall">
                    {t("knowledgeHub.chatChannels.messenger.webhookUrlHint")}
                  </Text>
                </div>
              </div>

              {/* Section 4: Rate Limits & Security (2 Columns Aligned) */}
              <div className="border-t pt-4 space-y-3">
                <Text size="small" weight="plus">
                  {t(
                    "knowledgeHub.chatChannels.messenger.fields.rateLimitTitle"
                  )}
                </Text>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="min-h-[22px] flex items-center">
                      <Label htmlFor="fb-burst-limit" size="small">
                        {t(
                          "knowledgeHub.chatChannels.messenger.fields.burstLimit"
                        )}
                      </Label>
                    </div>
                    <Input
                      id="fb-burst-limit"
                      min={1}
                      onChange={(e) =>
                        setMessengerForm((cur) => ({
                          ...cur,
                          burst_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={messengerForm.burst_limit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="min-h-[22px] flex items-center">
                      <Label htmlFor="fb-daily-limit" size="small">
                        {t(
                          "knowledgeHub.chatChannels.messenger.fields.dailyLimit"
                        )}
                      </Label>
                    </div>
                    <Input
                      id="fb-daily-limit"
                      min={1}
                      onChange={(e) =>
                        setMessengerForm((cur) => ({
                          ...cur,
                          daily_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={messengerForm.daily_limit}
                    />
                  </div>
                </div>
              </div>
            </Drawer.Body>

            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button size="small" type="button" variant="secondary">
                  {t("knowledgeHub.cancel")}
                </Button>
              </Drawer.Close>
              <Button
                disabled={
                  saveMessengerMutation.isPending ||
                  (!messengerForm.page_access_token.trim() && !selectedMessenger?.configured) ||
                  !messengerForm.public_base_url.trim()
                }
                isLoading={saveMessengerMutation.isPending}
                size="small"
                type="submit"
              >
                {t("knowledgeHub.saveDraft")}
              </Button>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>

      {/* Drawer: Configure TikTok */}
      <Drawer
        onOpenChange={(open) => {
          if (!open) setSelectedTikTok(null)
        }}
        open={Boolean(selectedTikTok)}
      >
        <Drawer.Content className="overflow-y-auto">
          <Drawer.Header>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-white">
                <TikTokIcon size={18} color="#ffffff" />
              </div>
              <Drawer.Title className="text-base font-semibold">
                {t("knowledgeHub.chatChannels.tiktok.drawerTitle")}
              </Drawer.Title>
            </div>
            <Drawer.Description className="text-xs text-ui-fg-subtle">
              {t("knowledgeHub.chatChannels.tiktok.drawerHint")}
            </Drawer.Description>
          </Drawer.Header>

          <form onSubmit={handleTikTokSubmit}>
            <Drawer.Body className="space-y-5 px-6 py-4">
              {/* Connected Account Card if configured */}
              {selectedTikTok?.configured && (
                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Text className="text-xs font-semibold text-ui-fg-base">
                      {t("knowledgeHub.chatChannels.tiktok.connectedCardTitle")}
                    </Text>
                    <StatusBadge
                      color={
                        selectedTikTok.status === "ACTIVE" ? "green" : "orange"
                      }
                    >
                      {selectedTikTok.status === "ACTIVE"
                        ? t("knowledgeHub.chatChannels.status.active")
                        : t("knowledgeHub.chatChannels.status.disabled")}
                    </StatusBadge>
                  </div>
                  {selectedTikTok.bot_username && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-ui-fg-muted">Account:</span>
                      <span className="font-semibold text-ui-fg-base">
                        {selectedTikTok.bot_username}
                      </span>
                    </div>
                  )}
                  {selectedTikTok.secret_hint && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-ui-fg-muted">Info:</span>
                      <span className="font-mono text-ui-fg-subtle">
                        {selectedTikTok.secret_hint}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Section 1: Credentials */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="tt-access-token" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.tiktok.fields.accessToken")}
                    </Label>
                    {selectedTikTok?.configured && (
                      <span className="text-[11px] text-ui-fg-muted">
                        {t(
                          "knowledgeHub.chatChannels.tiktok.fields.accessTokenStoredHint",
                          { hint: selectedTikTok.secret_hint }
                        )}
                      </span>
                    )}
                  </div>
                  <Input
                    autoComplete="off"
                    id="tt-access-token"
                    onChange={(e) =>
                      setTikTokForm((cur) => ({
                        ...cur,
                        access_token: e.target.value,
                      }))
                    }
                    placeholder={
                      selectedTikTok?.configured
                        ? t(
                            "knowledgeHub.chatChannels.tiktok.fields.accessTokenPlaceholderConfigured"
                          )
                        : t(
                            "knowledgeHub.chatChannels.tiktok.fields.accessTokenPlaceholder"
                          )
                    }
                    type="password"
                    value={tiktokForm.access_token}
                  />
                </div>

                {/* Test Connection Button */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    disabled={
                      tiktokTestLoading ||
                      (!tiktokForm.access_token.trim() &&
                        !selectedTikTok?.configured)
                    }
                    isLoading={tiktokTestLoading}
                    onClick={() => testTikTokMutation.mutate()}
                    size="small"
                    type="button"
                    variant="secondary"
                  >
                    {t("knowledgeHub.chatChannels.tiktok.testAction")}
                  </Button>
                  {tiktokTestResult && (
                    <Text
                      className={
                        tiktokTestResult.includes("thất bại") ||
                        tiktokTestResult.includes("failed")
                          ? "text-ui-fg-error text-xs"
                          : "text-ui-fg-interactive text-xs"
                      }
                    >
                      {tiktokTestResult}
                    </Text>
                  )}
                </div>
              </div>

              {/* Section 2: Client Key & Secret */}
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="min-h-[22px] flex items-center">
                    <Label htmlFor="tt-client-key" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.tiktok.fields.clientKey")}
                    </Label>
                  </div>
                  <Input
                    autoComplete="off"
                    id="tt-client-key"
                    onChange={(e) =>
                      setTikTokForm((cur) => ({ ...cur, client_key: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.tiktok.fields.clientKeyPlaceholder"
                    )}
                    value={tiktokForm.client_key}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="min-h-[22px] flex items-center">
                    <Label htmlFor="tt-client-secret" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.tiktok.fields.clientSecret")}
                    </Label>
                  </div>
                  <Input
                    autoComplete="off"
                    id="tt-client-secret"
                    onChange={(e) =>
                      setTikTokForm((cur) => ({ ...cur, client_secret: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.tiktok.fields.clientSecretPlaceholder"
                    )}
                    type="password"
                    value={tiktokForm.client_secret}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="min-h-[22px] flex items-center">
                    <Label htmlFor="tt-refresh-token" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.tiktok.fields.refreshToken")}
                    </Label>
                  </div>
                  <Input
                    autoComplete="off"
                    id="tt-refresh-token"
                    onChange={(e) =>
                      setTikTokForm((cur) => ({ ...cur, refresh_token: e.target.value }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.tiktok.fields.refreshTokenPlaceholder"
                    )}
                    type="password"
                    value={tiktokForm.refresh_token}
                  />
                </div>
              </div>

              {/* Section 3: Webhook Configuration */}
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-[22px]">
                    <Label htmlFor="tt-public-url" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.tiktok.fields.publicBaseUrl")}
                    </Label>
                    <span className="text-[11px] text-ui-fg-interactive font-medium">HTTPS</span>
                  </div>
                  <Input
                    id="tt-public-url"
                    onChange={(e) =>
                      setTikTokForm((cur) => ({
                        ...cur,
                        public_base_url: e.target.value,
                      }))
                    }
                    placeholder={t(
                      "knowledgeHub.chatChannels.tiktok.fields.publicBaseUrlPlaceholder"
                    )}
                    required
                    type="url"
                    value={tiktokForm.public_base_url}
                  />
                  <Text className="text-ui-fg-subtle" size="xsmall">
                    {t(
                      "knowledgeHub.chatChannels.tiktok.fields.publicBaseUrlHint"
                    )}
                  </Text>
                </div>

                {/* Webhook Callback URL Copy Box */}
                <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Text className="text-ui-fg-base" size="small" weight="plus">
                      {t("knowledgeHub.chatChannels.tiktok.webhookUrl")}
                    </Text>
                    <Button
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        const base = tiktokForm.public_base_url.trim().replace(/\/$/, "") || "https://trendhub.sbs"
                        const url = selectedTikTok?.webhook_url || `${base}/webhooks/agent-operations/tiktok/primary`
                        navigator.clipboard.writeText(url)
                        toast.success(t("knowledgeHub.chatChannels.tiktok.webhookCopied"))
                      }}
                      size="small"
                      type="button"
                      variant="secondary"
                    >
                      <ClipboardCopyIcon className="mr-1" size={12} />
                      {t("knowledgeHub.chatChannels.tiktok.copyWebhookUrl")}
                    </Button>
                  </div>
                  <div className="rounded bg-ui-bg-base px-2.5 py-1.5 border font-mono text-xs text-ui-fg-subtle break-all select-all">
                    {selectedTikTok?.webhook_url || `${(tiktokForm.public_base_url.trim().replace(/\/$/, "") || "https://trendhub.sbs")}/webhooks/agent-operations/tiktok/primary`}
                  </div>
                  <Text className="text-ui-fg-muted" size="xsmall">
                    {t("knowledgeHub.chatChannels.tiktok.webhookUrlHint")}
                  </Text>
                </div>
              </div>

              {/* Section 4: Rate Limits & Security */}
              <div className="border-t pt-4 space-y-3">
                <Text size="small" weight="plus">
                  {t(
                    "knowledgeHub.chatChannels.tiktok.fields.rateLimitTitle"
                  )}
                </Text>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="min-h-[22px] flex items-center">
                      <Label htmlFor="tt-burst-limit" size="small">
                        {t(
                          "knowledgeHub.chatChannels.tiktok.fields.burstLimit"
                        )}
                      </Label>
                    </div>
                    <Input
                      id="tt-burst-limit"
                      min={1}
                      onChange={(e) =>
                        setTikTokForm((cur) => ({
                          ...cur,
                          burst_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={tiktokForm.burst_limit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="min-h-[22px] flex items-center">
                      <Label htmlFor="tt-daily-limit" size="small">
                        {t(
                          "knowledgeHub.chatChannels.tiktok.fields.dailyLimit"
                        )}
                      </Label>
                    </div>
                    <Input
                      id="tt-daily-limit"
                      min={1}
                      onChange={(e) =>
                        setTikTokForm((cur) => ({
                          ...cur,
                          daily_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={tiktokForm.daily_limit}
                    />
                  </div>
                </div>
              </div>
            </Drawer.Body>

            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button size="small" type="button" variant="secondary">
                  {t("knowledgeHub.cancel")}
                </Button>
              </Drawer.Close>
              <Button
                disabled={
                  saveTikTokMutation.isPending ||
                  (!tiktokForm.access_token.trim() && !selectedTikTok?.configured) ||
                  !tiktokForm.public_base_url.trim()
                }
                isLoading={saveTikTokMutation.isPending}
                size="small"
                type="submit"
              >
                {t("knowledgeHub.saveDraft")}
              </Button>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}
