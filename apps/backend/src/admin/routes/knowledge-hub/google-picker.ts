export type GooglePickerCredential = {
  access_token: string
  app_id: string
  picker_api_key: string
}

type GoogleKnowledgeSourceType =
  | "GOOGLE_DOC"
  | "GOOGLE_DRIVE"
  | "GOOGLE_SHEET"

export type GooglePickerSelection =
  | {
      mime_type: string
      name: string
      source_type: GoogleKnowledgeSourceType
      source_url: string
      supported: true
    }
  | {
      mime_type: string
      name: string
      supported: false
    }

export const GOOGLE_KNOWLEDGE_PICKER_MIME_TYPES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/markdown",
  "text/plain",
].join(",")

type PickerDocument = {
  id?: string
  mimeType?: string
  name?: string
  url?: string
}

type PickerResponse = {
  action?: string
  docs?: PickerDocument[]
}

type PickerView = {
  setIncludeFolders(value: boolean): PickerView
  setMimeTypes(value: string): PickerView
  setMode(value: string): PickerView
  setSelectFolderEnabled(value: boolean): PickerView
}

type Picker = {
  setVisible(value: boolean): void
}

type PickerBuilder = {
  addView(view: PickerView): PickerBuilder
  build(): Picker
  enableFeature(value: string): PickerBuilder
  setAppId(value: string): PickerBuilder
  setCallback(callback: (data: PickerResponse) => void): PickerBuilder
  setDeveloperKey(value: string): PickerBuilder
  setOAuthToken(value: string): PickerBuilder
  setOrigin(value: string): PickerBuilder
}

type GooglePickerApi = {
  DocsView: new () => PickerView
  DocsViewMode: { LIST: string }
  Feature: { MULTISELECT_ENABLED: string }
  PickerBuilder: new () => PickerBuilder
}

declare global {
  interface Window {
    gapi?: {
      load(
        name: string,
        options: {
          callback: () => void
          onerror: () => void
          timeout: number
          ontimeout: () => void
        }
      ): void
    }
    google?: { picker?: GooglePickerApi }
  }
}

let pickerScriptPromise: Promise<void> | null = null

function loadPickerScript() {
  if (window.gapi) return Promise.resolve()
  if (pickerScriptPromise) return pickerScriptPromise

  pickerScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.async = true
    script.src = "https://apis.google.com/js/api.js"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Google Picker script failed to load."))
    document.head.appendChild(script)
  })
  return pickerScriptPromise
}

export function classifyGooglePickerMimeType(
  mimeType: string
): GoogleKnowledgeSourceType | null {
  if (mimeType === "application/vnd.google-apps.document") {
    return "GOOGLE_DOC"
  }
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    return "GOOGLE_SHEET"
  }
  if (
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/csv",
      "text/markdown",
      "text/plain",
    ].includes(mimeType)
  ) {
    return "GOOGLE_DRIVE"
  }
  return null
}

export async function openGoogleKnowledgePicker(
  credential: GooglePickerCredential
) {
  await loadPickerScript()
  await new Promise<void>((resolve, reject) => {
    window.gapi?.load("picker", {
      callback: resolve,
      onerror: () => reject(new Error("Google Picker could not be loaded.")),
      timeout: 10_000,
      ontimeout: () => reject(new Error("Google Picker timed out.")),
    })
  })
  const pickerApi = window.google?.picker
  if (!pickerApi) throw new Error("Google Picker is unavailable.")

  return new Promise<GooglePickerSelection[] | null>((resolve) => {
    const view = new pickerApi.DocsView()
      .setIncludeFolders(true)
      .setMimeTypes(GOOGLE_KNOWLEDGE_PICKER_MIME_TYPES)
      .setSelectFolderEnabled(false)
      // Google recommends LIST with drive.file because thumbnail access is not
      // guaranteed until the user explicitly selects a file.
      .setMode(pickerApi.DocsViewMode.LIST)
    new pickerApi.PickerBuilder()
      .setAppId(credential.app_id)
      .setDeveloperKey(credential.picker_api_key)
      .setOAuthToken(credential.access_token)
      .setOrigin(window.location.origin)
      .addView(view)
      .enableFeature(pickerApi.Feature.MULTISELECT_ENABLED)
      .setCallback((data) => {
        if (data.action === "cancel") return resolve(null)
        if (data.action !== "picked") return
        const documents = data.docs ?? []
        const selections: GooglePickerSelection[] = documents.flatMap<GooglePickerSelection>(
          (document) => {
            if (!document.id || !document.mimeType) return []
            const sourceType = classifyGooglePickerMimeType(document.mimeType)
            if (!sourceType) {
              return [
                {
                  mime_type: document.mimeType,
                  name: document.name ?? "Google Drive document",
                  supported: false as const,
                },
              ]
            }
            const sourceUrl =
              sourceType === "GOOGLE_DOC"
                ? `https://docs.google.com/document/d/${document.id}`
                : sourceType === "GOOGLE_SHEET"
                  ? `https://docs.google.com/spreadsheets/d/${document.id}`
                  : `https://drive.google.com/file/d/${document.id}`
            return [
              {
                mime_type: document.mimeType,
                name: document.name ?? "Google Drive document",
                source_type: sourceType,
                source_url: sourceUrl,
                supported: true as const,
              },
            ]
          }
        )
        resolve(selections.length ? selections : null)
      })
      .build()
      .setVisible(true)
  })
}
