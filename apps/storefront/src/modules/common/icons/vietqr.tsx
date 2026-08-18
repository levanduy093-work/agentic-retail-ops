import React from "react"
import { IconProps } from "types/icon"

const VietQRIcon: React.FC<IconProps> = ({
  size = "20",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
      <rect x="5" y="5" width="3" height="3" fill={color} />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
      <rect x="16" y="5" width="3" height="3" fill={color} />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
      <rect x="5" y="16" width="3" height="3" fill={color} />
      <path d="M14 14h3v3h-3zM18 14h3v3h-3zM14 18h3v3h-3zM18 18h3v3h-3z" fill={color} />
    </svg>
  )
}

export default VietQRIcon
