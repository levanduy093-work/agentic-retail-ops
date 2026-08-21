import { GhnClient, GhnDistrict, GhnProvince, GhnWard } from "../ghn-client"
import { GhnSettingsStore } from "./ghn-settings-store"

type CacheItem<T> = {
  data: T
  expiresAt: number
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

let provincesCache: CacheItem<GhnProvince[]> | null = null
const districtsCache = new Map<number, CacheItem<GhnDistrict[]>>()
const wardsCache = new Map<number, CacheItem<GhnWard[]>>()

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Official 63 Vietnam Provinces & Cities with GHN ProvinceIDs and codes
const FALLBACK_PROVINCES: GhnProvince[] = [
  { ProvinceID: 202, ProvinceName: "Hồ Chí Minh", Code: "HCM", NameExtension: ["TP Hồ Chí Minh", "TP.HCM", "Sài Gòn", "Ho Chi Minh"] },
  { ProvinceID: 201, ProvinceName: "Hà Nội", Code: "HN", NameExtension: ["Ha Noi", "HN", "Thủ Đô Hà Nội"] },
  { ProvinceID: 203, ProvinceName: "Đà Nẵng", Code: "DN", NameExtension: ["Da Nang", "ĐN"] },
  { ProvinceID: 204, ProvinceName: "Hải Phòng", Code: "HP", NameExtension: ["Hai Phong", "HP"] },
  { ProvinceID: 205, ProvinceName: "Cần Thơ", Code: "CT", NameExtension: ["Can Tho", "CT"] },
  { ProvinceID: 206, ProvinceName: "An Giang", Code: "AG", NameExtension: ["An Giang"] },
  { ProvinceID: 207, ProvinceName: "Bà Rịa - Vũng Tàu", Code: "BRVT", NameExtension: ["Vũng Tàu", "Ba Ria - Vung Tau"] },
  { ProvinceID: 208, ProvinceName: "Bắc Giang", Code: "BG", NameExtension: ["Bac Giang"] },
  { ProvinceID: 209, ProvinceName: "Bắc Kạn", Code: "BK", NameExtension: ["Bac Kan"] },
  { ProvinceID: 210, ProvinceName: "Bạc Liêu", Code: "BL", NameExtension: ["Bac Lieu"] },
  { ProvinceID: 211, ProvinceName: "Bắc Ninh", Code: "BN", NameExtension: ["Bac Ninh"] },
  { ProvinceID: 212, ProvinceName: "Bến Tre", Code: "BT", NameExtension: ["Ben Tre"] },
  { ProvinceID: 213, ProvinceName: "Bình Định", Code: "BDI", NameExtension: ["Binh Dinh", "Quy Nhơn"] },
  { ProvinceID: 214, ProvinceName: "Bình Dương", Code: "BD", NameExtension: ["Binh Duong", "Thủ Dầu Một"] },
  { ProvinceID: 215, ProvinceName: "Bình Phước", Code: "BP", NameExtension: ["Binh Phuoc"] },
  { ProvinceID: 216, ProvinceName: "Bình Thuận", Code: "BTH", NameExtension: ["Binh Thuan", "Phan Thiết"] },
  { ProvinceID: 217, ProvinceName: "Cà Mau", Code: "CM", NameExtension: ["Ca Mau"] },
  { ProvinceID: 218, ProvinceName: "Cao Bằng", Code: "CB", NameExtension: ["Cao Bang"] },
  { ProvinceID: 219, ProvinceName: "Đắk Lắk", Code: "DL", NameExtension: ["Dak Lak", "Buôn Ma Thuột"] },
  { ProvinceID: 220, ProvinceName: "Đắk Nông", Code: "DKN", NameExtension: ["Dak Nong"] },
  { ProvinceID: 221, ProvinceName: "Điện Biên", Code: "DB", NameExtension: ["Dien Bien"] },
  { ProvinceID: 222, ProvinceName: "Đồng Nai", Code: "DNA", NameExtension: ["Dong Nai", "Biên Hòa"] },
  { ProvinceID: 223, ProvinceName: "Đồng Tháp", Code: "DT", NameExtension: ["Dong Thap"] },
  { ProvinceID: 224, ProvinceName: "Gia Lai", Code: "GL", NameExtension: ["Gia Lai", "Pleiku"] },
  { ProvinceID: 225, ProvinceName: "Hà Giang", Code: "HG", NameExtension: ["Ha Giang"] },
  { ProvinceID: 226, ProvinceName: "Hà Nam", Code: "HNA", NameExtension: ["Ha Nam"] },
  { ProvinceID: 227, ProvinceName: "Hà Tĩnh", Code: "HT", NameExtension: ["Ha Tinh"] },
  { ProvinceID: 228, ProvinceName: "Hải Dương", Code: "HD", NameExtension: ["Hai Duong"] },
  { ProvinceID: 229, ProvinceName: "Hậu Giang", Code: "HGI", NameExtension: ["Hau Giang"] },
  { ProvinceID: 230, ProvinceName: "Hòa Bình", Code: "HB", NameExtension: ["Hoa Binh"] },
  { ProvinceID: 231, ProvinceName: "Hưng Yên", Code: "HY", NameExtension: ["Hung Yen"] },
  { ProvinceID: 232, ProvinceName: "Khánh Hòa", Code: "KH", NameExtension: ["Khanh Hoa", "Nha Trang"] },
  { ProvinceID: 233, ProvinceName: "Kiên Giang", Code: "KG", NameExtension: ["Kien Giang", "Rạch Giá", "Phú Quốc"] },
  { ProvinceID: 234, ProvinceName: "Kon Tum", Code: "KT", NameExtension: ["Kon Tum"] },
  { ProvinceID: 235, ProvinceName: "Lai Châu", Code: "LC", NameExtension: ["Lai Chau"] },
  { ProvinceID: 236, ProvinceName: "Lâm Đồng", Code: "LD", NameExtension: ["Lam Dong", "Đà Lạt"] },
  { ProvinceID: 237, ProvinceName: "Lạng Sơn", Code: "LS", NameExtension: ["Lang Son"] },
  { ProvinceID: 238, ProvinceName: "Lào Cai", Code: "LCA", NameExtension: ["Lao Cai", "Sa Pa"] },
  { ProvinceID: 239, ProvinceName: "Long An", Code: "LA", NameExtension: ["Long An", "Tân An"] },
  { ProvinceID: 240, ProvinceName: "Nam Định", Code: "ND", NameExtension: ["Nam Dinh"] },
  { ProvinceID: 241, ProvinceName: "Nghệ An", Code: "NA", NameExtension: ["Nghe An", "Vinh"] },
  { ProvinceID: 242, ProvinceName: "Ninh Bình", Code: "NB", NameExtension: ["Ninh Binh"] },
  { ProvinceID: 243, ProvinceName: "Ninh Thuận", Code: "NT", NameExtension: ["Ninh Thuan", "Phan Rang"] },
  { ProvinceID: 244, ProvinceName: "Phú Thọ", Code: "PT", NameExtension: ["Phu Tho", "Việt Trì"] },
  { ProvinceID: 245, ProvinceName: "Phú Yên", Code: "PY", NameExtension: ["Phu Yen", "Tuy Hòa"] },
  { ProvinceID: 246, ProvinceName: "Quảng Bình", Code: "QB", NameExtension: ["Quang Binh", "Đồng Hới"] },
  { ProvinceID: 247, ProvinceName: "Quảng Nam", Code: "QNA", NameExtension: ["Quang Nam", "Hội An", "Tam Kỳ"] },
  { ProvinceID: 248, ProvinceName: "Quảng Ngãi", Code: "QNG", NameExtension: ["Quang Ngai"] },
  { ProvinceID: 249, ProvinceName: "Quảng Ninh", Code: "QN", NameExtension: ["Quang Ninh", "Hạ Long"] },
  { ProvinceID: 250, ProvinceName: "Quảng Trị", Code: "QT", NameExtension: ["Quang Tri", "Đông Hà"] },
  { ProvinceID: 251, ProvinceName: "Sóc Trăng", Code: "ST", NameExtension: ["Soc Trang"] },
  { ProvinceID: 252, ProvinceName: "Sơn La", Code: "SL", NameExtension: ["Son La"] },
  { ProvinceID: 253, ProvinceName: "Tây Ninh", Code: "TN", NameExtension: ["Tay Ninh"] },
  { ProvinceID: 254, ProvinceName: "Thái Bình", Code: "TB", NameExtension: ["Thai Binh"] },
  { ProvinceID: 255, ProvinceName: "Thái Nguyên", Code: "TNG", NameExtension: ["Thai Nguyen"] },
  { ProvinceID: 256, ProvinceName: "Thanh Hóa", Code: "TH", NameExtension: ["Thanh Hoa"] },
  { ProvinceID: 257, ProvinceName: "Thừa Thiên Huế", Code: "TTH", NameExtension: ["Thua Thien Hue", "Huế"] },
  { ProvinceID: 258, ProvinceName: "Tiền Giang", Code: "TG", NameExtension: ["Tien Giang", "Mỹ Tho"] },
  { ProvinceID: 259, ProvinceName: "Trà Vinh", Code: "TV", NameExtension: ["Tra Vinh"] },
  { ProvinceID: 260, ProvinceName: "Tuyên Quang", Code: "TQ", NameExtension: ["Tuyen Quang"] },
  { ProvinceID: 261, ProvinceName: "Vĩnh Long", Code: "VL", NameExtension: ["Vinh Long"] },
  { ProvinceID: 262, ProvinceName: "Vĩnh Phúc", Code: "VP", NameExtension: ["Vinh Phuc"] },
  { ProvinceID: 263, ProvinceName: "Yên Bái", Code: "YB", NameExtension: ["Yen Bai"] },
]

const FALLBACK_DISTRICTS: Record<number, GhnDistrict[]> = {
  // TP. Hồ Chí Minh (ProvinceID: 202)
  202: [
    { DistrictID: 1442, ProvinceID: 202, DistrictName: "Quận 1", Code: "Q1", Type: 1, SupportType: 3, NameExtension: ["Quan 1", "District 1"] },
    { DistrictID: 1443, ProvinceID: 202, DistrictName: "Quận 3", Code: "Q3", Type: 1, SupportType: 3, NameExtension: ["Quan 3", "District 3"] },
    { DistrictID: 1444, ProvinceID: 202, DistrictName: "Quận 4", Code: "Q4", Type: 1, SupportType: 3, NameExtension: ["Quan 4", "District 4"] },
    { DistrictID: 1446, ProvinceID: 202, DistrictName: "Quận 5", Code: "Q5", Type: 1, SupportType: 3, NameExtension: ["Quan 5", "District 5"] },
    { DistrictID: 1447, ProvinceID: 202, DistrictName: "Quận 6", Code: "Q6", Type: 1, SupportType: 3, NameExtension: ["Quan 6", "District 6"] },
    { DistrictID: 1448, ProvinceID: 202, DistrictName: "Quận 7", Code: "Q7", Type: 1, SupportType: 3, NameExtension: ["Quan 7", "District 7", "Phú Mỹ Hưng"] },
    { DistrictID: 1449, ProvinceID: 202, DistrictName: "Quận 8", Code: "Q8", Type: 1, SupportType: 3, NameExtension: ["Quan 8", "District 8"] },
    { DistrictID: 1450, ProvinceID: 202, DistrictName: "Quận 10", Code: "Q10", Type: 1, SupportType: 3, NameExtension: ["Quan 10", "District 10"] },
    { DistrictID: 1451, ProvinceID: 202, DistrictName: "Quận 11", Code: "Q11", Type: 1, SupportType: 3, NameExtension: ["Quan 11", "District 11"] },
    { DistrictID: 1452, ProvinceID: 202, DistrictName: "Quận 12", Code: "Q12", Type: 1, SupportType: 3, NameExtension: ["Quan 12", "District 12"] },
    { DistrictID: 1454, ProvinceID: 202, DistrictName: "Thành phố Thủ Đức", Code: "TPTD", Type: 1, SupportType: 3, NameExtension: ["TP Thủ Đức", "Thủ Đức", "Quận 2", "Quận 9", "Quận Thủ Đức"] },
    { DistrictID: 1453, ProvinceID: 202, DistrictName: "Quận Bình Thạnh", Code: "QBT", Type: 1, SupportType: 3, NameExtension: ["Bình Thạnh"] },
    { DistrictID: 1455, ProvinceID: 202, DistrictName: "Quận Gò Vấp", Code: "QGV", Type: 1, SupportType: 3, NameExtension: ["Gò Vấp"] },
    { DistrictID: 1456, ProvinceID: 202, DistrictName: "Quận Phú Nhuận", Code: "QPN", Type: 1, SupportType: 3, NameExtension: ["Phú Nhuận"] },
    { DistrictID: 1457, ProvinceID: 202, DistrictName: "Quận Tân Bình", Code: "QTB", Type: 1, SupportType: 3, NameExtension: ["Tân Bình"] },
    { DistrictID: 1458, ProvinceID: 202, DistrictName: "Quận Tân Phú", Code: "QTP", Type: 1, SupportType: 3, NameExtension: ["Tân Phú"] },
    { DistrictID: 1459, ProvinceID: 202, DistrictName: "Quận Bình Tân", Code: "QBTN", Type: 1, SupportType: 3, NameExtension: ["Bình Tân"] },
    { DistrictID: 1460, ProvinceID: 202, DistrictName: "Huyện Bình Chánh", Code: "HBC", Type: 2, SupportType: 3, NameExtension: ["Bình Chánh"] },
    { DistrictID: 1461, ProvinceID: 202, DistrictName: "Huyện Hóc Môn", Code: "HHM", Type: 2, SupportType: 3, NameExtension: ["Hóc Môn"] },
    { DistrictID: 1462, ProvinceID: 202, DistrictName: "Huyện Củ Chi", Code: "HCC", Type: 2, SupportType: 3, NameExtension: ["Củ Chi"] },
    { DistrictID: 1463, ProvinceID: 202, DistrictName: "Huyện Nhà Bè", Code: "HNB", Type: 2, SupportType: 3, NameExtension: ["Nhà Bè"] },
    { DistrictID: 1464, ProvinceID: 202, DistrictName: "Huyện Cần Giờ", Code: "HCG", Type: 2, SupportType: 3, NameExtension: ["Cần Giờ"] },
  ],
  // Hà Nội (ProvinceID: 201)
  201: [
    { DistrictID: 1484, ProvinceID: 201, DistrictName: "Quận Ba Đình", Code: "QBD", Type: 1, SupportType: 3, NameExtension: ["Ba Đình"] },
    { DistrictID: 1485, ProvinceID: 201, DistrictName: "Quận Hoàn Kiếm", Code: "QHK", Type: 1, SupportType: 3, NameExtension: ["Hoàn Kiếm"] },
    { DistrictID: 1486, ProvinceID: 201, DistrictName: "Quận Tây Hồ", Code: "QTH", Type: 1, SupportType: 3, NameExtension: ["Tây Hồ"] },
    { DistrictID: 1487, ProvinceID: 201, DistrictName: "Quận Long Biên", Code: "QLB", Type: 1, SupportType: 3, NameExtension: ["Long Biên"] },
    { DistrictID: 1488, ProvinceID: 201, DistrictName: "Quận Cầu Giấy", Code: "QCG", Type: 1, SupportType: 3, NameExtension: ["Cầu Giấy"] },
    { DistrictID: 1489, ProvinceID: 201, DistrictName: "Quận Đống Đa", Code: "QDD", Type: 1, SupportType: 3, NameExtension: ["Đống Đa"] },
    { DistrictID: 1490, ProvinceID: 201, DistrictName: "Quận Hai Bà Trưng", Code: "QHBT", Type: 1, SupportType: 3, NameExtension: ["Hai Bà Trưng"] },
    { DistrictID: 1491, ProvinceID: 201, DistrictName: "Quận Hoàng Mai", Code: "QHM", Type: 1, SupportType: 3, NameExtension: ["Hoàng Mai"] },
    { DistrictID: 1492, ProvinceID: 201, DistrictName: "Quận Thanh Xuân", Code: "QTX", Type: 1, SupportType: 3, NameExtension: ["Thanh Xuân"] },
    { DistrictID: 1493, ProvinceID: 201, DistrictName: "Quận Nam Từ Liêm", Code: "QNTL", Type: 1, SupportType: 3, NameExtension: ["Nam Từ Liêm"] },
    { DistrictID: 1494, ProvinceID: 201, DistrictName: "Quận Bắc Từ Liêm", Code: "QBTL", Type: 1, SupportType: 3, NameExtension: ["Bắc Từ Liêm"] },
    { DistrictID: 1495, ProvinceID: 201, DistrictName: "Quận Hà Đông", Code: "QHD", Type: 1, SupportType: 3, NameExtension: ["Hà Đông"] },
    { DistrictID: 1496, ProvinceID: 201, DistrictName: "Thị xã Sơn Tây", Code: "TXST", Type: 1, SupportType: 3, NameExtension: ["Sơn Tây"] },
    { DistrictID: 1497, ProvinceID: 201, DistrictName: "Huyện Đông Anh", Code: "HDA", Type: 2, SupportType: 3, NameExtension: ["Đông Anh"] },
    { DistrictID: 1498, ProvinceID: 201, DistrictName: "Huyện Gia Lâm", Code: "HGL", Type: 2, SupportType: 3, NameExtension: ["Gia Lâm"] },
    { DistrictID: 1499, ProvinceID: 201, DistrictName: "Huyện Thanh Trì", Code: "HTT", Type: 2, SupportType: 3, NameExtension: ["Thanh Trì"] },
  ],
  // Đà Nẵng (ProvinceID: 203)
  203: [
    { DistrictID: 1530, ProvinceID: 203, DistrictName: "Quận Hải Châu", Code: "QHC", Type: 1, SupportType: 3, NameExtension: ["Hải Châu"] },
    { DistrictID: 1531, ProvinceID: 203, DistrictName: "Quận Thanh Khê", Code: "QTK", Type: 1, SupportType: 3, NameExtension: ["Thanh Khê"] },
    { DistrictID: 1532, ProvinceID: 203, DistrictName: "Quận Sơn Trà", Code: "QST", Type: 1, SupportType: 3, NameExtension: ["Sơn Trà"] },
    { DistrictID: 1533, ProvinceID: 203, DistrictName: "Quận Ngũ Hành Sơn", Code: "QNHS", Type: 1, SupportType: 3, NameExtension: ["Ngũ Hành Sơn"] },
    { DistrictID: 1534, ProvinceID: 203, DistrictName: "Quận Liên Chiểu", Code: "QLC", Type: 1, SupportType: 3, NameExtension: ["Liên Chiểu"] },
    { DistrictID: 1535, ProvinceID: 203, DistrictName: "Quận Cẩm Lệ", Code: "QCL", Type: 1, SupportType: 3, NameExtension: ["Cẩm Lệ"] },
    { DistrictID: 1536, ProvinceID: 203, DistrictName: "Huyện Hòa Vang", Code: "HHV", Type: 2, SupportType: 3, NameExtension: ["Hòa Vang"] },
  ],
  // Bình Dương (ProvinceID: 214)
  214: [
    { DistrictID: 1550, ProvinceID: 214, DistrictName: "Thành phố Thủ Dầu Một", Code: "TDM", Type: 1, SupportType: 3, NameExtension: ["Thủ Dầu Một"] },
    { DistrictID: 1551, ProvinceID: 214, DistrictName: "Thành phố Thuận An", Code: "TA", Type: 1, SupportType: 3, NameExtension: ["Thuận An"] },
    { DistrictID: 1552, ProvinceID: 214, DistrictName: "Thành phố Dĩ An", Code: "DA", Type: 1, SupportType: 3, NameExtension: ["Dĩ An"] },
    { DistrictID: 1553, ProvinceID: 214, DistrictName: "Thị xã Bến Cát", Code: "BC", Type: 1, SupportType: 3, NameExtension: ["Bến Cát"] },
    { DistrictID: 1554, ProvinceID: 214, DistrictName: "Thị xã Tân Uyên", Code: "TU", Type: 1, SupportType: 3, NameExtension: ["Tân Uyên"] },
  ],
  // Đồng Nai (ProvinceID: 222)
  222: [
    { DistrictID: 1560, ProvinceID: 222, DistrictName: "Thành phố Biên Hòa", Code: "BH", Type: 1, SupportType: 3, NameExtension: ["Biên Hòa"] },
    { DistrictID: 1561, ProvinceID: 222, DistrictName: "Thành phố Long Khánh", Code: "LK", Type: 1, SupportType: 3, NameExtension: ["Long Khánh"] },
    { DistrictID: 1562, ProvinceID: 222, DistrictName: "Huyện Long Thành", Code: "LT", Type: 2, SupportType: 3, NameExtension: ["Long Thành"] },
    { DistrictID: 1563, ProvinceID: 222, DistrictName: "Huyện Nhơn Trạch", Code: "NT", Type: 2, SupportType: 3, NameExtension: ["Nhơn Trạch"] },
  ],
}

const FALLBACK_WARDS: Record<number, GhnWard[]> = {
  // Quận 1 (DistrictID: 1442)
  1442: [
    { WardCode: "20101", DistrictID: 1442, WardName: "Phường Bến Nghé", NameExtension: ["Ben Nghe"], SupportType: 3 },
    { WardCode: "20102", DistrictID: 1442, WardName: "Phường Bến Thành", NameExtension: ["Ben Thanh"], SupportType: 3 },
    { WardCode: "20103", DistrictID: 1442, WardName: "Phường Cầu Kho", NameExtension: ["Cau Kho"], SupportType: 3 },
    { WardCode: "20104", DistrictID: 1442, WardName: "Phường Cầu Ông Lãnh", NameExtension: ["Cau Ong Lanh"], SupportType: 3 },
    { WardCode: "20105", DistrictID: 1442, WardName: "Phường Cô Giang", NameExtension: ["Co Giang"], SupportType: 3 },
    { WardCode: "20106", DistrictID: 1442, WardName: "Phường Đa Kao", NameExtension: ["Da Kao"], SupportType: 3 },
    { WardCode: "20107", DistrictID: 1442, WardName: "Phường Nguyễn Cư Trinh", NameExtension: ["Nguyen Cu Trinh"], SupportType: 3 },
    { WardCode: "20108", DistrictID: 1442, WardName: "Phường Nguyễn Thái Bình", NameExtension: ["Nguyen Thai Binh"], SupportType: 3 },
    { WardCode: "20109", DistrictID: 1442, WardName: "Phường Phạm Ngũ Lão", NameExtension: ["Pham Ngu Lao"], SupportType: 3 },
    { WardCode: "20110", DistrictID: 1442, WardName: "Phường Tân Định", NameExtension: ["Tan Dinh"], SupportType: 3 },
  ],
  // Quận 3 (DistrictID: 1443)
  1443: [
    { WardCode: "20201", DistrictID: 1443, WardName: "Phường 1", NameExtension: ["P1"], SupportType: 3 },
    { WardCode: "20202", DistrictID: 1443, WardName: "Phường 2", NameExtension: ["P2"], SupportType: 3 },
    { WardCode: "20203", DistrictID: 1443, WardName: "Phường 3", NameExtension: ["P3"], SupportType: 3 },
    { WardCode: "20204", DistrictID: 1443, WardName: "Phường 4", NameExtension: ["P4"], SupportType: 3 },
    { WardCode: "20209", DistrictID: 1443, WardName: "Phường Võ Thị Sáu", NameExtension: ["Vo Thi Sau"], SupportType: 3 },
  ],
  // TP Thủ Đức (DistrictID: 1454)
  1454: [
    { WardCode: "20301", DistrictID: 1454, WardName: "Phường Thảo Điền", NameExtension: ["Thao Dien"], SupportType: 3 },
    { WardCode: "20302", DistrictID: 1454, WardName: "Phường An Phú", NameExtension: ["An Phu"], SupportType: 3 },
    { WardCode: "20303", DistrictID: 1454, WardName: "Phường Thủ Thiêm", NameExtension: ["Thu Thiem"], SupportType: 3 },
    { WardCode: "20304", DistrictID: 1454, WardName: "Phường Hiệp Phú", NameExtension: ["Hiep Phu"], SupportType: 3 },
    { WardCode: "20305", DistrictID: 1454, WardName: "Phường Linh Trung", NameExtension: ["Linh Trung"], SupportType: 3 },
    { WardCode: "20306", DistrictID: 1454, WardName: "Phường Linh Chiểu", NameExtension: ["Linh Chieu"], SupportType: 3 },
  ],
  // Quận Hoàn Kiếm, Hà Nội (DistrictID: 1485)
  1485: [
    { WardCode: "10101", DistrictID: 1485, WardName: "Phường Hàng Bạc", NameExtension: ["Hang Bac"], SupportType: 3 },
    { WardCode: "10102", DistrictID: 1485, WardName: "Phường Hàng Đào", NameExtension: ["Hang Dao"], SupportType: 3 },
    { WardCode: "10103", DistrictID: 1485, WardName: "Phường Hàng Gai", NameExtension: ["Hang Gai"], SupportType: 3 },
    { WardCode: "10104", DistrictID: 1485, WardName: "Phường Tràng Tiền", NameExtension: ["Trang Tien"], SupportType: 3 },
    { WardCode: "10105", DistrictID: 1485, WardName: "Phường Lý Thái Tổ", NameExtension: ["Ly Thai To"], SupportType: 3 },
  ],
  // Quận Cầu Giấy, Hà Nội (DistrictID: 1488)
  1488: [
    { WardCode: "10201", DistrictID: 1488, WardName: "Phường Dịch Vọng", NameExtension: ["Dich Vong"], SupportType: 3 },
    { WardCode: "10202", DistrictID: 1488, WardName: "Phường Dịch Vọng Hậu", NameExtension: ["Dich Vong Hau"], SupportType: 3 },
    { WardCode: "10203", DistrictID: 1488, WardName: "Phường Nghĩa Đô", NameExtension: ["Nghia Do"], SupportType: 3 },
    { WardCode: "10204", DistrictID: 1488, WardName: "Phường Nghĩa Tân", NameExtension: ["Nghia Tan"], SupportType: 3 },
    { WardCode: "10205", DistrictID: 1488, WardName: "Phường Quan Hoa", NameExtension: ["Quan Hoa"], SupportType: 3 },
    { WardCode: "10206", DistrictID: 1488, WardName: "Phường Trung Hòa", NameExtension: ["Trung Hoa"], SupportType: 3 },
  ],
}

export class VietnamAddressService {
  private static getClient(): GhnClient {
    const config = GhnSettingsStore.getGhnConfig()
    return new GhnClient(config)
  }

  public static async getProvinces(client?: GhnClient): Promise<GhnProvince[]> {
    const now = Date.now()
    if (provincesCache && provincesCache.expiresAt > now) {
      return provincesCache.data
    }

    try {
      const ghnClient = client || this.getClient()
      const provinces = await ghnClient.getProvinces()
      if (Array.isArray(provinces) && provinces.length > 0) {
        provincesCache = {
          data: provinces,
          expiresAt: now + CACHE_TTL_MS,
        }
        return provinces
      }
    } catch {
      // Fallback
    }

    provincesCache = {
      data: FALLBACK_PROVINCES,
      expiresAt: now + CACHE_TTL_MS,
    }
    return FALLBACK_PROVINCES
  }

  public static async getDistricts(
    provinceId?: number,
    client?: GhnClient
  ): Promise<GhnDistrict[]> {
    const now = Date.now()
    const pId = provinceId || 0

    const cached = districtsCache.get(pId)
    if (cached && cached.expiresAt > now) {
      return cached.data
    }

    try {
      const ghnClient = client || this.getClient()
      const districts = await ghnClient.getDistricts(provinceId)
      if (Array.isArray(districts) && districts.length > 0) {
        districtsCache.set(pId, {
          data: districts,
          expiresAt: now + CACHE_TTL_MS,
        })
        return districts
      }
    } catch {
      // Fallback
    }

    const fallback = (provinceId && FALLBACK_DISTRICTS[provinceId]) || [
      {
        DistrictID: (provinceId || 100) * 10 + 1,
        ProvinceID: provinceId || 202,
        DistrictName: "Trung tâm / Thành phố trực thuộc",
        Code: "TT",
        Type: 1,
        SupportType: 3,
        NameExtension: [],
      },
    ]

    districtsCache.set(pId, {
      data: fallback,
      expiresAt: now + CACHE_TTL_MS,
    })
    return fallback
  }

  public static async getWards(
    districtId: number,
    client?: GhnClient
  ): Promise<GhnWard[]> {
    const now = Date.now()
    const cached = wardsCache.get(districtId)
    if (cached && cached.expiresAt > now) {
      return cached.data
    }

    try {
      const ghnClient = client || this.getClient()
      const wards = await ghnClient.getWards(districtId)
      if (Array.isArray(wards) && wards.length > 0) {
        wardsCache.set(districtId, {
          data: wards,
          expiresAt: now + CACHE_TTL_MS,
        })
        return wards
      }
    } catch {
      // Fallback
    }

    const fallback = (districtId && FALLBACK_WARDS[districtId]) || [
      {
        WardCode: `${districtId}01`,
        DistrictID: districtId,
        WardName: "Phường / Xã trung tâm",
        NameExtension: [],
        SupportType: 3,
      },
    ]

    wardsCache.set(districtId, {
      data: fallback,
      expiresAt: now + CACHE_TTL_MS,
    })
    return fallback
  }

  /**
   * Smart match district by text (searches both DistrictName and NameExtension)
   * Handles both old and merged names (e.g., 'Quận 2' -> TP. Thủ Đức, or vice versa)
   */
  public static async findDistrict(
    provinceId: number,
    query: string
  ): Promise<GhnDistrict | null> {
    const districts = await this.getDistricts(provinceId)
    const normQuery = normalizeText(query)

    for (const d of districts) {
      const normName = normalizeText(d.DistrictName)
      if (normName === normQuery || normName.includes(normQuery) || normQuery.includes(normName)) {
        return d
      }
      if (d.NameExtension && Array.isArray(d.NameExtension)) {
        for (const ext of d.NameExtension) {
          const normExt = normalizeText(ext)
          if (normExt === normQuery || normExt.includes(normQuery) || normQuery.includes(normExt)) {
            return d
          }
        }
      }
    }
    return null
  }

  /**
   * Smart match ward by text (searches both WardName and NameExtension)
   */
  public static async findWard(
    districtId: number,
    query: string
  ): Promise<GhnWard | null> {
    const wards = await this.getWards(districtId)
    const normQuery = normalizeText(query)

    for (const w of wards) {
      const normName = normalizeText(w.WardName)
      if (normName === normQuery || normName.includes(normQuery) || normQuery.includes(normName)) {
        return w
      }
      if (w.NameExtension && Array.isArray(w.NameExtension)) {
        for (const ext of w.NameExtension) {
          const normExt = normalizeText(ext)
          if (normExt === normQuery || normExt.includes(normQuery) || normQuery.includes(normExt)) {
            return w
          }
        }
      }
    }
    return null
  }

  /**
   * Smart match province by text (searches ProvinceName and NameExtension)
   * Handles queries like 'Sóc Trăng', 'soc trang', 'Đà Nẵng', 'Hà Nội', 'HCM', 'Sài Gòn', etc.
   */
  public static async findProvince(query: string): Promise<GhnProvince | null> {
    const provinces = await this.getProvinces()
    const normQuery = normalizeText(query)
    if (!normQuery) return null

    // 1. Exact match on ProvinceName or NameExtension
    for (const p of provinces) {
      const normName = normalizeText(p.ProvinceName)
      if (normName === normQuery) {
        return p
      }
      if (p.NameExtension && Array.isArray(p.NameExtension)) {
        for (const ext of p.NameExtension) {
          if (normalizeText(ext) === normQuery) {
            return p
          }
        }
      }
    }

    // 2. Query contains ProvinceName (e.g. query "TP Hồ Chí Minh quận 1" contains "hồ chí minh")
    for (const p of provinces) {
      const normName = normalizeText(p.ProvinceName)
      if (normQuery.includes(normName)) {
        return p
      }
      if (p.NameExtension && Array.isArray(p.NameExtension)) {
        for (const ext of p.NameExtension) {
          const normExt = normalizeText(ext)
          if (normExt.length >= 2 && normQuery.includes(normExt)) {
            return p
          }
        }
      }
    }

    // 3. ProvinceName starts with Query (avoid picking test provinces with trailing numbers like '02')
    for (const p of provinces) {
      const normName = normalizeText(p.ProvinceName)
      if (normName.startsWith(normQuery)) {
        return p
      }
    }

    return null
  }

  /**
   * Extract potential Vietnam province/city name from customer natural message
   */
  public static async extractDestinationLocation(
    message: string
  ): Promise<{ province: GhnProvince; district?: GhnDistrict } | null> {
    const normMessage = normalizeText(message)
    const provinces = await this.getProvinces()

    // Find the best matched province in message text (prioritize clean non-test province names)
    let matchedProvince: GhnProvince | null = null
    let longestMatchLen = 0

    for (const p of provinces) {
      // Skip sandbox mock provinces with trailing test digits like "Hà Nội 02"
      if (/\d+$/u.test(p.ProvinceName)) continue

      const normName = normalizeText(p.ProvinceName)
      if (normMessage.includes(normName) && normName.length > longestMatchLen) {
        matchedProvince = p
        longestMatchLen = normName.length
      }
      if (p.NameExtension && Array.isArray(p.NameExtension)) {
        for (const ext of p.NameExtension) {
          const normExt = normalizeText(ext)
          if (normExt.length >= 2 && normMessage.includes(normExt) && normExt.length > longestMatchLen) {
            matchedProvince = p
            longestMatchLen = normExt.length
          }
        }
      }
    }

    // If no standard province found, check all provinces
    if (!matchedProvince) {
      for (const p of provinces) {
        const normName = normalizeText(p.ProvinceName)
        if (normMessage.includes(normName) && normName.length > longestMatchLen) {
          matchedProvince = p
          longestMatchLen = normName.length
        }
      }
    }

    if (!matchedProvince) return null

    // Try finding district if province matched
    const district = await this.findDistrict(matchedProvince.ProvinceID, message)
    return {
      district: district || undefined,
      province: matchedProvince,
    }
  }

  /**
   * Clear cache for fresh reload
   */
  public static clearCache() {
    provincesCache = null
    districtsCache.clear()
    wardsCache.clear()
  }
}
