const fs = require('fs');
const filePath = 'src/modules/agent-operations/service.ts';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const methodStart = lines.findIndex(l => l.includes('async processCustomerKnowledgeQuestion('));
if (methodStart === -1) {
    console.log("Method not found");
    process.exit(1);
}

let endIdx = methodStart;
let braceCount = 0;
let started = false;
for (let i = methodStart; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('{')) braceCount += (line.match(/\{/g) || []).length;
    if (line.includes('}')) braceCount -= (line.match(/\}/g) || []).length;
    if (braceCount > 0) started = true;
    if (started && braceCount === 0) {
        endIdx = i;
        break;
    }
}

console.log(`Method starts at ${methodStart}, ends at ${endIdx}`);

const stub = [
    '  async processCustomerKnowledgeQuestion(',
    '    input: any,',
    '    @MedusaContext() sharedContext: Context = {}',
    '  ) {',
    '    throw new Error("Deprecated: Use processCustomerMessageAgentic instead.");',
    '  }'
];

lines.splice(methodStart, endIdx - methodStart + 1, ...stub);

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Stubbed processCustomerKnowledgeQuestion successfully.');
