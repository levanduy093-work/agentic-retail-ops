import { defineRouteConfig } from "@medusajs/admin-sdk";
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
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  CheckCircleIcon,
  GlobeIcon,
  InfoIcon,
  SpinnerIcon,
  TruckIcon,
} from "../../lib/icons";
import { sdk } from "../../lib/sdk";

type Carrier = {
  code: string;
  environment: "sandbox" | "production";
  has_token: boolean;
  is_enabled: boolean;
  last_verification?: {
    latency_ms?: number;
    message?: string;
    pick_addresses_count?: number;
    provinces_count?: number;
  } | null;
  last_verified_at?: string | null;
  name: string;
  provider_id: string;
  secret_hint?: string | null;
  settings: {
    sender_address?: string;
    sender_name?: string;
    sender_phone?: string;
    shop_id?: number;
  };
  updated_at?: string;
};

type Shipment = {
  carrier_code: string;
  carrier_name: string;
  created_at: string;
  delivered_at?: string | null;
  environment?: "sandbox" | "production";
  fulfillment_id: string;
  label_url?: string | null;
  order_display_id?: number | null;
  order_id?: string | null;
  service: string;
  shipped_at?: string | null;
  status: string;
  tracking_number?: string | null;
  tracking_url?: string | null;
};

type GhnForm = {
  api_token: string;
  environment: "sandbox" | "production";
  sender_address: string;
  sender_name: string;
  sender_phone: string;
  shop_id: string;
};

type PackagingStrategy = "hybrid_auto" | "pe_only" | "carton_only";

type PackagingBoxForm = {
  code: string;
  height: string;
  length: string;
  max_items: string;
  name: string;
  width: string;
};

type PackagingBagForm = {
  code: string;
  length: string;
  max_items: string;
  max_thickness: string;
  name: string;
  width: string;
};

type PackagingForm = {
  bag_packaging_weight: string;
  bags: PackagingBagForm[];
  boxes: PackagingBoxForm[];
  max_items_per_package: string;
  max_weight_per_package: string;
  packaging_weight: string;
  strategy: PackagingStrategy;
};

const emptyGhnForm: GhnForm = {
  api_token: "",
  environment: "sandbox",
  sender_address: "",
  sender_name: "",
  sender_phone: "",
  shop_id: "",
};

const defaultPackagingForm: PackagingForm = {
  strategy: "hybrid_auto",
  packaging_weight: "80",
  bag_packaging_weight: "10",
  max_items_per_package: "5",
  max_weight_per_package: "3000",
  bags: [
    {
      code: "PE-17x30",
      name: "Túi PE 17x30cm (1 áo thun / phụ kiện nhỏ)",
      length: "30",
      width: "17",
      max_thickness: "4",
      max_items: "1",
    },
    {
      code: "PE-25x35",
      name: "Túi PE 25x35cm (1-2 áo sơ mi / quần jean)",
      length: "35",
      width: "25",
      max_thickness: "5",
      max_items: "2",
    },
    {
      code: "PE-28x42",
      name: "Túi PE 28x42cm (2-3 áo / set đồ ngủ)",
      length: "42",
      width: "28",
      max_thickness: "6",
      max_items: "3",
    },
    {
      code: "PE-32x45",
      name: "Túi PE 32x45cm (Áo khoác / Váy dày / Giày mềm)",
      length: "45",
      width: "32",
      max_thickness: "7",
      max_items: "5",
    },
    {
      code: "PE-38x52",
      name: "Túi PE 38x52cm (Combo lớn / Áo phao / Balo)",
      length: "52",
      width: "38",
      max_thickness: "8",
      max_items: "8",
    },
  ],
  boxes: [
    {
      code: "S",
      name: "Hộp Carton S (25x18x8cm - Hàng nhỏ, mỹ phẩm)",
      length: "25",
      width: "18",
      height: "8",
      max_items: "2",
    },
    {
      code: "M",
      name: "Hộp Carton M (35x25x12cm - Hàng vừa, phụ kiện)",
      length: "35",
      width: "25",
      height: "12",
      max_items: "4",
    },
    {
      code: "L",
      name: "Hộp Carton L (45x35x18cm - Hàng lớn, giày hộp)",
      length: "45",
      width: "35",
      height: "18",
      max_items: "6",
    },
    {
      code: "XL",
      name: "Hộp Carton XL (55x40x25cm - Combo nhiều món)",
      length: "55",
      width: "40",
      height: "25",
      max_items: "10",
    },
  ],
};

