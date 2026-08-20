#!/bin/bash
sed -i '' 's/private container: MedusaContainer/private service: any/g' src/modules/agent-operations/agent-engine.ts
sed -i '' 's/this.__container__/this/g' src/modules/agent-operations/service.ts
sed -i '' 's/import { executeKnowledgeSearch } from ".\/read-tool-runtime";//g' src/modules/agent-operations/agent-engine.ts
