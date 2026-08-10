import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { scanOrderExceptions } from "../jobs/detect-order-exceptions"

export default async function runOrderDetectorScan({ container }: ExecArgs) {
  assert.equal(
    process.env.REDIS_INFRASTRUCTURE_ENABLED,
    "true",
    "Redis infrastructure must be enabled for the race verification"
  )

  const result = await scanOrderExceptions(container)

  assert.equal(result.errors, 0)
  console.log(
    JSON.stringify({
      result,
      status: "SCAN_COMPLETED",
      worker: process.env.ORDER_DETECTOR_WORKER ?? "unknown",
    })
  )
}
