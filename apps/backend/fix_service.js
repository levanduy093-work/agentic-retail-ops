const fs = require('fs');
const filePath = 'src/modules/agent-operations/service.ts';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

const methodStart = lines.findIndex(l => l.includes('async processCustomerMessageAgentic'));
const methodEnd = methodStart + 43; // Lines 350 to 393, inclusive (0-indexed array)

// Actually, let's find the closing brace exactly
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

// Extract the method lines
const methodLines = lines.slice(methodStart - 1, endIdx + 1); // include the comment before it

// Remove them from current position
lines.splice(methodStart - 1, endIdx - methodStart + 2);

// Find the "}) {" line
const classBodyStart = lines.findIndex(l => l.startsWith('}) {'));
console.log(`Class body starts at ${classBodyStart}`);

// Insert the method just after the class body starts
lines.splice(classBodyStart + 1, 0, ...methodLines);

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Fixed service.ts syntax error');
