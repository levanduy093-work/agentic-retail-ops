"use client"

import { sdk } from "@lib/config"
import Input from "@modules/common/components/input"
import NativeSelect from "@modules/common/components/native-select"
import { useEffect, useState } from "react"
import { useTranslation } from "@lib/i18n/client"

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
    initialMetadata?.ghn_province_id
      ? Number(initialMetadata.ghn_province_id)
      : "",
  )
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | "">(
    initialMetadata?.ghn_district_id
      ? Number(initialMetadata.ghn_district_id)
      : "",
  )
  const [selectedWardCode, setSelectedWardCode] = useState<string>(
    initialMetadata?.ghn_ward_code ? String(initialMetadata.ghn_ward_code) : "",
  )
  const [streetAddress, setStreetAddress] = useState<string>(
    initialAddress1 || "",
  )

  const [loadingProvinces, setLoadingProvinces] = useState(true)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [loadingWards, setLoadingWards] = useState(false)

  // Sync state if initial props change (e.g. user chooses a different saved address)
  useEffect(() => {
    if (initialMetadata?.ghn_province_id) {
      setSelectedProvinceId(Number(initialMetadata.ghn_province_id))
    } else {
      setSelectedProvinceId("")
    }
    if (initialMetadata?.ghn_district_id) {
      setSelectedDistrictId(Number(initialMetadata.ghn_district_id))
    } else {
      setSelectedDistrictId("")
    }
    if (initialMetadata?.ghn_ward_code) {
      setSelectedWardCode(String(initialMetadata.ghn_ward_code))
    } else {
      setSelectedWardCode("")
    }
  }, [initialMetadata])

  // 1. Fetch Provinces on Mount
  useEffect(() => {
    setLoadingProvinces(true)
    sdk.client
      .fetch<{ provinces: Province[] }>("/store/vietnam-address/provinces")
      .then((res) => {
        if (res?.provinces) {
          setProvinces(res.provinces)
          // If initialProvince was passed by name and no ID was set, match by name
          if (!selectedProvinceId && initialProvince) {
            const found = res.provinces.find(
              (p) =>
                p.name.toLowerCase().includes(initialProvince.toLowerCase()) ||
                initialProvince.toLowerCase().includes(p.name.toLowerCase()),
            )
            if (found) setSelectedProvinceId(found.id)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProvinces(false))
  }, [initialProvince])

  // 2. Fetch Districts when Province changes
  useEffect(() => {
    if (!selectedProvinceId) {
      setDistricts([])
      setSelectedDistrictId("")
      setWards([])
      setSelectedWardCode("")
      return
    }

    setLoadingDistricts(true)
    sdk.client
      .fetch<{ districts: District[] }>(
        `/store/vietnam-address/districts?province_id=${selectedProvinceId}`,
      )
      .then((res) => {
        if (res?.districts) {
          setDistricts(res.districts)
          if (!selectedDistrictId && initialCity) {
            const found = res.districts.find(
              (d) =>
                d.name.toLowerCase().includes(initialCity.toLowerCase()) ||
                d.extensions?.some((ext) =>
                  ext.toLowerCase().includes(initialCity.toLowerCase()),
                ),
            )
            if (found) setSelectedDistrictId(found.id)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDistricts(false))
  }, [selectedProvinceId, initialCity])

  // 3. Fetch Wards when District changes
  useEffect(() => {
    if (!selectedDistrictId) {
      setWards([])
      setSelectedWardCode("")
      return
    }

    setLoadingWards(true)
    sdk.client
      .fetch<{ wards: Ward[] }>(
        `/store/vietnam-address/wards?district_id=${selectedDistrictId}`,
      )
      .then((res) => {
        if (res?.wards) {
          setWards(res.wards)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingWards(false))
  }, [selectedDistrictId])

  // Current Names
  const currentProvince = provinces.find(
    (p) => p.id === Number(selectedProvinceId),
  )
  const currentDistrict = districts.find(
    (d) => d.id === Number(selectedDistrictId),
  )
  const currentWard = wards.find((w) => w.code === selectedWardCode)

  useEffect(() => {
    if (!initialAddress1) return

    const wardName = wards.find(
      (ward) => ward.code === String(initialMetadata?.ghn_ward_code || ""),
    )?.name
    const repeatedWardSuffix = wardName
      ? new RegExp(
          `(?:,\\s*${wardName.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})+$`,
          "i",
        )
      : null

    setStreetAddress(initialAddress1.replace(repeatedWardSuffix || /$^/, ""))
  }, [initialAddress1, initialMetadata?.ghn_ward_code, wards])

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : ""
    setSelectedProvinceId(val)
    setSelectedDistrictId("")
    setSelectedWardCode("")
    notifyChange(
      val ? Number(val) : undefined,
      undefined,
      undefined,
      streetAddress,
    )
  }

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : ""
    setSelectedDistrictId(val)
    setSelectedWardCode("")
    notifyChange(
      selectedProvinceId ? Number(selectedProvinceId) : undefined,
      val ? Number(val) : undefined,
      undefined,
      streetAddress,
    )
  }

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedWardCode(val)
    notifyChange(
      selectedProvinceId ? Number(selectedProvinceId) : undefined,
      selectedDistrictId ? Number(selectedDistrictId) : undefined,
      val || undefined,
      streetAddress,
    )
  }

  const handleStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setStreetAddress(val)
    notifyChange(
      selectedProvinceId ? Number(selectedProvinceId) : undefined,
      selectedDistrictId ? Number(selectedDistrictId) : undefined,
      selectedWardCode || undefined,
      val,
    )
  }

  const notifyChange = (
    pId?: number,
    dId?: number,
    wCode?: string,
    street?: string,
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
  const fullAddress1 = [streetAddress, currentWard ? currentWard.name : ""]
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
      <input type="hidden" name="shipping_address.postal_code" value="700000" />
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
        <div className="flex flex-col gap-y-1.5">
          <label className="text-xs text-ui-fg-subtle font-medium">
            {t("checkout.province_label")} <span className="text-rose-500">*</span>
          </label>
          <NativeSelect
            placeholder={
              loadingProvinces
                ? t("checkout.loading_provinces")
                : t("checkout.select_province")
            }
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
        <div className="flex flex-col gap-y-1.5">
          <label className="text-xs text-ui-fg-subtle font-medium">
            {t("checkout.district_label")} <span className="text-rose-500">*</span>
          </label>
          <NativeSelect
            placeholder={
              !selectedProvinceId
                ? t("checkout.select_province_first")
                : loadingDistricts
                  ? t("checkout.loading_districts")
                  : t("checkout.select_district")
            }
            value={selectedDistrictId ? String(selectedDistrictId) : ""}
            onChange={handleDistrictChange}
            disabled={!selectedProvinceId || loadingDistricts}
            required
          >
            {districts.map((dist) => (
              <option key={dist.id} value={String(dist.id)}>
                {dist.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Ward */}
        <div className="flex flex-col gap-y-1.5">
          <label className="text-xs text-ui-fg-subtle font-medium">
            {t("checkout.ward_label")} <span className="text-rose-500">*</span>
          </label>
          <NativeSelect
            placeholder={
              !selectedDistrictId
                ? t("checkout.select_district_first")
                : loadingWards
                  ? t("checkout.loading_wards")
                  : t("checkout.select_ward")
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
      <Input
        label={t("checkout.street_address_label")}
        name="vietnam_street_address"
        value={streetAddress}
        onChange={handleStreetChange}
        required
      />

    </div>
  )
}

export default VietnamAddressSelect
