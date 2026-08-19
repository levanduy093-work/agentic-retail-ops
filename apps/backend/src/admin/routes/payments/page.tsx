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
  Select,
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

const VIETNAM_BANKS = [
  { code: "MB", name: "MBBank (Quân Đội)" },
  { code: "VCB", name: "Vietcombank (Ngoại Thương)" },
  { code: "TCB", name: "Techcombank (Kỹ Thương)" },
  { code: "ACB", name: "ACB (Á Châu)" },
  { code: "VPB", name: "VPBank (Việt Nam Thịnh Vượng)" },
  { code: "TPB", name: "TPBank (Tiên Phong)" },
  { code: "CTG", name: "VietinBank (Công Thương)" },
  { code: "BIDV", name: "BIDV (Đầu tư và Phát triển VN)" },
  { code: "STB", name: "Sacombank (Sài Gòn Thương Tín)" },
  { code: "VIB", name: "VIB (Quốc Tế)" },
  { code: "HDB", name: "HDBank (Phát Triển TP.HCM)" },
  { code: "OCB", name: "OCB (Phương Đông)" },
  { code: "TIMO", name: "Timo (BVBank)" },
  { code: "MSB", name: "MSB (Hàng Hải)" },
  { code: "SHB", name: "SHB (Sài Gòn - Hà Nội)" },
  { code: "SEAB", name: "SeABank (Đông Nam Á)" },
  { code: "NAB", name: "NamABank (Nam Á)" },
  { code: "KLB", name: "Kienlongbank (Kiên Long)" },
  { code: "LPB", name: "LPBank (Lộc Phát VN)" },
]

type ProviderData = {
  code: string
  name: string
  provider_id: string
  environment: "sandbox" | "production"
  is_enabled: boolean
  is_timeout_enabled?: boolean
  timeout_minutes?: number
  display_title?: string
  order_prefix?: string
  // SePay
  account_number?: string
  bank_code?: string
  account_holder_name?: string
  // PayOS
  client_id?: string
  has_api_key?: boolean
  api_key_hint?: string | null
  has_checksum_key?: boolean
  checksum_key_hint?: string | null
  last_verified_at?: string | null
  last_verification?: {
    latency_ms?: number
    message?: string
    success?: boolean
  } | null
}

type PaymentProvidersResponse = {
  providers: ProviderData[]
  active_code: string | null
  provider?: ProviderData
}

