import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  StatusBadge,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircleIcon, GlobeIcon, SpinnerIcon, TruckIcon } from "../../lib/icons"
import { sdk } from "../../lib/sdk"

type Carrier = {
  code: string
  environment: "sandbox" | "production"
  has_token: boolean
  is_enabled: boolean
  last_verification?: {
    latency_ms?: number
    message?: string
    provinces_count?: number
  } | null
  last_verified_at?: string | null
  name: string
  provider_id: string
  secret_hint?: string | null
  settings: {
    sender_address?: string
    sender_name?: string
    sender_phone?: string
    shop_id?: number
  }
  updated_at?: string
}

type Shipment = {
  carrier_code: string
  carrier_name: string
  created_at: string
  delivered_at?: string | null
  fulfillment_id: string
  label_url?: string | null
  order_display_id?: number | null
  order_id?: string | null
  service: string
  shipped_at?: string | null
  status: string
  tracking_number?: string | null
  tracking_url?: string | null
}

type GhnForm = {
  api_token: string
  environment: "sandbox" | "production"
  sender_address: string
  sender_name: string
  sender_phone: string
  shop_id: string
}

const emptyForm: GhnForm = {
  api_token: "",
  environment: "sandbox",
  sender_address: "",
  sender_name: "",
  sender_phone: "",
  shop_id: "",
}

