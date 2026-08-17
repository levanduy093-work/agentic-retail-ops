import { Module } from "@medusajs/framework/utils"
import ShippingHubModuleService from "./service"

export const SHIPPING_HUB_MODULE = "shippingHub"

export default Module(SHIPPING_HUB_MODULE, {
  service: ShippingHubModuleService,
})
