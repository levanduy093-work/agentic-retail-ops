import { MedusaError } from "@medusajs/framework/utils"
import { IncidentStatus } from "./types"

const ALLOWED_INCIDENT_TRANSITIONS: Record<
  IncidentStatus,
  readonly IncidentStatus[]
> = {
  RECEIVED: ["INVESTIGATING", "CANCELLED", "FAILED"],
  INVESTIGATING: ["OPTIONS_READY", "RESOLVED", "ESCALATED", "FAILED"],
  OPTIONS_READY: [
    "AWAITING_APPROVAL",
    "EXECUTING",
    "RESOLVED",
    "ESCALATED",
    "CANCELLED",
  ],
  AWAITING_APPROVAL: [
    "EXECUTING",
    "REJECTED",
    "CANCELLED",
    "ESCALATED",
  ],
  EXECUTING: ["OPTIONS_READY", "MONITORING", "FAILED", "ESCALATED"],
  MONITORING: ["RESOLVED", "FAILED", "ESCALATED"],
  RESOLVED: [],
  REJECTED: [],
  CANCELLED: [],
  FAILED: [],
  ESCALATED: [],
}

export function canTransitionIncident(
  from: IncidentStatus,
  to: IncidentStatus
) {
  return ALLOWED_INCIDENT_TRANSITIONS[from].includes(to)
}

export function assertIncidentTransition(
  from: IncidentStatus,
  to: IncidentStatus
) {
  if (!canTransitionIncident(from, to)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Incident cannot transition from ${from} to ${to}.`
    )
  }
}
