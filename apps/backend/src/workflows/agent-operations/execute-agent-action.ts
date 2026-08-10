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
import { AGENT_TOOL_REGISTRY } from "../../modules/agent-operations/tool-registry"
import { executeAgentTool } from "../../modules/agent-operations/tool-executor"
import {
  evaluateInventoryTransfer,
  getInventoryPositions,
  INVENTORY_EXECUTE_TRANSFER_TOOL,
  INVENTORY_GET_POSITION_TOOL,
  InventoryGetPositionInput,
  InventoryGetPositionOutput,
  InventoryTransferInput,
  InventoryTransferOutput,
} from "../../modules/agent-operations/tools/inventory-tools"
import { ExecuteAgentActionInput } from "../../modules/agent-operations/types"

const DEFAULT_LEASE_DURATION_MS = INVENTORY_EXECUTE_TRANSFER_TOOL.timeout_ms
const DEFAULT_MAX_ATTEMPTS =
  INVENTORY_EXECUTE_TRANSFER_TOOL.retry.max_attempts
const DEFAULT_MAX_RETRY_DELAY_MS =
  INVENTORY_EXECUTE_TRANSFER_TOOL.retry.max_delay_ms
const DEFAULT_RETRY_BASE_DELAY_MS =
  INVENTORY_EXECUTE_TRANSFER_TOOL.retry.base_delay_ms

type ClaimResult = Awaited<
  ReturnType<AgentOperationsModuleService["claimAgentAction"]>
>

type TransferResult =
  | InventoryTransferOutput
  | {
      code?: string
      message?: string
      outcome: "CONFLICT" | "SKIPPED"
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
  async ({ claim, dispatch }, { container }) => {
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
      claim.action.tool_name === INVENTORY_EXECUTE_TRANSFER_TOOL.name &&
      claim.action.tool_version === INVENTORY_EXECUTE_TRANSFER_TOOL.version

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

    const execution = await locking.execute(
      `agent-inventory-transfer:${actionInput.data.inventory_item_id}`,
      async () => {
        const toolExecution = await executeAgentTool<
          InventoryTransferInput,
          InventoryTransferOutput
        >(
          AGENT_TOOL_REGISTRY,
          {
            authority: {
              action_request_id: claim.action.id,
              actor_id: dispatch.actor_id,
              approval_id: claim.approval.id,
              granted_permissions: [
                INVENTORY_EXECUTE_TRANSFER_TOOL.permission,
              ],
              idempotency_key: claim.action.idempotency_key,
              mode: "ACTION_GATEWAY",
            },
            input: actionInput.data,
            tool_name: claim.action.tool_name,
            tool_version: claim.action.tool_version,
          },
          async (transfer) => {
            const positionsBeforeExecution = await executeAgentTool<
              InventoryGetPositionInput,
              InventoryGetPositionOutput
            >(
              AGENT_TOOL_REGISTRY,
              {
                authority: {
                  actor_id: dispatch.actor_id,
                  granted_permissions: [
                    INVENTORY_GET_POSITION_TOOL.permission,
                  ],
                  mode: "DIRECT",
                },
                input: {
                  inventory_item_id: transfer.inventory_item_id,
                  location_ids: [
                    transfer.source_location_id,
                    transfer.target_location_id,
                  ],
                },
                tool_name: INVENTORY_GET_POSITION_TOOL.name,
                tool_version: INVENTORY_GET_POSITION_TOOL.version,
              },
              async (input) => ({
                positions: await getInventoryPositions(
                  inventoryService,
                  input
                ),
              })
            )
            const positionsBefore = positionsBeforeExecution.output.positions
            const evaluation = evaluateInventoryTransfer(
              transfer,
              positionsBefore
            )

            if (!evaluation.allowed) {
              return {
                code: evaluation.code,
                message: evaluation.message,
                outcome: "CONFLICT",
                positions_before: positionsBefore,
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
            const positionsAfterExecution = await executeAgentTool<
              InventoryGetPositionInput,
              InventoryGetPositionOutput
            >(
              AGENT_TOOL_REGISTRY,
              {
                authority: {
                  actor_id: dispatch.actor_id,
                  granted_permissions: [
                    INVENTORY_GET_POSITION_TOOL.permission,
                  ],
                  mode: "DIRECT",
                },
                input: {
                  inventory_item_id: transfer.inventory_item_id,
                  location_ids: [
                    transfer.source_location_id,
                    transfer.target_location_id,
                  ],
                },
                tool_name: INVENTORY_GET_POSITION_TOOL.name,
                tool_version: INVENTORY_GET_POSITION_TOOL.version,
              },
              async (input) => ({
                positions: await getInventoryPositions(
                  inventoryService,
                  input
                ),
              })
            )

            return {
              outcome: "SUCCEEDED",
              positions_after: positionsAfterExecution.output.positions,
              positions_before: positionsBefore,
              quantity: transfer.quantity,
            }
          }
        )

        return {
          compensation:
            toolExecution.output.outcome === "SUCCEEDED"
              ? toolExecution.input
              : null,
          result: toolExecution.output,
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
