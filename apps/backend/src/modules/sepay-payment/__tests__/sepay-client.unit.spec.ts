import { SepayClient } from "../sepay-client"

describe("SepayClient", () => {
  it("correctly determines configuration status", () => {
    const unconfigured = new SepayClient({ apiKey: "" })
    expect(unconfigured.isConfigured()).toBe(false)

    const configured = new SepayClient({
      apiKey: "test_token_123",
      accountNumber: "0123456789",
      bankCode: "MB",
      accountHolderName: "NGUYEN VAN A",
    })
    expect(configured.isConfigured()).toBe(true)
  })

  it("generates correct VietQR image URL", () => {
    const client = new SepayClient({
      apiKey: "test_token_123",
      accountNumber: "0987654321",
      bankCode: "MB",
      accountHolderName: "NGUYEN VAN A",
    })

    const qrUrl = client.generateVietQrUrl({
      amount: 150000,
      description: "DH123456",
    })

    expect(qrUrl).toContain("https://img.vietqr.io/image/970422-0987654321-compact2.png")
    expect(qrUrl).toContain("amount=150000")
    expect(qrUrl).toContain("addInfo=DH123456")
    expect(qrUrl).toContain("accountName=NGUYEN%20VAN%20A")
  })

  it("extracts order code from various transfer content formats", () => {
    const client = new SepayClient({ apiKey: "test" })

    const test1 = client.extractOrderCodeFromContent("DH100234 thanh toan don hang", "DH")
    expect(test1.fullCode).toBe("DH100234")
    expect(test1.orderCode).toBe("100234")

    const test2 = client.extractOrderCodeFromContent("Chuyen tien DH999", "DH")
    expect(test2.fullCode).toBe("DH999")
    expect(test2.orderCode).toBe("999")

    const test3 = client.extractOrderCodeFromContent("12345678 chuyen khoan", "DH")
    expect(test3.orderCode).toBe("12345678")
  })

  it("verifies webhook authorization token", () => {
    const client = new SepayClient({ apiKey: "my_secret_token_xyz" })

    expect(client.verifyWebhookAuthorization("Bearer my_secret_token_xyz")).toBe(true)
    expect(client.verifyWebhookAuthorization("Apikey my_secret_token_xyz")).toBe(true)
    expect(client.verifyWebhookAuthorization("my_secret_token_xyz")).toBe(true)
    expect(client.verifyWebhookAuthorization("Bearer wrong_token")).toBe(false)
    expect(client.verifyWebhookAuthorization(null)).toBe(false)
  })
})