const PaymentsPage = () => {
  const { t } = useTranslation()

  const tr = (key: string, fallback: string) => {
    const val = t(key)
    return val && val !== key ? val : fallback
  }

  const { data, isLoading, refetch } = useQuery<PaymentProvidersResponse>({
    queryKey: ["admin_payment_providers"],
    queryFn: async () => {
      return sdk.client.fetch<PaymentProvidersResponse>(
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
        body: payload,
      })
    },
    onSuccess: () => {
      refetch()
    },
  })

  // SePay state
  const [sepayEnabled, setSepayEnabled] = useState(true)
  const [sepayApiKey, setSepayApiKey] = useState("")
  const [sepayAccountNumber, setSepayAccountNumber] = useState("")
  const [sepayBankCode, setSepayBankCode] = useState("MB")
  const [sepayAccountHolderName, setSepayAccountHolderName] = useState("")
  const [sepayTimeoutEnabled, setSepayTimeoutEnabled] = useState(true)
  const [sepayTimeoutMinutes, setSepayTimeoutMinutes] = useState(15)
  const [sepayDisplayTitle, setSepayDisplayTitle] = useState("VietQR / Chuyển khoản ngân hàng")
  const [sepayOrderPrefix, setSepayOrderPrefix] = useState("DH")

  // PayOS state
  const [payosEnabled, setPayosEnabled] = useState(false)
  const [payosClientId, setPayosClientId] = useState("")
  const [payosApiKey, setPayosApiKey] = useState("")
  const [payosChecksumKey, setPayosChecksumKey] = useState("")
  const [payosTimeoutEnabled, setPayosTimeoutEnabled] = useState(true)
  const [payosTimeoutMinutes, setPayosTimeoutMinutes] = useState(15)
  const [payosDisplayTitle, setPayosDisplayTitle] = useState("VietQR / Chuyển khoản ngân hàng")
  const [payosOrderPrefix, setPayosOrderPrefix] = useState("DH")

  const sepayData = data?.providers?.find((p) => p.code === "SEPAY")
  const payosData = data?.providers?.find((p) => p.code === "PAYOS")

  useEffect(() => {
    if (sepayData) {
      setSepayEnabled(Boolean(sepayData.is_enabled))
      setSepayAccountNumber(sepayData.account_number || "")
      setSepayBankCode(sepayData.bank_code || "MB")
      setSepayAccountHolderName(sepayData.account_holder_name || "")
      setSepayTimeoutEnabled(sepayData.is_timeout_enabled ?? true)
      setSepayTimeoutMinutes(Number(sepayData.timeout_minutes || 15))
      setSepayDisplayTitle(sepayData.display_title || "VietQR / Chuyển khoản ngân hàng")
      setSepayOrderPrefix(sepayData.order_prefix || "DH")
    }

    if (payosData) {
      setPayosEnabled(Boolean(payosData.is_enabled))
      setPayosClientId(payosData.client_id || "")
      setPayosTimeoutEnabled(payosData.is_timeout_enabled ?? true)
      setPayosTimeoutMinutes(Number(payosData.timeout_minutes || 15))
      setPayosDisplayTitle(payosData.display_title || "VietQR / Chuyển khoản ngân hàng")
      setPayosOrderPrefix(payosData.order_prefix || "DH")
    }
  }, [sepayData, payosData])

  const handleSaveSepay = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload: Record<string, any> = {
      code: "SEPAY",
      is_enabled: sepayEnabled,
      environment: "production",
      account_number: sepayAccountNumber,
      bank_code: sepayBankCode,
      account_holder_name: sepayAccountHolderName,
      is_timeout_enabled: sepayTimeoutEnabled,
      timeout_minutes: sepayTimeoutMinutes,
      display_title: sepayDisplayTitle,
      order_prefix: sepayOrderPrefix,
    }

    if (sepayApiKey) payload.api_key = sepayApiKey

    try {
      await configureMutation.mutateAsync(payload)
      toast.success(tr("general.success", "Thành công"), {
        description: tr("paymentHub.savedSuccess", "Đã lưu cấu hình thanh toán thành công"),
      })
      setSepayApiKey("")
    } catch (err: any) {
      toast.error(tr("general.error", "Lỗi"), {
        description: err?.message || tr("paymentHub.savedFailed", "Lưu cấu hình thất bại"),
      })
    }
  }

  const handleTestSepay = async () => {
    try {
      const result = await verifyMutation.mutateAsync({
        code: "SEPAY",
        account_number: sepayAccountNumber || sepayData?.account_number,
        bank_code: sepayBankCode || sepayData?.bank_code,
        ...(sepayApiKey ? { api_key: sepayApiKey } : {}),
      })

      if (result.success) {
        toast.success(tr("paymentHub.testSuccess", "Kết nối thành công"), {
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

  const handleSavePayos = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload: Record<string, any> = {
      code: "PAYOS",
      is_enabled: payosEnabled,
      environment: "production",
      client_id: payosClientId,
      is_timeout_enabled: payosTimeoutEnabled,
      timeout_minutes: payosTimeoutMinutes,
      display_title: payosDisplayTitle,
      order_prefix: payosOrderPrefix,
    }

    if (payosApiKey) payload.api_key = payosApiKey
    if (payosChecksumKey) payload.checksum_key = payosChecksumKey

    try {
      await configureMutation.mutateAsync(payload)
      toast.success(tr("general.success", "Thành công"), {
        description: tr("paymentHub.savedSuccess", "Đã lưu cấu hình thanh toán thành công"),
      })
      setPayosApiKey("")
      setPayosChecksumKey("")
    } catch (err: any) {
      toast.error(tr("general.error", "Lỗi"), {
        description: err?.message || tr("paymentHub.savedFailed", "Lưu cấu hình thất bại"),
      })
    }
  }

  const handleTestPayos = async () => {
    try {
      const result = await verifyMutation.mutateAsync({
        code: "PAYOS",
        client_id: payosClientId || payosData?.client_id,
        ...(payosApiKey ? { api_key: payosApiKey } : {}),
        ...(payosChecksumKey ? { checksum_key: payosChecksumKey } : {}),
        environment: "production",
      })

      if (result.success) {
        toast.success(tr("paymentHub.testSuccess", "Kết nối thành công"), {
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

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-y-1">
        <Heading level="h1">{tr("paymentHub.title", "Cổng thanh toán")}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {tr(
            "paymentHub.description",
            "Quản lý cấu hình cổng thanh toán VietQR (SePay / PayOS)"
          )}
        </Text>
      </div>

      {/* Active Gateway Information Banner */}
      <div className="p-4 rounded-xl border border-ui-border-base bg-ui-bg-subtle/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ui-bg-base border border-ui-border-base text-ui-fg-base shadow-2xs">
            <CreditCardIcon size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Text size="small" className="font-semibold text-ui-fg-base">
                Cổng VietQR đang hoạt động:
              </Text>
              <StatusBadge color={sepayEnabled || payosEnabled ? "green" : "grey"}>
                {sepayEnabled ? "SePay (VietQR)" : payosEnabled ? "PayOS (VietQR)" : "Chưa kích hoạt"}
              </StatusBadge>
            </div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {tr(
                "paymentHub.activeGatewayInfo",
                "Hệ thống tự động kích hoạt 1 cổng VietQR duy nhất để khách hàng checkout mượt mà."
              )}
            </Text>
          </div>
        </div>
      </div>

      {/* RESPONSIVE 2-COLUMN GRID (SIDE-BY-SIDE ON DESKTOP, STACKED ON MOBILE) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        
        {/* CARD 1: SEPAY GATEWAY (RECOMMENDED) */}
        <form onSubmit={handleSaveSepay} className="flex flex-col h-full">
          <Container className="flex flex-col h-full justify-between p-0 overflow-hidden divide-y divide-ui-border-base bg-ui-bg-base border border-ui-border-base rounded-xl shadow-xs">
            
            {/* Card Content Top */}
            <div className="divide-y divide-ui-border-base">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-ui-bg-subtle/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 shadow-xs">
                    <CreditCardIcon size={20} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <Heading level="h2" className="text-sm font-semibold text-ui-fg-base">
                        {tr("paymentHub.sepayTitle", "Cổng SePay (VietQR)")}
                      </Heading>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20">
                        {tr("paymentHub.recommended", "Khuyến nghị")}
                      </span>
                    </div>
                    {sepayData?.last_verified_at && (
                      <div className="flex items-center gap-1.5 text-xs text-ui-fg-muted mt-0.5">
                        <CheckCircleIcon size={12} className="text-ui-tag-green-icon shrink-0" />
                        <span>{tr("paymentHub.verifySuccess", "Kết nối thành công")}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-center">
                  <Switch
                    id="enable-sepay"
                    checked={sepayEnabled}
                    onCheckedChange={(checked) => {
                      setSepayEnabled(checked)
                      if (checked) setPayosEnabled(false)
                    }}
                  />
                  <Label htmlFor="enable-sepay" className="cursor-pointer text-xs font-medium text-ui-fg-base select-none">
                    {sepayEnabled ? "Đã bật" : "Đã tắt"}
                  </Label>
                </div>
              </div>

              {/* SePay Connection Info */}
              <div className="p-5 flex flex-col gap-y-4">
                <div className="flex items-center justify-between">
                  <Heading level="h3" className="text-xs font-semibold uppercase tracking-wider text-ui-fg-subtle">
                    {tr("paymentHub.sepayConnectionInfo", "Thông tin kết nối SePay")}
                  </Heading>
                  <a
                    href="https://my.sepay.vn/companyapi"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-ui-fg-interactive hover:underline"
                  >
                    Lấy API Token tại my.sepay.vn ↗
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* API Token */}
                  <div className="flex flex-col gap-y-1.5 sm:col-span-2">
                    <div className="h-4 flex items-center justify-between">
                      <Label htmlFor="sepay-api-key" className="text-xs font-medium text-ui-fg-subtle">
                        {tr("paymentHub.sepayApiKey", "API Token (từ my.sepay.vn)")}
                      </Label>
                      {sepayData?.has_api_key && sepayData?.api_key_hint && (
                        <span className="text-[10px] font-mono text-ui-fg-muted bg-ui-bg-subtle px-1.5 py-0.5 rounded border border-ui-border-base">
                          {sepayData.api_key_hint}
                        </span>
                      )}
                    </div>
                    <Input
                      id="sepay-api-key"
                      type="password"
                      value={sepayApiKey}
                      onChange={(e) => setSepayApiKey(e.target.value)}
                      placeholder={
                        sepayData?.has_api_key
                          ? "••••••••••••••••"
                          : tr("paymentHub.enterSepayApiKey", "Nhập API Token từ SePay...")
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Ngân hàng */}
                  <div className="flex flex-col gap-y-1.5">
                    <div className="h-4 flex items-center">
                      <Label htmlFor="sepay-bank-code" className="text-xs font-medium text-ui-fg-subtle">
                        {tr("paymentHub.bank", "Ngân hàng nhận tiền")}
                      </Label>
                    </div>
                    <Select
                      value={sepayBankCode}
                      onValueChange={(val) => setSepayBankCode(val)}
                    >
                      <Select.Trigger id="sepay-bank-code">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {VIETNAM_BANKS.map((b) => (
                          <Select.Item key={b.code} value={b.code}>
                            {b.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>

                  {/* Số tài khoản */}
                  <div className="flex flex-col gap-y-1.5">
                    <div className="h-4 flex items-center">
                      <Label htmlFor="sepay-acc-num" className="text-xs font-medium text-ui-fg-subtle">
                        {tr("paymentHub.accountNumber", "Số tài khoản ngân hàng")}
                      </Label>
                    </div>
                    <Input
                      id="sepay-acc-num"
                      value={sepayAccountNumber}
                      onChange={(e) => setSepayAccountNumber(e.target.value)}
                      placeholder={tr("paymentHub.enterAccountNumber", "Nhập số tài khoản...")}
                      className="w-full"
                    />
                  </div>

                  {/* Tên chủ tài khoản */}
                  <div className="flex flex-col gap-y-1.5 sm:col-span-2">
                    <div className="h-4 flex items-center">
                      <Label htmlFor="sepay-holder-name" className="text-xs font-medium text-ui-fg-subtle">
                        {tr("paymentHub.accountHolderName", "Tên chủ tài khoản (in hoa không dấu)")}
                      </Label>
                    </div>
                    <Input
                      id="sepay-holder-name"
                      value={sepayAccountHolderName}
                      onChange={(e) => setSepayAccountHolderName(e.target.value.toUpperCase())}
                      placeholder={tr(
                        "paymentHub.enterAccountHolderName",
                        "Ví dụ: NGUYEN VAN A"
                      )}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="pt-1 flex justify-start">
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={handleTestSepay}
                    disabled={verifyMutation.isPending || (!sepayApiKey && !sepayData?.has_api_key)}
                  >
                    {verifyMutation.isPending ? (
                      <>
                        <SpinnerIcon size={14} className="mr-1.5" />
                        {tr("paymentHub.testing", "Đang kiểm tra...")}
                      </>
                    ) : (
                      tr("paymentHub.testConnection", "Kiểm tra kết nối SePay")
                    )}
                  </Button>
                </div>
              </div>

              {/* SePay Display & Settings */}
              <div className="p-5 flex flex-col gap-y-4">
                <Heading level="h3" className="text-xs font-semibold uppercase tracking-wider text-ui-fg-subtle">
                  {tr("paymentHub.displaySettings", "Hiển thị & Thời hạn")}
                </Heading>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-y-1.5 sm:col-span-1">
                    <Label htmlFor="sepay-display-title" className="text-xs font-medium text-ui-fg-subtle">
                      {tr("paymentHub.displayTitle", "Tên hiển thị")}
                    </Label>
                    <Input
                      id="sepay-display-title"
                      value={sepayDisplayTitle}
                      onChange={(e) => setSepayDisplayTitle(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-y-1.5">
                    <Label htmlFor="sepay-order-prefix" className="text-xs font-medium text-ui-fg-subtle">
                      {tr("paymentHub.orderPrefix", "Tiền tố")}
                    </Label>
                    <Input
                      id="sepay-order-prefix"
                      value={sepayOrderPrefix}
                      onChange={(e) => setSepayOrderPrefix(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-y-1.5">
                    <Label htmlFor="sepay-timeout-minutes" className="text-xs font-medium text-ui-fg-subtle">
                      {tr("paymentHub.timeoutMinutes", "Hết hạn (phút)")}
                    </Label>
                    <Input
                      id="sepay-timeout-minutes"
                      type="number"
                      min={1}
                      max={1440}
                      value={sepayTimeoutMinutes}
                      onChange={(e) => setSepayTimeoutMinutes(Math.max(1, Number(e.target.value)))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Save */}
            <div className="p-4 bg-ui-bg-subtle/20 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="small"
                disabled={configureMutation.isPending}
              >
                {configureMutation.isPending ? (
                  <>
                    <SpinnerIcon size={14} className="mr-1.5" />
                    {tr("paymentHub.saving", "Đang lưu...")}
                  </>
                ) : (
                  tr("paymentHub.save", "Lưu cấu hình SePay")
                )}
              </Button>
            </div>
          </Container>
        </form>

        {/* CARD 2: PAYOS GATEWAY */}
        <form onSubmit={handleSavePayos} className="flex flex-col h-full">
          <Container className="flex flex-col h-full justify-between p-0 overflow-hidden divide-y divide-ui-border-base bg-ui-bg-base border border-ui-border-base rounded-xl shadow-xs">
            
            {/* Card Content Top */}
            <div className="divide-y divide-ui-border-base">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-ui-bg-subtle/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ui-bg-base border border-ui-border-base text-ui-fg-base shadow-xs">
                    <CreditCardIcon size={20} />
                  </div>
                  <div className="flex flex-col">
                    <Heading level="h2" className="text-sm font-semibold text-ui-fg-base">
                      {tr("paymentHub.payosTitle", "Cổng PayOS (VietQR)")}
                    </Heading>
                    {payosData?.last_verified_at && (
                      <div className="flex items-center gap-1.5 text-xs text-ui-fg-muted mt-0.5">
                        <CheckCircleIcon size={12} className="text-ui-tag-green-icon shrink-0" />
                        <span>{tr("paymentHub.verifySuccess", "Kết nối thành công")}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-center">
                  <Switch
                    id="enable-payos"
                    checked={payosEnabled}
                    onCheckedChange={(checked) => {
                      setPayosEnabled(checked)
                      if (checked) setSepayEnabled(false)
                    }}
                  />
                  <Label htmlFor="enable-payos" className="cursor-pointer text-xs font-medium text-ui-fg-base select-none">
                    {payosEnabled ? "Đã bật" : "Đã tắt"}
                  </Label>
                </div>
              </div>

              {/* PayOS Connection Info */}
              <div className="p-5 flex flex-col gap-y-4">
                <Heading level="h3" className="text-xs font-semibold uppercase tracking-wider text-ui-fg-subtle">
                  {tr("paymentHub.connectionInfo", "Thông tin kết nối PayOS")}
                </Heading>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Client ID */}
                  <div className="flex flex-col gap-y-1.5 sm:col-span-2">
                    <Label htmlFor="payos-client-id" className="text-xs font-medium text-ui-fg-subtle">
                      {tr("paymentHub.clientId", "Client ID")}
                    </Label>
                    <Input
                      id="payos-client-id"
                      value={payosClientId}
                      onChange={(e) => setPayosClientId(e.target.value)}
                      placeholder={tr("paymentHub.enterClientId", "Nhập Client ID...")}
                      className="w-full"
                    />
                  </div>

                  {/* API Key */}
                  <div className="flex flex-col gap-y-1.5">
                    <div className="h-4 flex items-center justify-between">
                      <Label htmlFor="payos-api-key" className="text-xs font-medium text-ui-fg-subtle">
                        {tr("paymentHub.apiKey", "API Key")}
                      </Label>
                      {payosData?.has_api_key && payosData?.api_key_hint && (
                        <span className="text-[10px] font-mono text-ui-fg-muted bg-ui-bg-subtle px-1.5 py-0.5 rounded border border-ui-border-base">
                          {payosData.api_key_hint}
                        </span>
                      )}
                    </div>
                    <Input
                      id="payos-api-key"
                      type="password"
                      value={payosApiKey}
                      onChange={(e) => setPayosApiKey(e.target.value)}
                      placeholder={
                        payosData?.has_api_key
                          ? "••••••••••••••••"
                          : tr("paymentHub.enterApiKey", "Nhập API Key...")
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Checksum Key */}
                  <div className="flex flex-col gap-y-1.5">
                    <div className="h-4 flex items-center justify-between">
                      <Label htmlFor="payos-checksum" className="text-xs font-medium text-ui-fg-subtle">
                        {tr("paymentHub.checksumKey", "Checksum Key")}
                      </Label>
                      {payosData?.has_checksum_key && payosData?.checksum_key_hint && (
                        <span className="text-[10px] font-mono text-ui-fg-muted bg-ui-bg-subtle px-1.5 py-0.5 rounded border border-ui-border-base">
                          {payosData.checksum_key_hint}
                        </span>
                      )}
                    </div>
                    <Input
                      id="payos-checksum"
                      type="password"
                      value={payosChecksumKey}
                      onChange={(e) => setPayosChecksumKey(e.target.value)}
                      placeholder={
                        payosData?.has_checksum_key
                          ? "••••••••••••••••"
                          : tr("paymentHub.enterChecksumKey", "Nhập Checksum Key...")
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="pt-1 flex justify-start">
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={handleTestPayos}
                    disabled={verifyMutation.isPending || (!payosClientId && !payosData?.client_id)}
                  >
                    {verifyMutation.isPending ? (
                      <>
                        <SpinnerIcon size={14} className="mr-1.5" />
                        {tr("paymentHub.testing", "Đang kiểm tra...")}
                      </>
                    ) : (
                      tr("paymentHub.testConnection", "Kiểm tra kết nối PayOS")
                    )}
                  </Button>
                </div>
              </div>

              {/* PayOS Display & Timeout */}
              <div className="p-5 flex flex-col gap-y-4">
                <Heading level="h3" className="text-xs font-semibold uppercase tracking-wider text-ui-fg-subtle">
                  {tr("paymentHub.displaySettings", "Hiển thị & Thời hạn")}
                </Heading>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-y-1.5 sm:col-span-1">
                    <Label htmlFor="payos-display-title" className="text-xs font-medium text-ui-fg-subtle">
                      {tr("paymentHub.displayTitle", "Tên hiển thị")}
                    </Label>
                    <Input
                      id="payos-display-title"
                      value={payosDisplayTitle}
                      onChange={(e) => setPayosDisplayTitle(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-y-1.5">
                    <Label htmlFor="payos-order-prefix" className="text-xs font-medium text-ui-fg-subtle">
                      {tr("paymentHub.orderPrefix", "Tiền tố")}
                    </Label>
                    <Input
                      id="payos-order-prefix"
                      value={payosOrderPrefix}
                      onChange={(e) => setPayosOrderPrefix(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-y-1.5">
                    <Label htmlFor="payos-timeout-minutes" className="text-xs font-medium text-ui-fg-subtle">
                      {tr("paymentHub.timeoutMinutes", "Hết hạn (phút)")}
                    </Label>
                    <Input
                      id="payos-timeout-minutes"
                      type="number"
                      min={1}
                      max={1440}
                      value={payosTimeoutMinutes}
                      onChange={(e) => setPayosTimeoutMinutes(Math.max(1, Number(e.target.value)))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Save */}
            <div className="p-4 bg-ui-bg-subtle/20 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="small"
                disabled={configureMutation.isPending}
              >
                {configureMutation.isPending ? (
                  <>
                    <SpinnerIcon size={14} className="mr-1.5" />
                    {tr("paymentHub.saving", "Đang lưu...")}
                  </>
                ) : (
                  tr("paymentHub.save", "Lưu cấu hình PayOS")
                )}
              </Button>
            </div>
          </Container>
        </form>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "paymentHub.navigation",
  translationNs: "translation",
  icon: CreditCardIcon,
})

export default PaymentsPage
