import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Text,
  Input,
  Button,
  Switch,
  Label,
  StatusBadge,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import {
  CheckCircleIcon,
  CreditCardIcon,
  SpinnerIcon,
} from "../../lib/icons"
import { sdk } from "../../lib/sdk"

type PaymentProviderData = {
  provider: {
    code?: string
    client_id?: string
    configuration?: {
      client_id?: string
      display_title?: string
      is_timeout_enabled?: boolean
      order_prefix?: string
      timeout_minutes?: number
    }
    environment?: "sandbox" | "production"
    has_api_key?: boolean
    api_key_hint?: string | null
    has_checksum_key?: boolean
    checksum_key_hint?: string | null
    is_enabled: boolean
    is_timeout_enabled?: boolean
    timeout_minutes?: number
    display_title?: string
    order_prefix?: string
    last_verification?: {
      latency_ms?: number
      message?: string
      success?: boolean
    } | null
    last_verified_at?: string | null
    name: string
  }
}

const PaymentsPage = () => {
  const { t } = useTranslation()

  const tr = (key: string, fallback: string) => {
    const val = t(key)
    return val && val !== key ? val : fallback
  }

  const { data, isLoading, refetch } = useQuery<PaymentProviderData>({
    queryKey: ["admin_payment_provider"],
    queryFn: async () => {
      return sdk.client.fetch<PaymentProviderData>(
        "/admin/payments/providers"
      )
    },
  })

  const configureMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      return sdk.client.fetch<{ provider: any }>(
        "/admin/payments/providers",
        {
          method: "POST",
          body: payload,
        }
      )
    },
    onSuccess: () => {
      refetch()
    },
  })

  const verifyMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      return sdk.client.fetch<{
        success: boolean
        message: string
        latency_ms?: number
      }>("/admin/payments/providers/verify", {
        method: "POST",
        body: {
          code: "PAYOS",
          ...payload,
        },
      })
    },
    onSuccess: () => {
      refetch()
    },
  })

  const [isEnabled, setIsEnabled] = useState(false)
  const [clientId, setClientId] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [checksumKey, setChecksumKey] = useState("")
  const [isTimeoutEnabled, setIsTimeoutEnabled] = useState(true)
  const [timeoutMinutes, setTimeoutMinutes] = useState(15)
  const [displayTitle, setDisplayTitle] = useState("VietQR / Chuyển khoản ngân hàng")
  const [orderPrefix, setOrderPrefix] = useState("DH")

  useEffect(() => {
    if (data?.provider) {
      const p = data.provider
      setIsEnabled(Boolean(p.is_enabled))
      setClientId(p.client_id || p.configuration?.client_id || "")
      setIsTimeoutEnabled(
        p.is_timeout_enabled !== undefined
          ? Boolean(p.is_timeout_enabled)
          : Boolean(p.configuration?.is_timeout_enabled ?? true)
      )
      setTimeoutMinutes(
        Number(p.timeout_minutes || p.configuration?.timeout_minutes || 15)
      )
      setDisplayTitle(
        p.display_title || p.configuration?.display_title || "VietQR / Chuyển khoản ngân hàng"
      )
      setOrderPrefix(
        p.order_prefix || p.configuration?.order_prefix || "DH"
      )
    }
  }, [data])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload: Record<string, any> = {
      code: "PAYOS",
      is_enabled: isEnabled,
      environment: "production",
      client_id: clientId,
      is_timeout_enabled: isTimeoutEnabled,
      timeout_minutes: timeoutMinutes,
      display_title: displayTitle,
      order_prefix: orderPrefix,
    }

    if (apiKey) payload.api_key = apiKey
    if (checksumKey) payload.checksum_key = checksumKey

    try {
      await configureMutation.mutateAsync(payload)
      toast.success(tr("general.success", "Thành công"), {
        description: tr("paymentHub.savedSuccess", "Đã lưu cấu hình thanh toán thành công"),
      })
      setApiKey("")
      setChecksumKey("")
    } catch (err: any) {
      toast.error(tr("general.error", "Lỗi"), {
        description: err?.message || tr("paymentHub.savedFailed", "Lưu cấu hình thất bại"),
      })
    }
  }

  const handleTestConnection = async () => {
    try {
      const result = await verifyMutation.mutateAsync({
        client_id: clientId || data?.provider?.client_id,
        ...(apiKey ? { api_key: apiKey } : {}),
        ...(checksumKey ? { checksum_key: checksumKey } : {}),
        environment: "production",
      })

      if (result.success) {
        toast.success(tr("paymentHub.testSuccess", "Kết nối PayOS thành công"), {
          description: `${result.message} (${result.latency_ms}ms)`,
        })
      } else {
        toast.error(tr("paymentHub.testFailed", "Kiểm tra kết nối thất bại"), {
          description: result.message,
        })
      }
    } catch (err: any) {
      toast.error(tr("paymentHub.testFailed", "Kiểm tra kết nối thất bại"), {
        description: err?.message || "Kiểm tra kết nối thất bại.",
      })
    }
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
        <Heading level="h1">{tr("paymentHub.title", "Cổng thanh toán")}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {tr("paymentHub.description", "Quản lý cấu hình cổng thanh toán VietQR (PayOS)")}
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
                    {tr("paymentHub.payosTitle", "Cổng PayOS (VietQR)")}
                  </Heading>
                  <StatusBadge color={isEnabled ? "green" : "grey"}>
                    {isEnabled ? tr("general.enabled", "Đã bật") : tr("general.disabled", "Đã tắt")}
                  </StatusBadge>
                </div>
                {p?.last_verified_at && (
                  <div className="flex items-center gap-1.5 text-xs text-ui-fg-muted">
                    <CheckCircleIcon size={13} className="text-ui-tag-green-icon shrink-0" />
                    <span>{tr("paymentHub.verifySuccess", "Kết nối PayOS thành công")}</span>
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
                {tr("paymentHub.enablePayment", "Kích hoạt thanh toán PayOS")}
              </Label>
            </div>
          </div>

          {/* Section 1: Connection & Credentials */}
          <div className="p-6 flex flex-col gap-y-5">
            <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">
              Thông tin kết nối PayOS
            </Heading>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {/* Client ID */}
              <div className="flex flex-col gap-y-2 md:col-span-2">
                <div className="h-5 flex items-center">
                  <Label htmlFor="payos-client-id" className="text-xs font-medium text-ui-fg-subtle">
                    {tr("paymentHub.clientId", "Client ID")}
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

              {/* API Key */}
              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center justify-between">
                  <Label htmlFor="payos-api-key" className="text-xs font-medium text-ui-fg-subtle">
                    {tr("paymentHub.apiKey", "API Key")}
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

              {/* Checksum Key */}
              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center justify-between">
                  <Label htmlFor="payos-checksum" className="text-xs font-medium text-ui-fg-subtle">
                    {tr("paymentHub.checksumKey", "Checksum Key")}
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
                    {tr("paymentHub.testing", "Đang kiểm tra...")}
                  </>
                ) : (
                  tr("paymentHub.testConnection", "Kiểm tra kết nối")
                )}
              </Button>
            </div>
          </div>

          {/* Section 2: Payment Timeout */}
          <div className="p-6 flex flex-col gap-y-5">
            <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">
              {tr("paymentHub.timeoutTitle", "Thời gian thanh toán")}
            </Heading>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-center">
              <div className="flex items-center gap-3">
                <Switch
                  id="enable-timeout"
                  checked={isTimeoutEnabled}
                  onCheckedChange={setIsTimeoutEnabled}
                />
                <Label htmlFor="enable-timeout" className="cursor-pointer text-xs font-medium text-ui-fg-subtle select-none">
                  {tr("paymentHub.enableTimeout", "Giới hạn thời gian thanh toán")}
                </Label>
              </div>

              {isTimeoutEnabled && (
                <div className="flex flex-col gap-y-2">
                  <div className="h-5 flex items-center">
                    <Label htmlFor="timeout-minutes" className="text-xs font-medium text-ui-fg-subtle">
                      {tr("paymentHub.timeoutMinutes", "Số phút hết hạn")}
                    </Label>
                  </div>
                  <Input
                    id="timeout-minutes"
                    type="number"
                    min={1}
                    max={1440}
                    value={timeoutMinutes}
                    onChange={(e) => setTimeoutMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Display & Order Prefix */}
          <div className="p-6 flex flex-col gap-y-5">
            <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">
              {tr("paymentHub.displaySettings", "Hiển thị")}
            </Heading>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center">
                  <Label htmlFor="display-title" className="text-xs font-medium text-ui-fg-subtle">
                    {tr("paymentHub.displayTitle", "Tên phương thức hiển thị")}
                  </Label>
                </div>
                <Input
                  id="display-title"
                  value={displayTitle}
                  onChange={(e) => setDisplayTitle(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <div className="h-5 flex items-center">
                  <Label htmlFor="order-prefix" className="text-xs font-medium text-ui-fg-subtle">
                    {tr("paymentHub.orderPrefix", "Tiền tố mã đơn")}
                  </Label>
                </div>
                <Input
                  id="order-prefix"
                  value={orderPrefix}
                  onChange={(e) => setOrderPrefix(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Card Footer: Save Button */}
          <div className="p-6 bg-ui-bg-subtle/20 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="base"
              disabled={configureMutation.isPending}
            >
              {configureMutation.isPending ? (
                <>
                  <SpinnerIcon size={16} className="mr-2" />
                  {tr("paymentHub.saving", "Đang lưu...")}
                </>
              ) : (
                tr("paymentHub.save", "Lưu cấu hình")
              )}
            </Button>
          </div>
        </Container>
      </form>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Thanh toán",
  icon: CreditCardIcon,
})

export default PaymentsPage
