"use client"

import { useActionState, useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"
import GoogleSignInButton from "@modules/account/components/google-sign-in-button"
import { useTranslation } from "@lib/i18n/client"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Register = ({ setCurrentView }: Props) => {
  const t = useTranslation()
  const [message, formAction] = useActionState(signup, null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
      className="max-w-sm flex flex-col items-center"
      data-testid="register-page"
    >
      <h1 className="text-large-semi uppercase mb-6 text-center">
        {t("account.register_title")}
      </h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-4">
        {t("account.register_desc")}
      </p>
      <GoogleSignInButton label={t("account.continue_with_google")} />
      <div className="w-full flex items-center gap-3 my-6 text-ui-fg-subtle text-small-regular">
        <div className="h-px flex-1 bg-ui-border-base" />
        <span>{t("account.or_sign_in_with_email")}</span>
        <div className="h-px flex-1 bg-ui-border-base" />
      </div>
      {message?.state === "verification_required" && (
        <div
          className="w-full mb-4 text-center text-base-regular text-ui-fg-base bg-ui-bg-subtle border border-ui-border-base rounded-rounded p-4"
          data-testid="register-verification-message"
        >
          We sent a verification link to <strong>{message.email}</strong>.
          Please check your inbox to verify your email, then sign in.
        </div>
      )}
      <form className="w-full flex flex-col" action={formAction}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label={t("account.first_name")}
            name="first_name"
            required
            autoComplete="given-name"
            data-testid="first-name-input"
          />
          <Input
            label={t("account.last_name")}
            name="last_name"
            required
            autoComplete="family-name"
            data-testid="last-name-input"
          />
          <Input
            label={t("account.email")}
            name="email"
            required
            type="email"
            autoComplete="email"
            data-testid="email-input"
          />
          <Input
            label={t("account.phone")}
            name="phone"
            type="tel"
            autoComplete="tel"
            data-testid="phone-input"
          />
          <Input
            label={t("account.password")}
            name="password"
            required
            type="password"
            autoComplete="new-password"
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={message?.state === "error" ? message.error : null}
          data-testid="register-error"
        />
        <span className="text-center text-ui-fg-base text-small-regular mt-6">
          By creating an account, you agree to Synapse Store&apos;s{" "}
          <LocalizedClientLink
            href="/content/privacy-policy"
            className="underline"
          >
            Privacy Policy
          </LocalizedClientLink>{" "}
          and{" "}
          <LocalizedClientLink
            href="/content/terms-of-use"
            className="underline"
          >
            Terms of Use
          </LocalizedClientLink>
          .
        </span>
        <SubmitButton className="w-full mt-6" data-testid="register-button">
          {t("account.join_us")}
        </SubmitButton>
      </form>
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        {t("account.already_member")}{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="underline"
        >
          {t("account.sign_in")}
        </button>
        .
      </span>
    </div>
  )
}

export default Register
