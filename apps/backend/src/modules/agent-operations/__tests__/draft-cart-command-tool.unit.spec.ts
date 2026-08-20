import {
  CART_HANDOFF_SEND_TOOL,
  DRAFT_CART_CREATE_TOOL,
} from "../tools/platform-command-tools"
import {
  CUSTOMER_SUPPORT_NATIVE_TOOL_NAMES,
  CUSTOMER_SUPPORT_NATIVE_TOOLS,
} from "../customer-native-tool-dispatcher"
import { PLATFORM_COMMAND_TOOL_NAMES } from "../../../workflows/agent-operations/execute-agent-action"

describe("draft cart command tool", () => {
  it("requires explicit confirmation, real variant ids, and manager approval", () => {
    expect(DRAFT_CART_CREATE_TOOL.approval_required).toBe(true)
    expect(DRAFT_CART_CREATE_TOOL.required_role).toBe("operations_manager")
    expect(
      DRAFT_CART_CREATE_TOOL.input_schema.parse({
        conversation_id: "agconv_1",
        customer_confirmation_message_id: "agmsg_1",
        items: [{ quantity: 1, variant_id: "variant_1" }],
        region_id: "reg_1",
        sales_channel_id: "sc_1",
      })
    ).toMatchObject({ items: [{ quantity: 1, variant_id: "variant_1" }] })
    expect(() =>
      DRAFT_CART_CREATE_TOOL.input_schema.parse({
        conversation_id: "agconv_1",
        items: [{ quantity: 1, variant_id: "variant_1" }],
        region_id: "reg_1",
        sales_channel_id: "sc_1",
      })
    ).toThrow()
  })

  it("only permits handoff through a typed customer-cart notification", () => {
    expect(CART_HANDOFF_SEND_TOOL.approval_required).toBe(false)
    expect(CART_HANDOFF_SEND_TOOL.permission).toBe("agent_message:create")
    expect(
      CART_HANDOFF_SEND_TOOL.input_schema.parse({
        body: "Mình đã chuẩn bị giỏ hàng theo lựa chọn của bạn.",
        cart_id: "cart_1",
        conversation_id: "agconv_1",
      })
    ).toMatchObject({ cart_id: "cart_1" })
    expect(() =>
      CART_HANDOFF_SEND_TOOL.input_schema.parse({
        cart_id: "cart_1",
        conversation_id: "agconv_1",
      })
    ).toThrow()
  })

  it("exposes a proposal-only native tool, never a direct cart action", () => {
    expect(CUSTOMER_SUPPORT_NATIVE_TOOL_NAMES.has("propose_draft_cart")).toBe(true)
    expect(
      CUSTOMER_SUPPORT_NATIVE_TOOLS.find((tool) => tool.name === "propose_draft_cart")
        ?.description
    ).toContain("never creates a cart")
  })

  it("lets the action worker execute only the approved cart commands", () => {
    expect(PLATFORM_COMMAND_TOOL_NAMES).toContain(DRAFT_CART_CREATE_TOOL.name)
    expect(PLATFORM_COMMAND_TOOL_NAMES).toContain(CART_HANDOFF_SEND_TOOL.name)
  })
})
