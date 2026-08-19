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
import { sdk } from "../../lib/sdk"

type ChannelStatus = {
  account_ref: string
  allow_unmapped_users: boolean
  bot_id: string | null
  bot_username: string | null
  channel: "TELEGRAM" | "ZALO"
  configured: boolean
  identities: Array<{ chat_id?: string; user_id: string; zalo_user_id?: string }>
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

  const [telegramTestResult, setTelegramTestResult] = useState<string | null>(null)
  const [telegramTestLoading, setTelegramTestLoading] = useState(false)

  const [zaloTestResult, setZaloTestResult] = useState<string | null>(null)
  const [zaloTestLoading, setZaloTestLoading] = useState(false)

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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 shadow-sm border">
                  <svg
                    className="h-6 w-6 fill-current"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.847-.96 4.966-1.359 7.098-.17.9-.5 1.2-.818 1.23-.695.064-1.222-.46-1.896-.9-1.055-.693-1.652-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.664 3.498-1.524 5.831-2.529 7.001-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.155.232.171.326.016.094.037.309.02.479z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Text weight="plus">
                      {t("knowledgeHub.chatChannels.telegram.name")}
                    </Text>
                    <StatusBadge
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
                    src={zaloChannel.oa_avatar}
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold shadow-sm border text-sm">
                    Zalo
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <Text weight="plus">
                      {t("knowledgeHub.chatChannels.zalo.name")}
                    </Text>
                    <StatusBadge
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
                            {zaloChannel.bot_username}
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

            {/* Facebook Messenger Placeholder */}
            <div className="flex items-center justify-between p-6 opacity-60">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border">
                  <span className="font-bold text-sm">FB</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Text weight="plus">Facebook Messenger</Text>
                    <StatusBadge color="grey">Sắp ra mắt</StatusBadge>
                  </div>
                  <Text className="mt-1 text-ui-fg-subtle" size="small">
                    Kết nối Fanpage tự động trả lời tin nhắn Messenger.
                  </Text>
                </div>
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
            <Drawer.Title>
              {t("knowledgeHub.chatChannels.telegram.drawerTitle")}
            </Drawer.Title>
            <Drawer.Description>
              {t("knowledgeHub.chatChannels.telegram.drawerHint")}
            </Drawer.Description>
          </Drawer.Header>

          <form onSubmit={handleTelegramSubmit}>
            <Drawer.Body className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="telegram-bot-token" size="small" weight="plus">
                  {t("knowledgeHub.chatChannels.telegram.fields.botToken")}
                </Label>
                <Input
                  autoComplete="off"
                  id="telegram-bot-token"
                  onChange={(e) =>
                    setTelegramForm((cur) => ({ ...cur, bot_token: e.target.value }))
                  }
                  placeholder={
                    selectedTelegram?.secret_hint
                      ? t(
                          "knowledgeHub.chatChannels.telegram.fields.botTokenStoredHint",
                          { hint: selectedTelegram.secret_hint }
                        )
                      : t(
                          "knowledgeHub.chatChannels.telegram.fields.botTokenPlaceholder"
                        )
                  }
                  type="password"
                  value={telegramForm.bot_token}
                />
                {selectedTelegram?.secret_hint && (
                  <Text className="text-ui-fg-subtle" size="xsmall">
                    {t(
                      "knowledgeHub.chatChannels.telegram.fields.botTokenStoredHint",
                      { hint: selectedTelegram.secret_hint }
                    )}
                  </Text>
                )}
              </div>

              <div className="flex items-center gap-3">
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
                        ? "text-ui-fg-interactive text-xs"
                        : "text-ui-fg-error text-xs"
                    }
                    size="small"
                  >
                    {telegramTestResult}
                  </Text>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="telegram-public-url" size="small" weight="plus">
                  {t("knowledgeHub.chatChannels.telegram.fields.publicBaseUrl")}
                </Label>
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

              <div className="border-t pt-4 space-y-3">
                <Text size="small" weight="plus">
                  {t(
                    "knowledgeHub.chatChannels.telegram.fields.rateLimitTitle"
                  )}
                </Text>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="telegram-burst-limit" size="small">
                      {t(
                        "knowledgeHub.chatChannels.telegram.fields.burstLimit"
                      )}
                    </Label>
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

                  <div className="space-y-1">
                    <Label htmlFor="telegram-daily-limit" size="small">
                      {t(
                        "knowledgeHub.chatChannels.telegram.fields.dailyLimit"
                      )}
                    </Label>
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
            <Drawer.Title>
              {t("knowledgeHub.chatChannels.zalo.drawerTitle")}
            </Drawer.Title>
            <Drawer.Description>
              {t("knowledgeHub.chatChannels.zalo.drawerHint")}
            </Drawer.Description>
          </Drawer.Header>

          <form onSubmit={handleZaloSubmit}>
            <Drawer.Body className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="zalo-app-id" size="small" weight="plus">
                    {t("knowledgeHub.chatChannels.zalo.fields.appId")}
                  </Label>
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

                <div className="space-y-1">
                  <Label htmlFor="zalo-secret-key" size="small" weight="plus">
                    {t("knowledgeHub.chatChannels.zalo.fields.secretKey")}
                  </Label>
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

              <div className="space-y-1">
                <Label htmlFor="zalo-access-token" size="small" weight="plus">
                  {t("knowledgeHub.chatChannels.zalo.fields.accessToken")}
                </Label>
                <Input
                  autoComplete="off"
                  id="zalo-access-token"
                  onChange={(e) =>
                    setZaloForm((cur) => ({ ...cur, access_token: e.target.value }))
                  }
                  placeholder={
                    selectedZalo?.secret_hint
                      ? t(
                          "knowledgeHub.chatChannels.zalo.fields.accessTokenStoredHint",
                          { hint: selectedZalo.secret_hint }
                        )
                      : t(
                          "knowledgeHub.chatChannels.zalo.fields.accessTokenPlaceholder"
                        )
                  }
                  type="password"
                  value={zaloForm.access_token}
                />
                {selectedZalo?.secret_hint && (
                  <Text className="text-ui-fg-subtle" size="xsmall">
                    {t(
                      "knowledgeHub.chatChannels.zalo.fields.accessTokenStoredHint",
                      { hint: selectedZalo.secret_hint }
                    )}
                  </Text>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="zalo-refresh-token" size="small">
                  {t("knowledgeHub.chatChannels.zalo.fields.refreshToken")}
                </Label>
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

              <div className="space-y-1">
                <Label htmlFor="zalo-oa-secret-key" size="small">
                  {t("knowledgeHub.chatChannels.zalo.fields.oaSecretKey")}
                </Label>
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

              <div className="flex items-center gap-3">
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
                        ? "text-ui-fg-interactive text-xs"
                        : "text-ui-fg-error text-xs"
                    }
                    size="small"
                  >
                    {zaloTestResult}
                  </Text>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="zalo-public-url" size="small" weight="plus">
                  {t("knowledgeHub.chatChannels.zalo.fields.publicBaseUrl")}
                </Label>
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

              <div className="border-t pt-4 space-y-3">
                <Text size="small" weight="plus">
                  {t(
                    "knowledgeHub.chatChannels.zalo.fields.rateLimitTitle"
                  )}
                </Text>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="zalo-burst-limit" size="small">
                      {t(
                        "knowledgeHub.chatChannels.zalo.fields.burstLimit"
                      )}
                    </Label>
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

                  <div className="space-y-1">
                    <Label htmlFor="zalo-daily-limit" size="small">
                      {t(
                        "knowledgeHub.chatChannels.zalo.fields.dailyLimit"
                      )}
                    </Label>
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
    </div>
  )
}
