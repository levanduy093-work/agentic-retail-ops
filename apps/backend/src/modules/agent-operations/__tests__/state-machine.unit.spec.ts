import {
  assertIncidentTransition,
  canTransitionIncident,
} from "../state-machine"

describe("agent incident state machine", () => {
  it("allows the approval-gated happy path", () => {
    expect(canTransitionIncident("RECEIVED", "INVESTIGATING")).toBe(true)
    expect(canTransitionIncident("INVESTIGATING", "OPTIONS_READY")).toBe(true)
    expect(canTransitionIncident("OPTIONS_READY", "AWAITING_APPROVAL")).toBe(
      true
    )
    expect(canTransitionIncident("AWAITING_APPROVAL", "EXECUTING")).toBe(true)
    expect(canTransitionIncident("EXECUTING", "MONITORING")).toBe(true)
    expect(canTransitionIncident("MONITORING", "RESOLVED")).toBe(true)
  })

  it("returns to options when live state invalidates an approved action", () => {
    expect(canTransitionIncident("EXECUTING", "OPTIONS_READY")).toBe(true)
  })

  it("rejects transitions out of a terminal state", () => {
    expect(() => assertIncidentTransition("RESOLVED", "EXECUTING")).toThrow(
      "Incident cannot transition"
    )
  })
})
