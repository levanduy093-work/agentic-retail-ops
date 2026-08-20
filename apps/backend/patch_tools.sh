#!/bin/bash
cat << 'INNER_EOF' > src/modules/agent-operations/agent-engine.ts
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { AGENT_TOOL_REGISTRY } from "./tool-registry";
import { executeCatalogRead } from "./catalog-read-runtime";
import { executeKnowledgeSearch } from "./knowledge-rag-engine";
import { MedusaContainer } from "@medusajs/framework/types";

export type MessageRole = "system" | "user" | "assistant" | "tool";
export type Message = { role: MessageRole; content: string; };

export class AgentEngine {
  private llm: any;

  constructor(
    private container: MedusaContainer,
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
          const result = await executeCatalogRead(this.container, args, { tenant_id: this.context.tenant_id });
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
          const result = await executeKnowledgeSearch(this.container, { ...args, limit: 5 }, { tenant_id: this.context.tenant_id });
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
INNER_EOF
