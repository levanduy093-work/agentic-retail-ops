export const STOREFRONT_NAVIGATION_START = "storefront:navigation-start"

export function startStorefrontNavigation() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STOREFRONT_NAVIGATION_START))
  }
}
