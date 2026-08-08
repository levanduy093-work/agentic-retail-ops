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
    if (!isEnabled || !clientId || !isScriptReady || !buttonRef.current) {
      return
    }

    const google = window.google?.accounts.id

    if (!google) {
      setError("Google sign-in is temporarily unavailable.")
      return
    }

    google.initialize({
      client_id: clientId,
      callback: handleCredential,
      use_fedcm_for_button: true,
    })
    buttonRef.current.replaceChildren()
    google.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 360,
      locale,
    })
  }, [clientId, handleCredential, isEnabled, isScriptReady, locale])

  if (!isEnabled || !clientId) {
    return null
  }

  return (
    <div className="w-full">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setIsScriptReady(true)}
      />
      <div
        ref={buttonRef}
        aria-label={label}
        className={isLoading ? "pointer-events-none opacity-60" : undefined}
      />
      {error && (
        <p className="mt-2 text-center text-small-regular text-ui-fg-error">
          {error}
        </p>
      )}
    </div>
  )
}
