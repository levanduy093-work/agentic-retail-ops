import { MedusaError } from "@medusajs/framework/utils"

/**
 * @deprecated The LangChain-based engine was removed. Customer support now
 * runs through the native provider function-call loop in native-tool-loop.ts.
 */
export class AgentEngine {
  constructor(..._args: unknown[]) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "AgentEngine is retired. Use the native customer-support tool loop."
    )
  }
}
