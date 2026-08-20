import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

export const MemoryUpdateSchema = z.object({
  summary: z.string().describe("Tóm tắt tổng quan về toàn bộ cuộc trò chuyện tính đến thời điểm hiện tại."),
  customer_facts: z.array(z.string()).describe("Các thông tin bất biến về khách hàng (ví dụ: là VIP, sống ở Đà Lạt, thích màu đỏ)."),
  open_questions: z.array(z.string()).describe("Những câu hỏi khách đang đợi shop trả lời."),
  resolved_topics: z.array(z.string()).describe("Những vấn đề đã được giải quyết xong."),
  extracted_preferences: z.array(z.object({
    preference_type: z.enum(["SIZE", "STYLE", "MEASUREMENTS"]),
    value: z.string()
  })).describe("Sở thích mua sắm được phát hiện (chiều cao, cân nặng, size áo, phong cách).")
});

export type MemoryUpdate = z.infer<typeof MemoryUpdateSchema>;

export class MemoryEngine {
  private llm: any;

  constructor(apiKey: string, modelName: string = "gemini-1.5-pro") {
    // Sử dụng model có hỗ trợ structured output (withStructuredOutput)
    this.llm = new ChatGoogleGenerativeAI({
      apiKey,
      modelName,
      temperature: 0.1,
    });
  }

  async summarizeConversation(previousMemory: any, recentMessages: { role: string; content: string }[]): Promise<MemoryUpdate> {
    const prompt = `Bạn là hệ thống Trí Nhớ (Memory Agent). Hãy đọc tóm tắt cũ và các tin nhắn mới, sau đó cập nhật lại toàn bộ hồ sơ khách hàng.
Không được cắt gọt thông tin quan trọng. Cập nhật các danh sách Facts, Câu hỏi chưa trả lời, Chủ đề đã xong.

Tóm tắt cũ:
${previousMemory ? JSON.stringify(previousMemory, null, 2) : "Chưa có"}

Tin nhắn mới:
${recentMessages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n")}
`;

    // Bind zod schema for JSON extraction
    const structuredLlm = this.llm.withStructuredOutput(MemoryUpdateSchema, { name: "update_memory" });
    const response = await structuredLlm.invoke(prompt);
    
    return response as MemoryUpdate;
  }
}
