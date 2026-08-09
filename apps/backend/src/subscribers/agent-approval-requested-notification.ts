import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createApprovalNotificationWorkflow } from "../workflows/agent-operations/create-approval-notification"

type ApprovalRequestedEventData = {
  agent_outbox: {
    event_id: string
  }
  approval_id: string
  incident_id: string
  recommendation_id: string
}

export default async function agentApprovalRequestedNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<ApprovalRequestedEventData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const { result } = await createApprovalNotificationWorkflow(container).run({
      input: {
        approval_id: data.approval_id,
        incident_id: data.incident_id,
        outbox_event_id: data.agent_outbox.event_id,
        recommendation_id: data.recommendation_id,
      },
    })

    logger.info(
      `Agent approval notification ${result.message.id} is available in conversation ${result.conversation.id}.`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error(`Failed to create agent approval notification: ${message}`)
  }
}

export const config: SubscriberConfig = {
  event: "agent.approval.requested",
}
