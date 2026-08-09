"use client"

import { STOREFRONT_NAVIGATION_START } from "@lib/util/storefront-navigation"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

const SAFETY_TIMEOUT = 10000

export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    setPending(false)
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const start = useCallback(() => {
    setPending(true)
    if (timer.current) {
      clearTimeout(timer.current)
    }
    timer.current = setTimeout(stop, SAFETY_TIMEOUT)
  }, [stop])

  useEffect(() => {
    stop()
  }, [pathname, searchParams, stop])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target as HTMLElement | null
      const anchor = target?.closest("a")

      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return
      }

      const destination = new URL(anchor.href, window.location.href)
      const current = new URL(window.location.href)

      if (
        destination.origin === current.origin &&
        `${destination.pathname}${destination.search}` !==
          `${current.pathname}${current.search}`
      ) {
        start()
      }
    }

    window.addEventListener(STOREFRONT_NAVIGATION_START, start)
    document.addEventListener("click", handleClick, true)

    return () => {
      window.removeEventListener(STOREFRONT_NAVIGATION_START, start)
      document.removeEventListener("click", handleClick, true)
      if (timer.current) {
        clearTimeout(timer.current)
      }
    }
  }, [start])

  return (
    <div
      aria-hidden={!pending}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[1000] h-[3px] overflow-hidden transition-opacity duration-150 ${
        pending ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-full w-2/3 animate-pulse bg-[#174b3d] shadow-[0_0_12px_rgba(23,75,61,0.55)]" />
    </div>
  )
}
