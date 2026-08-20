const fs = require('fs');
const filePath = 'src/modules/agent-operations/service.ts';
let code = fs.readFileSync(filePath, 'utf8');

const startStr = "  async processCustomerKnowledgeQuestion(";
const endStr = "    }\n  }";

let startIdx = code.indexOf(startStr);
let endIdx = code.indexOf(endStr, startIdx);

const replacement = `  async processCustomerKnowledgeQuestion(input: any, @MedusaContext() sharedContext: Context = {}): Promise<any> {
    throw new Error("Deprecated: Use processCustomerMessageAgentic instead.");
  }`;
code = code.substring(0, startIdx) + replacement + code.substring(endIdx + endStr.length);

// Fix the JSON stringify too
code = code.replace(/customer_facts: JSON\.stringify\(memoryUpdate\.customer_facts\)/g, 'customer_facts: memoryUpdate.customer_facts as any');
code = code.replace(/open_questions: JSON\.stringify\(memoryUpdate\.open_questions\)/g, 'open_questions: memoryUpdate.open_questions as any');
code = code.replace(/resolved_topics: JSON\.stringify\(memoryUpdate\.resolved_topics\)/g, 'resolved_topics: memoryUpdate.resolved_topics as any');
code = code.replace(/await import\("\\.\/agent-engine"\)/g, 'await import("./agent-engine.js")');
code = code.replace(/await import\("\\.\/memory-engine"\)/g, 'await import("./memory-engine.js")');
code = code.replace(/role: m.direction === "INBOUND" \? "user" : "assistant",/g, 'role: (m.direction === "INBOUND" ? "user" : "assistant") as any,');

fs.writeFileSync(filePath, code);
