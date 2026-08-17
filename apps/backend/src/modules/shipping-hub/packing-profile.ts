export type PackagingBox = {
  code: string
  height: number
  length: number
  width: number
}

export type PackagingProfile = {
  boxes: PackagingBox[]
  max_items_per_package: number
  max_weight_per_package: number
  packaging_weight: number
}

export type PackableItem = {
  height?: number | null
  length?: number | null
  quantity?: number | null
  weight?: number | null
  width?: number | null
}

export type PackedPackage = {
  box_code: string
  height: number
  item_count: number
  length: number
  weight: number
  width: number
}

export const DEFAULT_PACKAGING_PROFILE: PackagingProfile = {
  packaging_weight: 80,
  max_items_per_package: 5,
  max_weight_per_package: 3000,
  boxes: [
    { code: "S", length: 25, width: 18, height: 8 },
    { code: "M", length: 35, width: 25, height: 12 },
    { code: "L", length: 45, width: 35, height: 18 },
  ],
}

function positiveNumber(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function normalizeBox(value: unknown): PackagingBox | null {
  if (!value || typeof value !== "object") return null
  const box = value as Partial<PackagingBox>
  if (!box.code?.trim()) return null

  return {
    code: box.code.trim().toUpperCase(),
    length: positiveNumber(box.length, 0),
    width: positiveNumber(box.width, 0),
    height: positiveNumber(box.height, 0),
  }
}

export function normalizePackagingProfile(value: unknown): PackagingProfile {
  if (!value || typeof value !== "object") return DEFAULT_PACKAGING_PROFILE
  const profile = value as Partial<PackagingProfile>
  const boxes = Array.isArray(profile.boxes)
    ? profile.boxes.map(normalizeBox).filter((box): box is PackagingBox => Boolean(box))
    : []

  return {
    packaging_weight: positiveNumber(
      profile.packaging_weight,
      DEFAULT_PACKAGING_PROFILE.packaging_weight
    ),
    max_items_per_package: Math.floor(
      positiveNumber(
        profile.max_items_per_package,
        DEFAULT_PACKAGING_PROFILE.max_items_per_package
      )
    ),
    max_weight_per_package: positiveNumber(
      profile.max_weight_per_package,
      DEFAULT_PACKAGING_PROFILE.max_weight_per_package
    ),
    boxes: (boxes.length ? boxes : DEFAULT_PACKAGING_PROFILE.boxes)
      .slice()
      .sort((a, b) => a.length * a.width * a.height - b.length * b.width * b.height),
  }
}

function fits(box: PackagingBox, length: number, width: number, height: number) {
  const packageDimensions = [length, width, height].sort((a, b) => b - a)
  const boxDimensions = [box.length, box.width, box.height].sort((a, b) => b - a)
  return packageDimensions.every((dimension, index) => dimension <= boxDimensions[index])
}

type NormalizedPackageItem = {
  height: number
  length: number
  weight: number
  width: number
}

function packageDimensions(items: NormalizedPackageItem[]) {
  return {
    length: Math.max(...items.map((item) => item.length)),
    width: Math.max(...items.map((item) => item.width)),
    height: items.reduce((sum, item) => sum + item.height, 0),
  }
}

export function buildPackingPlan(
  items: PackableItem[],
  profileInput?: unknown,
  fallbackWeight = 300
): PackedPackage[] {
  const profile = normalizePackagingProfile(profileInput)
  const units: NormalizedPackageItem[] = items.flatMap((item) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))
    const normalized = {
      length: positiveNumber(item.length, 15),
      width: positiveNumber(item.width, 10),
      height: positiveNumber(item.height, 5),
      weight: positiveNumber(item.weight, fallbackWeight),
    }
    return Array.from({ length: quantity }, () => normalized)
  })

  if (!units.length) {
    return []
  }

  units.sort((a, b) => b.length * b.width * b.height - a.length * a.width * a.height)
  const groups: typeof units[] = []
  let group: typeof units = []
  let groupWeight = 0

  for (const unit of units) {
    const exceedsLimit =
      group.length >= profile.max_items_per_package ||
      (group.length > 0 && groupWeight + unit.weight > profile.max_weight_per_package)
    if (exceedsLimit) {
      groups.push(group)
      group = []
      groupWeight = 0
    }
    group.push(unit)
    groupWeight += unit.weight
  }
  if (group.length) groups.push(group)

  return groups.map((groupItems) => {
    const dimensions = packageDimensions(groupItems)
    const box = profile.boxes.find((candidate) =>
      fits(candidate, dimensions.length, dimensions.width, dimensions.height)
    )
    return {
      box_code: box?.code || "CUSTOM",
      length: box?.length || Math.ceil(dimensions.length),
      width: box?.width || Math.ceil(dimensions.width),
      height: box?.height || Math.ceil(dimensions.height),
      item_count: groupItems.length,
      weight: Math.ceil(
        groupItems.reduce((sum, item) => sum + item.weight, 0) +
          profile.packaging_weight
      ),
    }
  })
}
