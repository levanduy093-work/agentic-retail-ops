import { MedusaError } from "@medusajs/framework/utils"
import { assertCustomerChatImageFiles } from "../route"

describe("customer-chat uploads", () => {
  const image = {
    buffer: Buffer.from("image"),
    mimetype: "image/jpeg",
    size: 5,
  } as Express.Multer.File

  it("accepts a bounded JPEG, PNG, or WebP image list", () => {
    expect(() => assertCustomerChatImageFiles([image])).not.toThrow()
    expect(() =>
      assertCustomerChatImageFiles([
        image,
        { ...image, mimetype: "image/png" },
        { ...image, mimetype: "image/webp" },
      ])
    ).not.toThrow()
  })

  it("rejects empty, non-image, or oversized uploads", () => {
    expect(() => assertCustomerChatImageFiles([])).toThrow(MedusaError)
    expect(() =>
      assertCustomerChatImageFiles([{ ...image, mimetype: "image/gif" }])
    ).toThrow(MedusaError)
    expect(() =>
      assertCustomerChatImageFiles([
        { ...image, size: 5 * 1024 * 1024 + 1 },
      ])
    ).toThrow(MedusaError)
  })
})
