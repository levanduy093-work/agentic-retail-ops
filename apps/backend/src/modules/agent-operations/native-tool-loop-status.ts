export type NativeToolLoopAuditEntry = {
  data: unknown
  event_type: string
  recorded_at: Date | string
}

type NativeToolLoopMode = "ACTIVE" | "DISABLED" | "SHADOW"

function getData(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function summarizeNativeToolLoopStatus(
  mode: NativeToolLoopMode,
  events: NativeToolLoopAuditEntry[]
) {
  const completed = events.filter((event) => event.event_type.endsWith("completed"))
  const failed = events.filter((event) => event.event_type.endsWith("failed"))
  const safeToUse = completed.filter(
    (event) => getData(getData(event.data).evaluation).safe_to_use === true
  )
  const usedAsResponseContext = completed.filter(
    (event) => getData(event.data).used_as_response_context === true
  )

  return {
    counts: {
      safe_to_use: safeToUse.length,
      completed: completed.length,
      failed: failed.length,
      used_as_response_context: usedAsResponseContext.length,
    },
    mode,
    recent_events: events
      .slice()
      .sort(
        (left, right) =>
          new Date(right.recorded_at).getTime() - new Date(left.recorded_at).getTime()
      )
      .slice(0, 20)
      .map((event) => {
        const data = getData(event.data)
        return {
          error: typeof data.error === "string" ? data.error : null,
          evaluation: getData(data.evaluation),
          event_type: event.event_type,
          mode: data.mode === "ACTIVE" || data.mode === "SHADOW" ? data.mode : null,
          recorded_at: new Date(event.recorded_at).toISOString(),
          used_as_response_context: data.used_as_response_context === true,
        }
      }),
  }
}
