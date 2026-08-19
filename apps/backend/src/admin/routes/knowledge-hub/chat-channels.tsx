import {
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
  channel: "TELEGRAM"
  configured: boolean
  identities: Array<{ chat_id: string; user_id: string }>
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

type ChatChannelsContentProps = {
  embedded?: boolean
}

export const ChatChannelsContent = ({
  embedded = false,
}: ChatChannelsContentProps) => {
  const { t } = useTranslation()
  const confirm = usePrompt()
  const queryClient = useQueryClient()
  const [selectedChannel, setSelectedChannel] = useState<ChannelStatus | null>(
    null
  )
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  const [form, setForm] = useState({
    allow_unmapped_users: true,
    api_base_url: "https://api.telegram.org",
    bot_token: "",
    burst_limit: 6,
    daily_limit: 100,
    public_base_url: "",
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

  const openTelegramDrawer = (channel?: ChannelStatus) => {
    setTestResult(null)
    const current = channel ?? telegramChannel
    setSelectedChannel(current ?? null)
    const defaultUrl =
      current?.public_base_url &&
      !current.public_base_url.includes("invalid") &&
      !current.public_base_url.includes("webhooks/")
        ? current.public_base_url
        : typeof window !== "undefined"
          ? window.location.origin
          : ""

    setForm({
      allow_unmapped_users: current?.allow_unmapped_users ?? true,
      api_base_url: "https://api.telegram.org",
      bot_token: "",
      burst_limit: current?.security?.burst_limit ?? 6,
      daily_limit: current?.security?.daily_limit ?? 100,
      public_base_url: defaultUrl,
    })
  }

  const testBotMutation = useMutation({
    mutationFn: async () => {
      const token = form.bot_token.trim()
      if (!token && !telegramChannel?.configured) {
        throw new Error(t("knowledgeHub.chatChannels.telegram.fields.botTokenPlaceholder"))
      }
      setTestLoading(true)
      setTestResult(null)
      try {
        const res = await sdk.client.fetch<TelegramTestResponse>(
          "/admin/agent-operations/channels/telegram/test",
          {
            body: {
              account_ref: "primary",
              api_base_url: form.api_base_url,
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
        setTestResult(msg)
        toast.success(msg)
      } catch (err: any) {
        const errMsg = err?.message || t("knowledgeHub.chatChannels.testError")
        setTestResult(errMsg)
        toast.error(errMsg)
      } finally {
        setTestLoading(false)
      }
    },
  })

  const saveTelegramMutation = useMutation({
    mutationFn: async () => {
      return sdk.client.fetch("/admin/agent-operations/channels/telegram", {
        body: {
          account_ref: "primary",
          allow_unmapped_users: form.allow_unmapped_users,
          api_base_url: form.api_base_url,
          ...(form.bot_token.trim() ? { bot_token: form.bot_token.trim() } : {}),
          public_base_url: form.public_base_url.trim(),
          security: {
            burst_limit: Number(form.burst_limit),
            daily_limit: Number(form.daily_limit),
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
      setSelectedChannel(null)
      setForm((cur) => ({ ...cur, bot_token: "" }))
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

  const handleDisconnect = async () => {
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveTelegramMutation.mutate()
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
                    onClick={handleDisconnect}
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

            {/* Zalo OA Channel Placeholder */}
            <div className="flex items-center justify-between p-6 opacity-60">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border">
                  <span className="font-bold text-sm">Zalo</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Text weight="plus">Zalo Official Account (OA)</Text>
                    <StatusBadge color="grey">Sắp ra mắt</StatusBadge>
                  </div>
                  <Text className="mt-1 text-ui-fg-subtle" size="small">
                    Tích hợp Zalo OA chăm sóc khách hàng tự động tại Việt Nam.
                  </Text>
                </div>
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
          if (!open) setSelectedChannel(null)
        }}
        open={Boolean(selectedChannel)}
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

          <form onSubmit={handleSubmit}>
            <Drawer.Body className="space-y-4">
              {/* Bot Token Field */}
              <div className="space-y-1">
                <Label htmlFor="telegram-bot-token" size="small" weight="plus">
                  {t("knowledgeHub.chatChannels.telegram.fields.botToken")}
                </Label>
                <Input
                  autoComplete="off"
                  id="telegram-bot-token"
                  onChange={(e) =>
                    setForm((cur) => ({ ...cur, bot_token: e.target.value }))
                  }
                  placeholder={
                    selectedChannel?.secret_hint
                      ? t(
                          "knowledgeHub.chatChannels.telegram.fields.botTokenStoredHint",
                          { hint: selectedChannel.secret_hint }
                        )
                      : t(
                          "knowledgeHub.chatChannels.telegram.fields.botTokenPlaceholder"
                        )
                  }
                  type="password"
                  value={form.bot_token}
                />
                {selectedChannel?.secret_hint && (
                  <Text className="text-ui-fg-subtle" size="xsmall">
                    {t(
                      "knowledgeHub.chatChannels.telegram.fields.botTokenStoredHint",
                      { hint: selectedChannel.secret_hint }
                    )}
                  </Text>
                )}
              </div>

              {/* Test Token Button */}
              <div className="flex items-center gap-3">
                <Button
                  disabled={
                    testLoading ||
                    (!form.bot_token.trim() && !selectedChannel?.configured)
                  }
                  isLoading={testLoading}
                  onClick={() => testBotMutation.mutate()}
                  size="small"
                  type="button"
                  variant="secondary"
                >
                  {t("knowledgeHub.chatChannels.telegram.testAction")}
                </Button>
                {testResult && (
                  <Text
                    className={
                      testResult.includes("thành công") || testResult.includes("Successfully")
                        ? "text-ui-fg-interactive text-xs"
                        : "text-ui-fg-error text-xs"
                    }
                    size="small"
                  >
                    {testResult}
                  </Text>
                )}
              </div>

              {/* Public Base URL Field */}
              <div className="space-y-1">
                <Label htmlFor="telegram-public-url" size="small" weight="plus">
                  {t("knowledgeHub.chatChannels.telegram.fields.publicBaseUrl")}
                </Label>
                <Input
                  id="telegram-public-url"
                  onChange={(e) =>
                    setForm((cur) => ({
                      ...cur,
                      public_base_url: e.target.value,
                    }))
                  }
                  placeholder={t(
                    "knowledgeHub.chatChannels.telegram.fields.publicBaseUrlPlaceholder"
                  )}
                  required
                  type="url"
                  value={form.public_base_url}
                />
                <Text className="text-ui-fg-subtle" size="xsmall">
                  {t(
                    "knowledgeHub.chatChannels.telegram.fields.publicBaseUrlHint"
                  )}
                </Text>
              </div>

              {/* Security & Limits */}
              <div className="border-t pt-4 space-y-3">
                <Text size="small" weight="plus">
                  {t(
                    "knowledgeHub.chatChannels.telegram.fields.rateLimitTitle"
                  )}
                </Text>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="burst-limit" size="small">
                      {t(
                        "knowledgeHub.chatChannels.telegram.fields.burstLimit"
                      )}
                    </Label>
                    <Input
                      id="burst-limit"
                      min={1}
                      onChange={(e) =>
                        setForm((cur) => ({
                          ...cur,
                          burst_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={form.burst_limit}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="daily-limit" size="small">
                      {t(
                        "knowledgeHub.chatChannels.telegram.fields.dailyLimit"
                      )}
                    </Label>
                    <Input
                      id="daily-limit"
                      min={1}
                      onChange={(e) =>
                        setForm((cur) => ({
                          ...cur,
                          daily_limit: Number(e.target.value),
                        }))
                      }
                      type="number"
                      value={form.daily_limit}
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
                  (!form.bot_token.trim() && !selectedChannel?.configured) ||
                  !form.public_base_url.trim()
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
    </div>
  )
}
