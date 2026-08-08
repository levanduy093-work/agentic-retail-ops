import { Suspense } from "react"

import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import CatalogSearch from "@modules/layout/components/catalog-search"
import SideMenu from "@modules/layout/components/side-menu"
import { getDictionary } from "@lib/i18n"

export default async function Nav() {
  const [regions, locales, currentLocale, dict] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    getDictionary(),
  ])

  return (
    <div className="sticky top-0 inset-x-0 z-50 px-3 pt-3 small:px-6 small:pt-5">
      <header className="liquid-glass-web-approx relative mx-auto h-[68px] max-w-[1376px] rounded-[22px]">
        <nav className="flex h-full items-center gap-4 px-4 small:px-6 text-small-regular text-[#315248]">
          <div className="flex min-w-fit items-center gap-x-5">
            <div className="block small:hidden h-full">
              <SideMenu regions={regions} locales={locales} currentLocale={currentLocale} />
            </div>
            <LocalizedClientLink
              href="/"
              className="relative z-[1] text-lg font-bold tracking-[-0.04em] text-[#174b3d] transition-colors hover:text-[#103a2f] small:text-xl"
              data-testid="nav-store-link"
            >
              Synapse Store
            </LocalizedClientLink>
          </div>
          <CatalogSearch />
          <div className="ml-auto flex items-center gap-x-3 small:gap-x-5">
            <div className="hidden small:flex items-center font-medium">
              <LocalizedClientLink
                className="relative z-[1] hover:text-[#103a2f] transition-colors duration-200"
                href="/account"
                data-testid="nav-account-link"
              >
                {dict.nav.account}
              </LocalizedClientLink>
            </div>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className="hover:text-ui-fg-base flex gap-2 font-medium transition-colors duration-200"
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  {dict.nav.cart} (0)
                </LocalizedClientLink>
              }
            >
              <div className="relative z-[1] font-medium">
                <CartButton />
              </div>
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
