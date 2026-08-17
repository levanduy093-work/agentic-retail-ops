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
import { GhnClient } from "../../modules/ghn-fulfillment/ghn-client"
import { getGhnSettings } from "../../modules/shipping-hub/ghn-connection"

type FulfillmentData = {
  data?: Record<string, unknown> | null
  id: string
  provider_id?: string | null
}

export type SyncGhnFulfillmentStatusInput = {
  fulfillment_id: string
}

export type SyncGhnFulfillmentStatusResult = {
  changed: boolean
  fulfillment_id: string
  status: string
  status_name?: string
  tracking_number: string
}

const syncGhnFulfillmentStatusStep = createStep<
  SyncGhnFulfillmentStatusInput,
  SyncGhnFulfillmentStatusResult,
  SyncGhnFulfillmentStatusResult
>(
  "sync-ghn-fulfillment-status",
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

    if (fulfillment.provider_id !== "ghn_ghn") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Fulfillment này không dùng GHN."
      )
    }

    const currentData = fulfillment.data ?? {}
    const trackingNumber =
      (currentData.ghn_order_code as string | undefined) ||
      (currentData.tracking_number as string | undefined)

    if (!trackingNumber) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Fulfillment chưa có mã vận đơn GHN."
      )
    }

    const settings = await getGhnSettings(container)
    const fulfillmentEnvironment = currentData.ghn_environment
    if (
      fulfillmentEnvironment &&
      fulfillmentEnvironment !== settings.environment
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Môi trường GHN hiện tại khác môi trường đã tạo vận đơn. Chuyển cấu hình carrier về đúng môi trường trước khi đồng bộ."
      )
    }

    const client = new GhnClient({
      apiToken: settings.api_token,
      baseUrl: settings.base_url,
      clientId: settings.client_id,
      environment: settings.environment,
      shopId: settings.shop_id,
    })
    const shipment = await client.getOrderDetail(trackingNumber)
    const previousStatus = currentData.ghn_current_status as string | undefined
    const changed = previousStatus !== shipment.status
    const history = Array.isArray(currentData.ghn_status_history)
      ? currentData.ghn_status_history
      : []
    const lastLog = shipment.log.at(-1)
    const now = new Date().toISOString()
    const nextHistory = changed
      ? [
          ...history,
          {
            source: "poll",
            status: shipment.status,
            status_name: shipment.status_name || null,
            time: lastLog?.updated_date || now,
          },
        ]
      : history

    const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
    await fulfillmentModule.updateFulfillment(fulfillment.id, {
      data: {
        ...currentData,
        ghn_current_status: shipment.status,
        ghn_last_polled_at: now,
        ghn_status_history: nextHistory,
      },
    })

    return new StepResponse({
      changed,
      fulfillment_id: fulfillment.id,
      status: shipment.status,
      status_name: shipment.status_name,
      tracking_number: shipment.order_code,
    })
  }
)

export const syncGhnFulfillmentStatusWorkflow = createWorkflow(
  "sync-ghn-fulfillment-status",
  function (input: SyncGhnFulfillmentStatusInput) {
    const result = syncGhnFulfillmentStatusStep(input)
    return new WorkflowResponse(result)
  }
)
