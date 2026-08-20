export const CustomerSupportTools = {
  SEARCH_CATALOG: {
    name: "search_catalog",
    description: "Tìm kiếm sản phẩm trong kho. Dùng khi khách hàng hỏi mua đồ, tìm đồ.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Từ khóa tìm kiếm (vd: áo khoác ấm, đồ đi du lịch)" },
        min_budget: { type: "number" },
        max_budget: { type: "number" }
      },
      required: ["query"]
    }
  },
  SEARCH_KNOWLEDGE_BASE: {
    name: "search_knowledge_base",
    description: "Tra cứu chính sách cửa hàng (đổi trả, bảo hành, phí ship).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"]
    }
  },
  ESCALATE_TO_HUMAN: {
    name: "escalate_to_human",
    description: "Bàn giao cho nhân viên thật xử lý. Dùng khi khách hàng tức giận, hoặc khi đã tra cứu kiến thức 2 lần mà không có giải pháp.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Lý do bàn giao" },
        urgency: { type: "string", enum: ["low", "high", "critical"] }
      },
      required: ["reason", "urgency"]
    }
  }
};
