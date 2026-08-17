import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Checkout",
}

type Props = {
  params: Promise<{
    locale: string
    countryCode: string
  }>
}

export default async function Checkout(props: Props) {
  const { locale, countryCode } = await props.params
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()

  if (!customer) {
    redirect(`/${locale}/${countryCode}/account?redirectTo=/checkout`)
  }

  return (
    <div className="content-container grid grid-cols-1 gap-8 py-8 small:grid-cols-[minmax(0,1fr)_400px] small:py-12">
      <PaymentWrapper cart={cart}>
        <div className="surface-card p-5 small:p-8">
          <CheckoutForm cart={cart} customer={customer} />
        </div>
      </PaymentWrapper>
      <div className="surface-card h-fit p-5 small:p-7">
        <CheckoutSummary cart={cart} />
      </div>
    </div>
  )
}

