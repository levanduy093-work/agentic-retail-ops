export const decodeRouteSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment).normalize("NFC")
  } catch {
    return segment.normalize("NFC")
  }
}
