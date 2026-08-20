import { z } from "@medusajs/framework/zod"

export const CustomerSentimentState = z.enum([
  "SATISFIED",
  "NEUTRAL",
  "CONFUSED",
  "FRUSTRATED_ANGRY",
])

export const CustomerUrgencyLevel = z.enum(["NORMAL", "HIGH", "CRITICAL"])

export type CustomerSentimentState = z.infer<typeof CustomerSentimentState>
export type CustomerUrgencyLevel = z.infer<typeof CustomerUrgencyLevel>

export type SentimentAnalysisResult = {
  empathetic_response?: string
  needs_immediate_escalation: boolean
  reason: string
  sentiment: CustomerSentimentState
  urgency: CustomerUrgencyLevel
}

const angryPatterns = [
  /(?:làm ăn|phục vụ|chất lượng)\s+(?:tệ|chán|bực|kém|bát nháo|vớ vẩn)/iu,
  /(?:lừa đảo|gian dối|treo đầu dê|quá thất vọng|tẩy chay)/iu,
  /(?:sao chưa|mãi chưa|bao giờ mới|chờ cả tuần|4 ngày|5 ngày|chậm thế)/iu,
  /(?:bực mình|ức chế|tức|cáu|khó chịu|quá đáng)/iu,
  /(?:hủy đơn ngay|hoàn tiền ngay|trả lại tiền|bồi thường)/iu,
]

const confusedPatterns = [
  /(?:không hiểu|chưa hiểu|khó hiểu|sao lạ thế|nghĩa là sao|là như nào)/iu,
  /(?:bối rối|lúng túng|chưa rõ|mù mờ)/iu,
]

const satisfiedPatterns = [
  /(?:tuyệt vời|ưng ý|xinh quá|đẹp lắm|thích quá|cảm ơn shop|10 điểm|chất lượng)/iu,
  /(?:nhanh thế|vừa vặn|hài lòng|yêu shop|chốt luôn)/iu,
]

export function analyzeCustomerSentiment(
  message: string
): SentimentAnalysisResult {
  const normalized = message.normalize("NFKC").toLowerCase()

  for (const pattern of angryPatterns) {
    if (pattern.test(normalized)) {
      return {
        empathetic_response:
          "Dạ shop rất xin lỗi vì trải nghiệm chưa trọn vẹn này đã làm bạn phiền lòng ạ! Shop hoàn toàn thấu hiểu sự bất tiện này. Bạn cho mình xin mã đơn hàng hoặc số điện thoại để shop kiểm tra và xử lý ưu tiên ngay cho bạn nhé ạ.",
        needs_immediate_escalation: true,
        reason: "Customer expresses frustration, delay complaints or anger.",
        sentiment: "FRUSTRATED_ANGRY",
        urgency: "CRITICAL",
      }
    }
  }

  for (const pattern of confusedPatterns) {
    if (pattern.test(normalized)) {
      return {
        needs_immediate_escalation: false,
        reason: "Customer is asking for clarification or feels confused.",
        sentiment: "CONFUSED",
        urgency: "NORMAL",
      }
    }
  }

  for (const pattern of satisfiedPatterns) {
    if (pattern.test(normalized)) {
      return {
        needs_immediate_escalation: false,
        reason: "Customer expresses satisfaction and positive feedback.",
        sentiment: "SATISFIED",
        urgency: "NORMAL",
      }
    }
  }

  return {
    needs_immediate_escalation: false,
    reason: "Standard neutral inquiry.",
    sentiment: "NEUTRAL",
    urgency: "NORMAL",
  }
}
