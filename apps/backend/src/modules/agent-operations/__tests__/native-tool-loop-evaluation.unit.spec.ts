import { evaluateNativeToolLoop } from "../native-tool-loop-evaluation"

const allowedToolNames = new Set([
  "search_catalog",
  "search_knowledge_base",
  "check_order_status",
])

describe("native tool loop evaluation", () => {
  it("marks a completed allowlisted trace eligible for canary analysis", () => {
    expect(
      evaluateNativeToolLoop({
        allowed_tool_names: allowedToolNames,
        termination: "COMPLETE",
        trace: [
          {
            call_id: "call_1",
            iteration: 1,
            name: "search_catalog",
            status: "EXECUTED",
          },
        ],
      })
    ).toEqual({
      assertions: [
        { id: "completion", passed: true },
        { id: "no-rejected-calls", passed: true },
        { id: "allowlisted-tool-names", passed: true },
      ],
      canary_eligible: true,
      score: 10_000,
    })
  })

  it("rejects traces that reach the loop limit", () => {
    expect(
      evaluateNativeToolLoop({
        allowed_tool_names: allowedToolNames,
        termination: "MAX_ITERATIONS",
        trace: [],
      })
    ).toMatchObject({
      canary_eligible: false,
      score: 6_667,
    })
  })

  it("rejects a rejected or non-allowlisted tool call", () => {
    expect(
      evaluateNativeToolLoop({
        allowed_tool_names: allowedToolNames,
        termination: "COMPLETE",
        trace: [
          {
            call_id: "call_unsafe",
            iteration: 1,
            name: "refund_order",
            status: "REJECTED",
          },
        ],
      })
    ).toEqual({
      assertions: [
        { id: "completion", passed: true },
        { id: "no-rejected-calls", passed: false },
        { id: "allowlisted-tool-names", passed: false },
      ],
      canary_eligible: false,
      score: 3_333,
    })
  })
})
