export type GooglePickerCredential = {
  access_token: string
  app_id: string
  picker_api_key: string
}

export type GooglePickerSelection = {
  name: string
  source_type: "GOOGLE_DOC" | "GOOGLE_DRIVE" | "GOOGLE_SHEET"
  source_url: string
}

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
  setSelectFolderEnabled(value: boolean): PickerView
}

type Picker = {
  setVisible(value: boolean): void
}

type PickerBuilder = {
  addView(view: PickerView): PickerBuilder
  build(): Picker
  setAppId(value: string): PickerBuilder
  setCallback(callback: (data: PickerResponse) => void): PickerBuilder
  setDeveloperKey(value: string): PickerBuilder
  setOAuthToken(value: string): PickerBuilder
  setOrigin(value: string): PickerBuilder
}

type GooglePickerApi = {
  DocsView: new () => PickerView
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

function sourceTypeFor(mimeType: string) {
  if (mimeType === "application/vnd.google-apps.document") {
    return "GOOGLE_DOC" as const
  }
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    return "GOOGLE_SHEET" as const
  }
  return "GOOGLE_DRIVE" as const
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

  return new Promise<GooglePickerSelection | null>((resolve) => {
    const view = new pickerApi.DocsView()
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setMimeTypes(
        [
          "application/vnd.google-apps.document",
          "application/vnd.google-apps.spreadsheet",
          "text/plain",
          "text/csv",
          "text/markdown",
        ].join(",")
      )
    new pickerApi.PickerBuilder()
      .setAppId(credential.app_id)
      .setDeveloperKey(credential.picker_api_key)
      .setOAuthToken(credential.access_token)
      .setOrigin(window.location.origin)
      .addView(view)
      .setCallback((data) => {
        if (data.action === "cancel") return resolve(null)
        if (data.action !== "picked") return
        const document = data.docs?.[0]
        if (!document?.id || !document.mimeType) return resolve(null)
        const sourceType = sourceTypeFor(document.mimeType)
        const sourceUrl =
          sourceType === "GOOGLE_DOC"
            ? `https://docs.google.com/document/d/${document.id}`
            : sourceType === "GOOGLE_SHEET"
              ? `https://docs.google.com/spreadsheets/d/${document.id}`
              : `https://drive.google.com/file/d/${document.id}`
        resolve({
          name: document.name ?? "Google Drive document",
          source_type: sourceType,
          source_url: sourceUrl,
        })
      })
      .build()
      .setVisible(true)
  })
}
