export type DevAccessMode = "public" | "passcode" | "maintenance"

export type DevAccessSettings = {
  public_access_enabled: boolean
  access_mode: DevAccessMode
  passcode: string
  public_domain: string
  maintenance_message: string
  allowed_ips: string[]
  updated_at: string
}

export type UpdateDevAccessInput = {
  public_access_enabled?: boolean
  access_mode?: DevAccessMode
  passcode?: string
  public_domain?: string
  maintenance_message?: string
  allowed_ips?: string[]
}
