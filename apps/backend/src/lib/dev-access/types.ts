export type DevAccessSettings = {
  passcode_hash: string
  public_access_enabled: boolean
  updated_at: string
}

export type UpdateDevAccessInput = {
  passcode?: string
  public_access_enabled?: boolean
}

export type PublicDevAccessSettings = {
  has_passcode: boolean
  public_access_enabled: boolean
  updated_at: string
}
