import { uploadFilesWorkflow } from "@medusajs/core-flows"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

const CUSTOMER_CHAT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

type CustomerChatUploadRequest = AuthenticatedMedusaRequest & {
  files?: Express.Multer.File[]
}

export function assertCustomerChatImageFiles(files: Express.Multer.File[]) {
  if (!files.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "At least one customer-support image is required."
    )
  }
  if (files.length > 3) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "A customer-support message can include at most three images."
    )
  }
  for (const file of files) {
    if (!CUSTOMER_CHAT_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Customer-support uploads must be JPEG, PNG, or WebP images."
      )
    }
    if (!file.buffer.length || file.size > 5 * 1024 * 1024) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Each customer-support image must be no larger than 5 MB."
      )
    }
  }
}

export async function POST(
  req: CustomerChatUploadRequest,
  res: MedusaResponse
) {
  const files = req.files ?? []
  assertCustomerChatImageFiles(files)

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: files.map((file) => ({
        access: "public" as const,
        content: file.buffer.toString("base64"),
        filename: file.originalname,
        mimeType: file.mimetype,
      })),
    },
  })

  res.status(201).json({
    files: result.map((file) => ({ id: file.id, url: file.url })),
  })
}
