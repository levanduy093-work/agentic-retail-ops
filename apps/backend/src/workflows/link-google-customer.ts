import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"

type ProviderIdentity = {
  provider: string
  user_metadata?: Record<string, unknown>
}

type AuthIdentity = {
  id: string
  app_metadata?: Record<string, unknown>
  provider_identities?: ProviderIdentity[]
}

type Customer = {
  id: string
  email: string
}

type LinkGoogleCustomerInput = {
  authIdentityId: string
}

type LinkGoogleCustomerResult = {
  customerId?: string
  linked: boolean
}

type LinkGoogleCustomerRollback = {
  authIdentityId: string
  appMetadata: Record<string, unknown>
} | null

export function getVerifiedGoogleEmail(authIdentity: AuthIdentity) {
  const googleIdentity = authIdentity.provider_identities?.find(
    (identity) => identity.provider === "google-one-tap"
  )
  const email = googleIdentity?.user_metadata?.email
  const emailVerified = googleIdentity?.user_metadata?.email_verified

  if (typeof email !== "string" || emailVerified !== true) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "A verified Google identity is required to link this account."
    )
  }

  return email.trim().toLowerCase()
}

export function selectExistingCustomer(customers: Customer[]) {
  if (customers.length > 1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Multiple customer accounts use this email. Account linking was stopped."
    )
  }

  return customers[0]
}

const linkGoogleCustomerStep = createStep(
  "link-google-customer",
  async (
    { authIdentityId }: LinkGoogleCustomerInput,
    { container }
  ): Promise<StepResponse<LinkGoogleCustomerResult, LinkGoogleCustomerRollback>> => {
    const authModule = container.resolve(Modules.AUTH)
    const customerModule = container.resolve(Modules.CUSTOMER)
    const authIdentity = await authModule.retrieveAuthIdentity(authIdentityId, {
      relations: ["provider_identities"]
    })
    const existingCustomerId = authIdentity.app_metadata?.customer_id

    if (typeof existingCustomerId === "string") {
      return new StepResponse({
        customerId: existingCustomerId,
        linked: true
      })
    }

    const email = getVerifiedGoogleEmail(authIdentity)
    const customers = await customerModule.listCustomers({
      email: { $ilike: email },
      has_account: true
    })
    const customer = selectExistingCustomer(customers)

    if (!customer) {
      return new StepResponse({ linked: false })
    }

    const appMetadata = { ...(authIdentity.app_metadata ?? {}) }

    await authModule.updateAuthIdentities({
      id: authIdentity.id,
      app_metadata: {
        ...appMetadata,
        customer_id: customer.id
      }
    })

    return new StepResponse(
      { customerId: customer.id, linked: true },
      { authIdentityId: authIdentity.id, appMetadata }
    )
  },
  async (rollback, { container }) => {
    if (!rollback) {
      return
    }

    const authModule = container.resolve(Modules.AUTH)

    await authModule.updateAuthIdentities({
      id: rollback.authIdentityId,
      app_metadata: rollback.appMetadata
    })
  }
)

export const linkGoogleCustomerWorkflow = createWorkflow(
  "link-google-customer",
  (input: LinkGoogleCustomerInput) => {
    const result = linkGoogleCustomerStep(input)

    return new WorkflowResponse(result)
  }
)
