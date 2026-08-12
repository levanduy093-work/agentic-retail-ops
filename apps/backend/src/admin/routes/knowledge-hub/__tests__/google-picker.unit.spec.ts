import { classifyGooglePickerMimeType } from "../google-picker"

describe("Google knowledge Picker file classification", () => {
  test.each([
    ["application/vnd.google-apps.document", "GOOGLE_DOC"],
    ["application/vnd.google-apps.spreadsheet", "GOOGLE_SHEET"],
    ["text/plain", "GOOGLE_DRIVE"],
    ["text/markdown", "GOOGLE_DRIVE"],
    ["text/csv", "GOOGLE_DRIVE"],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "GOOGLE_DRIVE",
    ],
  ])("recognizes supported MIME type %s", (mimeType, expectedType) => {
    expect(classifyGooglePickerMimeType(mimeType)).toBe(expectedType)
  })

  test.each([
    "application/pdf",
    "image/png",
  ])("rejects unsupported MIME type %s", (mimeType) => {
    expect(classifyGooglePickerMimeType(mimeType)).toBeNull()
  })
})
