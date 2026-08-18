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
  ({ className = "", size = 15, color = "currentColor", ...props }, ref) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 15 15"
      fill="none"
      className={`animate-spin ${className}`}
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
        <path d="M3.11 2.943 4.68 4.514" />
        <path d="M1.222 7.5h2.222" opacity={0.88} />
        <path d="m3.11 12.057 1.571-1.571" opacity={0.75} />
        <path d="M7.667 13.945v-2.222" opacity={0.63} />
        <path d="m12.224 12.057-1.572-1.571" opacity={0.5} />
        <path d="M14.112 7.5h-2.223" opacity={0.38} />
        <path d="m12.224 2.943-1.572 1.571" opacity={0.25} />
        <path d="M7.667 1.055v2.223" opacity={0.13} />
      </g>
    </svg>
  )
)
SpinnerIcon.displayName = "SpinnerIcon"

export const PrinterIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        strokeWidth={1.25}
      >
        <path d="M4 5.5V2.5h7v3" />
        <path d="M4 11.5H2.5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H11" />
        <rect x="4" y="9" width="7" height="4.5" rx="0.5" />
      </g>
    </svg>
  )
)
PrinterIcon.displayName = "PrinterIcon"

export const EyeIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <path d="M1.356 8.506c-.4-.607-.4-1.406 0-2.013.905-1.372 2.9-3.66 6.144-3.66s5.24 2.287 6.144 3.66c.4.607.4 1.406 0 2.013-.905 1.372-2.9 3.66-6.144 3.66S2.26 9.88 1.356 8.507" />
        <path d="M7.5 9.944a2.444 2.444 0 1 0 0-4.888 2.444 2.444 0 0 0 0 4.888" />
      </g>
    </svg>
  )
)
EyeIcon.displayName = "EyeIcon"

export const GlobeIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <path d="M4.63 8.288C4.59 8.231 3.87 7.112 4.416 6c.06-.122.43-.844 1.195-1.056 1.132-.314 1.958.816 2.493.475.599-.381-.24-1.916.451-2.781.526-.659 1.685-.61 2.563-.472M4.63 8.288c1.412-.39 2.32-.199 2.926.156.835.489.894 1.171 1.61 1.306 1.034.193 1.64-1.091 2.556-.917.426.081.944.482 1.394 1.829" />
        <path d="M7.145 13.927c.132-.515.208-1.194-.145-1.723-.376-.565-.907-.46-1.264-1.05-.371-.618.013-1.054-.264-1.82-.26-.72-.854-1.044-1.3-1.37-.743-.543-1.666-1.521-2.39-3.43" />
        <path d="M7.5 13.945a6.444 6.444 0 1 0 0-12.89 6.444 6.444 0 0 0 0 12.89" />
      </g>
    </svg>
  )
)
GlobeIcon.displayName = "GlobeIcon"

export const CheckCircleIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
      <path
        fill={color}
        d="M7.5.389C3.58.389.389 3.579.389 7.5s3.19 7.111 7.111 7.111 7.111-3.19 7.111-7.111S11.421.389 7.5.389m3.416 5.074-3.778 4.889a.67.67 0 0 1-.502.258h-.025a.67.67 0 0 1-.496-.22l-2-2.222a.668.668 0 0 1 .992-.893l1.465 1.629 3.29-4.257a.667.667 0 0 1 1.055.815z"
      />
    </svg>
  )
)
CheckCircleIcon.displayName = "CheckCircleIcon"

export const ShieldCheckIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
      <path
        fill={color}
        d="M12.64 2 7.974.507c-.31-.1-.638-.099-.948 0L2.36 2a1.55 1.55 0 0 0-1.081 1.482v5.796c0 3.118 4.396 4.781 5.742 5.217a1.56 1.56 0 0 0 .958 0c1.348-.435 5.744-2.098 5.744-5.216V3.482c0-.68-.434-1.275-1.082-1.482m-2.383 3.902-3.02 4a.67.67 0 0 1-.986.086l-1.43-1.333a.667.667 0 0 1 .908-.976l.89.829 2.574-3.41a.667.667 0 0 1 1.064.804"
      />
    </svg>
  )
)
ShieldCheckIcon.displayName = "ShieldCheckIcon"

