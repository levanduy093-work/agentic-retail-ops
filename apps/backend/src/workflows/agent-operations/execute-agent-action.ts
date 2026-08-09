import type {
  IInventoryService,
  ILockingModule,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AGENT_OPERATIONS_MODULE } from "../../modules/agent-operations"
import AgentOperationsModuleService from "../../modules/agent-operations/service"
import {
  evaluateInventoryTransfer,
  getInventoryPositions,
  InventoryTransferInput,
} from "../../modules/agent-operations/tools/inventory-tools"
import { ExecuteAgentActionInput } from "../../modules/agent-operations/types"

const DEFAULT_LEASE_DURATION_MS = 60_000
const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_MAX_RETRY_DELAY_MS = 15 * 60_000
const DEFAULT_RETRY_BASE_DELAY_MS = 5_000

type ClaimResult = Awaited<
  ReturnType<AgentOperationsModuleService["claimAgentAction"]>
>

type TransferResult = {
  code?: string
  message?: string
  outcome: "CONFLICT" | "SKIPPED" | "SUCCEEDED"
  positions_after?: unknown
  positions_before?: unknown
  quantity?: number
}

const claimAgentActionStep = createStep(
  "claim-agent-action",
  async (input: ExecuteAgentActionInput, { container }) => {
    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const claimedAt = new Date().toISOString()
    const result = await service.claimAgentAction({
      action_request_id: input.action_request_id,
      claimed_at: claimedAt,
      lease_duration_ms:
        input.lease_duration_ms ?? DEFAULT_LEASE_DURATION_MS,
      worker_id: input.worker_id,
    })

    return new StepResponse(
      result,
      result.claimed
        ? {
            action_request_id: input.action_request_id,
            max_attempts: input.max_attempts ?? DEFAULT_MAX_ATTEMPTS,
            max_retry_delay_ms:
              input.max_retry_delay_ms ?? DEFAULT_MAX_RETRY_DELAY_MS,
            retry_base_delay_ms:
              input.retry_base_delay_ms ?? DEFAULT_RETRY_BASE_DELAY_MS,
            worker_id: input.worker_id,
          }
        : null
    )
  },
  async (input, { container }) => {
    if (!input) {
      return
    }

    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    await service.markAgentActionFailed({
      ...input,
      error: "Action Gateway workflow was compensated",
      failed_at: new Date().toISOString(),
    })
  }
)

type ExecuteInventoryTransferStepInput = {
  claim: ClaimResult
  dispatch: ExecuteAgentActionInput
}

type TransferCompensationInput = {
  inventory_item_id: string
  quantity: number
  source_location_id: string
  target_location_id: string
} | null

const executeInventoryTransferStep = createStep<
  ExecuteInventoryTransferStepInput,
  TransferResult,
  TransferCompensationInput
