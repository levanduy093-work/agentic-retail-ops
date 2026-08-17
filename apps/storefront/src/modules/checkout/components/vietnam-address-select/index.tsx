"use client"

import { sdk } from "@lib/config"
import { useTranslation } from "@lib/i18n/client"
import { convertToLocale } from "@lib/util/money"
import Input from "@modules/common/components/input"
import NativeSelect from "@modules/common/components/native-select"
import { useEffect, useRef, useState } from "react"

type Province = {
  id: number
  name: string
  code: string
  extensions: string[]
}

type District = {
  id: number
  province_id: number
  name: string
  code: string
  extensions: string[]
}

type Ward = {
  code: string
  district_id: number
  name: string
  extensions: string[]
}

type EstimatedGhnFees = {
  standard: number
}

type VietnamAddressSelectProps = {
  initialProvince?: string
  initialCity?: string
  initialAddress1?: string
  initialMetadata?: Record<string, unknown>
  onChange?: (data: {
    provinceId?: number
    provinceName?: string
    districtId?: number
    districtName?: string
    wardCode?: string
    wardName?: string
    streetAddress?: string
  }) => void
}

const VietnamAddressSelect = ({
  initialProvince,
  initialCity,
  initialAddress1,
  initialMetadata,
  onChange,
}: VietnamAddressSelectProps) => {
  const t = useTranslation()

  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [wards, setWards] = useState<Ward[]>([])

  const [selectedProvinceId, setSelectedProvinceId] = useState<number | "">(
    initialMetadata?.ghn_province_id ? Number(initialMetadata.ghn_province_id) : ""
  )
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | "">(
    initialMetadata?.ghn_district_id ? Number(initialMetadata.ghn_district_id) : ""
  )
  const [selectedWardCode, setSelectedWardCode] = useState<string>(
    initialMetadata?.ghn_ward_code ? String(initialMetadata.ghn_ward_code) : ""
  )
  const [streetAddress, setStreetAddress] = useState<string>(initialAddress1 || "")

  const [loadingProvinces, setLoadingProvinces] = useState(true)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [loadingWards, setLoadingWards] = useState(false)

  // Live GHN fee estimation state
  const [estimatingFee, setEstimatingFee] = useState(false)
  const [estimatedFees, setEstimatedFees] = useState<EstimatedGhnFees | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Sync state if initial props change (e.g. user chooses a different saved address)
  useEffect(() => {
    if (initialMetadata?.ghn_province_id) {
      setSelectedProvinceId(Number(initialMetadata.ghn_province_id))
    }
    if (initialMetadata?.ghn_district_id) {
      setSelectedDistrictId(Number(initialMetadata.ghn_district_id))
    }
    if (initialMetadata?.ghn_ward_code) {
      setSelectedWardCode(String(initialMetadata.ghn_ward_code))
    }
    if (initialAddress1) {
      setStreetAddress(initialAddress1)
    }
  }, [initialMetadata, initialAddress1])

  // 1. Fetch Provinces on Mount
  useEffect(() => {
    setLoadingProvinces(true)
    sdk.client
      .fetch<{ provinces: Province[] }>("/store/vietnam-address/provinces")
      .then((res) => {
        if (res?.provinces && isMountedRef.current) {
          setProvinces(res.provinces)
          // If initialProvince was passed by name and no ID was set, match by name
          if (!selectedProvinceId && initialProvince) {
            const found = res.provinces.find(
              (p) =>
                p.name.toLowerCase().includes(initialProvince.toLowerCase()) ||
                initialProvince.toLowerCase().includes(p.name.toLowerCase())
            )
            if (found) setSelectedProvinceId(found.id)
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMountedRef.current) setLoadingProvinces(false)
      })
  }, [initialProvince])

  // 2. Fetch Districts when Province changes
  useEffect(() => {
    if (!selectedProvinceId) {
      setDistricts([])
      setSelectedDistrictId("")
      setWards([])
      setSelectedWardCode("")
      setEstimatedFees(null)
      return
    }

    setLoadingDistricts(true)
    sdk.client
      .fetch<{ districts: District[] }>(
        `/store/vietnam-address/districts?province_id=${selectedProvinceId}`
      )
      .then((res) => {
        if (res?.districts && isMountedRef.current) {
          setDistricts(res.districts)
          if (!selectedDistrictId && initialCity) {
            const found = res.districts.find(
              (d) =>
                d.name.toLowerCase().includes(initialCity.toLowerCase()) ||
                d.extensions?.some((ext) =>
                  ext.toLowerCase().includes(initialCity.toLowerCase())
                )
            )
            if (found) setSelectedDistrictId(found.id)
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMountedRef.current) setLoadingDistricts(false)
      })
  }, [selectedProvinceId, initialCity])

  // 3. Fetch Wards when District changes
  useEffect(() => {
    if (!selectedDistrictId) {
      setWards([])
      setSelectedWardCode("")
      setEstimatedFees(null)
      return
    }

    setLoadingWards(true)
    sdk.client
      .fetch<{ wards: Ward[] }>(
        `/store/vietnam-address/wards?district_id=${selectedDistrictId}`
      )
      .then((res) => {
        if (res?.wards && isMountedRef.current) {
          setWards(res.wards)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMountedRef.current) setLoadingWards(false)
      })
  }, [selectedDistrictId])

  // 4. Live GHN Fee Calculation when District is selected
  useEffect(() => {
    if (!selectedDistrictId) {
      setEstimatedFees(null)
      return
    }

    setEstimatingFee(true)
    // NOTE: SDK handles serialization, pass plain object (never JSON.stringify)
    sdk.client
      .fetch<{
        success: boolean
        standard_fee: number
      }>("/store/vietnam-address/calculate-fee", {
        method: "POST",
        body: {
          to_district_id: Number(selectedDistrictId),
          to_ward_code: selectedWardCode || undefined,
        },
      })
      .then((res) => {
        if (res?.success && isMountedRef.current) {
          setEstimatedFees({
            standard: res.standard_fee,
          })
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          setEstimatedFees(null)
        }
      })
      .finally(() => {
        if (isMountedRef.current) setEstimatingFee(false)
      })
  }, [selectedDistrictId, selectedWardCode])

  // Current Names
  const currentProvince = provinces.find((p) => p.id === Number(selectedProvinceId))
  const currentDistrict = districts.find((d) => d.id === Number(selectedDistrictId))
  const currentWard = wards.find((w) => w.code === selectedWardCode)

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : ""
    setSelectedProvinceId(val)
    setSelectedDistrictId("")
    setSelectedWardCode("")
    notifyChange(val ? Number(val) : undefined, undefined, undefined, streetAddress)
  }

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : ""
    setSelectedDistrictId(val)
    setSelectedWardCode("")
    notifyChange(
      selectedProvinceId ? Number(selectedProvinceId) : undefined,
      val ? Number(val) : undefined,
      undefined,
      streetAddress
    )
  }

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedWardCode(val)
    notifyChange(
      selectedProvinceId ? Number(selectedProvinceId) : undefined,
      selectedDistrictId ? Number(selectedDistrictId) : undefined,
      val || undefined,
      streetAddress
    )
  }

  const handleStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setStreetAddress(val)
    notifyChange(
      selectedProvinceId ? Number(selectedProvinceId) : undefined,
      selectedDistrictId ? Number(selectedDistrictId) : undefined,
      selectedWardCode || undefined,
      val
    )
  }

  const notifyChange = (
    pId?: number,
    dId?: number,
    wCode?: string,
    street?: string
  ) => {
    const prov = provinces.find((p) => p.id === pId)
    const dist = districts.find((d) => d.id === dId)
    const ward = wards.find((w) => w.code === wCode)

    onChange?.({
      provinceId: pId,
      provinceName: prov?.name,
      districtId: dId,
      districtName: dist?.name,
      wardCode: wCode,
      wardName: ward?.name,
      streetAddress: street,
    })
  }

  // Combined full address for Medusa address_1
  const fullAddress1 = [
    streetAddress,
    currentWard ? currentWard.name : "",
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="flex flex-col gap-y-4 col-span-2">
      {/* Hidden inputs to feed standard FormData for Medusa updateCart */}
      <input
        type="hidden"
        name="shipping_address.province"
        value={currentProvince?.name || ""}
      />
      <input
        type="hidden"
        name="shipping_address.city"
        value={currentDistrict?.name || ""}
      />
      <input
        type="hidden"
        name="shipping_address.address_1"
        value={fullAddress1 || streetAddress}
      />
      <input
        type="hidden"
        name="shipping_address.postal_code"
        value="700000"
      />
      <input
        type="hidden"
        name="shipping_address.metadata.ghn_province_id"
        value={selectedProvinceId ? String(selectedProvinceId) : ""}
      />
      <input
        type="hidden"
        name="shipping_address.metadata.ghn_district_id"
        value={selectedDistrictId ? String(selectedDistrictId) : ""}
      />
      <input
        type="hidden"
        name="shipping_address.metadata.ghn_ward_code"
        value={selectedWardCode}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Province / City */}
        <div className="flex flex-col gap-y-1">
          <label className="text-xs text-ui-fg-subtle font-medium">
            Tỉnh / Thành phố <span className="text-rose-500">*</span>
          </label>
          <NativeSelect
            placeholder={loadingProvinces ? "Đang tải tỉnh thành..." : "Chọn Tỉnh / Thành..."}
            value={selectedProvinceId ? String(selectedProvinceId) : ""}
            onChange={handleProvinceChange}
            required
          >
            {provinces.map((prov) => (
              <option key={prov.id} value={String(prov.id)}>
                {prov.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* District */}
        <div className="flex flex-col gap-y-1">
          <label className="text-xs text-ui-fg-subtle font-medium">
            Quận / Huyện <span className="text-rose-500">*</span>
          </label>
          <NativeSelect
            placeholder={
              !selectedProvinceId
                ? "Vui lòng chọn Tỉnh/Thành trước"
                : loadingDistricts
                ? "Đang tải quận huyện..."
                : "Chọn Quận / Huyện..."
            }
            value={selectedDistrictId ? String(selectedDistrictId) : ""}
            onChange={handleDistrictChange}
            disabled={!selectedProvinceId || loadingDistricts}
            required
          >
            {districts.map((dist) => {
              const extensionHint =
                dist.extensions && dist.extensions.length > 0
                  ? ` (${dist.extensions.slice(0, 2).join(", ")})`
                  : ""
              return (
                <option key={dist.id} value={String(dist.id)}>
                  {dist.name}
                  {extensionHint}
                </option>
              )
            })}
          </NativeSelect>
        </div>

        {/* Ward */}
        <div className="flex flex-col gap-y-1">
          <label className="text-xs text-ui-fg-subtle font-medium">
            Phường / Xã <span className="text-rose-500">*</span>
          </label>
          <NativeSelect
            placeholder={
              !selectedDistrictId
                ? "Vui lòng chọn Quận/Huyện trước"
                : loadingWards
                ? "Đang tải phường xã..."
                : "Chọn Phường / Xã..."
            }
            value={selectedWardCode}
            onChange={handleWardChange}
            disabled={!selectedDistrictId || loadingWards}
            required
          >
            {wards.map((ward) => (
              <option key={ward.code} value={ward.code}>
                {ward.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Street Address */}
      <div className="flex flex-col gap-y-1">
        <Input
          label="Số nhà, tên đường, tòa nhà"
          name="vietnam_street_address"
          value={streetAddress}
          onChange={handleStreetChange}
          placeholder="Ví dụ: 123 Đường Song Hành"
          required
        />
      </div>

      {/* Live GHN Fee Estimation Card */}
      {selectedDistrictId ? (
        <div className="mt-2 rounded-2xl border border-emerald-900/10 bg-emerald-50/50 p-4 transition-all duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-900/10">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#12231d] text-white text-[10px] font-bold tracking-tight shadow-sm">
                GHN
              </span>
              <div>
                <span className="text-xs font-semibold text-emerald-950 uppercase tracking-wider">
                  {t("checkout.ghn_estimated_fee")}
                </span>
                <p className="text-[11px] text-emerald-800/80">
                  {t("checkout.ghn_fee_notice")}
                </p>
              </div>
            </div>
            {estimatingFee && (
              <span className="text-[11px] font-medium text-emerald-700 animate-pulse flex items-center gap-1.5">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t("checkout.ghn_calculating")}
              </span>
            )}
          </div>

          {estimatedFees && (
            <div className="pt-3">
              <div className="rounded-xl border border-emerald-900/10 bg-white/90 p-3 shadow-xs flex flex-col justify-between hover:border-emerald-700/30 transition-colors">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#12231d]">
                      {t("checkout.ghn_standard")}
                    </span>
                    <span className="text-xs font-bold text-emerald-800">
                      {convertToLocale({ amount: estimatedFees.standard, currency_code: "vnd" })}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default VietnamAddressSelect
