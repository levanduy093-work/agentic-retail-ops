"use client"

import { FormEvent, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function DevLockPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("from") || "/"

  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) {
      setError("Vui lòng nhập mã PIN.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
      const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

      const response = await fetch(`${backendUrl}/store/dev-access/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": publishableKey,
        },
        body: JSON.stringify({ passcode: pin.trim() }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.message || "Mã PIN không chính xác. Vui lòng kiểm tra lại.")
        setLoading(false)
        return
      }

      // Set unlock cookie valid for 7 days
      document.cookie = `synapse_dev_access_pass=unlocked; path=/; max-age=${
        60 * 60 * 24 * 7
      }; SameSite=Lax`

      // Redirect back to target URL
      router.push(redirectUrl)
      router.refresh()
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-ui-border-base bg-white p-8 shadow-sm dark:bg-ui-bg-base">
        {/* Header Icon */}
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Title & Description */}
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            Dev Safe Mode
          </span>
          <h1 className="mt-3 text-xl font-bold tracking-tight text-ui-fg-base">
            Chế độ Phát triển Riêng tư
          </h1>
          <p className="mt-2 text-sm text-ui-fg-subtle">
            Hệ thống đang được bảo vệ trong lúc lập trình viên đang làm việc.
            Vui lòng nhập mã PIN được chia sẻ để mở khóa.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleUnlock} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              htmlFor="dev-pin"
              className="block text-xs font-medium uppercase tracking-wider text-ui-fg-subtle"
            >
              Mã PIN mở khóa
            </label>
            <input
              id="dev-pin"
              type="password"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Nhập mã PIN truy cập..."
              className="mt-1.5 block w-full rounded-lg border border-ui-border-base bg-ui-bg-subtle px-3.5 py-2.5 text-sm text-ui-fg-base placeholder-ui-fg-muted transition focus:border-ui-border-interactive focus:bg-white focus:outline-none focus:ring-2 focus:ring-ui-fg-interactive/20 dark:focus:bg-ui-bg-subtle"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-ui-fg-base px-4 py-2.5 text-sm font-medium text-ui-bg-base transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Đang xác thực...
              </span>
            ) : (
              "Mở khóa truy cập"
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-ui-border-base pt-4 text-center">
          <p className="text-xs text-ui-fg-muted">
            Truy cập từ localhost trên máy dev luôn được cho phép trực tiếp.
          </p>
        </div>
      </div>
    </div>
  )
}
