import { MedusaError } from "@medusajs/framework/utils"
import {
  getVerifiedGoogleEmail,
  selectExistingCustomer
} from "../link-google-customer"

describe("Google customer account linking", () => {
  it("uses only a verified Google email", () => {
    const email = getVerifiedGoogleEmail({
      id: "auth_1",
      provider_identities: [
        {
          provider: "google-one-tap",
          user_metadata: {
            email: " Customer@Example.com ",
            email_verified: true
          }
        }
      ]
    })

    expect(email).toBe("customer@example.com")
  })

  it("rejects an unverified provider email", () => {
    expect(() =>
      getVerifiedGoogleEmail({
        id: "auth_1",
        provider_identities: [
          {
            provider: "google-one-tap",
            user_metadata: {
              email: "customer@example.com",
              email_verified: false
            }
          }
        ]
      })
    ).toThrow(MedusaError)
  })

  it("stops when multiple account customers share an email", () => {
    expect(() =>
      selectExistingCustomer([
        { id: "cus_1", email: "customer@example.com" },
        { id: "cus_2", email: "customer@example.com" }
      ])
    ).toThrow("Multiple customer accounts use this email")
  })
})
