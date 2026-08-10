import type {
  ILockingModule,
  IOrderModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  buildOrderSlaEventId,
  detectOrderSlaException,
  ORDER_FULFILLMENT_DUE_AT_METADATA_KEY,
  ORDER_PAYMENT_DUE_AT_METADATA_KEY,
} from "../modules/agent-operations/order-exception-detector"
import { executeOrderRead } from "../modules/agent-operations/order-read-runtime"
import { ingestOrderExceptionEventWorkflow } from "../workflows/agent-operations/ingest-order-exception-event"

const DETECTOR_SOURCE = "order-sla-detector"
const DEFAULT_SCAN_LIMIT = 100
const MAX_SCAN_LIMIT = 500
const DEFAULT_MAX_PAGES = 5
const MAX_SCAN_PAGES = 20
const ORDER_LOCK_TIMEOUT_SECONDS = 30

export type OrderExceptionScanResult = {
  candidates: number
  created: number
  duplicates: number
  errors: number
  pages: number
  scanned: number
  skipped_without_sla: number
}

function scanLimit() {
  const configured = Number.parseInt(
    process.env.ORDER_EXCEPTION_DETECTOR_SCAN_LIMIT ?? "",
    10
  )

  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_SCAN_LIMIT
  }

  return Math.min(configured, MAX_SCAN_LIMIT)
}

function maxScanPages() {
  const configured = Number.parseInt(
    process.env.ORDER_EXCEPTION_DETECTOR_MAX_PAGES ?? "",
    10
  )

  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_MAX_PAGES
  }

  return Math.min(configured, MAX_SCAN_PAGES)
}

function hasSlaMetadata(metadata: Record<string, unknown> | null | undefined) {
  return Boolean(
    metadata?.[ORDER_PAYMENT_DUE_AT_METADATA_KEY] ||
      metadata?.[ORDER_FULFILLMENT_DUE_AT_METADATA_KEY]
  )
}

export async function scanOrderExceptions(
  container: MedusaContainer,
  now = new Date()
): Promise<OrderExceptionScanResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const locking = container.resolve<ILockingModule>(Modules.LOCKING)
  const pageSize = scanLimit()
  const result: OrderExceptionScanResult = {
    candidates: 0,
    created: 0,
    duplicates: 0,
    errors: 0,
    pages: 0,
    scanned: 0,
    skipped_without_sla: 0,
  }

  for (let page = 0; page < maxScanPages(); page += 1) {
    const candidates = await orders.listOrders(
      {},
      {
        order: { updated_at: "DESC" },
        select: ["id", "metadata", "status"],
        skip: page * pageSize,
        take: pageSize,
      }
    )

    if (!candidates.length) {
      break
    }

    result.candidates += candidates.length
    result.pages += 1

    for (const candidate of candidates) {
      if (!hasSlaMetadata(candidate.metadata)) {
        result.skipped_without_sla += 1
        continue
      }

      result.scanned += 1
      try {
        await locking.execute(
          `agent-order-sla:${candidate.id}`,
          async () => {
            const execution = await executeOrderRead(
              container,
              { order_id: candidate.id },
              "order-sla-detector"
            )
            const detected = detectOrderSlaException(
              execution.output,
              candidate.metadata,
              now
            )

            if (!detected) {
              return
            }

            const eventId = buildOrderSlaEventId(candidate.id, detected)
            const tenantId =
              typeof candidate.metadata?.agent_tenant_id === "string"
                ? candidate.metadata.agent_tenant_id
                : "default"
            const { result: ingested } =
              await ingestOrderExceptionEventWorkflow(container).run({
                input: {
                  correlation_id: `order:${candidate.id}:sla`,
                  event_id: eventId,
                  event_type: "order.exception",
                  event_version: 1,
                  occurred_at: now.toISOString(),
                  payload: {
                    details: {
                      detector: "order-sla-detector@1.0.0",
                      reason: detected.reason,
                    },
                    detected_at: now.toISOString(),
                    exception_type: detected.exception_type,
                    order_id: candidate.id,
                    sla_due_at: detected.due_at,
                  },
                  source: DETECTOR_SOURCE,
                  subject_id: candidate.id,
                  subject_type: "order",
                  tenant_id: tenantId,
                },
              })

            if (ingested.duplicate) {
              result.duplicates += 1
            } else {
              result.created += 1
            }
          },
          { timeout: ORDER_LOCK_TIMEOUT_SECONDS }
        )
      } catch (error) {
        result.errors += 1
        const message = error instanceof Error ? error.message : "Unknown error"
        logger.error(`Order ${candidate.id} SLA detection failed: ${message}`)
      }
    }

    if (candidates.length < pageSize) {
      break
    }
  }

  return result
}

export default async function detectOrderExceptionsJob(
  container: MedusaContainer
) {
  if (process.env.ORDER_EXCEPTION_DETECTOR_ENABLED === "false") {
    return
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const result = await scanOrderExceptions(container)

  if (result.created || result.duplicates || result.errors) {
    logger.info(
      `Order exception detector completed: ${result.created} created, ${result.duplicates} duplicates, ${result.errors} errors, ${result.skipped_without_sla} without SLA metadata across ${result.pages} pages.`
    )
  }
}

export const config = {
  name: "detect-order-exceptions",
  schedule: "*/5 * * * *",
}
