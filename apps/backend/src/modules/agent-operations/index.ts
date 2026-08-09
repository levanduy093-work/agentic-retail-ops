import { Module } from "@medusajs/framework/utils"
import AgentOperationsModuleService from "./service"

export const AGENT_OPERATIONS_MODULE = "agentOperations"

export default Module(AGENT_OPERATIONS_MODULE, {
  service: AgentOperationsModuleService,
})
