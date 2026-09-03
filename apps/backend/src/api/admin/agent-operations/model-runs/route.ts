import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AGENT_OPERATIONS_MODULE } from "../../../../modules/agent-operations"
import AgentOperationsModuleService from "../../../../modules/agent-operations/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve<AgentOperationsModuleService>(
    AGENT_OPERATIONS_MODULE
  )
  const [runs, count] = await service.listAndCountAgentModelRuns({}, {
    order: { created_at: "DESC" },
    take: 100,
  })
  const usageByModel = Object.values(
    runs.reduce<Record<string, {
      input_tokens: number
      model: string
      output_tokens: number
      provider: string
      runs: number
      tracked_runs: number
    }>>((summary, run) => {
      const key = `${run.provider}:${run.model}`
      const entry = summary[key] ?? {
        input_tokens: 0,
        model: run.model,
        output_tokens: 0,
        provider: run.provider,
        runs: 0,
        tracked_runs: 0,
      }
      entry.runs += 1
      if (run.input_tokens !== null || run.output_tokens !== null) {
        entry.tracked_runs += 1
        entry.input_tokens += run.input_tokens ?? 0
        entry.output_tokens += run.output_tokens ?? 0
      }
      summary[key] = entry
      return summary
    }, {})
  )
  const usageByProvider = ["OPENAI", "GEMINI", "DEEPSEEK"].map((provider) => {
    const entries = usageByModel.filter(
      (entry) => entry.provider.toUpperCase() === provider
    )
    const trackedRuns = entries.reduce(
      (total, entry) => total + entry.tracked_runs,
      0
    )
    const inputTokens = entries.reduce(
      (total, entry) => total + entry.input_tokens,
      0
    )
    const outputTokens = entries.reduce(
      (total, entry) => total + entry.output_tokens,
      0
    )
    const totalTokens = inputTokens + outputTokens
    return {
      average_tokens_per_request:
        trackedRuns > 0 ? Math.round(totalTokens / trackedRuns) : 0,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      provider,
      runs: entries.reduce((total, entry) => total + entry.runs, 0),
      total_tokens: totalTokens,
      tracked_runs: trackedRuns,
    }
  })
  res.json({
    count,
    runs,
    usage_summary: {
      note: "Token totals cover the latest 100 model runs. Configure per-model pricing before treating cost_micros as an estimate.",
      sampled_runs: runs.length,
      by_model: usageByModel,
      by_provider: usageByProvider,
      input_tokens: usageByProvider.reduce((total, item) => total + item.input_tokens, 0),
      output_tokens: usageByProvider.reduce((total, item) => total + item.output_tokens, 0),
      total_tokens: usageByProvider.reduce((total, item) => total + item.total_tokens, 0),
    },
  })
}
