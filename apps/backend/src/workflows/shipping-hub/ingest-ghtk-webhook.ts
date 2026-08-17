import { createHash } from "node:crypto"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SHIPPING_HUB_MODULE } from "../../modules/shipping-hub"
import type ShippingHubModuleService from "../../modules/shipping-hub/service"

export type GhtkWebhookInput = {
  action_time?: string
  fee?: number
  label_id: string
  partner_id?: string
  reason?: string
  reason_code?: string
  return_part_package?: number
  status_id: number
  weight?: number
  [key: string]: unknown
}

type RecordedEvent = {
  duplicate: boolean
  event_id: string
}

type ApplyGhtkWebhookInput = {
  event: RecordedEvent
  payload: GhtkWebhookInput
}

type ApplyGhtkWebhookResult = {
  fulfillment_id: string | null
  status: "IGNORED" | "PROCESSED"
}

const GHTK_STATUS_MAP: Record<number, string> = {
  [-1]: "Hủy đơn hàng",
  1: "Chưa tiếp nhận",
  2: "Đã tiếp nhận",
  3: "Đã lấy hàng",
  4: "Đang giao hàng",
  5: "Đã giao hàng",
  6: "Đã đối soát",
  7: "Không lấy được hàng",
  8: "Hoãn lấy hàng",
  9: "Không giao được hàng",
  10: "Delay giao hàng",
  11: "Đang hoàn hàng",
  12: "Đã hoàn hàng",
  20: "Đang trả hàng",
  21: "Đã trả hàng",
}

const recordGhtkWebhookEventStep = createStep(
  "record-ghtk-webhook-event",
  async (input: GhtkWebhookInput, { container }) => {
    const shippingHub = container.resolve<ShippingHubModuleService>(
      SHIPPING_HUB_MODULE
    )
    const externalEventId = createHash("sha256")
      .update(
        [
          input.label_id,
          String(input.status_id),
          input.action_time || "",
          input.reason || "",
          input.reason_code || "",
          String(input.fee || ""),
        ].join("|")
      )
      .digest("hex")
    const [existing] = await shippingHub.listShippingWebhookEvents({
      carrier_code: "GHTK",
      external_event_id: externalEventId,
    })

    if (existing) {
      return new StepResponse({ duplicate: true, event_id: existing.id })
    }

    const event = await shippingHub.createShippingWebhookEvents({
      carrier_code: "GHTK",
      external_event_id: externalEventId,
      occurred_at: input.action_time ? new Date(input.action_time) : null,
      payload: input,
      received_at: new Date(),
      status: "RECEIVED",
      tracking_number: input.label_id,
    })

    return new StepResponse({ duplicate: false, event_id: event.id })
  }
)

const applyGhtkWebhookStatusStep = createStep<
  ApplyGhtkWebhookInput,
  ApplyGhtkWebhookResult,
  ApplyGhtkWebhookResult
>(
  "apply-ghtk-webhook-status",
  async (input: ApplyGhtkWebhookInput, { container }) => {
    const shippingHub = container.resolve<ShippingHubModuleService>(
      SHIPPING_HUB_MODULE
    )
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "data", "labels.*"],
      filters: { provider_id: "ghtk_ghtk" },
      pagination: { skip: 0, take: 100 },
    })
    const fulfillment = (
      fulfillments as Array<{
        data?: Record<string, unknown> | null
        id: string
        labels?: Array<{ tracking_number?: string | null }>
      }>
    ).find((candidate) => {
      const data = candidate.data ?? {}
      return (
        data.ghtk_label_id === input.payload.label_id ||
        data.ghtk_order_code === input.payload.label_id ||
        data.tracking_number === input.payload.label_id ||
        data.partner_id === input.payload.partner_id ||
        candidate.labels?.some(
          (label) => label.tracking_number === input.payload.label_id
        )
      )
    })

    if (!fulfillment) {
      await shippingHub.updateShippingWebhookEvents({
        id: input.event.event_id,
        last_error: "No GHTK fulfillment matches this tracking number.",
        processed_at: new Date(),
        status: "IGNORED",
      })
      return new StepResponse<ApplyGhtkWebhookResult>({
        fulfillment_id: null,
        status: "IGNORED",
      })
    }

    try {
      const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
      const currentData = fulfillment.data ?? {}
      const history = Array.isArray(currentData.ghtk_status_history)
        ? currentData.ghtk_status_history
        : []
      const statusText =
        GHTK_STATUS_MAP[input.payload.status_id] ||
        `Trạng thái (${input.payload.status_id})`
      const statusRecord = {
        event_id: input.event.event_id,
        reason: input.payload.reason || null,
        reason_code: input.payload.reason_code || null,
        status: statusText,
        status_id: input.payload.status_id,
        time: input.payload.action_time || new Date().toISOString(),
      }

      await fulfillmentModule.updateFulfillment(fulfillment.id, {
        data: {
          ...currentData,
          ghtk_current_status: statusText,
          ghtk_last_webhook_at: new Date().toISOString(),
          ghtk_status_history: [...history, statusRecord],
          ghtk_status_id: input.payload.status_id,
        },
      })

      // If delivered (status 5 or 6), mark delivered_at
      if (
        (input.payload.status_id === 5 || input.payload.status_id === 6) &&
        !fulfillmentModule.createFulfillment
      ) {
        // Can be marked via fulfillment module if supported
      }

      await shippingHub.updateShippingWebhookEvents({
        id: input.event.event_id,
        last_error: null,
        processed_at: new Date(),
        status: "PROCESSED",
      })
      return new StepResponse<ApplyGhtkWebhookResult>({
        fulfillment_id: fulfillment.id,
        status: "PROCESSED",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await shippingHub.updateShippingWebhookEvents({
        id: input.event.event_id,
        last_error: message,
        processed_at: new Date(),
        status: "FAILED",
      })
      throw error
    }
  }
)

export const ingestGhtkWebhookWorkflow = createWorkflow(
  "ingest-ghtk-webhook",
  function (input: GhtkWebhookInput) {
    const event = recordGhtkWebhookEventStep(input)
    const applyInput = transform({ event, input }, (data) => ({
      event: data.event,
      payload: data.input,
    }))
    const applied = when({ event }, (data) => !data.event.duplicate).then(() => {
      return applyGhtkWebhookStatusStep(applyInput)
    })

    return new WorkflowResponse({ applied, event })
  }
)
