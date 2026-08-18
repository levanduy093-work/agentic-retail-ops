import { latestGhnStatusLog } from "../sync-ghn-fulfillment-status"

describe("latestGhnStatusLog", () => {
  it("accepts the GHN detail response when it omits its optional log", () => {
    expect(latestGhnStatusLog({ log: undefined })).toBeUndefined()
  })

  it("returns the last status log when GHN includes history", () => {
    const latest = {
      payment_type_id: 1,
      status: "ready_to_pick",
      updated_date: "2026-08-18T13:28:00Z",
    }

    expect(
      latestGhnStatusLog({
        log: [
          { ...latest, status: "created" },
          latest,
        ],
      })
    ).toEqual(latest)
  })
})
