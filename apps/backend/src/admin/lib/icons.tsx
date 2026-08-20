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

export const CreditCardIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" />
        <path d="M1.5 5.5h12" />
        <path d="M3.5 9.5h3" />
      </g>
    </svg>
  )
)
CreditCardIcon.displayName = "CreditCardIcon"

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

export const EllipsisHorizontalIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        fillRule="evenodd"
        d="M2.5 7.5a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0M6.25 7.5a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0m3.75 0a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0"
        clipRule="evenodd"
      />
    </svg>
  )
)
EllipsisHorizontalIcon.displayName = "EllipsisHorizontalIcon"

export const TrashIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <path d="M2.5 3.5h10M5.5 3.5V2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5M3.5 3.5v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-9M6 6.5v4M9 6.5v4" />
      </g>
    </svg>
  )
)
TrashIcon.displayName = "TrashIcon"

export const SendIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        d="m14.435 6.942-12.5-5.75a.625.625 0 0 0-.87.72l1.246 4.985a.625.625 0 0 0 .472.464L8.125 7.5l-5.342.191a.625.625 0 0 0-.472.464l-1.246 4.985a.625.625 0 0 0 .87.72l12.5-5.75a.625.625 0 0 0 0-1.116z"
      />
    </svg>
  )
)
SendIcon.displayName = "SendIcon"

export const TelegramIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, color = "currentColor", ...props }, ref) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <path
        fill={color}
        d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.847-.96 4.966-1.359 7.098-.17.9-.5 1.2-.818 1.23-.695.064-1.222-.46-1.896-.9-1.055-.693-1.652-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.664 3.498-1.524 5.831-2.529 7.001-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.14.121.099.155.232.171.326.016.094.037.309.02.479z"
      />
    </svg>
  )
)
TelegramIcon.displayName = "TelegramIcon"

export const ZaloIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, color = "currentColor", ...props }, ref) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <path
        fill={color}
        d="M12.49 10.2722v-.4496h1.3467v6.3218h-.7704a.576.576 0 0 1-.5763-.5729l-.0006.0005a3.273 3.273 0 0 1-1.9372.6321c-1.8138 0-3.2844-1.4697-3.2844-3.2823 0-1.8125 1.4706-3.2822 3.2844-3.2822a3.273 3.273 0 0 1 1.9372.6321l.0006.0005zM6.9188 7.7896v.205c0 .3823-.051.6944-.2995 1.0605l-.03.0343c-.0542.0615-.1815.206-.2421.2843L2.024 14.8h4.8948v.7682a.5764.5764 0 0 1-.5767.5761H0v-.3622c0-.4436.1102-.6414.2495-.8476L4.8582 9.23H.1922V7.7896h6.7266zm8.5513 8.3548a.4805.4805 0 0 1-.4803-.4798v-7.875h1.4416v8.3548H15.47zM20.6934 9.6C22.52 9.6 24 11.0807 24 12.9044c0 1.8252-1.4801 3.306-3.3066 3.306-1.8264 0-3.3066-1.4808-3.3066-3.306 0-1.8237 1.4802-3.3044 3.3066-3.3044zm-10.1412 5.253c1.0675 0 1.9324-.8645 1.9324-1.9312 0-1.065-.865-1.9295-1.9324-1.9295s-1.9324.8644-1.9324 1.9295c0 1.0667.865 1.9312 1.9324 1.9312zm10.1412-.0033c1.0737 0 1.945-.8707 1.945-1.9453 0-1.073-.8713-1.9436-1.945-1.9436-1.0753 0-1.945.8706-1.945 1.9436 0 1.0746.8697 1.9453 1.945 1.9453z"
      />
    </svg>
  )
)
ZaloIcon.displayName = "ZaloIcon"

export const FacebookMessengerIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, color = "currentColor", ...props }, ref) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <path
        fill={color}
        d="M12 0C5.24 0 0 4.952 0 11.64c0 3.499 1.434 6.521 3.769 8.61a.96.96 0 0 1 .323.683l.065 2.135a.96.96 0 0 0 1.347.85l2.381-1.053a.96.96 0 0 1 .641-.046A13 13 0 0 0 12 23.28c6.76 0 12-4.952 12-11.64S18.76 0 12 0m6.806 7.44c.522-.03.971.567.63 1.094l-4.178 6.457a.707.707 0 0 1-.977.208l-3.87-2.504a.44.44 0 0 0-.49.007l-4.363 3.01c-.637.438-1.415-.317-.995-.966l4.179-6.457a.706.706 0 0 1 .977-.21l3.87 2.505c.15.097.344.094.491-.007l4.362-3.008a.7.7 0 0 1 .364-.13"
      />
    </svg>
  )
)
FacebookMessengerIcon.displayName = "FacebookMessengerIcon"

export const FacebookIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className = "", size = 15, color = "currentColor", ...props }, ref) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      ref={ref}
      aria-hidden="true"
      {...props}
    >
      <path
        fill={color}
        d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
      />
    </svg>
  )
)
FacebookIcon.displayName = "FacebookIcon"

export const MailIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" />
        <path d="m2 3.5 5.5 4.5 5.5-4.5" />
      </g>
    </svg>
  )
)
MailIcon.displayName = "MailIcon"

