"use client"

import { loginWithGoogleOneTap } from "@lib/data/customer"
import { useParams, useRouter } from "next/navigation"
import Script from "next/script"
import { useCallback, useEffect, useRef, useState } from "react"

type GoogleSignInButtonProps = {
  label: string
}

type GoogleCredentialResponse = {
  credential: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: Record<string, unknown>) => void
          prompt: () => void
          cancel: () => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void
        }
      }
    }
  }
}

export default function GoogleSignInButton({ label }: GoogleSignInButtonProps) {
  const { countryCode, locale } = useParams<{
    countryCode: string
    locale: string
  }>()
  const router = useRouter()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isScriptReady, setIsScriptReady] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(
    null,
  )
  const isInitializedRef = useRef(false)

  const isEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  const handleCredential = useCallback(
    async ({ credential }: GoogleCredentialResponse) => {
      setError(null)
      setIsLoading(true)

      try {
        const result = await loginWithGoogleOneTap(credential)

        if (result?.state !== "success") {
          setError(
            result && "error" in result
              ? result.error
              : "Google sign-in could not be completed."
          )
          return
        }

        router.replace(`/${locale}/${countryCode}/account`)
        router.refresh()
      } catch {
        setError("Google sign-in could not be completed.")
      } finally {
        setIsLoading(false)
      }
    },
    [countryCode, locale, router],
  )

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)")
    const updateViewport = () => setIsMobileViewport(mobileQuery.matches)

    updateViewport()
    mobileQuery.addEventListener("change", updateViewport)

    return () => mobileQuery.removeEventListener("change", updateViewport)
  }, [])

  useEffect(() => {
    if (
      !isEnabled ||
      !clientId ||
      !isScriptReady ||
      !buttonRef.current ||
      isMobileViewport === null
    ) {
      return
    }

    if (isInitializedRef.current) {
      return
    }

    const google = window.google?.accounts.id

    if (!google) {
      setError("Google sign-in is temporarily unavailable.")
      return
    }

    isInitializedRef.current = true

    google.initialize({
      client_id: clientId,
      callback: handleCredential,
      use_fedcm_for_button: false,
      cancel_on_tap_outside: false,
      ...(!isMobileViewport && {
        prompt_parent_id: "google-one-tap-container",
      }),
    })
    buttonRef.current.replaceChildren()
    google.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: Math.min(buttonRef.current.clientWidth, 360),
      locale,
    })

    if (!isMobileViewport) {
      google.prompt()
    }

    return () => {
      google.cancel()
      isInitializedRef.current = false
    }
  }, [
    clientId,
    handleCredential,
    isEnabled,
    isMobileViewport,
    isScriptReady,
    locale,
  ])

  if (!isEnabled || !clientId) {
    return null
  }

  return (
    <div className="w-full">
      {!isMobileViewport && (
        <div
          id="google-one-tap-container"
          className="fixed top-16 right-4 z-[9999]"
        />
      )}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setIsScriptReady(true)}
      />
      <div
        ref={buttonRef}
        aria-label={label}
        className={`mx-auto w-full max-w-[360px] ${
          isLoading ? "pointer-events-none opacity-60" : ""
        }`}
      />
      {error && (
        <p className="mt-2 text-center text-small-regular text-ui-fg-error">
          {error}
        </p>
      )}
    </div>
  )
}
