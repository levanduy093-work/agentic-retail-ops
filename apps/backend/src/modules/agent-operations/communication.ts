type ApprovalRequestedMessageInput = {
  approval: {
    expires_at: Date | string
    id: string
    required_role: string
  }
  incident: {
    id: string
    priority: string
    title: string
  }
  recommendation: {
    id: string
    summary: string
  }
}

type ApprovalDecisionResultMessageInput = {
  action_request_id?: string | null
  approval_id: string
  decision: "APPROVED" | "REJECTED"
  duplicate: boolean
}

export function isApprovalDecisionCommandTarget(
  conversation: { topic_id: string; topic_type: string },
  command: { approval_id: string }
) {
  return (
    conversation.topic_type === "APPROVAL" &&
    conversation.topic_id === command.approval_id
  )
}

export function buildApprovalRequestedMessage(
  input: ApprovalRequestedMessageInput
) {
  return {
    body: `${input.incident.title}. Đề xuất: ${input.recommendation.summary}. Cần ${input.approval.required_role} phê duyệt trước ${new Date(input.approval.expires_at).toISOString()}.`,
    structured_content: {
      approval_id: input.approval.id,
      available_commands: ["APPROVAL_DECISION"],
      expires_at: new Date(input.approval.expires_at).toISOString(),
      incident_id: input.incident.id,
      priority: input.incident.priority,
      recommendation_id: input.recommendation.id,
      required_role: input.approval.required_role,
    },
  }
}

export function buildApprovalDecisionResultMessage(
  input: ApprovalDecisionResultMessageInput
) {
  const actionText = input.action_request_id
    ? ` Action ${input.action_request_id} đã được tạo.`
    : ""
  const duplicateText = input.duplicate
    ? " Đây là lệnh lặp lại nên hệ thống không tạo tác vụ mới."
    : ""

  return {
    body: `Approval ${input.approval_id} đã được ${input.decision}.${actionText}${duplicateText}`,
    structured_content: {
      action_request_id: input.action_request_id ?? null,
      approval_id: input.approval_id,
      decision: input.decision,
      duplicate: input.duplicate,
    },
  }
}
