import { z } from "@medusajs/framework/zod"
import { CUSTOMER_SUPPORT_NATIVE_TOOLS } from "../customer-native-tool-dispatcher"
import { RETURN_PROPOSE_TOOL, ReturnProposeInput } from "../tools/platform-command-tools"

describe("return proposal command contract", () => {
  it("only describes a staff-review proposal, never an autonomous refund", () => {
    expect(RETURN_PROPOSE_TOOL).toMatchObject({
      approval_required: false,
      kind: "COMMAND",
      name: "return.propose",
      permission: "agent_task:create",
      risk_level: "MEDIUM",
    })
    expect(RETURN_PROPOSE_TOOL.description).toContain("never creates a Medusa return or refund")
    expect(CUSTOMER_SUPPORT_NATIVE_TOOLS.find((tool) => tool.name === "propose_return_review")?.description).toContain(
      "never creates a return or refund"
    )
  })

  it("requires a concrete customer request with an order code and reason", () => {
    expect(
      ReturnProposeInput.parse({
        conversation_id: "agconv_1",
        customer_confirmation_message_id: "agmsg_1",
        order_code: "1024",
        reason: "Sản phẩm giao không đúng màu đã đặt.",
        requested_resolution: "EXCHANGE",
      })
    ).toMatchObject({ order_code: 1024, requested_resolution: "EXCHANGE" })
    expect(() =>
      ReturnProposeInput.parse({
        conversation_id: "agconv_1",
        customer_confirmation_message_id: "agmsg_1",
        order_code: "1024",
        reason: "ngắn",
        requested_resolution: "REFUND",
      })
    ).toThrow(z.ZodError)
  })
})