>(
  "execute-inventory-transfer",
  async ({ claim }, { container }) => {
    if (!claim.claimed || !claim.approval || !claim.incident || !claim.recommendation) {
      return new StepResponse<TransferResult, TransferCompensationInput>(
        { outcome: "SKIPPED" },
        null
      )
    }

    const actionInput = InventoryTransferInput.safeParse(claim.action.input)

    if (!actionInput.success) {
      return new StepResponse<TransferResult, TransferCompensationInput>(
        {
          code: "INVALID_TOOL_INPUT",
          message: actionInput.error.message,
          outcome: "CONFLICT",
        },
        null
      )
    }

    const now = Date.now()
    const approvalIsUsable =
      claim.approval.status === "APPROVED" &&
      new Date(claim.approval.expires_at).getTime() > now
    const recommendationIsUsable =
      claim.recommendation.status === "APPROVED" &&
      claim.recommendation.action_type === "INVENTORY_TRANSFER"
    const incidentIsExecutable = claim.incident.status === "EXECUTING"
    const toolIsAllowed =
      claim.action.tool_name === "inventory.execute-transfer" &&
      claim.action.tool_version === "1.0.0"

    if (
      !approvalIsUsable ||
      !recommendationIsUsable ||
      !incidentIsExecutable ||
      !toolIsAllowed
    ) {
      return new StepResponse<TransferResult, TransferCompensationInput>(
        {
          code: "ACTION_GATE_REJECTED",
          message:
            "Approval, recommendation, incident state, or tool contract is no longer valid.",
          outcome: "CONFLICT",
        },
        null
      )
    }

    const inventoryService = container.resolve<IInventoryService>(
      Modules.INVENTORY
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)
    const transfer = actionInput.data

    const execution = await locking.execute(
      `agent-inventory-transfer:${transfer.inventory_item_id}`,
      async () => {
        const positionsBefore = await getInventoryPositions(inventoryService, {
          inventory_item_id: transfer.inventory_item_id,
          location_ids: [
            transfer.source_location_id,
            transfer.target_location_id,
          ],
        })
        const evaluation = evaluateInventoryTransfer(
          transfer,
          positionsBefore
        )

        if (!evaluation.allowed) {
          return {
            compensation: null,
            result: {
              code: evaluation.code,
              message: evaluation.message,
              outcome: "CONFLICT",
              positions_before: positionsBefore,
            },
          } satisfies {
            compensation: TransferCompensationInput
            result: TransferResult
          }
        }

        await inventoryService.adjustInventory([
          {
            adjustment: -transfer.quantity,
            inventoryItemId: transfer.inventory_item_id,
            locationId: transfer.source_location_id,
          },
          {
            adjustment: transfer.quantity,
            inventoryItemId: transfer.inventory_item_id,
            locationId: transfer.target_location_id,
          },
        ])
        const positionsAfter = await getInventoryPositions(inventoryService, {
          inventory_item_id: transfer.inventory_item_id,
          location_ids: [
            transfer.source_location_id,
            transfer.target_location_id,
          ],
        })

        return {
          compensation: transfer,
          result: {
            outcome: "SUCCEEDED",
            positions_after: positionsAfter,
            positions_before: positionsBefore,
            quantity: transfer.quantity,
          },
        } satisfies {
          compensation: TransferCompensationInput
          result: TransferResult
        }
      }
    )

    return new StepResponse<TransferResult, TransferCompensationInput>(
      execution.result,
      execution.compensation
    )
  },
  async (transfer, { container }) => {
    if (!transfer) {
      return
    }

    const inventoryService = container.resolve<IInventoryService>(
      Modules.INVENTORY
    )
    const locking = container.resolve<ILockingModule>(Modules.LOCKING)

    await locking.execute(
      `agent-inventory-transfer:${transfer.inventory_item_id}`,
      async () => {
        await inventoryService.adjustInventory([
          {
            adjustment: transfer.quantity,
            inventoryItemId: transfer.inventory_item_id,
            locationId: transfer.source_location_id,
          },
          {
            adjustment: -transfer.quantity,
            inventoryItemId: transfer.inventory_item_id,
            locationId: transfer.target_location_id,
          },
        ])
      }
    )
  }
)

type FinalizeAgentActionStepInput = {
  claim: ClaimResult
  dispatch: ExecuteAgentActionInput
  transfer: TransferResult
}

const finalizeAgentActionStep = createStep(
  "finalize-agent-action",
  async (input: FinalizeAgentActionStepInput, { container }) => {
    if (!input.claim.claimed || input.transfer.outcome === "SKIPPED") {
      return new StepResponse({
        action: input.claim.action,
        duplicate: input.claim.duplicate,
        skipped: true,
      })
    }

    const service = container.resolve<AgentOperationsModuleService>(
      AGENT_OPERATIONS_MODULE
    )
    const result = await service.finalizeAgentAction({
      action_request_id: input.dispatch.action_request_id,
      actor_id: input.dispatch.actor_id,
      actor_type: input.dispatch.actor_type,
      completed_at: new Date().toISOString(),
      outcome: input.transfer.outcome,
      result: input.transfer,
      worker_id: input.dispatch.worker_id,
    })

    return new StepResponse({ ...result, skipped: false })
  }
)

export const executeAgentActionWorkflow = createWorkflow(
  "execute-agent-action",
  function (input: ExecuteAgentActionInput) {
    const claim = claimAgentActionStep(input)
    const transfer = executeInventoryTransferStep({ claim, dispatch: input })
    const result = finalizeAgentActionStep({ claim, dispatch: input, transfer })

    return new WorkflowResponse(result)
  }
)
