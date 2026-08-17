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
  Tabs,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  CheckCircleIcon,
  GlobeIcon,
  SpinnerIcon,
  TruckIcon,
} from "../../lib/icons"
import { sdk } from "../../lib/sdk"

type Carrier = {
  code: string
  environment: "sandbox" | "production"
  has_token: boolean
  is_enabled: boolean
  last_verification?: {
    latency_ms?: number
    message?: string
    pick_addresses_count?: number
    provinces_count?: number
  } | null
  last_verified_at?: string | null
  name: string
  provider_id: string
  secret_hint?: string | null
  settings: {
    pick_address_id?: string
    sender_address?: string
    sender_district?: string
    sender_name?: string
    sender_phone?: string
    sender_province?: string
    sender_ward?: string
    shop_id?: number
  }
  updated_at?: string
}

type Shipment = {
  carrier_code: string
  carrier_name: string
  created_at: string
  delivered_at?: string | null
  environment?: "sandbox" | "production"
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

type GhtkForm = {
  api_token: string
  environment: "sandbox" | "production"
  pick_address_id: string
  sender_address: string
  sender_district: string
  sender_name: string
  sender_phone: string
  sender_province: string
  sender_ward: string
}

type PackagingBox = {
  code: string
  height: string
  length: string
  width: string
}

type PackagingForm = {
  boxes: PackagingBox[]
  max_items_per_package: string
  max_weight_per_package: string
  packaging_weight: string
}

const emptyGhnForm: GhnForm = {
  api_token: "",
  environment: "sandbox",
  sender_address: "",
  sender_name: "",
  sender_phone: "",
  shop_id: "",
}

const emptyGhtkForm: GhtkForm = {
  api_token: "",
  environment: "sandbox",
  pick_address_id: "",
  sender_address: "",
  sender_district: "Quận 1",
  sender_name: "",
  sender_phone: "",
  sender_province: "Hồ Chí Minh",
  sender_ward: "Phường Bến Nghé",
}

const defaultPackagingForm: PackagingForm = {
  packaging_weight: "80",
  max_items_per_package: "5",
  max_weight_per_package: "3000",
  boxes: [
    { code: "S", length: "25", width: "18", height: "8" },
    { code: "M", length: "35", width: "25", height: "12" },
    { code: "L", length: "45", width: "35", height: "18" },
  ],
}

function toGhnForm(carrier?: Carrier): GhnForm {
  if (!carrier) return emptyGhnForm

  return {
    api_token: "",
    environment: carrier.environment,
    sender_address: carrier.settings.sender_address || "",
    sender_name: carrier.settings.sender_name || "",
    sender_phone: carrier.settings.sender_phone || "",
    shop_id: carrier.settings.shop_id ? String(carrier.settings.shop_id) : "",
  }
}

function toGhtkForm(carrier?: Carrier): GhtkForm {
  if (!carrier) return emptyGhtkForm

  return {
    api_token: "",
    environment: carrier.environment,
    pick_address_id: carrier.settings.pick_address_id || "",
    sender_address: carrier.settings.sender_address || "",
    sender_district: carrier.settings.sender_district || "Quận 1",
    sender_name: carrier.settings.sender_name || "",
    sender_phone: carrier.settings.sender_phone || "",
    sender_province: carrier.settings.sender_province || "Hồ Chí Minh",
    sender_ward: carrier.settings.sender_ward || "Phường Bến Nghé",
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
  const [activeTab, setActiveTab] = useState<string>("GHN")
  const [ghnForm, setGhnForm] = useState<GhnForm>(emptyGhnForm)
  const [ghtkForm, setGhtkForm] = useState<GhtkForm>(emptyGhtkForm)
  const [packagingForm, setPackagingForm] = useState<PackagingForm>(defaultPackagingForm)

  const carriersQuery = useQuery({
    queryKey: ["shipping-hub", "carriers"],
    queryFn: () =>
      sdk.client.fetch<{ carriers: Carrier[] }>("/admin/shipping/carriers"),
  })
  const shipmentsQuery = useQuery({
    queryKey: ["shipping-hub", "shipments"],
    queryFn: () =>
      sdk.client.fetch<{ shipments: Shipment[] }>("/admin/shipping/shipments"),
  })
  const packagingProfileQuery = useQuery({
    queryKey: ["shipping-hub", "packaging-profile"],
    queryFn: () => sdk.client.fetch<{ profile: {
      boxes: Array<{ code: string; height: number; length: number; width: number }>
      max_items_per_package: number
      max_weight_per_package: number
      packaging_weight: number
    } }>("/admin/shipping/packaging-profile"),
  })
  const pendingGhnFulfillmentIds =
    shipmentsQuery.data?.shipments
      .filter(
        (shipment) =>
          shipment.carrier_code === "GHN" &&
          Boolean(shipment.tracking_number) &&
          !["cancel", "delivered", "return"].includes(
            shipment.status.toLowerCase()
          )
      )
      .map((shipment) => shipment.fulfillment_id)
      .join(",") || ""

  const ghn = carriersQuery.data?.carriers.find(
    (carrier) => carrier.code === "GHN"
  )
  const ghtk = carriersQuery.data?.carriers.find(
    (carrier) => carrier.code === "GHTK"
  )

  useEffect(() => {
    setGhnForm(toGhnForm(ghn))
  }, [ghn?.updated_at])

  useEffect(() => {
    setGhtkForm(toGhtkForm(ghtk))
  }, [ghtk?.updated_at])

  useEffect(() => {
    const profile = packagingProfileQuery.data?.profile
    if (!profile) return
    setPackagingForm({
      packaging_weight: String(profile.packaging_weight),
      max_items_per_package: String(profile.max_items_per_package),
      max_weight_per_package: String(profile.max_weight_per_package),
      boxes: profile.boxes.map((box) => ({
        code: box.code,
        height: String(box.height),
        length: String(box.length),
        width: String(box.width),
      })),
    })
  }, [packagingProfileQuery.data?.profile])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["shipping-hub", "carriers"] })
    queryClient.invalidateQueries({ queryKey: ["shipping-hub", "shipments"] })
    queryClient.invalidateQueries({ queryKey: ["shipping-hub", "packaging-profile"] })
  }

  const savePackagingMutation = useMutation({
    mutationFn: () => sdk.client.fetch("/admin/shipping/packaging-profile", {
      method: "POST",
      body: {
        packaging_weight: Number(packagingForm.packaging_weight),
        max_items_per_package: Number(packagingForm.max_items_per_package),
        max_weight_per_package: Number(packagingForm.max_weight_per_package),
        boxes: packagingForm.boxes.map((box) => ({
          code: box.code,
          height: Number(box.height),
          length: Number(box.length),
          width: Number(box.width),
        })),
      },
    }),
    onError: (error: Error) =>
      toast.error("Không thể lưu quy tắc đóng gói", { description: error.message }),
    onSuccess: () => {
      invalidate()
      toast.success("Đã lưu quy tắc đóng gói", {
        description: "Checkout và các carrier đang kết nối sẽ dùng profile này.",
      })
    },
  })

  const saveGhnMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/shipping/carriers/ghn", {
        body: {
          api_token: ghnForm.api_token || undefined,
          environment: ghnForm.environment,
          is_enabled: true,
          sender_address: ghnForm.sender_address,
          sender_name: ghnForm.sender_name,
          sender_phone: ghnForm.sender_phone,
          shop_id: Number(ghnForm.shop_id),
        },
        method: "POST",
      }),
    onError: (error: Error) =>
      toast.error("Không thể lưu cấu hình GHN", { description: error.message }),
    onSuccess: () => {
      setGhnForm((current) => ({ ...current, api_token: "" }))
      invalidate()
      toast.success("Đã lưu kết nối GHN", {
        description: "Token được mã hóa an toàn trong cơ sở dữ liệu.",
      })
    },
  })

  const testGhnMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ message: string }>(
        "/admin/shipping/carriers/ghn/test",
        {
          body: {
            api_token: ghnForm.api_token || undefined,
            environment: ghnForm.environment,
            shop_id: Number(ghnForm.shop_id),
          },
          method: "POST",
        }
      ),
    onError: (error: Error) =>
      toast.error("GHN chưa kết nối được", { description: error.message }),
    onSuccess: (result) => {
      setGhnForm((current) => ({ ...current, api_token: "" }))
      invalidate()
      toast.success("GHN đã kết nối", { description: result.message })
    },
  })

  const saveGhtkMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/shipping/carriers/ghtk", {
        body: {
          api_token: ghtkForm.api_token || undefined,
          environment: ghtkForm.environment,
          is_enabled: true,
          pick_address_id: ghtkForm.pick_address_id || undefined,
          sender_address: ghtkForm.sender_address,
          sender_district: ghtkForm.sender_district,
          sender_name: ghtkForm.sender_name,
          sender_phone: ghtkForm.sender_phone,
          sender_province: ghtkForm.sender_province,
          sender_ward: ghtkForm.sender_ward,
        },
        method: "POST",
      }),
    onError: (error: Error) =>
      toast.error("Không thể lưu cấu hình GHTK", {
        description: error.message,
      }),
    onSuccess: () => {
      setGhtkForm((current) => ({ ...current, api_token: "" }))
      invalidate()
      toast.success("Đã lưu kết nối GHTK", {
        description: "Token được mã hóa an toàn trong cơ sở dữ liệu.",
      })
    },
  })

  const testGhtkMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ message: string }>(
        "/admin/shipping/carriers/ghtk/test",
        {
          body: {
            api_token: ghtkForm.api_token || undefined,
            environment: ghtkForm.environment,
          },
          method: "POST",
        }
      ),
    onError: (error: Error) =>
      toast.error("GHTK chưa kết nối được", { description: error.message }),
    onSuccess: (result) => {
      setGhtkForm((current) => ({ ...current, api_token: "" }))
      invalidate()
      toast.success("GHTK đã kết nối", { description: result.message })
    },
  })

  const syncGhnStatusMutation = useMutation({
    mutationFn: (fulfillmentId: string) =>
      sdk.client.fetch<{
        shipment: {
          changed: boolean
          status: string
          status_name?: string
          tracking_number: string
        }
      }>(`/admin/shipping/shipments/${fulfillmentId}/sync-status`, {
        method: "POST",
      }),
    onError: (error: Error) =>
      toast.error("Không thể đồng bộ trạng thái GHN", {
        description: error.message,
      }),
    onSuccess: ({ shipment }) => {
      queryClient.invalidateQueries({ queryKey: ["shipping-hub", "shipments"] })
      toast.success(`GHN: ${shipment.status_name || shipment.status}`, {
        description: `Mã vận đơn ${shipment.tracking_number}`,
      })
    },
  })

  useEffect(() => {
    const fulfillmentIds = pendingGhnFulfillmentIds
      ? pendingGhnFulfillmentIds.split(",")
      : []

    if (!fulfillmentIds.length) return

    let stopped = false
    const sync = async () => {
      try {
        await Promise.all(
          fulfillmentIds.map((fulfillmentId) =>
            sdk.client.fetch(
              `/admin/shipping/shipments/${fulfillmentId}/sync-status`,
              { method: "POST" }
            )
          )
        )
        if (!stopped) {
          queryClient.invalidateQueries({
            queryKey: ["shipping-hub", "shipments"],
          })
        }
      } catch {
        // A later polling cycle retries; the visible shipment data is retained.
      }
    }

    void sync()
    const interval = window.setInterval(() => void sync(), 60_000)
    return () => {
      stopped = true
      window.clearInterval(interval)
    }
  }, [pendingGhnFulfillmentIds, queryClient])

  const submitGhn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveGhnMutation.mutate()
  }

  const submitGhtk = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveGhtkMutation.mutate()
  }

  const isLoading = carriersQuery.isLoading || shipmentsQuery.isLoading

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center gap-x-2">
          <TruckIcon className="text-ui-fg-interactive" />
          <Heading level="h1">Trung tâm vận chuyển</Heading>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Container className="flex flex-col gap-y-3">
          <Text size="small" className="text-ui-fg-subtle">
            Hãng vận chuyển hoạt động
          </Text>
          <div className="flex items-center justify-between">
            <Heading level="h2">
              {carriersQuery.data?.carriers.filter(
                (carrier) => carrier.is_enabled
              ).length || 0}
            </Heading>
            <Badge color="green">Sẵn sàng</Badge>
          </div>
        </Container>
        <Container className="flex flex-col gap-y-3">
          <Text size="small" className="text-ui-fg-subtle">
            Vận đơn đã tạo
          </Text>
          <Heading level="h2">
            {shipmentsQuery.data?.shipments.length || 0}
          </Heading>
        </Container>
        <Container className="flex flex-col gap-y-3">
          <Text size="small" className="text-ui-fg-subtle">
            Cước tại checkout
          </Text>
          <div className="flex items-center gap-x-2">
            <CheckCircleIcon className="text-ui-fg-interactive" />
            <Heading level="h2">Tính theo carrier</Heading>
          </div>
        </Container>
      </div>

      <Container className="max-w-5xl p-0">
        <form
          className="flex flex-col gap-y-5 p-6"
          onSubmit={(event) => {
            event.preventDefault()
            savePackagingMutation.mutate()
          }}
        >
          <div className="border-b pb-5">
            <Heading level="h2">Đóng gói tự động</Heading>
          </div>
          <div className="flex flex-col gap-y-4">
            <Text size="small" weight="plus">Thiết lập kiện</Text>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["packaging-weight", "Trọng lượng hộp (g)", "packaging_weight"],
              ["packaging-max-items", "Tối đa SP / kiện", "max_items_per_package"],
              ["packaging-max-weight", "Tối đa trọng lượng / kiện (g)", "max_weight_per_package"],
            ].map(([id, label, field]) => (
              <div className="flex flex-col gap-y-2" key={id}>
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  inputMode="numeric"
                  min="0"
                  type="number"
                  value={packagingForm[field as keyof Omit<PackagingForm, "boxes">]}
                  onChange={(event) => setPackagingForm((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))}
                  required
                />
              </div>
            ))}
            </div>
          </div>
          <div className="flex flex-col gap-y-4 border-t pt-5">
            <div className="flex items-center justify-between gap-x-3">
              <Text size="small" weight="plus">Kích thước hộp</Text>
              <Button
                size="small"
                type="button"
                variant="secondary"
                onClick={() => setPackagingForm((current) => ({
                  ...current,
                  boxes: [
                    ...current.boxes,
                    {
                      code: `Hộp ${current.boxes.length + 1}`,
                      height: "10",
                      length: "20",
                      width: "15",
                    },
                  ],
                }))}
              >
                Thêm hộp
              </Button>
            </div>
            <div className="flex flex-col gap-y-3">
              {packagingForm.boxes.map((box, boxIndex) => (
                <div className="grid items-end gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]" key={`${box.code}-${boxIndex}`}>
                  <div className="flex flex-col gap-y-2">
                    <Label htmlFor={`box-name-${boxIndex}`}>Tên hộp</Label>
                    <Input id={`box-name-${boxIndex}`} value={box.code} onChange={(event) => setPackagingForm((current) => ({
                      ...current,
                      boxes: current.boxes.map((currentBox, index) => index === boxIndex ? { ...currentBox, code: event.target.value } : currentBox),
                    }))} required />
                  </div>
                  {([
                    ["length", "Dài"],
                    ["width", "Rộng"],
                    ["height", "Cao"],
                  ] as const).map(([dimension, label]) => (
                    <div className="flex flex-col gap-y-2" key={dimension}>
                      <Label htmlFor={`box-${dimension}-${boxIndex}`}>{label} (cm)</Label>
                      <Input
                        id={`box-${dimension}-${boxIndex}`}
                        inputMode="numeric"
                        min="1"
                        type="number"
                        value={box[dimension]}
                        onChange={(event) => setPackagingForm((current) => ({
                          ...current,
                          boxes: current.boxes.map((currentBox, index) => index === boxIndex ? { ...currentBox, [dimension]: event.target.value } : currentBox),
                        }))}
                        required
                      />
                    </div>
                  ))}
                  <Button
                    size="small"
                    type="button"
                    variant="secondary"
                    disabled={packagingForm.boxes.length === 1}
                    onClick={() => setPackagingForm((current) => ({
                      ...current,
                      boxes: current.boxes.filter((_, index) => index !== boxIndex),
                    }))}
                  >
                    Xóa
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end border-t pt-5">
            <Button type="submit" isLoading={savePackagingMutation.isPending}>
              Lưu quy tắc đóng gói
            </Button>
          </div>
        </form>
      </Container>

      <Container className="p-0">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <Heading level="h2">Danh sách vận đơn</Heading>
          </div>
          {shipmentsQuery.isFetching && (
            <SpinnerIcon className="animate-spin text-ui-fg-subtle" />
          )}
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center p-10">
            <SpinnerIcon className="animate-spin" />
          </div>
        ) : !shipmentsQuery.data?.shipments.length ? (
          <div className="p-6">
            <Text className="text-ui-fg-subtle">
              Chưa có fulfillment qua carrier. Khi xuất kho từ đơn hàng Medusa, vận đơn sẽ hiển thị tại đây.
            </Text>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-ui-fg-subtle">
                <tr>
                  <th className="px-6 py-3 font-medium">Đơn hàng</th>
                  <th className="px-6 py-3 font-medium">Carrier</th>
                  <th className="px-6 py-3 font-medium">Mã vận đơn</th>
                  <th className="px-6 py-3 font-medium">Dịch vụ</th>
                  <th className="px-6 py-3 font-medium">Trạng thái</th>
                  <th className="px-6 py-3 font-medium">Tạo lúc</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {shipmentsQuery.data.shipments.map((shipment) => (
                  <tr
                    key={shipment.fulfillment_id}
                    className="border-b last:border-0"
                  >
                    <td className="px-6 py-4">
                      {shipment.order_id ? (
                        <Button asChild size="small" variant="transparent">
                          <Link to={`/orders/${shipment.order_id}`}>
                            #{shipment.order_display_id || "—"}
                          </Link>
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Text size="small" weight="plus">
                        {shipment.carrier_name}
                      </Text>
                    </td>
                    <td className="px-6 py-4">
                      {shipment.tracking_number || "Đang tạo"}
                    </td>
                    <td className="px-6 py-4">{shipment.service}</td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        color={shipment.delivered_at ? "green" : "orange"}
                      >
                        {shipment.status}
                      </StatusBadge>
                    </td>
                    <td className="px-6 py-4">
                      {formatDate(shipment.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-x-2">
                        {shipment.carrier_code === "GHN" && (
                          <Button
                            size="small"
                            variant="transparent"
                            isLoading={syncGhnStatusMutation.isPending}
                            onClick={() =>
                              syncGhnStatusMutation.mutate(shipment.fulfillment_id)
                            }
                          >
                            Đồng bộ GHN
                          </Button>
                        )}
                        {shipment.environment === "production" &&
                        shipment.tracking_url ? (
                          <Button asChild size="small" variant="transparent">
                            <a
                              href={shipment.tracking_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Theo dõi
                            </a>
                          </Button>
                        ) : null}
                        {shipment.label_url && (
                          <Button asChild size="small" variant="transparent">
                            <a
                              href={shipment.label_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              In nhãn
                            </a>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Container>

      <Container className="max-w-4xl p-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <div className="flex items-center justify-between border-b px-6 py-3">
            <Tabs.List>
              <Tabs.Trigger value="GHN">
                Giao Hàng Nhanh (GHN)
              </Tabs.Trigger>
              <Tabs.Trigger value="GHTK">
                Giao Hàng Tiết Kiệm (GHTK)
              </Tabs.Trigger>
            </Tabs.List>
            <div>
              {activeTab === "GHN" ? (
                ghn?.is_enabled ? (
                  <StatusBadge color="green">Đang hoạt động</StatusBadge>
                ) : (
                  <StatusBadge color="grey">Chưa cấu hình</StatusBadge>
                )
              ) : ghtk?.is_enabled ? (
                <StatusBadge color="green">Đang hoạt động</StatusBadge>
              ) : (
                <StatusBadge color="grey">Chưa cấu hình</StatusBadge>
              )}
            </div>
          </div>

          <Tabs.Content value="GHN" className="p-6">
            <div className="mb-6 flex flex-col gap-y-1">
              <Heading level="h2">Cấu hình Giao Hàng Nhanh</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Kết nối API Token, Shop ID và thông tin địa chỉ kho gửi hàng.
              </Text>
            </div>
            <form className="flex flex-col gap-y-5" onSubmit={submitGhn}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghn-environment">Môi trường</Label>
                  <Select
                    value={ghnForm.environment}
                    onValueChange={(value) =>
                      setGhnForm((current) => ({
                        ...current,
                        environment: value as GhnForm["environment"],
                      }))
                    }
                  >
                    <Select.Trigger id="ghn-environment">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="sandbox">Sandbox</Select.Item>
                      <Select.Item value="production">Production</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghn-shop-id">Shop ID</Label>
                  <Input
                    id="ghn-shop-id"
                    inputMode="numeric"
                    value={ghnForm.shop_id}
                    onChange={(event) =>
                      setGhnForm((current) => ({
                        ...current,
                        shop_id: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="ghn-token">API Token GHN</Label>
                <Input
                  id="ghn-token"
                  type="password"
                  value={ghnForm.api_token}
                  placeholder={
                    ghn?.secret_hint
                      ? `Đã lưu: ${ghn.secret_hint}. Chỉ nhập khi muốn đổi token.`
                      : "Nhập API Token GHN cấp"
                  }
                  onChange={(event) =>
                    setGhnForm((current) => ({
                      ...current,
                      api_token: event.target.value,
                    }))
                  }
                />
                <Text size="small" className="text-ui-fg-subtle">
                  Token được mã hóa an toàn bằng AES-256-GCM trong Shipping Hub.
                </Text>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghn-sender-name">Tên người gửi / Shop</Label>
                  <Input
                    id="ghn-sender-name"
                    value={ghnForm.sender_name}
                    onChange={(event) =>
                      setGhnForm((current) => ({
                        ...current,
                        sender_name: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghn-sender-phone">Số điện thoại gửi</Label>
                  <Input
                    id="ghn-sender-phone"
                    value={ghnForm.sender_phone}
                    onChange={(event) =>
                      setGhnForm((current) => ({
                        ...current,
                        sender_phone: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="ghn-sender-address">Địa chỉ kho gửi hàng</Label>
                <Input
                  id="ghn-sender-address"
                  value={ghnForm.sender_address}
                  onChange={(event) =>
                    setGhnForm((current) => ({
                      ...current,
                      sender_address: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <Text size="small" className="text-ui-fg-subtle">
                  {ghn?.last_verified_at
                    ? `Xác thực gần nhất: ${formatDate(ghn.last_verified_at)}`
                    : "Chưa xác thực kết nối"}
                </Text>
                <div className="flex gap-x-2">
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={testGhnMutation.isPending}
                    onClick={() => testGhnMutation.mutate()}
                  >
                    <GlobeIcon />
                    Kiểm tra kết nối
                  </Button>
                  <Button type="submit" isLoading={saveGhnMutation.isPending}>
                    Lưu cấu hình GHN
                  </Button>
                </div>
              </div>
            </form>
          </Tabs.Content>

          <Tabs.Content value="GHTK" className="p-6">
            <div className="mb-6 flex flex-col gap-y-1">
              <Heading level="h2">Cấu hình Giao Hàng Tiết Kiệm</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Kết nối API Token, Pick Address ID và thông tin kho lấy hàng của GHTK.
              </Text>
            </div>
            <form className="flex flex-col gap-y-5" onSubmit={submitGhtk}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghtk-environment">Môi trường</Label>
                  <Select
                    value={ghtkForm.environment}
                    onValueChange={(value) =>
                      setGhtkForm((current) => ({
                        ...current,
                        environment: value as GhtkForm["environment"],
                      }))
                    }
                  >
                    <Select.Trigger id="ghtk-environment">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="sandbox">
                        Sandbox (dev.ghtk.vn)
                      </Select.Item>
                      <Select.Item value="production">
                        Production (services.giaohangtietkiem.vn)
                      </Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghtk-pick-id">Pick Address ID (Mã điểm lấy hàng)</Label>
                  <Input
                    id="ghtk-pick-id"
                    value={ghtkForm.pick_address_id}
                    placeholder="Tùy chọn (để trống nếu dùng địa chỉ mặc định)"
                    onChange={(event) =>
                      setGhtkForm((current) => ({
                        ...current,
                        pick_address_id: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="ghtk-token">API Token GHTK</Label>
                <Input
                  id="ghtk-token"
                  type="password"
                  value={ghtkForm.api_token}
                  placeholder={
                    ghtk?.secret_hint
                      ? `Đã lưu: ${ghtk.secret_hint}. Chỉ nhập khi muốn đổi token.`
                      : "Nhập API Token do GHTK cấp"
                  }
                  onChange={(event) =>
                    setGhtkForm((current) => ({
                      ...current,
                      api_token: event.target.value,
                    }))
                  }
                />
                <Text size="small" className="text-ui-fg-subtle">
                  Token được mã hóa an toàn bằng AES-256-GCM trong Shipping Hub.
                </Text>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghtk-sender-name">Tên người gửi / Shop</Label>
                  <Input
                    id="ghtk-sender-name"
                    value={ghtkForm.sender_name}
                    onChange={(event) =>
                      setGhtkForm((current) => ({
                        ...current,
                        sender_name: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghtk-sender-phone">Số điện thoại gửi</Label>
                  <Input
                    id="ghtk-sender-phone"
                    value={ghtkForm.sender_phone}
                    onChange={(event) =>
                      setGhtkForm((current) => ({
                        ...current,
                        sender_phone: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghtk-province">Tỉnh / Thành phố kho</Label>
                  <Input
                    id="ghtk-province"
                    value={ghtkForm.sender_province}
                    onChange={(event) =>
                      setGhtkForm((current) => ({
                        ...current,
                        sender_province: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghtk-district">Quận / Huyện kho</Label>
                  <Input
                    id="ghtk-district"
                    value={ghtkForm.sender_district}
                    onChange={(event) =>
                      setGhtkForm((current) => ({
                        ...current,
                        sender_district: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="ghtk-ward">Phường / Xã kho</Label>
                  <Input
                    id="ghtk-ward"
                    value={ghtkForm.sender_ward}
                    onChange={(event) =>
                      setGhtkForm((current) => ({
                        ...current,
                        sender_ward: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="ghtk-sender-address">Địa chỉ chi tiết kho gửi</Label>
                <Input
                  id="ghtk-sender-address"
                  value={ghtkForm.sender_address}
                  onChange={(event) =>
                    setGhtkForm((current) => ({
                      ...current,
                      sender_address: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <Text size="small" className="text-ui-fg-subtle">
                  {ghtk?.last_verified_at
                    ? `Xác thực gần nhất: ${formatDate(ghtk.last_verified_at)}`
                    : "Chưa xác thực kết nối"}
                </Text>
                <div className="flex gap-x-2">
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={testGhtkMutation.isPending}
                    onClick={() => testGhtkMutation.mutate()}
                  >
                    <GlobeIcon />
                    Kiểm tra kết nối GHTK
                  </Button>
                  <Button type="submit" isLoading={saveGhtkMutation.isPending}>
                    Lưu cấu hình GHTK
                  </Button>
                </div>
              </div>
            </form>
          </Tabs.Content>
        </Tabs>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  icon: TruckIcon,
  label: "Vận chuyển",
})

export default ShippingHubPage
