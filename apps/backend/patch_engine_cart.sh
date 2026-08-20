#!/bin/bash
awk '
/return tools;/ {
    print "    tools.push(tool("
    print "      async (args: any) => {"
    print "        const cartUrl = \"https://store.example.com/checkout?cart_id=draft_\" + Date.now();"
    print "        return JSON.stringify({ status: \"SUCCESS\", checkout_url: cartUrl, message: \"Đã tạo giỏ hàng nháp thành công với các sản phẩm: \" + args.product_ids.join(\", \") });"
    print "      },"
    print "      {"
    print "        name: \"create_draft_cart\","
    print "        description: \"Tạo giỏ hàng nháp và trả về link thanh toán cho khách. Dùng khi khách chốt mua hàng.\","
    print "        schema: z.object({ product_ids: z.array(z.string()) })"
    print "      }"
    print "    ));"
    print "    "
    print "    return tools;"
    next
}
1
' src/modules/agent-operations/agent-engine.ts > tmp_engine_cart.ts && mv tmp_engine_cart.ts src/modules/agent-operations/agent-engine.ts
