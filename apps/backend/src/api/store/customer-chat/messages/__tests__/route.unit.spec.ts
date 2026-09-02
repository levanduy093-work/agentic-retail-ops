import { Modules } from "@medusajs/framework/utils";
import { answerCustomerKnowledgeQuestionWorkflow } from "../../../../../workflows/agent-operations/answer-customer-knowledge-question";
import { postCustomerChatMessageWorkflow } from "../../../../../workflows/agent-operations/post-customer-chat-message";
import { refreshConversationMemoryWorkflow } from "../../../../../workflows/agent-operations/refresh-conversation-memory";
import { POST } from "../route";

jest.mock(
  "../../../../../workflows/agent-operations/answer-customer-knowledge-question",
  () => ({ answerCustomerKnowledgeQuestionWorkflow: jest.fn() }),
);
jest.mock(
  "../../../../../workflows/agent-operations/post-customer-chat-message",
  () => ({ postCustomerChatMessageWorkflow: jest.fn() }),
);
jest.mock(
  "../../../../../workflows/agent-operations/refresh-conversation-memory",
  () => ({ refreshConversationMemoryWorkflow: jest.fn() }),
);

describe("customer-chat message route latency path", () => {
  it("flushes the response before refreshing conversation memory", async () => {
    const callOrder: string[] = [];
    let finishMemoryRefresh: (() => void) | undefined;
    const memoryRefreshPending = new Promise<void>((resolve) => {
      finishMemoryRefresh = resolve;
    });

    const postRun = jest.fn().mockResolvedValue({
      result: {
        conversation: { id: "conversation_1" },
        duplicate: false,
        inbound_message: { id: "message_inbound_1" },
      },
    });
    const answerRun = jest.fn().mockResolvedValue({
      result: { response_message_id: "message_outbound_1" },
    });
    const refreshRun = jest.fn().mockImplementation(() => {
      callOrder.push("memory-refresh");
      return memoryRefreshPending;
    });

    jest
      .mocked(postCustomerChatMessageWorkflow)
      .mockReturnValue({ run: postRun } as never);
    jest
      .mocked(answerCustomerKnowledgeQuestionWorkflow)
      .mockReturnValue({ run: answerRun } as never);
    jest
      .mocked(refreshConversationMemoryWorkflow)
      .mockReturnValue({ run: refreshRun } as never);

    const customerService = {
      retrieveCustomer: jest.fn().mockResolvedValue({
        email: "customer@example.com",
        first_name: "Customer",
        last_name: "One",
        phone: null,
      }),
    };
    const agentService = {
      retrieveAgentMessage: jest.fn().mockResolvedValue({
        id: "message_outbound_1",
      }),
    };
    const request = {
      auth_context: { actor_id: "customer_1" },
      scope: {
        resolve: jest.fn((key: string) =>
          key === Modules.CUSTOMER ? customerService : agentService,
        ),
      },
      validatedBody: {
        locale: "vi",
        message: "Shop tư vấn giúp mình nhé",
      },
    };
    const response = {
      json: jest.fn(() => {
        callOrder.push("response");
      }),
      status: jest.fn().mockReturnThis(),
    };

    const requestPromise = POST(request as never, response as never);

    await new Promise((resolve) => setImmediate(resolve));

    expect(callOrder).toEqual(["response", "memory-refresh"]);
    expect(refreshRun).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(201);

    finishMemoryRefresh?.();
    await requestPromise;
  });
});
