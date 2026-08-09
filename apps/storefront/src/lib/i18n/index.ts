import "server-only"
import { getRequestLocale } from "./request-locale"

const dictionaries = {
  en: () => import("./dictionaries/en.json").then((module) => module.default),
  vi: () => import("./dictionaries/vi.json").then((module) => module.default),
}

export const getDictionary = async () => {
  const locale = await getRequestLocale()
  
  // Return the selected locale dictionary, fallback to 'en'
  if (locale && dictionaries[locale as keyof typeof dictionaries]) {
    return dictionaries[locale as keyof typeof dictionaries]()
  }
  
  return dictionaries.en()
}
