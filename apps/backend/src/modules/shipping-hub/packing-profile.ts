export type PackagingStrategy = "hybrid_auto" | "pe_only" | "carton_only"

export type PackagingBox = {
  code: string
  height: number
  length: number
  max_items?: number
  name?: string
  width: number
}

export type PackagingBag = {
  code: string
  length: number
  max_items?: number
  max_thickness?: number
  name?: string
  width: number
}

export type NormalizedPackagingProfile = {
  bag_packaging_weight: number
  bags: PackagingBag[]
  boxes: PackagingBox[]
  max_items_per_package: number
  max_weight_per_package: number
  packaging_weight: number
  strategy: PackagingStrategy
}

export type PackagingProfile = {
  bag_packaging_weight?: number
  bags?: PackagingBag[]
  boxes: PackagingBox[]
  max_items_per_package: number
  max_weight_per_package: number
  packaging_weight: number
  strategy?: PackagingStrategy
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
  box_name?: string
  height: number
  item_count: number
  length: number
  package_type?: "pe_bag" | "carton_box" | "custom"
  weight: number
  width: number
}

export const DEFAULT_PACKAGING_PROFILE: NormalizedPackagingProfile = {
  strategy: "hybrid_auto",
  packaging_weight: 80,
  bag_packaging_weight: 10,
  max_items_per_package: 5,
  max_weight_per_package: 3000,
  bags: [
    {
      code: "PE-17x30",
      name: "Túi PE 17x30cm (1 áo thun / phụ kiện nhỏ)",
      length: 30,
      width: 17,
      max_thickness: 4,
      max_items: 1,
    },
    {
      code: "PE-25x35",
      name: "Túi PE 25x35cm (1-2 áo sơ mi / quần jean)",
      length: 35,
      width: 25,
      max_thickness: 5,
      max_items: 2,
    },
    {
      code: "PE-28x42",
      name: "Túi PE 28x42cm (2-3 áo / set đồ ngủ)",
      length: 42,
      width: 28,
      max_thickness: 6,
      max_items: 3,
    },
    {
      code: "PE-32x45",
      name: "Túi PE 32x45cm (Áo khoác / Váy dày / Giày mềm)",
      length: 45,
      width: 32,
      max_thickness: 7,
      max_items: 5,
    },
    {
      code: "PE-38x52",
      name: "Túi PE 38x52cm (Combo lớn / Áo phao / Balo)",
      length: 52,
      width: 38,
      max_thickness: 8,
      max_items: 8,
    },
  ],
  boxes: [
    {
      code: "S",
      name: "Hộp Carton S (25x18x8cm - Hàng nhỏ, mỹ phẩm)",
      length: 25,
      width: 18,
      height: 8,
      max_items: 2,
    },
    {
      code: "M",
      name: "Hộp Carton M (35x25x12cm - Hàng vừa, phụ kiện)",
      length: 35,
      width: 25,
      height: 12,
      max_items: 4,
    },
    {
      code: "L",
      name: "Hộp Carton L (45x35x18cm - Hàng lớn, giày hộp)",
      length: 45,
      width: 35,
      height: 18,
      max_items: 6,
    },
    {
      code: "XL",
      name: "Hộp Carton XL (55x40x25cm - Combo nhiều món)",
      length: 55,
      width: 40,
      height: 25,
      max_items: 10,
    },
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
    name: box.name?.trim() || undefined,
    length: positiveNumber(box.length, 0),
    width: positiveNumber(box.width, 0),
    height: positiveNumber(box.height, 0),
    max_items: box.max_items ? Math.max(1, Math.floor(Number(box.max_items))) : undefined,
  }
}

