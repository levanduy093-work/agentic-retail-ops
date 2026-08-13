import type { ExecArgs } from "@medusajs/framework/types"
import { AGENT_OPERATIONS_MODULE } from "../modules/agent-operations"
import AgentOperationsModuleService from "../modules/agent-operations/service"

const CUSTOMER_AGENT_IDS = new Set([
  "conversation-memory-agent",
  "customer-intent-router",
  "customer-knowledge-agent",
  "customer-product-advisor",
])

function percentile(values: number[], ratio: number) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(Math.ceil(sorted.length * ratio) - 1, sorted.length - 1)]
}

export default async function analyzeCustomerAiLatency({ container }: ExecArgs) {
  const service = container.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const runs = await service.listAgentModelRuns(
    { status: "SUCCEEDED" },
    { order: { completed_at: "DESC" }, take: 2_000 }
  )
  const customerRuns = runs.filter(
    (run) => CUSTOMER_AGENT_IDS.has(run.agent_id) && run.latency_ms !== null
  )
  const groups = new Map<string, number[]>()
  for (const run of customerRuns) {
    const key = `${run.agent_id}:${run.provider}:${run.model}`
    const values = groups.get(key) ?? []
    values.push(Number(run.latency_ms))
    groups.set(key, values)
  }

  console.log(
    JSON.stringify(
      {
        analyzed_runs: customerRuns.length,
        groups: [...groups.entries()].map(([key, values]) => ({
          average_ms: Math.round(
            values.reduce((total, value) => total + value, 0) / values.length
          ),
          key,
          p50_ms: percentile(values, 0.5),
          p95_ms: percentile(values, 0.95),
          run_count: values.length,
        })),
      },
      null,
      2
    )
  )
}