function toGhnForm(carrier?: Carrier): GhnForm {
  if (!carrier) return emptyGhnForm;

  return {
    api_token: "",
    environment: carrier.environment,
    sender_address: carrier.settings.sender_address || "",
    sender_name: carrier.settings.sender_name || "",
    sender_phone: carrier.settings.sender_phone || "",
    shop_id: carrier.settings.shop_id ? String(carrier.settings.shop_id) : "",
  };
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const shipmentStatusLabels: Record<string, string> = {
  cancel: "cancelled",
  created: "created",
  damage: "damaged",
  delivered: "delivered",
  delivering: "delivering",
  delivery_fail: "deliveryFailed",
  exception: "exception",
  lost: "lost",
  money_collect_delivering: "delivering",
  money_collect_picking: "picking",
  picked: "pickedUp",
  picking: "picking",
  ready_to_pick: "readyToPick",
  return: "returning",
  return_fail: "returnFailed",
  return_sorting: "returnSorting",
  return_transporting: "returnTransporting",
  returned: "returned",
  returning: "returning",
  shipping: "shipping",
  sorting: "sorting",
  storing: "sorting",
  transporting: "shipping",
  waiting_to_return: "waitingToReturn",
};

function formatShipmentStatus(status: string, t: (key: string) => string) {
  const key = shipmentStatusLabels[status.toLowerCase()];

  return key
    ? t(`shippingHub.shipments.statusLabels.${key}`)
    : t("shippingHub.shipments.statusLabels.updating");
}

function shipmentStatusColor(status: string, deliveredAt?: string | null) {
  if (deliveredAt || status.toLowerCase() === "delivered") return "green";

  if (["cancel", "delivery_fail", "exception", "lost", "damage"].includes(status.toLowerCase())) {
    return "red";
  }

  if (["return", "returning", "returned", "waiting_to_return"].includes(status.toLowerCase())) {
    return "purple";
  }

  return "orange";
}

function formatShipmentService(service: string, t: (key: string) => string) {
  if (service === "ghn-standard") {
    return t("shippingHub.shipments.services.ghnStandard");
  }

  if (service === "ghn-fast") {
    return t("shippingHub.shipments.services.ghnFast");
  }

  return service;
}

const LoadError = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-ui-border-error bg-ui-bg-base px-5 py-5">
      <Text className="text-ui-fg-error" size="small">
        {t("shippingHub.loadError")}
      </Text>
      <Button onClick={onRetry} size="small" variant="secondary">
        {t("shippingHub.retry")}
      </Button>
    </div>
  );
};

