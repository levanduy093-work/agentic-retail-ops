import { Module } from "@medusajs/framework/utils"
import PaymentHubModuleService from "./service"

export const PAYMENT_HUB_MODULE = "paymentHub"

export default Module(PAYMENT_HUB_MODULE, {
  service: PaymentHubModuleService,
})
