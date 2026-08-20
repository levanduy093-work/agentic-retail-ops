#!/bin/bash
awk '
/return tools;/ {
    print "    const orderToolDef = AGENT_TOOL_REGISTRY[\"order.read\"];"
    print "    if (orderToolDef) {"
    print "      tools.push(tool("
    print "        async (args: any) => {"
    print "          try {"
    print "            const query = this.service.__container__.resolve(\"query\");"
    print "            const { data: orders } = await query.graph({"
    print "              entity: \"order\","
    print "              fields: [\"id\"],"
    print "              filters: {"
    print "                customer_id: this.context.customer_id,"
    print "                display_id: String(args.display_id),"
    print "              },"
    print "            });"
    print "            if (!orders || orders.length === 0) return JSON.stringify({ error: \"Không tìm thấy đơn hàng nào khớp với mã này của bạn.\" });"
    print "            "
    print "            const { executeOrderRead } = await import(\"./order-read-runtime\");"
    print "            const result = await executeOrderRead(this.service.__container__, { order_id: orders[0].id }, \"customer-agent\");"
    print "            return JSON.stringify(result.output);"
    print "          } catch (e: any) {"
    print "            return JSON.stringify({ error: e.message });"
    print "          }"
    print "        },"
    print "        { "
    print "          name: \"check_order_status\", "
    print "          description: \"Kiểm tra tình trạng đơn hàng của khách. Yêu cầu truyền display_id (ví dụ 1024).\", "
    print "          schema: z.object({ display_id: z.string().or(z.number()) }) "
    print "        }"
    print "      ));"
    print "    }"
    print "    "
    print "    return tools;"
    next
}
1
' src/modules/agent-operations/agent-engine.ts > tmp_engine.ts && mv tmp_engine.ts src/modules/agent-operations/agent-engine.ts
