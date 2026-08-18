import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  StatusBadge,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CheckCircleIcon,
  CreditCardIcon,
  SpinnerIcon,
} from "../../lib/icons"
import { sdk } from "../../lib/sdk"

type PaymentProviderResponse = {
  provider: {
    code: string
    name: string
    provider_id: string
    environment: "sandbox" | "production"
    is_enabled: boolean
    is_timeout_enabled: boolean
    timeout_minutes: number
    display_title: string
    order_prefix: string
    client_id: string
    has_api_key: boolean
    api_key_hint?: string | null
    has_checksum_key: boolean
    checksum_key_hint?: string | null
    last_verified_at?: string | null
    last_verification?: {
      success?: boolean
      latency_ms?: number
      message?: string
    } | null
    updated_at?: string | null
  }
}

const PaymentsPage = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [isEnabled, setIsEnabled] = useState(false)
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox")
  const [clientId, setClientId] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [checksumKey, setChecksumKey] = useState("")
  const [isTimeoutEnabled, setIsTimeoutEnabled] = useState(true)
  const [timeoutMinutes, setTimeoutMinutes] = useState(15)
  const [displayTitle, setDisplayTitle] = useState("VietQR / Chuyển khoản ngân hàng")
  const [orderPrefix, setOrderPrefix] = useState("DH")

  const { data, isLoading } = useQuery<PaymentProviderResponse>({
    queryKey: ["admin-payments-provider-payos"],
    queryFn: () => sdk.client.fetch("/admin/payments/providers"),
  })

  useEffect(() => {
    if (!data?.provider) return
    const p = data.provider
    setIsEnabled(p.is_enabled)
    setEnvironment(p.environment || "sandbox")
    setClientId(p.client_id || "")
    setIsTimeoutEnabled(p.is_timeout_enabled ?? true)
    setTimeoutMinutes(p.timeout_minutes || 15)
    setDisplayTitle(p.display_title || "VietQR / Chuyển khoản ngân hàng")
    setOrderPrefix(p.order_prefix || "DH")
  }, [data])

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      sdk.client.fetch("/admin/payments/providers", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments-provider-payos"] })
      setApiKey("")
      setChecksumKey("")
      toast.success(t("paymentHub.saveSuccess"))
    },
    onError: (err: any) => {
      toast.error(err?.message || t("paymentHub.saveError"))
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (payload: any) =>
      sdk.client.fetch<{ success: boolean; message: string; latency_ms?: number }>(
        "/admin/payments/providers/verify",
        {
          method: "POST",
          body: payload,
        }
      ),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-payments-provider-payos"] })
      if (res.success) {
        toast.success(
          `${t("paymentHub.verifySuccess")}${res.latency_ms ? ` (${res.latency_ms}ms)` : ""}`
        )
      } else {
        toast.error(res.message || t("paymentHub.verifyError"))
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || t("paymentHub.verifyError"))
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      is_enabled: isEnabled,
      environment,
      client_id: clientId,
      ...(apiKey ? { api_key: apiKey } : {}),
      ...(checksumKey ? { checksum_key: checksumKey } : {}),
      is_timeout_enabled: isTimeoutEnabled,
      timeout_minutes: Number(timeoutMinutes),
      display_title: displayTitle,
      order_prefix: orderPrefix,
    })
  }

  const handleTestConnection = () => {
    verifyMutation.mutate({
      client_id: clientId,
      ...(apiKey ? { api_key: apiKey } : {}),
      ...(checksumKey ? { checksum_key: checksumKey } : {}),
      environment,
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <SpinnerIcon size={24} className="text-ui-fg-muted" />
      </div>
    )
  }

  const p = data?.provider

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-y-1">
        <Heading level="h1">{t("paymentHub.title")}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t("paymentHub.description")}
        </Text>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-y-6">
        {/* Main Unified Settings Container */}
        <Container className="p-0 overflow-hidden divide-y divide-ui-border-base bg-ui-bg-base border border-ui-border-base rounded-xl shadow-xs">
          
          {/* Card Header: Provider info + Enable Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-ui-bg-subtle/40">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ui-bg-base border border-ui-border-base text-ui-fg-base shadow-xs">
                <CreditCardIcon size={22} className="text-ui-fg-base" />
              </div>
              <div className="flex flex-col gap-y-1">
                <div className="flex items-center gap-2.5">
                  <Heading level="h2" className="text-base font-semibold text-ui-fg-base">
                    {t("paymentHub.payosTitle")}
                  </Heading>
                  <StatusBadge color={isEnabled ? "green" : "grey"}>
                    {isEnabled ? t("general.enabled") : t("general.disabled")}
                  </StatusBadge>
                </div>
                {p?.last_verified_at && (
                  <div className="flex items-center gap-1.5 text-xs text-ui-fg-muted">
                    <CheckCircleIcon size={13} className="text-ui-tag-green-icon shrink-0" />
                    <span>{t("paymentHub.verifySuccess")}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center">
              <Switch
                id="enable-payos"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
              <Label htmlFor="enable-payos" className="cursor-pointer text-sm font-medium text-ui-fg-base select-none">
                {t("paymentHub.enablePayment")}
              </Label>
            </div>
          </div>

          {/* Section 1: Connection & Credentials */}
          <div className="p-6 flex flex-col gap-y-5">
            <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">
              Thông tin kết nối PayOS
            </Heading>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {/* Row 1: Environment & Client ID */}
              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center">
                  <Label htmlFor="payos-env" className="text-xs font-medium text-ui-fg-subtle">
                    {t("paymentHub.environment")}
                  </Label>
                </div>
                <Select
                  value={environment}
                  onValueChange={(val) => setEnvironment(val as "sandbox" | "production")}
                >
                  <Select.Trigger id="payos-env" className="w-full">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="sandbox">{t("paymentHub.sandbox")}</Select.Item>
                    <Select.Item value="production">{t("paymentHub.production")}</Select.Item>
                  </Select.Content>
                </Select>
              </div>

              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center">
                  <Label htmlFor="payos-client-id" className="text-xs font-medium text-ui-fg-subtle">
                    {t("paymentHub.clientId")}
                  </Label>
                </div>
                <Input
                  id="payos-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Nhập Client ID..."
                  className="w-full"
                />
              </div>

              {/* Row 2: API Key & Checksum Key */}
              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center justify-between">
                  <Label htmlFor="payos-api-key" className="text-xs font-medium text-ui-fg-subtle">
                    {t("paymentHub.apiKey")}
                  </Label>
                  {p?.has_api_key && p?.api_key_hint && (
                    <span className="text-[11px] font-mono text-ui-fg-muted bg-ui-bg-subtle px-1.5 py-0.5 rounded border border-ui-border-base">
                      {p.api_key_hint}
                    </span>
                  )}
                </div>
                <Input
                  id="payos-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={p?.has_api_key ? "••••••••••••••••" : "Nhập API Key..."}
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center justify-between">
                  <Label htmlFor="payos-checksum" className="text-xs font-medium text-ui-fg-subtle">
                    {t("paymentHub.checksumKey")}
                  </Label>
                  {p?.has_checksum_key && p?.checksum_key_hint && (
                    <span className="text-[11px] font-mono text-ui-fg-muted bg-ui-bg-subtle px-1.5 py-0.5 rounded border border-ui-border-base">
                      {p.checksum_key_hint}
                    </span>
                  )}
                </div>
                <Input
                  id="payos-checksum"
                  type="password"
                  value={checksumKey}
                  onChange={(e) => setChecksumKey(e.target.value)}
                  placeholder={p?.has_checksum_key ? "••••••••••••••••" : "Nhập Checksum Key..."}
                  className="w-full"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-start">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={handleTestConnection}
                disabled={verifyMutation.isPending || (!clientId && !p?.client_id)}
              >
                {verifyMutation.isPending ? (
                  <>
                    <SpinnerIcon size={14} className="mr-1.5" />
                    {t("paymentHub.testing")}
                  </>
                ) : (
                  t("paymentHub.testConnection")
                )}
              </Button>
            </div>
          </div>

          {/* Section 2: Payment Timeout */}
          <div className="p-6 flex flex-col gap-y-5">
            <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">
              {t("paymentHub.timeoutTitle")}
            </Heading>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-center">
              <div className="flex items-center gap-3">
                <Switch
                  id="enable-timeout"
                  checked={isTimeoutEnabled}
                  onCheckedChange={setIsTimeoutEnabled}
                />
                <Label htmlFor="enable-timeout" className="cursor-pointer text-sm font-medium text-ui-fg-base select-none">
                  {t("paymentHub.enableTimeout")}
                </Label>
              </div>

              {isTimeoutEnabled ? (
                <div className="flex flex-col gap-y-2">
                  <div className="h-5 flex items-center">
                    <Label htmlFor="timeout-minutes" className="text-xs font-medium text-ui-fg-subtle">
                      {t("paymentHub.timeoutMinutes")}
                    </Label>
                  </div>
                  <Input
                    id="timeout-minutes"
                    type="number"
                    min={1}
                    max={1440}
                    value={timeoutMinutes}
                    onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>

          {/* Section 3: Display Settings */}
          <div className="p-6 flex flex-col gap-y-5">
            <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">
              {t("paymentHub.displaySettings")}
            </Heading>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center">
                  <Label htmlFor="display-name" className="text-xs font-medium text-ui-fg-subtle">
                    {t("paymentHub.displayName")}
                  </Label>
                </div>
                <Input
                  id="display-name"
                  value={displayTitle}
                  onChange={(e) => setDisplayTitle(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center">
                  <Label htmlFor="order-prefix" className="text-xs font-medium text-ui-fg-subtle">
                    {t("paymentHub.orderPrefix")}
                  </Label>
                </div>
                <Input
                  id="order-prefix"
                  value={orderPrefix}
                  maxLength={10}
                  onChange={(e) => setOrderPrefix(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="px-6 py-4 bg-ui-bg-subtle/50 flex items-center justify-end gap-x-3">
            <Button
              type="submit"
              variant="primary"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? t("paymentHub.saving") : t("paymentHub.save")}
            </Button>
          </div>

        </Container>
      </form>
    </div>
  )
}

export const config = defineRouteConfig({
  icon: CreditCardIcon,
  label: "paymentHub.navigation",
  translationNs: "translation",
})

export default PaymentsPage
