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

export type GhnWebhookInput = {
  ClientOrderCode?: string
  Description?: string
  OrderCode: string
  Reason?: string
  Status: string
  Time?: string
  TotalFee?: number
  Type?: string
  [key: string]: unknown
}

type RecordedEvent = {
  duplicate: boolean
  event_id: string
}

type ApplyGhnWebhookInput = {
  event: RecordedEvent
  payload: GhnWebhookInput
}

type ApplyGhnWebhookResult = {
  fulfillment_id: string | null
  status: "IGNORED" | "PROCESSED"
}

const recordGhnWebhookEventStep = createStep(
  "record-ghn-webhook-event",
  async (input: GhnWebhookInput, { container }) => {
    const shippingHub = container.resolve<ShippingHubModuleService>(
      SHIPPING_HUB_MODULE
    )
    const externalEventId = createHash("sha256")
      .update(
        [
          input.OrderCode,
          input.Status,
          input.Type || "",
          input.Time || "",
          input.Description || "",
          input.TotalFee || "",
        ].join("|")
      )
      .digest("hex")
    const [existing] = await shippingHub.listShippingWebhookEvents({
      carrier_code: "GHN",
      external_event_id: externalEventId,
    })

    if (existing) {
      return new StepResponse({ duplicate: true, event_id: existing.id })
    }

    const event = await shippingHub.createShippingWebhookEvents({
      carrier_code: "GHN",
      external_event_id: externalEventId,
      occurred_at: input.Time ? new Date(input.Time) : null,
      payload: input,
      received_at: new Date(),
      status: "RECEIVED",
      tracking_number: input.OrderCode,
    })

    return new StepResponse({ duplicate: false, event_id: event.id })
  }
)

const applyGhnWebhookStatusStep = createStep<
  ApplyGhnWebhookInput,
  ApplyGhnWebhookResult,
  ApplyGhnWebhookResult
>(
  "apply-ghn-webhook-status",
  async (
    input: ApplyGhnWebhookInput,
    { container }
  ) => {
    const shippingHub = container.resolve<ShippingHubModuleService>(
      SHIPPING_HUB_MODULE
    )
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: fulfillments } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "data", "labels.*"],
      filters: { provider_id: "ghn_ghn" },
      pagination: { skip: 0, take: 100 },
    })
    const fulfillment = (fulfillments as Array<{
      data?: Record<string, unknown> | null
      id: string
      labels?: Array<{ tracking_number?: string | null }>
    }>).find((candidate) => {
      const data = candidate.data ?? {}
      return (
        data.ghn_order_code === input.payload.OrderCode ||
        data.tracking_number === input.payload.OrderCode ||
        candidate.labels?.some(
          (label) => label.tracking_number === input.payload.OrderCode
        )
      )
    })

    if (!fulfillment) {
      await shippingHub.updateShippingWebhookEvents({
        id: input.event.event_id,
        last_error: "No GHN fulfillment matches this tracking number.",
        processed_at: new Date(),
        status: "IGNORED",
      })
      return new StepResponse<ApplyGhnWebhookResult>({
        fulfillment_id: null,
        status: "IGNORED",
      })
    }

    try {
      const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
      const currentData = fulfillment.data ?? {}
      const history = Array.isArray(currentData.ghn_status_history)
        ? currentData.ghn_status_history
        : []
      const statusRecord = {
        description: input.payload.Description || null,
        event_id: input.event.event_id,
        reason: input.payload.Reason || null,
        status: input.payload.Status,
        time: input.payload.Time || new Date().toISOString(),
      }
      await fulfillmentModule.updateFulfillment(fulfillment.id, {
        data: {
          ...currentData,
          ghn_current_status: input.payload.Status,
          ghn_last_webhook_at: new Date().toISOString(),
          ghn_status_history: [...history, statusRecord],
        },
      })
      await shippingHub.updateShippingWebhookEvents({
        id: input.event.event_id,
        last_error: null,
        processed_at: new Date(),
        status: "PROCESSED",
      })
      return new StepResponse<ApplyGhnWebhookResult>({
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

export const ingestGhnWebhookWorkflow = createWorkflow(
  "ingest-ghn-webhook",
  function (input: GhnWebhookInput) {
    const event = recordGhnWebhookEventStep(input)
    const applyInput = transform({ event, input }, (data) => ({
      event: data.event,
      payload: data.input,
    }))
    const applied = when({ event }, (data) => !data.event.duplicate).then(() => {
      return applyGhnWebhookStatusStep(applyInput)
    })

    return new WorkflowResponse({ applied, event })
  }
)
