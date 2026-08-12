import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  fetchGoogleDriveKnowledgeSource,
  parseGoogleDriveFileUrl,
  validateGoogleKnowledgeSourceUrl,
} from "../google-drive-knowledge-connector"

describe("Google Drive knowledge connector", () => {
  it("extracts file IDs from Docs, Sheets, and Drive links", () => {
    expect(
      parseGoogleDriveFileUrl(
        "https://docs.google.com/document/d/1234567890_doc-id/edit"
      )
    ).toMatchObject({ file_id: "1234567890_doc-id", link_type: "GOOGLE_DOC" })
    expect(
      parseGoogleDriveFileUrl(
        "https://docs.google.com/spreadsheets/d/1234567890_sheet-id/edit"
      )
    ).toMatchObject({
      file_id: "1234567890_sheet-id",
      link_type: "GOOGLE_SHEET",
    })
    expect(
      parseGoogleDriveFileUrl(
        "https://drive.google.com/file/d/1234567890_file-id/view"
      )
    ).toMatchObject({
      file_id: "1234567890_file-id",
      link_type: "GOOGLE_DRIVE",
    })
  })

  it("keeps a canonical Docs URL so later syncs retain their source type", () => {
    expect(
      validateGoogleKnowledgeSourceUrl(
        "https://docs.google.com/document/d/1234567890_doc-id/edit",
        "GOOGLE_DOC"
      ).canonical_url
    ).toBe("https://docs.google.com/document/d/1234567890_doc-id")
  })

  it("exports Google Docs as text", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            capabilities: { canDownload: true },
            id: "1234567890_doc-id",
            mimeType: "application/vnd.google-apps.document",
            modifiedTime: "2026-08-11T06:00:00.000Z",
            name: "Support policy",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          "Support employees must verify the live order before answering a customer.",
          { status: 200 }
        )
      )

    const result = await fetchGoogleDriveKnowledgeSource(
      "https://docs.google.com/document/d/1234567890_doc-id/edit",
      "GOOGLE_DOC",
      {
        authorizationHeader: "Bearer test-token",
        fetchImpl: fetchImpl as typeof fetch,
      }
    )

    expect(result).toMatchObject({
      content_type: "text/plain",
      etag: "2026-08-11T06:00:00.000Z",
    })
    expect(fetchImpl.mock.calls[1][0]).toContain("/export?mimeType=text%2Fplain")
  })

  it("exports Google Sheets as CSV", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            capabilities: { canDownload: true },
            id: "1234567890_sheet-id",
            mimeType: "application/vnd.google-apps.spreadsheet",
            name: "Delivery rules",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response("question,answer\nDelivery,Check the live fulfillment status", {
          status: 200,
        })
      )

    const result = await fetchGoogleDriveKnowledgeSource(
      "https://docs.google.com/spreadsheets/d/1234567890_sheet-id/edit",
      "GOOGLE_SHEET",
      {
        authorizationHeader: "Bearer test-token",
        fetchImpl: fetchImpl as typeof fetch,
      }
    )

    expect(result.content_type).toBe("text/csv")
    expect(fetchImpl.mock.calls[1][0]).toContain("/export?mimeType=text%2Fcsv")
  })

  it("downloads DOCX files and extracts their text", async () => {
    const docx = readFileSync(
      resolve(
        process.cwd(),
        "../../docs/test-fixtures/rag-knowledge-pack/multiformat/customer-support-escalation-playbook.docx"
      )
    )
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            capabilities: { canDownload: true },
            id: "1234567890_file-id",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            modifiedTime: "2026-08-11T06:00:00.000Z",
            name: "customer-support-escalation-playbook.docx",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(docx, { status: 200 }))

    const result = await fetchGoogleDriveKnowledgeSource(
      "https://drive.google.com/file/d/1234567890_file-id/view",
      "GOOGLE_DRIVE",
      {
        authorizationHeader: "Bearer test-token",
        fetchImpl: fetchImpl as typeof fetch,
      }
    )

    expect(result.content_type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    expect(result.content).toContain("SỔ TAY XỬ LÝ ESCALATION")
    expect(fetchImpl.mock.calls[1][0]).toContain("alt=media")
  })

  it("rejects unsupported Drive file types", async () => {
    await expect(
      fetchGoogleDriveKnowledgeSource(
        "https://drive.google.com/file/d/1234567890_file-id/view",
        "GOOGLE_DRIVE",
        {
          authorizationHeader: "Bearer test-token",
          fetchImpl: async () =>
            new Response(
              JSON.stringify({
                capabilities: { canDownload: true },
                id: "1234567890_file-id",
                mimeType: "application/zip",
                name: "archive.zip",
              }),
              { status: 200 }
            ),
        }
      )
    ).rejects.toThrow("not supported")
  })
})
