type CheckoutStep = "address" | "delivery" | "payment" | "review"

export function setCheckoutStep(
  step: CheckoutStep,
  options: { replace?: boolean } = {}
) {
  const url = new URL(window.location.href)
  url.searchParams.set("step", step)

  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  const method = options.replace ? "replaceState" : "pushState"

  window.history[method](null, "", nextUrl)
}
