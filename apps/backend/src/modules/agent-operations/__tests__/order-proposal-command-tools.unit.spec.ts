import { z } from "@medusajs/framework/zod"
import { CUSTOMER_SUPPORT_NATIVE_TOOLS } from "../customer-native-tool-dispatcher"
import {
  ORDER_CANCEL_PROPOSE_TOOL,
  ORDER_UPDATE_ADDRESS_PROPOSE_TOOL,
  OrderCancelProposeInput,
  OrderUpdateAddressProposeInput,
} from "../tools/platform-command-tools"

describe("order proposal command contracts", () => {
  describe("order cancellation proposal", () => {
    it("only describes a staff-review cancellation proposal, never an autonomous cancellation", () => {
      expect(ORDER_CANCEL_PROPOSE_TOOL).toMatchObject({
        approval_required: false,
        kind: "COMMAND",
        name: "order.cancel-propose",
        permission: "agent_task:create",
        risk_level: "MEDIUM",
      })
      expect(ORDER_CANCEL_PROPOSE_TOOL.description).toContain(
        "never cancels an order autonomously"
      )
      expect(
        CUSTOMER_SUPPORT_NATIVE_TOOLS.find(
          (tool) => tool.name === "propose_order_cancellation"
        )?.description
      ).toContain("never cancels an order autonomously")
    })

    it("requires a concrete customer cancellation request with an order code and valid reason", () => {
      expect(
        OrderCancelProposeInput.parse({
          conversation_id: "agconv_1",
          customer_confirmation_message_id: "agmsg_1",
          order_code: "1024",
          reason: "Tôi đặt nhầm số lượng, muốn hủy đơn để đặt lại.",
        })
      ).toMatchObject({
        conversation_id: "agconv_1",
        customer_confirmation_message_id: "agmsg_1",
        order_code: 1024,
        reason: "Tôi đặt nhầm số lượng, muốn hủy đơn để đặt lại.",
      })

      expect(() =>
        OrderCancelProposeInput.parse({
          conversation_id: "agconv_1",
          customer_confirmation_message_id: "agmsg_1",
          order_code: "1024",
          reason: "hủy",
        })
      ).toThrow(z.ZodError)
    })
  })

  describe("order address update proposal", () => {
    it("only describes a staff-review address update proposal, never modifies order autonomously", () => {
      expect(ORDER_UPDATE_ADDRESS_PROPOSE_TOOL).toMatchObject({
        approval_required: false,
        kind: "COMMAND",
        name: "order.update-address-propose",
        permission: "agent_task:create",
        risk_level: "MEDIUM",
      })
      expect(ORDER_UPDATE_ADDRESS_PROPOSE_TOOL.description).toContain(
        "never modifies order address autonomously"
      )
      expect(
        CUSTOMER_SUPPORT_NATIVE_TOOLS.find(
          (tool) => tool.name === "propose_address_change"
        )?.description
      ).toContain("human-review proposal to update the shipping address")
    })

    it("requires new shipping address details, order code, and valid reason", () => {
      expect(
        OrderUpdateAddressProposeInput.parse({
          address_1: "123 Nguyen Hue",
          city: "Ho Chi Minh",
          conversation_id: "agconv_1",
          customer_confirmation_message_id: "agmsg_1",
          order_code: 1024,
          phone: "0901234567",
          province: "Quan 1",
          reason: "Chuyển địa chỉ nhận hàng về cơ quan.",
        })
      ).toMatchObject({
        address_1: "123 Nguyen Hue",
        city: "Ho Chi Minh",
        conversation_id: "agconv_1",
        customer_confirmation_message_id: "agmsg_1",
        order_code: 1024,
      })

      expect(() =>
        OrderUpdateAddressProposeInput.parse({
          address_1: "12",
          city: "H",
          conversation_id: "agconv_1",
          customer_confirmation_message_id: "agmsg_1",
          order_code: 1024,
          reason: "ngắn",
        })
      ).toThrow(z.ZodError)
    })
  })
})
