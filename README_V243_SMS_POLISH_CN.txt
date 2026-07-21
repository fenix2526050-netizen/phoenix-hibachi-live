Phoenix Hibachi V243 - Customer SMS Polish

本补丁只修改 Supabase Edge Function：
supabase/functions/booking-lifecycle/index.ts

用途：
1. 把客户短信从一大段连续文字改为清晰分行。
2. 初次预约短信显示订单号、日期时间、人数、城市/州/邮编、Travel fee、Estimated total。
3. 初次预约不再显示容易误解的重复 Balance Due。
4. 明确写明 Pending review - not confirmed yet。
5. 电话统一显示为 516-518-3325，避免出现 .(516) 这种杂乱链接。
6. 金额增加千位逗号，例如 $1,224.84。
7. 所有短信仅使用 ASCII 安全文字，减少被转成 UCS-2 长短信的风险。
8. 普通美国订单数据下，短信目标控制在 280 字符以内。
9. 同时统一以下通知：
   - Request received
   - Booking confirmed
   - Deposit received
   - Paid in full
   - Schedule updated
   - Booking cancelled
   - Order updated
   - 72-hour reminder
10. 修复 booking_modified 邮件标题中的乱码字符。

重要：
- 这不是 GitHub Pages 前端补丁。
- 只上传到 GitHub 不会立即改变正式短信。
- 必须把 booking-lifecycle Edge Function 部署到正式 Supabase 项目。
- Make 的 Quo 模块应继续映射 webhook 的 sms_content 字段。

本地检查：
- TypeScript 完整语法/类型结构检查通过（仅使用 Deno/Supabase 环境声明）。
- 8 种短信模板全部通过。
- 每种模板均包含分行、品牌名、联系号码和 Reply STOP to opt out。
- 截图中的测试订单初次短信为 268 个 ASCII 字符。
