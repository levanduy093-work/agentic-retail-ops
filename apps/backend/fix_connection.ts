import fs from 'fs';

let code = fs.readFileSync('src/modules/agent-operations/service.ts', 'utf8');

const target = `connection_id: inbound.connection_id || "default",`;
const replacement = `connection_id: typeof ((conversation.metadata || {}) as Record<string, unknown>).connection_id === "string" ? ((conversation.metadata || {}) as Record<string, unknown>).connection_id as string : "default",`;

code = code.replace(target, replacement);
fs.writeFileSync('src/modules/agent-operations/service.ts', code);
console.log("Fixed connection ID.");
