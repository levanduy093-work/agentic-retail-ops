const fs = require('fs');
const path = 'src/workflows/agent-operations/answer-customer-knowledge-question.ts';
let code = fs.readFileSync(path, 'utf8');

const startStr = "const inbound = await service.retrieveAgentMessage(input.inbound_message_id)";
const endStr = "const result = await locking.execute(";

const startIdx = code.indexOf(startStr) + startStr.length;
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + '\n    ' + code.substring(endIdx);
    fs.writeFileSync(path, code);
    console.log("Cleaned up workflow");
} else {
    console.log("Could not find boundaries");
}