function toForm(carrier?: Carrier): GhnForm {
  if (!carrier) return emptyForm

  return {
    api_token: "",
    environment: carrier.environment,
    sender_address: carrier.settings.sender_address || "",
    sender_name: carrier.settings.sender_name || "",
    sender_phone: carrier.settings.sender_phone || "",
    shop_id: carrier.settings.shop_id ? String(carrier.settings.shop_id) : "",
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

const ShippingHubPage = () => {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<GhnForm>(emptyForm)

  const carriersQuery = useQuery({
    queryKey: ["shipping-hub", "carriers"],
    queryFn: () => sdk.client.fetch<{ carriers: Carrier[] }>("/admin/shipping/carriers"),
  })
  const shipmentsQuery = useQuery({
    queryKey: ["shipping-hub", "shipments"],
    queryFn: () => sdk.client.fetch<{ shipments: Shipment[] }>("/admin/shipping/shipments"),
  })
  const ghn = carriersQuery.data?.carriers.find((carrier) => carrier.code === "GHN")

  useEffect(() => {
    setForm(toForm(ghn))
  }, [ghn?.updated_at])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["shipping-hub", "carriers"] })
    queryClient.invalidateQueries({ queryKey: ["shipping-hub", "shipments"] })
  }
  const saveMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/shipping/carriers/ghn", {
        body: {
          api_token: form.api_token || undefined,
          environment: form.environment,
          is_enabled: true,
          sender_address: form.sender_address,
          sender_name: form.sender_name,
          sender_phone: form.sender_phone,
          shop_id: Number(form.shop_id),
        },
        method: "POST",
      }),
    onError: (error: Error) => toast.error("Không thể lưu cấu hình", { description: error.message }),
    onSuccess: () => {
      setForm((current) => ({ ...current, api_token: "" }))
      invalidate()
      toast.success("Đã lưu kết nối GHN", { description: "Token được mã hóa trong cơ sở dữ liệu." })
    },
  })
  const testMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ message: string }>("/admin/shipping/carriers/ghn/test", {
        body: {
          api_token: form.api_token || undefined,
          environment: form.environment,
          shop_id: Number(form.shop_id),
        },
        method: "POST",
      }),
    onError: (error: Error) => toast.error("GHN chưa kết nối được", { description: error.message }),
    onSuccess: (result) => {
      setForm((current) => ({ ...current, api_token: "" }))
      invalidate()
      toast.success("GHN đã kết nối", { description: result.message })
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveMutation.mutate()
  }
  const isLoading = carriersQuery.isLoading || shipmentsQuery.isLoading

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center gap-x-2">
          <TruckIcon className="text-ui-fg-interactive" />
          <Heading level="h1">Trung tâm vận chuyển</Heading>
        </div>
        <Text className="text-ui-fg-subtle">
          Một nơi để cấu hình carrier, chọn cước tính thực tế và theo dõi các fulfillment đã xuất kho.
        </Text>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Container className="flex flex-col gap-y-3">
          <Text size="small" className="text-ui-fg-subtle">Carrier đang hoạt động</Text>
          <div className="flex items-center justify-between">
            <Heading level="h2">{carriersQuery.data?.carriers.filter((carrier) => carrier.is_enabled).length || 0}</Heading>
            <Badge color="green">Sẵn sàng mở rộng</Badge>
          </div>
          <Text size="small" className="text-ui-fg-subtle">GHN đang là adapter đầu tiên; các carrier mới dùng chung luồng này.</Text>
        </Container>
        <Container className="flex flex-col gap-y-3">
          <Text size="small" className="text-ui-fg-subtle">Vận đơn đã tạo</Text>
          <Heading level="h2">{shipmentsQuery.data?.shipments.length || 0}</Heading>
          <Text size="small" className="text-ui-fg-subtle">Dữ liệu lấy từ Fulfillment của Medusa, không phải một danh sách đơn song song.</Text>
        </Container>
        <Container className="flex flex-col gap-y-3">
          <Text size="small" className="text-ui-fg-subtle">Cước tại checkout</Text>
          <div className="flex items-center gap-x-2">
            <CheckCircleIcon className="text-ui-fg-interactive" />
            <Heading level="h2">Tính theo carrier</Heading>
          </div>
          <Text size="small" className="text-ui-fg-subtle">GHN Tiêu chuẩn là shipping option calculated, chỉ hiện khi GHN trả được cước thật.</Text>
        </Container>
      </div>

      <Container className="p-0">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <Heading level="h2">Vận đơn</Heading>
            <Text size="small" className="text-ui-fg-subtle">Theo dõi và mở fulfillment tương ứng trong đơn hàng.</Text>
          </div>
          {shipmentsQuery.isFetching && <SpinnerIcon className="animate-spin text-ui-fg-subtle" />}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center p-10"><SpinnerIcon className="animate-spin" /></div>
        ) : !shipmentsQuery.data?.shipments.length ? (
          <div className="p-6"><Text className="text-ui-fg-subtle">Chưa có fulfillment qua carrier. Khi xuất kho từ đơn hàng Medusa, vận đơn sẽ xuất hiện ở đây.</Text></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-ui-fg-subtle">
                <tr><th className="px-6 py-3 font-medium">Đơn hàng</th><th className="px-6 py-3 font-medium">Carrier</th><th className="px-6 py-3 font-medium">Mã vận đơn</th><th className="px-6 py-3 font-medium">Dịch vụ</th><th className="px-6 py-3 font-medium">Trạng thái</th><th className="px-6 py-3 font-medium">Tạo lúc</th><th className="px-6 py-3 font-medium" /></tr>
              </thead>
              <tbody>
                {shipmentsQuery.data.shipments.map((shipment) => (
                  <tr key={shipment.fulfillment_id} className="border-b last:border-0">
                    <td className="px-6 py-4">{shipment.order_id ? <Button asChild size="small" variant="transparent"><Link to={`/orders/${shipment.order_id}`}>#{shipment.order_display_id || "—"}</Link></Button> : "—"}</td>
                    <td className="px-6 py-4"><Text size="small" weight="plus">{shipment.carrier_name}</Text></td>
                    <td className="px-6 py-4">{shipment.tracking_number || "Đang tạo"}</td>
                    <td className="px-6 py-4">{shipment.service}</td>
                    <td className="px-6 py-4"><StatusBadge color={shipment.delivered_at ? "green" : "orange"}>{shipment.status}</StatusBadge></td>
                    <td className="px-6 py-4">{formatDate(shipment.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-x-2">
                        {shipment.tracking_url && <Button asChild size="small" variant="transparent"><a href={shipment.tracking_url} target="_blank" rel="noreferrer">Theo dõi</a></Button>}
                        {shipment.label_url && <Button asChild size="small" variant="transparent"><a href={shipment.label_url} target="_blank" rel="noreferrer">In nhãn</a></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>

      <Container className="max-w-4xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Heading level="h2">Giao Hàng Nhanh</Heading>
            <Text size="small" className="text-ui-fg-subtle">Kết nối API, kho gửi và kiểm tra trạng thái sandbox/production.</Text>
          </div>
          {ghn?.is_enabled ? <StatusBadge color="green">Đang hoạt động</StatusBadge> : <StatusBadge color="grey">Chưa cấu hình</StatusBadge>}
        </div>
        <form className="flex flex-col gap-y-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-y-2"><Label htmlFor="ghn-environment">Môi trường</Label><Select value={form.environment} onValueChange={(value) => setForm((current) => ({ ...current, environment: value as GhnForm["environment"] }))}><Select.Trigger id="ghn-environment"><Select.Value /></Select.Trigger><Select.Content><Select.Item value="sandbox">Sandbox</Select.Item><Select.Item value="production">Production</Select.Item></Select.Content></Select></div>
            <div className="flex flex-col gap-y-2"><Label htmlFor="ghn-shop-id">Shop ID</Label><Input id="ghn-shop-id" inputMode="numeric" value={form.shop_id} onChange={(event) => setForm((current) => ({ ...current, shop_id: event.target.value }))} required /></div>
          </div>
          <div className="flex flex-col gap-y-2"><Label htmlFor="ghn-token">API Token</Label><Input id="ghn-token" type="password" value={form.api_token} placeholder={ghn?.secret_hint ? `Đã lưu: ${ghn.secret_hint}. Chỉ nhập khi đổi token.` : "Nhập token lần đầu"} onChange={(event) => setForm((current) => ({ ...current, api_token: event.target.value }))} /><Text size="small" className="text-ui-fg-subtle">Token được mã hóa; sau khi lưu chỉ hiện hint, không cần nhập lại mỗi lần.</Text></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-y-2"><Label htmlFor="ghn-sender-name">Tên người gửi</Label><Input id="ghn-sender-name" value={form.sender_name} onChange={(event) => setForm((current) => ({ ...current, sender_name: event.target.value }))} required /></div>
            <div className="flex flex-col gap-y-2"><Label htmlFor="ghn-sender-phone">Số điện thoại gửi</Label><Input id="ghn-sender-phone" value={form.sender_phone} onChange={(event) => setForm((current) => ({ ...current, sender_phone: event.target.value }))} required /></div>
          </div>
          <div className="flex flex-col gap-y-2"><Label htmlFor="ghn-sender-address">Địa chỉ kho gửi</Label><Input id="ghn-sender-address" value={form.sender_address} onChange={(event) => setForm((current) => ({ ...current, sender_address: event.target.value }))} required /></div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <Text size="small" className="text-ui-fg-subtle">{ghn?.last_verified_at ? `Xác thực gần nhất: ${formatDate(ghn.last_verified_at)}` : "Chưa xác thực kết nối"}</Text>
            <div className="flex gap-x-2"><Button type="button" variant="secondary" isLoading={testMutation.isPending} onClick={() => testMutation.mutate()}><GlobeIcon />Kiểm tra kết nối</Button><Button type="submit" isLoading={saveMutation.isPending}>Lưu cấu hình</Button></div>
          </div>
        </form>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  icon: TruckIcon,
  label: "Vận chuyển",
})

export default ShippingHubPage
