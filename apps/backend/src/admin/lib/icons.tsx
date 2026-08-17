import React from "react"

export interface IconProps extends React.SVGAttributes<SVGElement> {
  className?: string
  size?: number | string
  color?: string
}

export const TruckIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, color = "currentColor", ...props }, ref) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 15 15"
      fill="none"
      className={className}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <g
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      >
        <path d="M3.472 12.938a1.41 1.41 0 1 0 0-2.82 1.41 1.41 0 0 0 0 2.82M9.312 12.938a1.41 1.41 0 1 0 0-2.82 1.41 1.41 0 0 0 0 2.82M7.918 11.326H4.882M4.076 2.465h3.625c.89 0 1.612.721 1.612 1.611v6.042" />
        <path d="M9.313 4.882h1.775c.274 0 .53.14.677.37l1.447 2.25c.084.13.128.281.128.436v1.777a1.61 1.61 0 0 1-1.61 1.611h-1.008M9.313 7.701h3.95M2.465 4.882H5.89M.854 7.299h3.424" />
      </g>
    </svg>
  )
)
TruckIcon.displayName = "TruckIcon"

export const SpinnerIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, ...props }, ref) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`inline-block shrink-0 animate-spin ${className}`}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
)
SpinnerIcon.displayName = "SpinnerIcon"

export const PrinterIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, ...props }, ref) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
)
PrinterIcon.displayName = "PrinterIcon"

export const EyeIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, ...props }, ref) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
)
EyeIcon.displayName = "EyeIcon"

export const GlobeIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, ...props }, ref) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
)
GlobeIcon.displayName = "GlobeIcon"

export const CheckCircleIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, ...props }, ref) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
)
CheckCircleIcon.displayName = "CheckCircleIcon"

export const ShieldCheckIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, ...props }, ref) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
)
ShieldCheckIcon.displayName = "ShieldCheckIcon"

export const InfoIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, ...props }, ref) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
)
InfoIcon.displayName = "InfoIcon"
