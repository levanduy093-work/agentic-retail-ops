"use client"

import { login } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import GoogleSignInButton from "@modules/account/components/google-sign-in-button"
import { usePathname, useSearchParams } from "next/navigation"
import { useActionState, useEffect } from "react"
import { useTranslation } from "@lib/i18n/client"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Login = ({ setCurrentView }: Props) => {
  const t = useTranslation()
  const [message, formAction] = useActionState(login, null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const googleAuthError = searchParams.get("google_auth_error")

  useEffect(() => {
    if (message?.state === "success") {
      const redirectTo = searchParams.get("redirectTo")
      if (redirectTo) {
        const segments = pathname.split("/").filter(Boolean)
        const locale = segments[0] || "vi"
        const countryCode = segments[1] || "vn"
        const targetPath = redirectTo.startsWith(`/${locale}/${countryCode}`)
          ? redirectTo
          : `/${locale}/${countryCode}${redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`}`
        window.location.href = targetPath
      }
    }
  }, [message, searchParams, pathname])

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center"
      data-testid="login-page"
    >
      <h1 className="text-large-semi uppercase mb-6">{t("account.welcome_back")}</h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-8">
        {t("account.sign_in_description")}
      </p>
      <GoogleSignInButton label={t("account.continue_with_google")} />
      {googleAuthError && (
        <ErrorMessage
          error={googleAuthError}
          data-testid="google-auth-error-message"
        />
      )}
      <div className="w-full flex items-center gap-3 my-6 text-ui-fg-subtle text-small-regular">
        <div className="h-px flex-1 bg-ui-border-base" />
        <span>{t("account.or_sign_in_with_email")}</span>
        <div className="h-px flex-1 bg-ui-border-base" />
      </div>
      {message?.state === "verification_required" && (
        <div
          className="w-full mb-6 text-center text-base-regular text-ui-fg-base bg-ui-bg-subtle border border-ui-border-base rounded-rounded p-4"
          data-testid="login-verification-message"
        >
          We sent a verification link to <strong>{message.email}</strong>.
          Please verify your email, then sign in.
        </div>
      )}
      <form className="w-full" action={formAction}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label={t("account.email_address")}
            name="email"
            type="email"
            title="Enter a valid email address."
            autoComplete="email"
            required
            data-testid="email-input"
          />
          <Input
            label={t("account.password")}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={message?.state === "error" ? message.error : null}
          data-testid="login-error-message"
        />
        <SubmitButton data-testid="sign-in-button" className="w-full mt-6">
          {t("account.sign_in")}
        </SubmitButton>
      </form>
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        {t("account.not_a_member")} {" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="underline"
          data-testid="register-button"
        >
          {t("account.join_us")}
        </button>
        .
      </span>
    </div>
  )
}

export default Login
