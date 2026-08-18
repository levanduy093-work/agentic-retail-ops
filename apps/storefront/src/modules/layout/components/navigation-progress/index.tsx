"use client"

import { STOREFRONT_NAVIGATION_START } from "@lib/util/storefront-navigation"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "@lib/i18n/client"

const SHOW_DELAY = 100
const MINIMUM_VISIBLE_TIME = 280
const SAFETY_TIMEOUT = 10000

function clearTimer(
  timer: React.RefObject<ReturnType<typeof setTimeout> | null>
) {
  if (timer.current) {
    clearTimeout(timer.current)
    timer.current = null
  }
}

export default function NavigationProgress() {
  const t = useTranslation()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const shownAt = useRef(0)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeAnchor = useRef<HTMLAnchorElement | null>(null)

  const setVisible = useCallback((visible: boolean) => {
    pendingRef.current = visible
    setPending(visible)
  }, [])

  const stop = useCallback(() => {
    clearTimer(showTimer)
    clearTimer(safetyTimer)

    if (activeAnchor.current) {
      activeAnchor.current.removeAttribute("aria-busy")
      activeAnchor.current = null
    }

    if (!pendingRef.current) {
      return
    }

    const remainingTime = Math.max(
      0,
      MINIMUM_VISIBLE_TIME - (Date.now() - shownAt.current)
    )

    clearTimer(hideTimer)
    hideTimer.current = setTimeout(() => setVisible(false), remainingTime)
  }, [setVisible])

  const start = useCallback(() => {
    clearTimer(hideTimer)
    clearTimer(showTimer)
    clearTimer(safetyTimer)

    if (!pendingRef.current) {
      showTimer.current = setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, SHOW_DELAY)
    }

    safetyTimer.current = setTimeout(stop, SAFETY_TIMEOUT)
  }, [setVisible, stop])

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
        activeAnchor.current?.removeAttribute("aria-busy")
        activeAnchor.current = anchor
        anchor.setAttribute("aria-busy", "true")
        start()
      }
    }

    window.addEventListener(STOREFRONT_NAVIGATION_START, start)
    document.addEventListener("click", handleClick, true)

    return () => {
      window.removeEventListener(STOREFRONT_NAVIGATION_START, start)
      document.removeEventListener("click", handleClick, true)
      clearTimer(showTimer)
      clearTimer(hideTimer)
      clearTimer(safetyTimer)
    }
  }, [start])

  return (
    <div
      role="status"
      aria-label={t("common.page_loading")}
      aria-hidden={!pending}
      className={`fixed inset-0 z-[1000] bg-[#f4f7f5]/90 backdrop-blur-[2px] ${
        pending ? "visible" : "invisible"
      }`}
    />
  )
}
