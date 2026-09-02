export type SkillDefinition = {
  configuration_schema: Record<string, unknown>
  description: string
  eligible_tool_names: string[]
  evaluation_scenario_keys: string[]
  instructions: string
  key: string
  name: string
  required_evidence: string[]
  version: string
}

export const PLATFORM_SKILL_CATALOG: SkillDefinition[] = [
  {
    configuration_schema: {
      fields: [
        {
          key: "product_facets",
          label: "Thuộc tính dùng để tư vấn",
          type: "text",
        },
      ],
    },
    description: "Tư vấn sản phẩm từ catalog thật của cửa hàng.",
    eligible_tool_names: ["search_catalog", "check_realtime_stock"],
    evaluation_scenario_keys: ["customer-product-advice-grounding"],
    instructions:
      "Dùng khi khách cần tìm hoặc so sánh sản phẩm. Luôn tra catalog trước khi đề xuất và chỉ nêu giá, tồn kho hoặc biến thể có trong kết quả tool.",
    key: "catalog-advisor",
    name: "Tư vấn sản phẩm từ catalog",
    required_evidence: ["sellable_variant", "availability"],
    version: "1.0.0",
  },
  {
    configuration_schema: { fields: [] },
    description: "Trả lời chính sách từ tài liệu đã duyệt của cửa hàng.",
    eligible_tool_names: ["search_knowledge"],
    evaluation_scenario_keys: ["customer-knowledge-grounding"],
    instructions:
      "Dùng khi khách hỏi chính sách, đổi trả, giao hàng hoặc thông tin cửa hàng. Chỉ trả lời theo tài liệu đã duyệt và chuyển nhân viên khi thiếu bằng chứng.",
    key: "knowledge-grounding",
    name: "Trả lời từ tài liệu cửa hàng",
    required_evidence: ["approved_knowledge"],
    version: "1.0.0",
  },
  {
    configuration_schema: { fields: [] },
    description: "Tra cứu đơn hàng và tạo đề xuất cần nhân viên phê duyệt.",
    eligible_tool_names: ["check_order_status", "search_orders", "check_delivery_status"],
    evaluation_scenario_keys: ["customer-order-support"],
    instructions:
      "Dùng khi khách hỏi về đơn hàng. Chỉ đọc đơn thuộc đúng khách đã xác thực; mọi thay đổi, hủy hoặc hoàn tiền phải tạo proposal để nhân viên duyệt.",
    key: "order-support",
    name: "Hỗ trợ đơn hàng an toàn",
    required_evidence: ["verified_customer", "live_order"],
    version: "1.0.0",
  },
]

export const getPlatformSkillDefinition = (key: string, version: string) =>
  PLATFORM_SKILL_CATALOG.find(
    (skill) => skill.key === key && skill.version === version
  ) ?? null