const ShippingHubPage = () => {
  const { i18n, t } = useTranslation();
  const tr = (key: string, fallback: string) => {
    const val = t(key);
    return val && val !== key ? val : fallback;
  };
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<string>("shipments");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ghnForm, setGhnForm] = useState<GhnForm>(emptyGhnForm);
  const [packagingForm, setPackagingForm] =
    useState<PackagingForm>(defaultPackagingForm);

  const carriersQuery = useQuery({
    queryKey: ["shipping-hub", "carriers"],
    queryFn: () =>
      sdk.client.fetch<{ carriers: Carrier[] }>("/admin/shipping/carriers"),
  });

  const shipmentsQuery = useQuery({
    queryKey: ["shipping-hub", "shipments"],
    queryFn: () =>
      sdk.client.fetch<{ shipments: Shipment[] }>("/admin/shipping/shipments"),
  });

  const packagingProfileQuery = useQuery({
    queryKey: ["shipping-hub", "packaging-profile"],
    queryFn: () =>
      sdk.client.fetch<{
        profile: {
          bag_packaging_weight?: number;
          bags?: Array<{
            code: string;
            length: number;
            max_items?: number;
            max_thickness?: number;
            name?: string;
            width: number;
          }>;
          boxes: Array<{
            code: string;
            height: number;
            length: number;
            max_items?: number;
            name?: string;
            width: number;
          }>;
          max_items_per_package: number;
          max_weight_per_package: number;
          packaging_weight: number;
          strategy?: PackagingStrategy;
        };
      }>("/admin/shipping/packaging-profile"),
  });

  const pendingGhnFulfillmentIds =
    shipmentsQuery.data?.shipments
      .filter(
        (shipment) =>
          shipment.carrier_code === "GHN" &&
          Boolean(shipment.tracking_number) &&
          !["cancel", "delivered", "return"].includes(
            shipment.status.toLowerCase(),
          ),
      )
      .map((shipment) => shipment.fulfillment_id)
      .join(",") || "";

  const ghn = carriersQuery.data?.carriers.find(
    (carrier) => carrier.code === "GHN",
  );
  const carrierLoadFailed = carriersQuery.isError && !carriersQuery.data;
  const packagingLoadFailed =
    packagingProfileQuery.isError && !packagingProfileQuery.data;
  const shipmentsLoadFailed = shipmentsQuery.isError && !shipmentsQuery.data;

  useEffect(() => {
    setGhnForm(toGhnForm(ghn));
  }, [ghn?.updated_at]);

  useEffect(() => {
    const profile = packagingProfileQuery.data?.profile;
    if (!profile) return;

    setPackagingForm({
      strategy: profile.strategy || "hybrid_auto",
      packaging_weight: String(profile.packaging_weight ?? 80),
      bag_packaging_weight: String(profile.bag_packaging_weight ?? 10),
      max_items_per_package: String(profile.max_items_per_package ?? 5),
      max_weight_per_package: String(profile.max_weight_per_package ?? 3000),
      bags: (profile.bags && profile.bags.length > 0
        ? profile.bags
        : defaultPackagingForm.bags
      ).map((bag) => ({
        code: bag.code,
        name: bag.name || "",
        length: String(bag.length),
        width: String(bag.width),
        max_thickness: String(bag.max_thickness || 5),
        max_items: bag.max_items ? String(bag.max_items) : "",
      })),
      boxes: (profile.boxes && profile.boxes.length > 0
        ? profile.boxes
        : defaultPackagingForm.boxes
      ).map((box) => ({
        code: box.code,
        name: box.name || "",
        height: String(box.height),
        length: String(box.length),
        width: String(box.width),
        max_items: box.max_items ? String(box.max_items) : "",
      })),
    });
  }, [packagingProfileQuery.data?.profile]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["shipping-hub", "carriers"] });
    queryClient.invalidateQueries({ queryKey: ["shipping-hub", "shipments"] });
    queryClient.invalidateQueries({
      queryKey: ["shipping-hub", "packaging-profile"],
    });
  };

  const savePackagingMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch("/admin/shipping/packaging-profile", {
        method: "POST",
        body: {
          strategy: packagingForm.strategy,
          packaging_weight: Number(packagingForm.packaging_weight),
          bag_packaging_weight: Number(packagingForm.bag_packaging_weight),
          max_items_per_package: Number(packagingForm.max_items_per_package),
          max_weight_per_package: Number(packagingForm.max_weight_per_package),
          bags: packagingForm.bags.map((bag) => ({
            code: bag.code,
            name: bag.name.trim() || undefined,
            length: Number(bag.length),
            width: Number(bag.width),
            max_thickness: Number(bag.max_thickness || 5),
            max_items: bag.max_items ? Number(bag.max_items) : undefined,
          })),
          boxes: packagingForm.boxes.map((box) => ({
            code: box.code,
            name: box.name.trim() || undefined,
            height: Number(box.height),
            length: Number(box.length),
            width: Number(box.width),
            max_items: box.max_items ? Number(box.max_items) : undefined,
          })),
        },
      }),
    onError: (error: Error) =>
      toast.error(t("shippingHub.packaging.saveError"), {
        description: error.message,
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t("shippingHub.packaging.saved"), {
        description: t("shippingHub.packaging.savedDescription"),
      });
    },
  });

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
      toast.error(t("shippingHub.ghn.saveError"), {
        description: error.message,
      }),
    onSuccess: () => {
      setGhnForm((current) => ({ ...current, api_token: "" }));
      invalidate();
      toast.success(t("shippingHub.ghn.saved"), {
        description: t("shippingHub.ghn.savedDescription"),
      });
    },
  });

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
        },
      ),
    onError: (error: Error) =>
      toast.error(t("shippingHub.ghn.testError"), {
        description: error.message,
      }),
    onSuccess: (result) => {
      setGhnForm((current) => ({ ...current, api_token: "" }));
      invalidate();
      toast.success(t("shippingHub.ghn.testSuccess"), {
        description: result.message,
      });
    },
  });

  const syncGhnStatusMutation = useMutation({
    mutationFn: (fulfillmentId: string) =>
      sdk.client.fetch<{
        shipment: {
          changed: boolean;
          status: string;
          status_name?: string;
          tracking_number: string;
        };
      }>(`/admin/shipping/shipments/${fulfillmentId}/sync-status`, {
        method: "POST",
      }),
    onError: (error: Error) =>
      toast.error(t("shippingHub.shipments.syncError"), {
        description: error.message,
      }),
    onSuccess: ({ shipment }) => {
      queryClient.invalidateQueries({
        queryKey: ["shipping-hub", "shipments"],
      });
      toast.success(`GHN: ${formatShipmentStatus(shipment.status, t)}`, {
        description: `${t("shippingHub.shipments.trackingNumber")}: ${shipment.tracking_number}`,
      });
    },
  });

  useEffect(() => {
    const fulfillmentIds = pendingGhnFulfillmentIds
      ? pendingGhnFulfillmentIds.split(",")
      : [];

    if (!fulfillmentIds.length) return;

    let stopped = false;
    const sync = async () => {
      try {
        await Promise.all(
          fulfillmentIds.map((fulfillmentId) =>
            sdk.client.fetch(
              `/admin/shipping/shipments/${fulfillmentId}/sync-status`,
              { method: "POST" },
            ),
          ),
        );
        if (!stopped) {
          queryClient.invalidateQueries({
            queryKey: ["shipping-hub", "shipments"],
          });
        }
      } catch {
        // A later polling cycle retries; the visible shipment data is retained.
      }
    };

    void sync();
    const interval = window.setInterval(() => void sync(), 60_000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [pendingGhnFulfillmentIds, queryClient]);

  const submitGhn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveGhnMutation.mutate();
  };

  const filteredShipments = useMemo(() => {
    const all = shipmentsQuery.data?.shipments || [];
    return all.filter((shipment) => {
      const matchesSearch =
        !searchQuery.trim() ||
        String(shipment.order_display_id || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        String(shipment.tracking_number || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        shipment.carrier_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        shipment.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [shipmentsQuery.data?.shipments, searchQuery, statusFilter]);

  const isLoading = carriersQuery.isLoading || shipmentsQuery.isLoading;

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-1">
        <div className="flex items-center gap-x-2">
          <TruckIcon className="text-ui-fg-interactive" />
          <Heading level="h1">{t("shippingHub.title")}</Heading>
        </div>
      </div>

      <Tabs
        value={mainTab}
        onValueChange={setMainTab}
        className="w-full flex flex-col gap-y-6"
      >
        <div className="border-b">
          <Tabs.List className="w-full">
            <Tabs.Trigger value="shipments">
              {t("shippingHub.tabs.shipments")}
            </Tabs.Trigger>
            <Tabs.Trigger value="packaging">
              {t("shippingHub.tabs.packaging")}
            </Tabs.Trigger>
            <Tabs.Trigger value="carriers">
              {t("shippingHub.tabs.carriers")}
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        {/* TAB 1: VẬN ĐƠN & TỔNG QUAN (SHIPMENTS & OVERVIEW) */}
        <Tabs.Content value="shipments" className="flex flex-col gap-y-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <Container className="flex flex-col gap-y-3">
              <Text size="small" className="text-ui-fg-subtle">
                {t("shippingHub.activeCarriers")}
              </Text>
              <div className="flex items-center justify-between">
                <Heading level="h2">
                  {carriersQuery.data?.carriers.filter(
                    (carrier) => carrier.is_enabled,
                  ).length || 0}
                </Heading>
                <Badge color="green">{t("shippingHub.ready")}</Badge>
              </div>
            </Container>
            <Container className="flex flex-col gap-y-3">
              <Text size="small" className="text-ui-fg-subtle">
                {t("shippingHub.shipmentsCreated")}
              </Text>
              <Heading level="h2">
                {shipmentsQuery.data?.shipments.length || 0}
              </Heading>
            </Container>
            <Container className="flex flex-col gap-y-3">
              <Text size="small" className="text-ui-fg-subtle">
                {t("shippingHub.checkoutRate")}
              </Text>
              <div className="flex items-center gap-x-2">
                <CheckCircleIcon className="text-ui-fg-interactive" />
                <Heading level="h2">
                  {t("shippingHub.calculatedByCarrier")}
                </Heading>
              </div>
            </Container>
          </div>

          <Container className="p-0">
            <div className="flex flex-col gap-y-4 border-b px-6 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Heading level="h2">{t("shippingHub.shipments.title")}</Heading>
                <Text size="small" className="text-ui-fg-subtle">
                  {t("shippingHub.shipments.subtitle")}
                </Text>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  className="w-64"
                  size="small"
                  placeholder={t("shippingHub.shipments.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                  size="small"
                >
                  <Select.Trigger className="w-44">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="all">
                      {t("shippingHub.shipments.filterAll")}
                    </Select.Item>
                    <Select.Item value="ready_to_pick">
                      {t("shippingHub.shipments.statusLabels.readyToPick")}
                    </Select.Item>
                    <Select.Item value="picking">
                      {t("shippingHub.shipments.statusLabels.picking")}
                    </Select.Item>
                    <Select.Item value="delivering">
                      {t("shippingHub.shipments.statusLabels.delivering")}
                    </Select.Item>
                    <Select.Item value="delivered">
                      {t("shippingHub.shipments.statusLabels.delivered")}
                    </Select.Item>
                    <Select.Item value="cancel">
                      {t("shippingHub.shipments.statusLabels.cancelled")}
                    </Select.Item>
                    <Select.Item value="return">
                      {t("shippingHub.shipments.statusLabels.returned")}
                    </Select.Item>
                  </Select.Content>
                </Select>
                {shipmentsQuery.isFetching && (
                  <SpinnerIcon className="animate-spin text-ui-fg-subtle" />
                )}
              </div>
            </div>

            {shipmentsLoadFailed ? (
              <div className="p-6">
                <LoadError onRetry={() => void shipmentsQuery.refetch()} />
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center p-10">
                <SpinnerIcon className="animate-spin" />
              </div>
            ) : !filteredShipments.length ? (
              <div className="p-6 text-center">
                <Text className="text-ui-fg-subtle">
                  {t("shippingHub.shipments.empty")}
                </Text>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-ui-fg-subtle">
                    <tr>
                      <th className="px-6 py-3 font-medium">
                        {t("shippingHub.shipments.order")}
                      </th>
                      <th className="px-6 py-3 font-medium">Carrier</th>
                      <th className="px-6 py-3 font-medium">
                        {t("shippingHub.shipments.trackingNumber")}
                      </th>
                      <th className="px-6 py-3 font-medium">
                        {t("shippingHub.shipments.service")}
                      </th>
                      <th className="px-6 py-3 font-medium">
                        {t("shippingHub.shipments.status")}
                      </th>
                      <th className="px-6 py-3 font-medium">
                        {t("shippingHub.shipments.createdAt")}
                      </th>
                      <th className="px-6 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShipments.map((shipment) => (
                      <tr
                        key={shipment.fulfillment_id}
                        className="border-b last:border-0 hover:bg-ui-bg-subtle-hover transition-colors"
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
                          {shipment.tracking_number ? (
                            <code className="rounded bg-ui-bg-subtle px-2 py-0.5 text-xs font-mono">
                              {shipment.tracking_number}
                            </code>
                          ) : (
                            <Text size="small" className="text-ui-fg-subtle">
                              {t("shippingHub.shipments.creating")}
                            </Text>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {formatShipmentService(shipment.service, t)}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge
                            color={shipmentStatusColor(
                              shipment.status,
                              shipment.delivered_at,
                            )}
                          >
                            {formatShipmentStatus(shipment.status, t)}
                          </StatusBadge>
                        </td>
                        <td className="px-6 py-4">
                          {formatDate(
                            shipment.created_at,
                            i18n.resolvedLanguage || i18n.language,
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-x-2">
                            {shipment.carrier_code === "GHN" && (
                              <Button
                                size="small"
                                variant="transparent"
                                isLoading={syncGhnStatusMutation.isPending}
                                onClick={() =>
                                  syncGhnStatusMutation.mutate(
                                    shipment.fulfillment_id,
                                  )
                                }
                              >
                                {t("shippingHub.shipments.syncGhn")}
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
                                  {t("shippingHub.shipments.track")}
                                </a>
                              </Button>
                            ) : null}
                            {shipment.carrier_code === "GHN" &&
                            shipment.tracking_number ? (
                              <Button asChild size="small" variant="transparent">
                                <a
                                  href={`/admin/shipping/shipments/${shipment.fulfillment_id}/label`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {t("shippingHub.shipments.printLabel")}
                                </a>
                              </Button>
                            ) : shipment.label_url ? (
                              <Button asChild size="small" variant="transparent">
                                <a
                                  href={shipment.label_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {t("shippingHub.shipments.printLabel")}
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Container>
        </Tabs.Content>

        {/* TAB 2: CẤU HÌNH ĐÓNG GÓI (PACKAGING CONFIGURATION) */}
        <Tabs.Content value="packaging" className="flex flex-col gap-y-6">
          <Container className="p-0">
            {packagingLoadFailed ? (
              <div className="p-6">
                <LoadError
                  onRetry={() => void packagingProfileQuery.refetch()}
                />
              </div>
            ) : (
              <form
                className="flex flex-col gap-y-6 p-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  savePackagingMutation.mutate();
                }}
              >
                <div className="border-b pb-5">
                  <Heading level="h2">{t("shippingHub.packaging.title")}</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    {t("shippingHub.packaging.subtitle")}
                  </Text>
                </div>

                {/* TIP / KINH NGHIỆM TỐI ƯU CHI PHÍ */}
                <div className="flex items-start gap-3 rounded-lg border border-ui-border-interactive bg-ui-bg-subtle p-4">
                  <InfoIcon className="mt-0.5 text-ui-fg-interactive shrink-0" />
                  <div className="flex flex-col gap-y-1">
                    <Text size="small" weight="plus">
                      {t("shippingHub.packaging.peBagsTitle")}
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {t("shippingHub.packaging.peBagsDescription")}
                    </Text>
                  </div>
                </div>

                {/* 1. CHIẾN LƯỢC ĐÓNG GÓI */}
                <div className="flex flex-col gap-y-3">
                  <div>
                    <Text size="small" weight="plus">
                      {t("shippingHub.packaging.strategyTitle")}
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {t("shippingHub.packaging.strategyDescription")}
                    </Text>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      {
                        value: "hybrid_auto",
                        title: t("shippingHub.packaging.strategyHybridAuto"),
                        recommended: true,
                      },
                      {
                        value: "pe_only",
                        title: t("shippingHub.packaging.strategyPeOnly"),
                        recommended: false,
                      },
                      {
                        value: "carton_only",
                        title: t("shippingHub.packaging.strategyCartonOnly"),
                        recommended: false,
                      },
                    ].map((strategyOption) => (
                      <div
                        key={strategyOption.value}
                        onClick={() =>
                          setPackagingForm((current) => ({
                            ...current,
                            strategy: strategyOption.value as PackagingStrategy,
                          }))
                        }
                        className={`flex cursor-pointer flex-col justify-between gap-y-2 rounded-lg border p-4 transition-all ${
                          packagingForm.strategy === strategyOption.value
                            ? "border-ui-border-interactive bg-ui-bg-subtle ring-1 ring-ui-border-interactive"
                            : "hover:bg-ui-bg-subtle-hover"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-x-2">
                            <input
                              type="radio"
                              name="packaging_strategy"
                              checked={
                                packagingForm.strategy === strategyOption.value
                              }
                              onChange={() =>
                                setPackagingForm((current) => ({
                                  ...current,
                                  strategy:
                                    strategyOption.value as PackagingStrategy,
                                }))
                              }
                              className="accent-ui-fg-interactive"
                            />
                            <Text size="small" weight="plus">
                              {strategyOption.value === "hybrid_auto"
                                ? tr("shippingHub.packaging.autoOptimized", "Tự động tối ưu")
                                : strategyOption.value === "pe_only"
                                  ? tr("shippingHub.packaging.peBagOnly", "Túi PE Only")
                                  : tr("shippingHub.packaging.cartonOnly", "Hộp Carton Only")}
                            </Text>
                          </div>
                          {strategyOption.recommended && (
                            <Badge color="blue" size="small">
                              {tr("shippingHub.packaging.recommended", "Khuyên dùng")}
                            </Badge>
                          )}
                        </div>
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {strategyOption.title}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. THIẾT LẬP GIỚI HẠN KIỆN & TRỌNG LƯỢNG BÌ */}
                <div className="flex flex-col gap-y-4 border-t pt-5">
                  <Text size="small" weight="plus">
                    {t("shippingHub.packaging.packageSettings")}
                  </Text>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="flex flex-col gap-y-2">
                      <Label htmlFor="bag-packaging-weight">
                        {t("shippingHub.packaging.bagWeight")}
                      </Label>
                      <Input
                        id="bag-packaging-weight"
                        inputMode="numeric"
                        min="0"
                        type="number"
                        value={packagingForm.bag_packaging_weight}
                        onChange={(e) =>
                          setPackagingForm((curr) => ({
                            ...curr,
                            bag_packaging_weight: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-y-2">
                      <Label htmlFor="box-packaging-weight">
                        {t("shippingHub.packaging.weight")}
                      </Label>
                      <Input
                        id="box-packaging-weight"
                        inputMode="numeric"
                        min="0"
                        type="number"
                        value={packagingForm.packaging_weight}
                        onChange={(e) =>
                          setPackagingForm((curr) => ({
                            ...curr,
                            packaging_weight: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-y-2">
                      <Label htmlFor="packaging-max-items">
                        {t("shippingHub.packaging.maxItems")}
                      </Label>
                      <Input
                        id="packaging-max-items"
                        inputMode="numeric"
                        min="1"
                        type="number"
                        value={packagingForm.max_items_per_package}
                        onChange={(e) =>
                          setPackagingForm((curr) => ({
                            ...curr,
                            max_items_per_package: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-y-2">
                      <Label htmlFor="packaging-max-weight">
                        {t("shippingHub.packaging.maxWeight")}
                      </Label>
                      <Input
                        id="packaging-max-weight"
                        inputMode="numeric"
                        min="100"
                        type="number"
                        value={packagingForm.max_weight_per_package}
                        onChange={(e) =>
                          setPackagingForm((curr) => ({
                            ...curr,
                            max_weight_per_package: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 3. QUY CHUẨN TÚI NIÊM PHONG PE */}
                <div className="flex flex-col gap-y-4 border-t pt-5">
                  <div className="flex items-center justify-between gap-x-3">
                    <div>
                      <Text size="small" weight="plus">
                        {t("shippingHub.packaging.peBagsTitle")}
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle">
                        {t("shippingHub.packaging.peBagsDescription")}
                      </Text>
                    </div>
                    <Button
                      size="small"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setPackagingForm((current) => ({
                          ...current,
                          bags: [
                            ...current.bags,
                            {
                              code: `PE-Custom-${current.bags.length + 1}`,
                              name: "",
                              length: "35",
                              width: "25",
                              max_thickness: "5",
                              max_items: "2",
                            },
                          ],
                        }))
                      }
                    >
                      {t("shippingHub.packaging.addBag")}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-y-3">
                    {packagingForm.bags.map((bag, bagIndex) => (
                      <div
                        className="grid items-end gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_repeat(4,minmax(0,0.8fr))_auto]"
                        key={`bag-${bagIndex}`}
                      >
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`bag-code-${bagIndex}`}>
                            {t("shippingHub.packaging.peBagLabel")}
                          </Label>
                          <Input
                            id={`bag-code-${bagIndex}`}
                            value={bag.code}
                            placeholder="PE-25x35"
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                bags: current.bags.map((curBag, idx) =>
                                  idx === bagIndex
                                    ? { ...curBag, code: e.target.value }
                                    : curBag,
                                ),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`bag-name-${bagIndex}`}>
                            {t("shippingHub.packaging.peBagName")}
                          </Label>
                          <Input
                            id={`bag-name-${bagIndex}`}
                            value={bag.name}
                            placeholder={tr("shippingHub.packaging.suggestPe", "Gợi ý: 1-2 áo sơ mi / quần jean...")}
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                bags: current.bags.map((curBag, idx) =>
                                  idx === bagIndex
                                    ? { ...curBag, name: e.target.value }
                                    : curBag,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`bag-length-${bagIndex}`}>
                            {t("shippingHub.packaging.length")} (cm)
                          </Label>
                          <Input
                            id={`bag-length-${bagIndex}`}
                            type="number"
                            min="1"
                            value={bag.length}
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                bags: current.bags.map((curBag, idx) =>
                                  idx === bagIndex
                                    ? { ...curBag, length: e.target.value }
                                    : curBag,
                                ),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`bag-width-${bagIndex}`}>
                            {t("shippingHub.packaging.width")} (cm)
                          </Label>
                          <Input
                            id={`bag-width-${bagIndex}`}
                            type="number"
                            min="1"
                            value={bag.width}
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                bags: current.bags.map((curBag, idx) =>
                                  idx === bagIndex
                                    ? { ...curBag, width: e.target.value }
                                    : curBag,
                                ),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`bag-thick-${bagIndex}`}>
                            {t("shippingHub.packaging.peBagThickness")} (cm)
                          </Label>
                          <Input
                            id={`bag-thick-${bagIndex}`}
                            type="number"
                            min="1"
                            value={bag.max_thickness}
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                bags: current.bags.map((curBag, idx) =>
                                  idx === bagIndex
                                    ? { ...curBag, max_thickness: e.target.value }
                                    : curBag,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`bag-maxitems-${bagIndex}`}>
                            {t("shippingHub.packaging.peBagMaxItems")}
                          </Label>
                          <Input
                            id={`bag-maxitems-${bagIndex}`}
                            type="number"
                            min="1"
                            value={bag.max_items}
                            placeholder="Mặc định"
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                bags: current.bags.map((curBag, idx) =>
                                  idx === bagIndex
                                    ? { ...curBag, max_items: e.target.value }
                                    : curBag,
                                ),
                              }))
                            }
                          />
                        </div>
                        <Button
                          size="small"
                          type="button"
                          variant="secondary"
                          disabled={packagingForm.bags.length === 1}
                          onClick={() =>
                            setPackagingForm((current) => ({
                              ...current,
                              bags: current.bags.filter(
                                (_, idx) => idx !== bagIndex,
                              ),
                            }))
                          }
                        >
                          {t("shippingHub.packaging.deleteBag")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. QUY CHUẨN HỘP CARTON */}
                <div className="flex flex-col gap-y-4 border-t pt-5">
                  <div className="flex items-center justify-between gap-x-3">
                    <div>
                      <Text size="small" weight="plus">
                        {t("shippingHub.packaging.cartonBoxesTitle")}
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle">
                        {t("shippingHub.packaging.cartonBoxesDescription")}
                      </Text>
                    </div>
                    <Button
                      size="small"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setPackagingForm((current) => ({
                          ...current,
                          boxes: [
                            ...current.boxes,
                            {
                              code: `Box-${current.boxes.length + 1}`,
                              name: "",
                              height: "10",
                              length: "20",
                              width: "15",
                              max_items: "3",
                            },
                          ],
                        }))
                      }
                    >
                      {t("shippingHub.packaging.addBox")}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-y-3">
                    {packagingForm.boxes.map((box, boxIndex) => (
                      <div
                        className="grid items-end gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_repeat(4,minmax(0,0.8fr))_auto]"
                        key={`box-${boxIndex}`}
                      >
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`box-code-${boxIndex}`}>
                            {t("shippingHub.packaging.boxLabel")}
                          </Label>
                          <Input
                            id={`box-code-${boxIndex}`}
                            value={box.code}
                            placeholder="S, M, L..."
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                boxes: current.boxes.map((curBox, idx) =>
                                  idx === boxIndex
                                    ? { ...curBox, code: e.target.value }
                                    : curBox,
                                ),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`box-name-${boxIndex}`}>
                            {t("shippingHub.packaging.boxName")}
                          </Label>
                          <Input
                            id={`box-name-${boxIndex}`}
                            value={box.name}
                            placeholder={tr("shippingHub.packaging.suggestCarton", "Gợi ý: 1-2 món nhỏ / Mỹ phẩm...")}
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                boxes: current.boxes.map((curBox, idx) =>
                                  idx === boxIndex
                                    ? { ...curBox, name: e.target.value }
                                    : curBox,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`box-length-${boxIndex}`}>
                            {t("shippingHub.packaging.length")} (cm)
                          </Label>
                          <Input
                            id={`box-length-${boxIndex}`}
                            type="number"
                            min="1"
                            value={box.length}
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                boxes: current.boxes.map((curBox, idx) =>
                                  idx === boxIndex
                                    ? { ...curBox, length: e.target.value }
                                    : curBox,
                                ),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`box-width-${boxIndex}`}>
                            {t("shippingHub.packaging.width")} (cm)
                          </Label>
                          <Input
                            id={`box-width-${boxIndex}`}
                            type="number"
                            min="1"
                            value={box.width}
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                boxes: current.boxes.map((curBox, idx) =>
                                  idx === boxIndex
                                    ? { ...curBox, width: e.target.value }
                                    : curBox,
                                ),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`box-height-${boxIndex}`}>
                            {t("shippingHub.packaging.height")} (cm)
                          </Label>
                          <Input
                            id={`box-height-${boxIndex}`}
                            type="number"
                            min="1"
                            value={box.height}
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                boxes: current.boxes.map((curBox, idx) =>
                                  idx === boxIndex
                                    ? { ...curBox, height: e.target.value }
                                    : curBox,
                                ),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-y-2">
                          <Label htmlFor={`box-maxitems-${boxIndex}`}>
                            {t("shippingHub.packaging.boxMaxItems")}
                          </Label>
                          <Input
                            id={`box-maxitems-${boxIndex}`}
                            type="number"
                            min="1"
                            value={box.max_items}
                            placeholder="Mặc định"
                            onChange={(e) =>
                              setPackagingForm((current) => ({
                                ...current,
                                boxes: current.boxes.map((curBox, idx) =>
                                  idx === boxIndex
                                    ? { ...curBox, max_items: e.target.value }
                                    : curBox,
                                ),
                              }))
                            }
                          />
                        </div>
                        <Button
                          size="small"
                          type="button"
                          variant="secondary"
                          disabled={packagingForm.boxes.length === 1}
                          onClick={() =>
                            setPackagingForm((current) => ({
                              ...current,
                              boxes: current.boxes.filter(
                                (_, idx) => idx !== boxIndex,
                              ),
                            }))
                          }
                        >
                          {t("shippingHub.packaging.deleteBox")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end border-t pt-5">
                  <Button
                    type="submit"
                    isLoading={savePackagingMutation.isPending}
                  >
                    {t("shippingHub.packaging.save")}
                  </Button>
                </div>
              </form>
            )}
          </Container>
        </Tabs.Content>

        {/* TAB 3: KẾT NỐI API & HÃNG VẬN CHUYỂN (CARRIERS & API) */}
        <Tabs.Content value="carriers" className="flex flex-col gap-y-6">
          <Container className="max-w-4xl p-0">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-x-3">
                <GlobeIcon className="text-ui-fg-interactive" />
                <div>
                  <Heading level="h2">Giao Hàng Nhanh (GHN)</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    {t("shippingHub.ghn.subtitle")}
                  </Text>
                </div>
              </div>
              <div>
                {carrierLoadFailed ? (
                  <StatusBadge color="red">
                    {t("shippingHub.loadFailed")}
                  </StatusBadge>
                ) : ghn?.is_enabled ? (
                  <StatusBadge color="green">
                    {t("shippingHub.active")}
                  </StatusBadge>
                ) : (
                  <StatusBadge color="grey">
                    {t("shippingHub.notConfigured")}
                  </StatusBadge>
                )}
              </div>
            </div>

            <div className="p-6">
              {carrierLoadFailed ? (
                <LoadError onRetry={() => void carriersQuery.refetch()} />
              ) : (
                <form className="flex flex-col gap-y-5" onSubmit={submitGhn}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-y-2">
                      <Label htmlFor="ghn-environment">
                        {t("shippingHub.ghn.environment")}
                      </Label>
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
                          <Select.Item value="production">
                            Production
                          </Select.Item>
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
                          ? t("shippingHub.ghn.savedTokenPlaceholder", {
                              hint: ghn.secret_hint,
                            })
                          : t("shippingHub.ghn.tokenPlaceholder")
                      }
                      onChange={(event) =>
                        setGhnForm((current) => ({
                          ...current,
                          api_token: event.target.value,
                        }))
                      }
                    />
                    <Text size="small" className="text-ui-fg-subtle">
                      {t("shippingHub.ghn.tokenHint")}
                    </Text>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-y-2">
                      <Label htmlFor="ghn-sender-name">
                        {t("shippingHub.ghn.senderName")}
                      </Label>
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
                      <Label htmlFor="ghn-sender-phone">
                        {t("shippingHub.ghn.senderPhone")}
                      </Label>
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
                    <Label htmlFor="ghn-sender-address">
                      {t("shippingHub.ghn.senderAddress")}
                    </Label>
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
                        ? t("shippingHub.ghn.lastVerified", {
                            date: formatDate(
                              ghn.last_verified_at,
                              i18n.resolvedLanguage || i18n.language,
                            ),
                          })
                        : t("shippingHub.ghn.notVerified")}
                    </Text>
                    <div className="flex gap-x-2">
                      <Button
                        type="button"
                        variant="secondary"
                        isLoading={testGhnMutation.isPending}
                        onClick={() => testGhnMutation.mutate()}
                      >
                        <GlobeIcon />
                        {t("shippingHub.ghn.testConnection")}
                      </Button>
                      <Button
                        type="submit"
                        isLoading={saveGhnMutation.isPending}
                      >
                        {t("shippingHub.ghn.save")}
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </Container>
        </Tabs.Content>
      </Tabs>
    </div>
  );
};

export const config = defineRouteConfig({
  icon: TruckIcon,
  label: "shippingHub.navigation",
  translationNs: "translation",
});

export default ShippingHubPage;
