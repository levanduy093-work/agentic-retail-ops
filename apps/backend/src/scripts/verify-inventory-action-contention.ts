import assert from "node:assert/strict"
import {
  createInventoryItemsWorkflow,
  createStockLocationsWorkflow,
  deleteInventoryItemWorkflow,
  deleteInventoryLevelsWorkflow,
  deleteStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"
import { ExecArgs, IInventoryService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { getInventoryPositions } from "../modules/agent-operations/tools/inventory-tools"
import { decideAgentApprovalWorkflow } from "../workflows/agent-operations/decide-agent-approval"
import { executeAgentActionWorkflow } from "../workflows/agent-operations/execute-agent-action"
import { ingestInventoryLowEventWorkflow } from "../workflows/agent-operations/ingest-inventory-low-event"

export default async function verifyInventoryActionContention({
  container,
}: ExecArgs) {
  const inventoryService = container.resolve<IInventoryService>(
    Modules.INVENTORY
  )
  const verificationId = `verify-inventory-contention-${Date.now()}`
  const locationIds: string[] = []
  let inventoryItemId: string | null = null

  try {
    const { result: locations } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          { name: `${verificationId} source` },
          { name: `${verificationId} target-a` },
          { name: `${verificationId} target-b` },
        ],
      },
    })
    locationIds.push(...locations.map((location) => location.id))
    const [sourceLocationId, targetLocationAId, targetLocationBId] = locationIds

    const { result: items } = await createInventoryItemsWorkflow(container).run(
      {
        input: {
          items: [
            {
              location_levels: [
                { location_id: sourceLocationId, stocked_quantity: 15 },
                { location_id: targetLocationAId, stocked_quantity: 0 },
                { location_id: targetLocationBId, stocked_quantity: 0 },
              ],
              sku: `AGENT-RACE-${Date.now()}`,
              title: "Agent inventory contention verification item",
            },
          ],
        },
      }
    )
    inventoryItemId = items[0].id

    const createAction = async (targetLocationId: string, suffix: string) => {
      const eventId = `${verificationId}-${suffix}`
      const { result: ingestion } = await ingestInventoryLowEventWorkflow(
        container
      ).run({
        input: {
          correlation_id: eventId,
          event_id: eventId,
          event_type: "inventory.low",
          event_version: 1,
          occurred_at: new Date().toISOString(),
          payload: {
            alternative_locations: [
              {
                available_quantity: 15,
                location_id: sourceLocationId,
              },
            ],
            available_quantity: 0,
            inventory_item_id: inventoryItemId!,
            location_id: targetLocationId,
            required_quantity: 10,
          },
          source: "inventory-contention-runtime-verifier",
          subject_id: inventoryItemId!,
          subject_type: "inventory_item",
          tenant_id: "default",
        },
      })
      assert.ok(ingestion.approval)

      const { result: decision } = await decideAgentApprovalWorkflow(
        container
      ).run({
        input: {
          actor_id: "inventory-contention-operations-manager",
          approval_id: ingestion.approval.id,
          decision: "APPROVED",
          reason: "Approve controlled inventory contention verification",
        },
      })
      assert.ok(decision.action_request)
      return decision.action_request.id
    }

    const [actionAId, actionBId] = await Promise.all([
      createAction(targetLocationAId, "a"),
      createAction(targetLocationBId, "b"),
    ])
    const executions = await Promise.all([
      executeAgentActionWorkflow(container).run({
        input: {
          action_request_id: actionAId,
          actor_id: "inventory-contention-worker-a",
          actor_type: "worker",
          worker_id: "inventory-contention-worker-a",
        },
      }),
      executeAgentActionWorkflow(container).run({
        input: {
          action_request_id: actionBId,
          actor_id: "inventory-contention-worker-b",
          actor_type: "worker",
          worker_id: "inventory-contention-worker-b",
        },
      }),
    ])
    const statuses = executions.map(({ result }) => result.action.status).sort()
    assert.deepEqual(statuses, ["CONFLICT", "SUCCEEDED"])

    const positions = await getInventoryPositions(inventoryService, {
      inventory_item_id: inventoryItemId,
      location_ids: locationIds,
    })
    const quantities = Object.fromEntries(
      positions.map((position) => [
        position.location_id,
        position.stocked_quantity,
      ])
    )
    assert.equal(quantities[sourceLocationId], 5)
    assert.deepEqual(
      [quantities[targetLocationAId], quantities[targetLocationBId]].sort(
        (left, right) => Number(left) - Number(right)
      ),
      [0, 10]
    )

    console.log(
      JSON.stringify(
        {
          action_statuses: statuses,
          inventory_item_id: inventoryItemId,
          location_count: locationIds.length,
          source_quantity_after: quantities[sourceLocationId],
          status: "INVENTORY_CONTENTION_VERIFIED",
          target_quantities_after: [
            quantities[targetLocationAId],
            quantities[targetLocationBId],
          ].sort((left, right) => Number(left) - Number(right)),
        },
        null,
        2
      )
    )
  } finally {
    if (inventoryItemId) {
      await deleteInventoryLevelsWorkflow(container).run({
        input: { force: true, inventory_item_id: inventoryItemId },
      })
      await deleteInventoryItemWorkflow(container).run({
        input: [inventoryItemId],
      })
    }
    if (locationIds.length) {
      await deleteStockLocationsWorkflow(container).run({
        input: { ids: locationIds },
      })
    }
  }
}
