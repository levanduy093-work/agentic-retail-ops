import { summarizeNativeToolLoopStatus } from "../native-tool-loop-status"

describe("native tool loop status", () => {
  it("summarizes eligible active runs without exposing raw customer tool data", () => {
    const status = summarizeNativeToolLoopStatus("ACTIVE", [
      {
        data: {
          evaluation: { canary_eligible: true, score: 10_000 },
          mode: "ACTIVE",
          used_as_response_context: true,
        },
        event_type: "agent.customer-support.native-tool-loop-active-completed",
        recorded_at: "2026-08-21T04:00:00.000Z",
      },
      {
        data: { error: "Model provider timed out" },
        event_type: "agent.customer-support.native-tool-loop-active-failed",
        recorded_at: "2026-08-21T04:01:00.000Z",
      },
    ])

    expect(status).toMatchObject({
      counts: {
        canary_eligible: 1,
        completed: 1,
        failed: 1,
        used_as_response_context: 1,
      },
      mode: "ACTIVE",
    })
    expect(status.recent_events[0]).toEqual({
      error: "Model provider timed out",
      evaluation: {},
      event_type: "agent.customer-support.native-tool-loop-active-failed",
      mode: null,
      recorded_at: "2026-08-21T04:01:00.000Z",
      used_as_response_context: false,
    })
  })
})
