const fs = require('fs');

const filePath = 'src/modules/agent-operations/service.ts';
let code = fs.readFileSync(filePath, 'utf8');

function removeMethod(methodName) {
    const startIndex = code.indexOf(`async ${methodName}(`);
    if (startIndex === -1) {
        console.log(`Method ${methodName} not found.`);
        return;
    }
    
    // Find the opening brace of the method body
    const bodyStartIndex = code.indexOf('{', startIndex);
    if (bodyStartIndex === -1) return;
    
    let braceCount = 1;
    let i = bodyStartIndex + 1;
    let inString = false;
    let stringChar = '';
    
    while (i < code.length && braceCount > 0) {
        const char = code[i];
        const prevChar = code[i-1];
        
        if (!inString) {
            if (char === '"' || char === "'" || char === '`') {
                inString = true;
                stringChar = char;
            } else if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
            }
        } else {
            if (char === stringChar && prevChar !== '\\') {
                inString = false;
            }
        }
        i++;
    }
    
    if (braceCount === 0) {
        const endIndex = i;
        const methodCode = code.substring(startIndex, endIndex);
        const linesRemoved = methodCode.split('\n').length;
        
        // Replace with a deprecated stub
        const replacement = `async ${methodName}(...args: any[]) {\n    throw new Error("Deprecated in Agentic Upgrade");\n  }`;
        
        code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
        console.log(`Replaced ${methodName} (removed ~${linesRemoved} lines)`);
    } else {
        console.log(`Failed to parse ${methodName}`);
    }
}

removeMethod('processCustomerKnowledgeQuestion');
removeMethod('shouldReadCatalogForCustomerMessage');
removeMethod('extractCustomerProductPreferences');
// Also the legacy intent router
removeMethod('processCustomerMessage');
removeMethod('refreshConversationMemoryLegacy');

fs.writeFileSync(filePath, code);
console.log("Cleanup complete!");
