import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { GhtkClient } from "../../modules/ghtk-fulfillment/ghtk-client"
import { getGhtkSettings } from "../../modules/shipping-hub/ghtk-connection"

type FulfillmentData = {
  data?: Record<string, unknown> | null
  id: string
  provider_id?: string | null
}

export type SyncGhtkFulfillmentStatusInput = {
  fulfillment_id: string
}

export type SyncGhtkFulfillmentStatusResult = {
  changed: boolean
  fulfillment_id: string
  status: string
  status_name: string
  tracking_number: string
}

const syncGhtkFulfillmentStatusStep = createStep<
  SyncGhtkFulfillmentStatusInput,
  SyncGhtkFulfillmentStatusResult,
  SyncGhtkFulfillmentStatusResult
>(
  "sync-ghtk-fulfillment-status",
  async (input, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "fulfillment",
      fields: ["id", "provider_id", "data"],
      filters: { id: input.fulfillment_id },
    })
    const fulfillment = (data as FulfillmentData[])[0]

    if (!fulfillment) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Không tìm thấy fulfillment."
      )
    }

    if (fulfillment.provider_id !== "ghtk_ghtk") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Fulfillment này không dùng GHTK."
      )
    }

    const currentData = fulfillment.data ?? {}
    const trackingNumber =
      (currentData.ghtk_label_id as string | undefined) ||
      (currentData.ghtk_order_code as string | undefined) ||
      (currentData.tracking_number as string | undefined)

    if (!trackingNumber) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Fulfillment chưa có mã vận đơn GHTK."
      )
    }

    const settings = await getGhtkSettings(container)
    const fulfillmentEnvironment = currentData.ghtk_environment
    if (
      fulfillmentEnvironment &&
      fulfillmentEnvironment !== settings.environment
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Môi trường GHTK hiện tại khác môi trường đã tạo vận đơn. Chuyển cấu hình carrier về đúng môi trường trước khi đồng bộ."
      )
    }

    const client = new GhtkClient({
      apiToken: settings.api_token,
      baseUrl: settings.base_url,
      environment: settings.environment,
    })
    const shipment = await client.getOrderStatus(trackingNumber)
    const previousStatus = currentData.ghtk_current_status as string | undefined
    const changed = previousStatus !== shipment.status_text
    const history = Array.isArray(currentData.ghtk_status_history)
      ? currentData.ghtk_status_history
      : []
    const now = new Date().toISOString()
    const nextHistory = changed
      ? [
          ...history,
          {
            source: "poll",
            status: shipment.status_text,
            status_id: shipment.status,
            time: shipment.modified || now,
          },
        ]
      : history

    const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
    await fulfillmentModule.updateFulfillment(fulfillment.id, {
      data: {
        ...currentData,
        ghtk_current_status: shipment.status_text,
        ghtk_last_polled_at: now,
        ghtk_status_history: nextHistory,
        ghtk_status_id: shipment.status,
      },
    })

    return new StepResponse({
      changed,
      fulfillment_id: fulfillment.id,
      status: shipment.status,
      status_name: shipment.status_text,
      tracking_number: shipment.label_id || trackingNumber,
    })
  }
)

export const syncGhtkFulfillmentStatusWorkflow = createWorkflow(
  "sync-ghtk-fulfillment-status",
  function (input: SyncGhtkFulfillmentStatusInput) {
    const result = syncGhtkFulfillmentStatusStep(input)
    return new WorkflowResponse(result)
  }
)
