import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  StatusBadge,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ClipboardCopyIcon,
  GlobeIcon,
  LinkIcon,
  LockClosedIcon,
  LockOpenIcon,
  ShieldCheckIcon,
} from "../../lib/icons"
import { sdk } from "../../lib/sdk"

type DevAccessSettings = {
  allowed_ips: string[]
  access_mode: "public" | "passcode" | "maintenance"
  maintenance_message: string
  passcode: string
  public_access_enabled: boolean
  public_domain: string
  updated_at: string
}

type DevAccessResponse = {
  settings: DevAccessSettings
  tunnel: {
    command_down: string
    command_status: string
    command_up: string
    is_configured: boolean
    public_domain: string
  }
}

const DevAccessPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    maintenance_message: "",
    passcode: "",
    public_domain: "trendhub.sbs",
  })

  const accessQuery = useQuery({
    queryFn: () =>
      sdk.client.fetch<DevAccessResponse>("/admin/dev-access"),
    queryKey: ["admin-dev-access"],
  })

  useEffect(() => {
    if (accessQuery.data?.settings) {
      setForm({
        maintenance_message: accessQuery.data.settings.maintenance_message,
        passcode: accessQuery.data.settings.passcode,
        public_domain: accessQuery.data.settings.public_domain,
      })
    }
  }, [accessQuery.data?.settings])

  const updateMutation = useMutation({
    mutationFn: (body: Partial<DevAccessSettings>) =>
      sdk.client.fetch<DevAccessResponse>("/admin/dev-access", {
        body,
        method: "POST",
      }),
    onError: (error: Error) =>
      toast.error(t("devAccess.saveError"), { description: error.message }),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-dev-access"], data)
      toast.success(
        data.settings.public_access_enabled
          ? t("devAccess.statusUnlocked")
          : t("devAccess.statusLocked")
      )
    },
  })

  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<DevAccessResponse>("/admin/dev-access", {
        body: {
          maintenance_message: form.maintenance_message,
          passcode: form.passcode,
          public_domain: form.public_domain,
        },
        method: "POST",
      }),
    onError: (error: Error) =>
      toast.error(t("devAccess.saveError"), { description: error.message }),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-dev-access"], data)
      toast.success(t("devAccess.settingsSaved"))
    },
  })

  const handleToggleMaster = () => {
    const nextState = !isPublicEnabled
    updateMutation.mutate({ public_access_enabled: nextState })
  }

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault()
    saveSettingsMutation.mutate()
  }

  const copyToClipboard = async (text: string, title = "Link") => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t("devAccess.copied"), { description: `${title}: ${text}` })
    } catch {
      toast.error("Không thể sao chép vào clipboard.")
    }
  }

  const settings = accessQuery.data?.settings
  const isPublicEnabled = Boolean(settings?.public_access_enabled)
  const currentDomain = form.public_domain || "trendhub.sbs"
  const currentPasscode = form.passcode || "synapse2026"

  const links = [
    {
      id: "storefront",
      name: t("devAccess.storefrontHome"),
      path: "",
      url: `https://${currentDomain}`,
      localUrl: "http://localhost:8000",
    },
    {
      id: "customer-chat",
      name: t("devAccess.customerChat"),
      path: "/customer-chat",
      url: `https://${currentDomain}/customer-chat`,
      localUrl: "http://localhost:8000/customer-chat",
    },
    {
      id: "admin-app",
      name: t("devAccess.adminDashboard"),
      path: "/app",
      url: `https://${currentDomain}/app`,
      localUrl: "http://localhost:9000/app",
    },
  ]

  return (
    <div className="flex flex-col gap-y-6">
      {/* Header */}
      <div className="flex flex-col gap-y-1">
        <div className="flex items-center gap-x-2">
          <ShieldCheckIcon className="text-ui-fg-interactive" size={20} />
          <Heading level="h1">{t("devAccess.title")}</Heading>
        </div>
        <Text className="text-ui-fg-subtle" size="small">
          {t("devAccess.subtitle")}
        </Text>
      </div>

      {/* Master Toggle Banner */}
      <Container className="p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                isPublicEnabled
                  ? "bg-ui-bg-highlight text-ui-fg-interactive"
                  : "bg-ui-bg-subtle text-ui-fg-muted"
              }`}
            >
              {isPublicEnabled ? (
                <LockOpenIcon size={22} />
              ) : (
                <LockClosedIcon size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Heading level="h2">{t("devAccess.masterTitle")}</Heading>
                <StatusBadge color={isPublicEnabled ? "green" : "orange"}>
                  {isPublicEnabled
                    ? t("devAccess.statusUnlocked")
                    : t("devAccess.statusLocked")}
                </StatusBadge>
              </div>
              <Text className="mt-1 text-ui-fg-subtle" size="small">
                {isPublicEnabled
                  ? "Domain công khai đang mở. Mọi người có link đều có thể truy cập hệ thống của bạn."
                  : "Đang bật chế độ bảo vệ. Truy cập ngoài qua domain sẽ bị chặn hoặc yêu cầu mã PIN mở khóa."}
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="small"
              variant={isPublicEnabled ? "secondary" : "primary"}
              isLoading={updateMutation.isPending || accessQuery.isLoading}
              onClick={handleToggleMaster}
            >
              {isPublicEnabled ? (
                <>
                  <LockClosedIcon size={14} />
                  {t("devAccess.toggleBlock")}
                </>
              ) : (
                <>
                  <LockOpenIcon size={14} />
                  {t("devAccess.toggleUnblock")}
                </>
              )}
            </Button>
          </div>
        </div>
      </Container>

      {/* Grid: Link Share Hub & Passcode Settings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Link Share Hub */}
        <Container className="flex flex-col gap-y-4 p-6">
          <div className="flex items-center gap-x-2">
            <LinkIcon className="text-ui-fg-interactive" size={18} />
            <Heading level="h2">{t("devAccess.shareHubTitle")}</Heading>
          </div>
          <Text className="text-ui-fg-subtle" size="small">
            {t("devAccess.shareHubSubtitle")}
          </Text>

          <div className="flex flex-col gap-y-3">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex flex-col justify-between gap-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3.5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <Text size="small" weight="plus">
                    {link.name}
                  </Text>
                  <Text
                    className="truncate font-mono text-ui-fg-subtle"
                    size="xsmall"
                  >
                    {link.url}
                  </Text>
                </div>
                <div className="flex items-center gap-x-2 shrink-0">
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => copyToClipboard(link.url, link.name)}
                  >
                    <ClipboardCopyIcon size={14} />
                    {t("devAccess.copyLink")}
                  </Button>
                  <Button
                    size="small"
                    variant="transparent"
                    onClick={() =>
                      copyToClipboard(
                        `${link.url} (Mã PIN: ${currentPasscode})`,
                        `${link.name} kèm PIN`
                      )
                    }
                  >
                    {t("devAccess.copyLinkWithPin")}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-ui-border-base bg-ui-bg-base p-3">
            <Text className="text-ui-fg-subtle" size="xsmall">
              💡 <strong>Mẹo:</strong> Khi ở chế độ Khóa An Toàn, bạn chỉ cần gửi link kèm mã PIN. Người nhận chỉ cần nhập PIN 1 lần trên trình duyệt là có thể test bình thường mà không ai khác xem được.
            </Text>
          </div>
        </Container>

        {/* PIN & Domain Configuration */}
        <Container className="p-6">
          <div className="mb-4 flex items-center gap-x-2">
            <GlobeIcon className="text-ui-fg-interactive" size={18} />
            <Heading level="h2">{t("devAccess.pinSettingsTitle")}</Heading>
          </div>
          <Text className="mb-5 text-ui-fg-subtle" size="small">
            {t("devAccess.pinSettingsSubtitle")}
          </Text>

          <form className="flex flex-col gap-y-4" onSubmit={handleFormSubmit}>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="passcode-input">
                {t("devAccess.passcodeLabel")}
              </Label>
              <Input
                id="passcode-input"
                value={form.passcode}
                placeholder="Nhập mã PIN (vd: synapse2026)"
                onChange={(e) =>
                  setForm((cur) => ({ ...cur, passcode: e.target.value }))
                }
                required
              />
              <Text className="text-ui-fg-subtle" size="xsmall">
                Mã này dùng để mở khóa trên trang bảo vệ khi truy cập từ xa.
              </Text>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="domain-input">{t("devAccess.domainLabel")}</Label>
              <Input
                id="domain-input"
                value={form.public_domain}
                placeholder="trendhub.sbs"
                onChange={(e) =>
                  setForm((cur) => ({ ...cur, public_domain: e.target.value }))
                }
                required
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="message-input">
                {t("devAccess.messageLabel")}
              </Label>
              <Textarea
                id="message-input"
                rows={3}
                value={form.maintenance_message}
                onChange={(e) =>
                  setForm((cur) => ({
                    ...cur,
                    maintenance_message: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                size="small"
                isLoading={saveSettingsMutation.isPending}
              >
                {t("devAccess.saveSettings")}
              </Button>
            </div>
          </form>
        </Container>
      </div>

      {/* Cloudflare Tunnel Commands Info */}
      <Container className="p-6">
        <div className="flex flex-col gap-y-2">
          <Heading level="h2">{t("devAccess.tunnelTitle")}</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            {t("devAccess.tunnelSubtitle")}
          </Text>

          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
              <div className="flex items-center justify-between">
                <Text size="small" weight="plus">
                  Tắt Tunnel (Ngắt mạng)
                </Text>
                <Badge color="red">Tắt</Badge>
              </div>
              <code className="mt-2 block rounded bg-ui-bg-base p-1.5 font-mono text-xs text-ui-fg-interactive">
                pnpm run tunnel:down
              </code>
            </div>

            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
              <div className="flex items-center justify-between">
                <Text size="small" weight="plus">
                  Bật Tunnel (Mở mạng)
                </Text>
                <Badge color="green">Bật</Badge>
              </div>
              <code className="mt-2 block rounded bg-ui-bg-base p-1.5 font-mono text-xs text-ui-fg-interactive">
                pnpm run tunnel:up
              </code>
            </div>

            <div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
              <div className="flex items-center justify-between">
                <Text size="small" weight="plus">
                  Kiểm tra trạng thái
                </Text>
                <Badge color="blue">Status</Badge>
              </div>
              <code className="mt-2 block rounded bg-ui-bg-base p-1.5 font-mono text-xs text-ui-fg-interactive">
                pnpm run tunnel:status
              </code>
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  icon: ShieldCheckIcon,
  label: "Truy cập & Share",
})

export default DevAccessPage
