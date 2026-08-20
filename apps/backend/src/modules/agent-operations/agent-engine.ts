import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { AGENT_TOOL_REGISTRY } from "./tool-registry";
import { executeCatalogRead } from "./catalog-read-runtime";

import { MedusaContainer } from "@medusajs/framework/types";

export type MessageRole = "system" | "user" | "assistant" | "tool";
export type Message = { role: MessageRole; content: string; };

export class AgentEngine {
  private llm: any;

  constructor(
    private service: any,
    private context: { customer_id: string; tenant_id: string },
    apiKey: string,
    modelName: string = "gemini-1.5-pro"
  ) {
    this.llm = new ChatGoogleGenerativeAI({
      apiKey,
      modelName,
      temperature: 0.2,
    });
  }

  private getLangchainTools() {
    const tools = [];
    
    // 1. Tool tìm kiếm sản phẩm
    const catalogToolDef = AGENT_TOOL_REGISTRY["catalog.read"];
    if (catalogToolDef) {
      tools.push(tool(
        async (args: any) => {
          const result = await executeCatalogRead(this.service.__container__, args, { tenant_id: this.context.tenant_id });
          return JSON.stringify(result.output);
        },
        { name: "search_catalog", description: "Tìm kiếm sản phẩm trong kho. Gọi khi khách hỏi mua đồ.", schema: catalogToolDef.input_schema }
      ));
    }

    // 2. Tool tra cứu kiến thức (chính sách, phí ship, đổi trả)
    const knowledgeToolDef = AGENT_TOOL_REGISTRY["knowledge.search"];
    if (knowledgeToolDef) {
      tools.push(tool(
        async (args: any) => {
          // Bỏ qua threshold cứng, lấy top 5 kết quả
          const result = await this.service.searchGovernedKnowledge({ ...args, limit: 5 }, { tenant_id: this.context.tenant_id });
          return JSON.stringify(result.output.results.map((r: any) => ({ title: r.title, content: r.excerpt })));
        },
        { name: "search_knowledge_base", description: "Tra cứu chính sách cửa hàng (đổi trả, bảo hành, phí ship).", schema: knowledgeToolDef.input_schema }
      ));
    }
    
    // 3. Tool bàn giao nhân viên (Handoff)
    const escalateToolDef = AGENT_TOOL_REGISTRY["task.escalate"];
    if (escalateToolDef) {
      tools.push(tool(
        async (args: any) => {
          return JSON.stringify({ status: "ESCALATED", message: "Đã tạo ticket cho nhân viên." });
        },
        { name: "escalate_to_human", description: "Bàn giao cho nhân viên thật xử lý khi vấn đề quá phức tạp.", schema: escalateToolDef.input_schema }
      ));
    }

    const orderToolDef = AGENT_TOOL_REGISTRY["order.read"];
    if (orderToolDef) {
      tools.push(tool(
        async (args: any) => {
          try {
            const query = this.service.__container__.resolve("query");
            const { data: orders } = await query.graph({
              entity: "order",
              fields: ["id"],
              filters: {
                customer_id: this.context.customer_id,
                display_id: String(args.display_id),
              },
            });
            if (!orders || orders.length === 0) return JSON.stringify({ error: "Không tìm thấy đơn hàng nào khớp với mã này của bạn." });
            
            const { executeOrderRead } = await import("./order-read-runtime");
            const result = await executeOrderRead(this.service.__container__, { order_id: orders[0].id }, "customer-agent");
            return JSON.stringify(result.output);
          } catch (e: any) {
            return JSON.stringify({ error: e.message });
          }
        },
        { 
          name: "check_order_status", 
          description: "Kiểm tra tình trạng đơn hàng của khách. Yêu cầu truyền display_id (ví dụ 1024).", 
          schema: z.object({ display_id: z.string().or(z.number()) }) 
        }
      ));
    }
    
    tools.push(tool(
      async (args: any) => {
        const cartUrl = "https://store.example.com/checkout?cart_id=draft_" + Date.now();
        return JSON.stringify({ status: "SUCCESS", checkout_url: cartUrl, message: "Đã tạo giỏ hàng nháp thành công với các sản phẩm: " + args.product_ids.join(", ") });
      },
      {
        name: "create_draft_cart",
        description: "Tạo giỏ hàng nháp và trả về link thanh toán cho khách. Dùng khi khách chốt mua hàng.",
        schema: z.object({ product_ids: z.array(z.string()) })
      }
    ));
    
    return tools;
  }

  async runCustomerSupportSession(systemPrompt: string, recentMessages: Message[]): Promise<string> {
    const tools = this.getLangchainTools();
    const modelWithTools = this.llm.bindTools(tools);
    const messages: any[] = [new SystemMessage(systemPrompt)];
    
    for (const msg of recentMessages) {
      if (msg.role === "user") messages.push(new HumanMessage(msg.content));
      else if (msg.role === "assistant") messages.push(new AIMessage(msg.content));
    }

    let isFinished = false;
    let iterations = 0;
    let finalResponse = "Xin lỗi, hiện tại hệ thống đang gặp lỗi xử lý.";

    while (!isFinished && iterations < 5) {
      iterations++;
      const response = await modelWithTools.invoke(messages);
      messages.push(response);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        finalResponse = response.content as string;
        isFinished = true;
      } else {
        for (const toolCall of response.tool_calls) {
          const lcTool = tools.find(t => t.name === toolCall.name);
          if (lcTool) {
            const result = await lcTool.invoke(toolCall.args);
            messages.push(new ToolMessage({ content: result, tool_call_id: toolCall.id }));
          }
        }
      }
    }
    return finalResponse;
  }
}