export const InfoIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
      <path
        fill={color}
        d="M7.5.389A7.12 7.12 0 0 0 .389 7.5 7.12 7.12 0 0 0 7.5 14.611 7.12 7.12 0 0 0 14.611 7.5c0-3.921-3.19-7.111-7.111-7.111m.667 10.444a.667.667 0 0 1-1.334 0V7.944H6.39a.667.667 0 0 1 0-1.333h.667c.612 0 1.11.498 1.11 1.111zM7.5 5.5a.89.89 0 0 1 0-1.778.89.89 0 0 1 0 1.778"
      />
    </svg>
  )
)
InfoIcon.displayName = "InfoIcon"

export const LockClosedIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
      <path
        fill={color}
        d="M9.75 7.5A.75.75 0 0 1 9 6.75V4.5C9 3.673 8.327 3 7.5 3S6 3.673 6 4.5v2.25a.75.75 0 0 1-1.5 0V4.5c0-1.654 1.346-3 3-3s3 1.346 3 3v2.25a.75.75 0 0 1-.75.75"
      />
      <path
        fill={color}
        d="M10.75 6h-6.5A2.25 2.25 0 0 0 2 8.25v3a2.25 2.25 0 0 0 2.25 2.25h6.5A2.25 2.25 0 0 0 13 11.25v-3A2.25 2.25 0 0 0 10.75 6m-2.5 4.25a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 1.5 0z"
      />
    </svg>
  )
)
LockClosedIcon.displayName = "LockClosedIcon"

export const LockOpenIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
      <path
        fill={color}
        d="M6.833 7.5a.667.667 0 0 1-.666-.667V3.944a2.225 2.225 0 0 0-2.223-2.222 2.225 2.225 0 0 0-2.222 2.222v1.112a.667.667 0 0 1-1.333 0V3.944A3.56 3.56 0 0 1 3.944.39 3.56 3.56 0 0 1 7.5 3.944v2.89a.667.667 0 0 1-.667.666"
      />
      <path
        fill={color}
        d="M12.167 6.167H5.5A2.446 2.446 0 0 0 3.056 8.61v3.556A2.446 2.446 0 0 0 5.5 14.61h6.667a2.446 2.446 0 0 0 2.444-2.444V8.61a2.446 2.446 0 0 0-2.444-2.444M9.5 10.833a.667.667 0 0 1-1.333 0v-.889a.667.667 0 0 1 1.333 0z"
      />
    </svg>
  )
)
LockOpenIcon.displayName = "LockOpenIcon"

export const LinkIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <path d="m6.44 3.965 1.59-1.591a3.25 3.25 0 1 1 4.597 4.596l-1.591 1.59M3.964 6.44l-1.59 1.59a3.25 3.25 0 1 0 4.596 4.597l1.59-1.591M5.909 9.09 9.091 5.91" />
      </g>
    </svg>
  )
)
LinkIcon.displayName = "LinkIcon"

export const ClipboardCopyIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <path d="M12.386 4.5H7.614c-.753 0-1.364.773-1.364 1.727v6.046c0 .954.61 1.727 1.364 1.727h4.772c.754 0 1.364-.773 1.364-1.727V6.227c0-.954-.61-1.727-1.364-1.727" />
        <path d="M8.633 2.025C8.42 1.421 7.943 1 7.386 1H2.614C1.86 1 1.25 1.773 1.25 2.727v6.046c0 .954.61 1.727 1.364 1.727h1.039" />
      </g>
    </svg>
  )
)
ClipboardCopyIcon.displayName = "ClipboardCopyIcon"

