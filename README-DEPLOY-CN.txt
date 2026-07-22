Phoenix Hibachi V250 最小安全更新包

包含 6 个实际修改文件，不包含图片、archive、docs 或历史版本。

部署顺序：
1. Supabase SQL Editor 执行：supabase/migrations/07_V250_SECURE_PRICING_COUPON_MANAGER_DISCOUNT.sql
2. Supabase Edge Functions > booking-lifecycle：用 supabase/functions/booking-lifecycle/index.ts 全量覆盖并 Deploy updates
3. GitHub：上传本 ZIP 内 src 文件，保持原文件夹结构并覆盖同名文件

本版重点：
- 浏览器提交的 final_total / balance_due / paid_amount / discount 不再被 Modify Order 后端信任
- 删除管理员修改失败时直接写 bookings 的危险回退
- Manager Discount 由后端计算，只减食物金额，税、车费、NJ toll、小费基数不降低
- Coupon 由 booking-lifecycle 验证、占用并统一写入订单金额
- Coupon 与 Manager Discount 不可同时使用
- Payment / Price 通过管理员认证后的 Edge Function 保存
- 管理员令牌兼容 Authorization 请求头和 accessToken 正文

测试注意：只使用测试订单，不要使用真实顾客订单。
