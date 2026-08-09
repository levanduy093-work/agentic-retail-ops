import Image from "next/image"
import { Suspense } from "react"

import { listRegions } from "@lib/data/regions"
import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import CatalogSearch from "@modules/layout/components/catalog-search"
import CatalogNavigation from "@modules/layout/components/catalog-navigation"
import SideMenu from "@modules/layout/components/side-menu"
import NavLanguageSelect from "@modules/layout/components/nav-language-select"
import { getDictionary } from "@lib/i18n"
import { getLocale } from "@lib/data/locale-actions"

export default async function Nav() {
  const [regions, dict, currentLocale, productCategories, { collections }] =
    await Promise.all([
      listRegions().then((regions: StoreRegion[]) => regions),
      getDictionary(),
      getLocale(),
      listCategories({
        fields: "id,handle,name,*category_children,*parent_category",
        limit: 20,
      }),
      listCollections({
        fields: "id,handle,title",
        limit: "6",
      }),
    ])

  const categories = productCategories
    .filter((category) => !category.parent_category)
    .slice(0, 6)
    .map((category) => ({
      id: category.id,
      handle: category.handle,
      name:
        dict.footer.category_names[
          category.handle as keyof typeof dict.footer.category_names
        ] ?? category.name,
      children: (category.category_children || []).map((child) => ({
        id: child.id,
        handle: child.handle,
        name: child.name,
        children: [],
      })),
    }))

  const navigationCollections = collections.slice(0, 6).map((collection) => ({
    id: collection.id,
    handle: collection.handle,
    title:
      dict.footer.collection_names[
        collection.handle as keyof typeof dict.footer.collection_names
      ] ?? collection.title,
  }))

  return (
    <div className="sticky top-0 inset-x-0 z-50 px-3 pt-3 small:px-6 small:pt-5">
      <header className="liquid-glass-web-approx relative mx-auto h-[68px] max-w-[1376px] rounded-[22px] !overflow-visible">
        <nav className="flex h-full items-center gap-2 px-3 small:gap-4 small:px-6 text-small-regular text-[#315248]">
          <div className="flex shrink-0 items-center gap-x-2 small:gap-x-5">
            <div className="block small:hidden h-full">
              <SideMenu
                regions={regions}
                locales={null}
                currentLocale={null}
                dict={dict}
                categories={categories}
                collections={navigationCollections}
              />
            </div>
            <LocalizedClientLink
              href="/"
              className="relative z-[1] flex items-center gap-2.5 text-lg font-bold tracking-[-0.04em] text-[#174b3d] transition-colors hover:text-[#103a2f] small:text-xl"
              data-testid="nav-store-link"
            >
              <Image
                src="/logo.png"
                alt="Synapse Store Logo"
                width={36}
                height={36}
                className="h-8 w-auto object-contain"
                priority
              />
              <span className="hidden small:inline">Synapse Store</span>
            </LocalizedClientLink>
          </div>
          <CatalogNavigation
            categories={categories}
            collections={navigationCollections}
            categoryLabel={dict.nav.categories}
            collectionLabel={dict.nav.collections}
          />
          <CatalogSearch dict={dict} />
          <div className="ml-auto flex shrink-0 items-center gap-x-2 small:gap-x-5">
            <div className="hidden small:flex items-center font-medium">
              <LocalizedClientLink
                className="relative z-[1] hover:text-[#103a2f] transition-colors duration-200"
                href="/account"
                data-testid="nav-account-link"
              >
                {dict.nav.account}
              </LocalizedClientLink>
            </div>
            <NavLanguageSelect currentLocale={currentLocale} />
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
              <div className="relative z-[1] font-medium h-full flex items-center">
                <CartButton />
              </div>
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
