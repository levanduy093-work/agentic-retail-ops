import {
  AuditSearchInput,
  buildTraceReplayOutput,
  formatAuditSearchResult,
  searchKnowledgeDocuments,
  TraceReplayInput,
} from "../tools/platform-read-tools"

describe("platform read tools", () => {
  test("searches only eligible approved knowledge and returns citations", () => {
    const now = new Date("2026-08-10T00:00:00.000Z")
    const result = searchKnowledgeDocuments(
      {
        limit: 5,
        query: "chuyen kho",
        tenant_id: "default",
      },
      [
        {
          approved_at: "2026-08-01T00:00:00.000Z",
          citation_locator: "ops://inventory/transfer#safe-transfer",
          content: "Quy trinh chuyen kho phai duoc kiem tra ton kha dung.",
          document_key: "safe-inventory-transfer",
          effective_at: "2026-08-01T00:00:00.000Z",
          id: "agknow_approved",
          status: "APPROVED",
          title: "Chuyen kho an toan",
          version: "1.0.0",
        },
        {
          approved_at: null,
          citation_locator: "ops://inventory/draft",
          content: "Chuyen kho khong can phe duyet.",
          document_key: "unsafe-draft",
          effective_at: "2026-08-01T00:00:00.000Z",
          id: "agknow_draft",
          status: "DRAFT",
          title: "Ban nhap chuyen kho",
          version: "1.0.0",
        },
      ],
      now
    )

    expect(result.total_candidates).toBe(1)
    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toMatchObject({
      citation_locator: "ops://inventory/transfer#safe-transfer",
      document_id: "agknow_approved",
      title: "Chuyen kho an toan",
    })
    expect(result.results[0].quote_checksum).toHaveLength(64)
  })

  test("normalizes audit event timestamps and nullable data", () => {
    const result = formatAuditSearchResult([
      {
        action: "approval-decided",
        actor_id: "user_admin",
        actor_type: "user",
        correlation_id: "corr_1",
        event_type: "agent.approval.decided",
        id: "agaud_1",
        incident_id: "aginc_1",
        recorded_at: new Date("2026-08-10T01:00:00.000Z"),
        resource_id: "agappr_1",
        resource_type: "agent_approval",
      },
    ])

    expect(result).toEqual({
      events: [
        expect.objectContaining({
          data: null,
          event_id: "agaud_1",
          recorded_at: "2026-08-10T01:00:00.000Z",
        }),
      ],
      returned_count: 1,
    })
  })

  test("requires bounded audit and trace selectors", () => {
    expect(() => AuditSearchInput.parse({})).toThrow()
    expect(() =>
      TraceReplayInput.parse({ correlation_id: "corr_1", incident_id: "aginc_1" })
    ).toThrow()
    expect(() => TraceReplayInput.parse({})).toThrow()
  })

  test("orders, deduplicates incident ids, and truncates trace timelines", () => {
    const result = buildTraceReplayOutput({
      correlation_id: "corr_1",
      incident_ids: ["aginc_2", "aginc_1", "aginc_1"],
      limit: 2,
      timeline: [
        {
          category: "TOOL_CALL",
          data: null,
          entry_id: "agtcall_1",
          name: "inventory.get-position",
          occurred_at: "2026-08-10T01:00:02.000Z",
          status: "SUCCEEDED",
        },
        {
          category: "EVENT",
          data: null,
          entry_id: "agevt_1",
          name: "inventory.low",
          occurred_at: "2026-08-10T01:00:00.000Z",
          status: "PROCESSED",
        },
        {
          category: "AUDIT",
          data: null,
          entry_id: "agaud_1",
          name: "agent.incident.created",
          occurred_at: "2026-08-10T01:00:01.000Z",
          status: null,
        },
      ],
    })

    expect(result.incident_ids).toEqual(["aginc_1", "aginc_2"])
    expect(result.timeline.map((entry) => entry.entry_id)).toEqual([
      "agevt_1",
      "agaud_1",
    ])
    expect(result.truncated).toBe(true)
  })
})