function normalizeBag(value: unknown): PackagingBag | null {
  if (!value || typeof value !== "object") return null
  const bag = value as Partial<PackagingBag>
  if (!bag.code?.trim()) return null

  return {
    code: bag.code.trim().toUpperCase(),
    name: bag.name?.trim() || undefined,
    length: positiveNumber(bag.length, 0),
    width: positiveNumber(bag.width, 0),
    max_thickness: positiveNumber(bag.max_thickness, 5),
    max_items: bag.max_items ? Math.max(1, Math.floor(Number(bag.max_items))) : undefined,
  }
}

export function normalizePackagingProfile(
  value: unknown
): NormalizedPackagingProfile {
  if (!value || typeof value !== "object") return DEFAULT_PACKAGING_PROFILE
  const profile = value as Partial<PackagingProfile>

  const rawStrategy = profile.strategy
  const strategy: PackagingStrategy =
    rawStrategy === "pe_only" || rawStrategy === "carton_only" || rawStrategy === "hybrid_auto"
      ? rawStrategy
      : DEFAULT_PACKAGING_PROFILE.strategy

  const boxes = Array.isArray(profile.boxes)
    ? profile.boxes.map(normalizeBox).filter((box): box is PackagingBox => Boolean(box))
    : []

  const bags = Array.isArray(profile.bags)
    ? profile.bags.map(normalizeBag).filter((bag): bag is PackagingBag => Boolean(bag))
    : []

  return {
    strategy,
    packaging_weight: positiveNumber(
      profile.packaging_weight,
      DEFAULT_PACKAGING_PROFILE.packaging_weight
    ),
    bag_packaging_weight: positiveNumber(
      profile.bag_packaging_weight,
      DEFAULT_PACKAGING_PROFILE.bag_packaging_weight
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
    bags: (bags.length ? bags : DEFAULT_PACKAGING_PROFILE.bags)
      .slice()
      .sort((a, b) => a.length * a.width - b.length * b.width),
    boxes: (boxes.length ? boxes : DEFAULT_PACKAGING_PROFILE.boxes)
      .slice()
      .sort((a, b) => a.length * a.width * a.height - b.length * b.width * b.height),
  }
}

type NormalizedPackageItem = {
  height: number
  length: number
  weight: number
  width: number
}

type BoundingArrangement = {
  height: number
  length: number
  width: number
}

type PackagingCandidate = {
  billable_weight: number
  box_code: string
  box_name?: string
  footprint: number
  height: number
  item_count: number
  length: number
  package_type: "pe_bag" | "carton_box" | "custom"
  weight: number
  width: number
}

function generate3DArrangements(items: NormalizedPackageItem[]): BoundingArrangement[] {
  if (!items.length) return []
  if (items.length === 1) {
    const sorted = [items[0].length, items[0].width, items[0].height].sort((a, b) => b - a)
    return [{ length: sorted[0], width: sorted[1], height: sorted[2] }]
  }

  const oriented = items.map((item) => {
    const sorted = [item.length, item.width, item.height].sort((a, b) => b - a)
    return { length: sorted[0], width: sorted[1], height: sorted[2] }
  })

  const results: BoundingArrangement[] = []

  // 1. Vertical Stacking Topology (Xếp chồng)
  const stackL = Math.max(...oriented.map((it) => it.length))
  const stackW = Math.max(...oriented.map((it) => it.width))
  const rawStackH = oriented.reduce((sum, it) => sum + it.height, 0)
  // Quần áo / đồ mềm khi xếp chồng nhiều lớp nén tự nhiên theo thể tích
  const stackH = Math.max(
    ...oriented.map((it) => it.height),
    Math.ceil(rawStackH * 0.75)
  )
  const sortedStack = [stackL, stackW].sort((a, b) => b - a)
  results.push({ length: sortedStack[0], width: sortedStack[1], height: stackH })

  // 2. Side-by-side along length (Xếp nối tiếp theo chiều dài)
  const lengthL = oriented.reduce((sum, it) => sum + it.length, 0)
  const lengthW = Math.max(...oriented.map((it) => it.width))
  const lengthH = Math.max(...oriented.map((it) => it.height))
  const sortedLen = [lengthL, lengthW].sort((a, b) => b - a)
  results.push({ length: sortedLen[0], width: sortedLen[1], height: lengthH })

  // 3. Side-by-side along width (Xếp cạnh nhau theo chiều rộng)
  const widthL = Math.max(...oriented.map((it) => it.length))
  const widthW = oriented.reduce((sum, it) => sum + it.width, 0)
  const widthH = Math.max(...oriented.map((it) => it.height))
  const sortedWid = [widthL, widthW].sort((a, b) => b - a)
  results.push({ length: sortedWid[0], width: sortedWid[1], height: widthH })

  // 4. 2x2 Grid Topology (for 2, 3, 4, 5 items)
  if (items.length >= 2) {
    const half = Math.ceil(oriented.length / 2)
    const row1 = oriented.slice(0, half)
    const row2 = oriented.slice(half)

    const gridL = Math.max(
      row1.reduce((sum, it) => sum + it.length, 0),
      row2.reduce((sum, it) => sum + it.length, 0)
    )
    const gridW =
      Math.max(...row1.map((it) => it.width)) + Math.max(...row2.map((it) => it.width))
    const gridH = Math.max(
      ...row1.map((it) => it.height),
      ...row2.map((it) => it.height)
    )
    const sortedGrid = [gridL, gridW].sort((a, b) => b - a)
    results.push({ length: sortedGrid[0], width: sortedGrid[1], height: gridH })
  }

  return results
}

function evaluateBagCandidate(
  bag: PackagingBag,
  arrangement: BoundingArrangement,
  itemCount: number,
  totalItemsWeight: number,
  bagTareWeight: number
): PackagingCandidate | null {
  if (bag.max_items && itemCount > bag.max_items) return null
  const maxThickness = bag.max_thickness || 8
  if (arrangement.height > maxThickness) return null

  const bagDim = [bag.length, bag.width].sort((a, b) => b - a)
  const bagL = bagDim[0]
  const bagW = bagDim[1]

  const itemL = arrangement.length
  const itemW = arrangement.width
  const itemH = arrangement.height

  // Quy chuẩn hình học bao bì mềm: Chu vi mặt cắt ngang và chiều dài nén
  const neededWidth = itemW + itemH
  const neededLength = itemL + itemH + 3.5 // Nếp gấp mép keo

  const fitsNormal = neededWidth <= bagW && neededLength <= bagL
  const fitsRotated = neededWidth <= bagL && neededLength <= bagW

  if (!fitsNormal && !fitsRotated) return null

  const shipLength = bagL
  const shipWidth = bagW
  const shipHeight = Math.max(2, Math.min(Math.ceil(itemH), maxThickness))
  const actualWeight = Math.ceil(totalItemsWeight + bagTareWeight)
  const volumetricWeight = Math.ceil((shipLength * shipWidth * shipHeight) / 5) // (L*W*H/5000)*1000 = /5
  const billableWeight = Math.max(actualWeight, volumetricWeight)

  return {
    package_type: "pe_bag",
    box_code: bag.code,
    box_name: bag.name || bag.code,
    length: shipLength,
    width: shipWidth,
    height: shipHeight,
    weight: actualWeight,
    item_count: itemCount,
    billable_weight: billableWeight,
    footprint: shipLength * shipWidth * shipHeight,
  }
}

function evaluateBoxCandidate(
  box: PackagingBox,
  arrangement: BoundingArrangement,
  itemCount: number,
  totalItemsWeight: number,
  boxTareWeight: number
): PackagingCandidate | null {
  if (box.max_items && itemCount > box.max_items) return null

  const boxDim = [box.length, box.width, box.height].sort((a, b) => b - a)
  const arrDim = [arrangement.length, arrangement.width, arrangement.height].sort((a, b) => b - a)

  const fits = arrDim[0] <= boxDim[0] && arrDim[1] <= boxDim[1] && arrDim[2] <= boxDim[2]
  if (!fits) return null

  const shipLength = box.length
  const shipWidth = box.width
  const shipHeight = box.height
  const actualWeight = Math.ceil(totalItemsWeight + boxTareWeight)
  const volumetricWeight = Math.ceil((shipLength * shipWidth * shipHeight) / 5)
  const billableWeight = Math.max(actualWeight, volumetricWeight)

  return {
    package_type: "carton_box",
    box_code: box.code,
    box_name: box.name || box.code,
    length: shipLength,
    width: shipWidth,
    height: shipHeight,
    weight: actualWeight,
    item_count: itemCount,
    billable_weight: billableWeight,
    footprint: shipLength * shipWidth * shipHeight,
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
      length: positiveNumber(item.length, 20),
      width: positiveNumber(item.width, 15),
      height: positiveNumber(item.height, 3),
      weight: positiveNumber(item.weight, fallbackWeight),
    }
    return Array.from({ length: quantity }, () => normalized)
  })

  if (!units.length) return []

  // Sắp xếp các sản phẩm theo thể tích giảm dần (First-Fit Decreasing)
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
    const totalItemsWeight = groupItems.reduce((sum, it) => sum + it.weight, 0)
    const itemCount = groupItems.length
    const arrangements = generate3DArrangements(groupItems)

    const candidates: PackagingCandidate[] = []

    // 1. Thử nghiệm tất cả các Túi niêm phong PE đã cấu hình
    if (profile.strategy !== "carton_only") {
      for (const bag of profile.bags) {
        for (const arrangement of arrangements) {
          const candidate = evaluateBagCandidate(
            bag,
            arrangement,
            itemCount,
            totalItemsWeight,
            profile.bag_packaging_weight
          )
          if (candidate) candidates.push(candidate)
        }
      }
    }

    // 2. Thử nghiệm tất cả các Hộp Carton đã cấu hình
    if (profile.strategy !== "pe_only") {
      for (const box of profile.boxes) {
        for (const arrangement of arrangements) {
          const candidate = evaluateBoxCandidate(
            box,
            arrangement,
            itemCount,
            totalItemsWeight,
            profile.packaging_weight
          )
          if (candidate) candidates.push(candidate)
        }
      }
    }

    // 3. Hàm mục tiêu: Tìm ứng viên có cước tính tối thiểu (Billable Weight tối thiểu)
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        // Tiêu chí 1: Trọng lượng tính cước nhỏ nhất
        if (a.billable_weight !== b.billable_weight) {
          return a.billable_weight - b.billable_weight
        }
        // Tiêu chí 2: Ưu tiên Túi PE khi cùng cước (tiết kiệm chi phí bao bì thực tế)
        if (a.package_type !== b.package_type) {
          return a.package_type === "pe_bag" ? -1 : 1
        }
        // Tiêu chí 3: Thể tích bao bì nhỏ nhất
        return a.footprint - b.footprint
      })

      const best = candidates[0]
      return {
        box_code: best.box_code,
        box_name: best.box_name,
        package_type: best.package_type,
        length: best.length,
        width: best.width,
        height: best.height,
        weight: best.weight,
        item_count: best.item_count,
      }
    }

    // 4. Fallback: Kiện tùy chỉnh (CUSTOM) theo kích thước bao nhỏ nhất
    const primaryArrangement = arrangements[0] || { length: 30, width: 20, height: 5 }
    const tare = profile.strategy === "pe_only" ? profile.bag_packaging_weight : profile.packaging_weight
    return {
      box_code: "CUSTOM",
      box_name: "Kiện tùy chỉnh",
      package_type: "custom",
      length: Math.ceil(primaryArrangement.length),
      width: Math.ceil(primaryArrangement.width),
      height: Math.ceil(primaryArrangement.height),
      item_count: itemCount,
      weight: Math.ceil(totalItemsWeight + tare),
    }
  })
}
