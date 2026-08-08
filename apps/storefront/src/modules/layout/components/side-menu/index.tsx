"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import useToggleState from "@lib/hooks/use-toggle-state"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text, clx } from "@modules/common/components/ui"
import { Fragment } from "react"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"
import { Locale } from "@lib/data/locales"


const SideMenuItems = {
  Home: "/",
  Store: "/store",
  Account: "/account",
  Cart: "/cart",
}

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  dict?: Record<string, Record<string, string>>
}

const SideMenu = ({ regions, locales, currentLocale, dict }: SideMenuProps) => {
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
            <>
              <div className="relative flex h-full">
                <Popover.Button
                  data-testid="nav-menu-button"
                  aria-label="Open menu"
                  className="relative z-[1] flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 hover:bg-white/65 focus:outline-none"
                >
                  <span className="sr-only">Menu</span>
                  <span className="flex flex-col gap-1" aria-hidden="true">
                    <span className="h-px w-4 bg-current" />
                    <span className="h-px w-4 bg-current" />
                    <span className="h-px w-4 bg-current" />
                  </span>
                </Popover.Button>
              </div>

              {open && (
                <div
                  className="fixed inset-0 z-[50] bg-black/0 pointer-events-auto"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <PopoverPanel className="flex flex-col absolute top-full left-0 mt-3 w-[85vw] max-w-[320px] z-[51] text-sm text-[#315248]">
                  <div
                    data-testid="nav-menu-popup"
                    className="flex flex-col bg-white border border-[#12231d]/10 shadow-[0_18px_55px_rgba(17,49,39,0.12)] rounded-[22px] p-6 gap-6"
                  >
                    <ul className="flex flex-col gap-4 items-start justify-start">
                      {Object.entries(SideMenuItems).map(([name, href]) => {
                        const translationKey = name.toLowerCase() as "home" | "store" | "account" | "cart"
                        const translatedName = dict?.nav?.[translationKey] || name

                        return (
                          <li key={name}>
                            <LocalizedClientLink
                              href={href}
                              className="text-xl leading-8 font-semibold text-[#174b3d] hover:text-[#103a2f] transition-colors tracking-tight"
                              onClick={close}
                              data-testid={`${name.toLowerCase()}-link`}
                            >
                              {translatedName}
                            </LocalizedClientLink>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="flex flex-col gap-y-4 pt-4 border-t border-[#12231d]/10">
                      {!!locales?.length && (
                        <div
                          className="flex justify-between"
                          onMouseEnter={languageToggleState.open}
                          onMouseLeave={languageToggleState.close}
                        >
                          <LanguageSelect
                            toggleState={languageToggleState}
                            locales={locales}
                            currentLocale={currentLocale}
                          />
                          <ArrowRightMini
                            className={clx(
                              "transition-transform duration-150",
                              languageToggleState.state ? "-rotate-90" : ""
                            )}
                          />
                        </div>
                      )}
                      <div
                        className="flex justify-between"
                        onMouseEnter={countryToggleState.open}
                        onMouseLeave={countryToggleState.close}
                      >
                        {regions && (
                          <CountrySelect
                            toggleState={countryToggleState}
                            regions={regions}
                          />
                        )}
                        <ArrowRightMini
                          className={clx(
                            "transition-transform duration-150",
                            countryToggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                      <Text className="flex justify-between txt-compact-small text-[#60716a] mt-2">
                        © {new Date().getFullYear()} Synapse Store.
                      </Text>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
