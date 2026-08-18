import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { GhnClient } from "../../modules/ghn-fulfillment/ghn-client"
import { getGhnSettings } from "../../modules/shipping-hub/ghn-connection"

type FulfillmentData = {
  data?: Record<string, unknown> | null
  id: string
  provider_id?: string | null
}

export type GenerateGhnFulfillmentLabelInput = {
  fulfillment_id: string
}

export type GenerateGhnFulfillmentLabelResult = {
  label_url: string
}

const generateGhnFulfillmentLabelStep = createStep<
  GenerateGhnFulfillmentLabelInput,
  GenerateGhnFulfillmentLabelResult,
  GenerateGhnFulfillmentLabelResult
>(
  "generate-ghn-fulfillment-label",
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

    const fulfillmentData = fulfillment.data ?? {}
    const orderCodes = Array.isArray(fulfillmentData.ghn_order_codes)
      ? fulfillmentData.ghn_order_codes.filter(
          (orderCode): orderCode is string => typeof orderCode === "string"
        )
      : [
          fulfillmentData.ghn_order_code || fulfillmentData.tracking_number,
        ].filter((orderCode): orderCode is string => typeof orderCode === "string")

    if (!orderCodes.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Fulfillment chưa có mã vận đơn GHN."
      )
    }

    const settings = await getGhnSettings(container)
    const fulfillmentEnvironment = fulfillmentData.ghn_environment
    if (
      fulfillmentEnvironment &&
      fulfillmentEnvironment !== settings.environment
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Môi trường GHN hiện tại khác môi trường đã tạo vận đơn. Chuyển cấu hình carrier về đúng môi trường trước khi in nhãn."
      )
    }

    const client = new GhnClient({
      apiToken: settings.api_token,
      baseUrl: settings.base_url,
      clientId: settings.client_id,
      environment: settings.environment,
      shopId: settings.shop_id,
    })
    const { token } = await client.generatePrintToken(orderCodes)

    if (!token) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "GHN không trả về mã in nhãn."
      )
    }

    return new StepResponse({
      label_url: client.getPrintUrl(token, "A5"),
    })
  }
)

export const generateGhnFulfillmentLabelWorkflow = createWorkflow(
  "generate-ghn-fulfillment-label",
  function (input: GenerateGhnFulfillmentLabelInput) {
    const result = generateGhnFulfillmentLabelStep(input)
    return new WorkflowResponse(result)
  }
)
