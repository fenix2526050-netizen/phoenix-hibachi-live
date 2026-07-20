Phoenix Hibachi V240 发布包说明

目标仓库：
fenix2526050-netizen/phoenix-hibachi-live

重要状态：
本次 Codex 已尝试直接创建发布分支，但 GitHub 返回 403：
Resource not accessible by integration

所以目前没有自动发布成功，也没有修改正式 Supabase。

请把本文件夹内的文件按相同路径上传或覆盖到 GitHub 仓库根目录。

需要上传/覆盖的文件：

1. src/phoenix-v2382-admin-lifecycle-bridge.js
   作用：在现有正式网页加载链路中自动加载 V240 travel fee 修复层。

2. src/phoenix-v240-travel-fee-notifications.js
   作用：
   - Travel Fee 默认规则：base $50
   - Included miles：20 miles
   - Extra miles：$2/mile
   - NJ Toll Fee：$30，单独显示
   - 后台 Pricing/Menu Settings 动态加入 Travel fee rules
   - Admin 手动保存 Travel Fee 时同步更新订单总价、余额、Invoice/Portal显示
   - 客户/厨师 PDF 和页面中的地址使用可点击 Google Maps 链接

3. src/phoenix-v241-order-modification.js
   作用：
   - 客户订单卡片增加 Modify order
   - 客户只能在活动开始前 48 小时以上修改订单
   - 活动前 48 小时内订单锁定，提示打电话给 Phoenix Hibachi support
   - Admin / Manager / Customer Service 后台订单卡片增加 Modify order
   - 管理员不受 48 小时限制，可以随时修改
   - 修改后重新计算 final total 和 balance due
   - 不新增 Supabase 表或字段，兼容旧订单
   - 保存时触发 booking_modified 通知 payload

4. supabase/functions/booking-created/index.ts
   作用：客户确认邮件、公司通知、PDF invoice 增加可点击地址/电话/官网链接。

5. supabase/functions/booking-lifecycle/index.ts
   作用：
   - 订单生命周期通知邮件增加品牌化明细、地址链接、map_url字段
   - 增加 customer_modify_order
   - 增加 admin_modify_order
   - 客户修改订单时验证电话或邮箱，并执行 48 小时锁单规则
   - 管理员修改订单时要求 Admin / Manager / Customer Service 权限
   - 修改订单后发送 booking_modified 通知

6. supabase/functions/stripe-webhook/index.ts
   作用：Stripe付款通知邮件增加品牌化明细、地址链接、map_url字段。

7. package.json
   作用：增加 test:v240 和 test:v241 测试命令。

8. scripts/verify-phoenix-v240.js
   作用：本地检查 Travel Fee、NJ Toll、通知payload和PDF链接相关规则。

9. scripts/verify-phoenix-v241.js
   作用：本地检查客户48小时修改订单、Admin随时修改订单、booking_modified通知和旧字段兼容规则。

发布注意：

- 上传 src 文件后，GitHub Pages 正常部署完成，前台/Admin相关改动会生效。
- Supabase functions 目录里的文件上传到 GitHub 后，不一定会自动影响正式邮件和PDF。
  如果你的仓库没有配置 Supabase Edge Functions 自动部署，还需要在 Supabase 中单独部署：
  - booking-created
  - booking-lifecycle
  - stripe-webhook

Make 邮件模块建议：

- Body type 继续使用 Raw HTML
- Content 建议直接使用 webhook payload 里的 email_html
- 公司短信建议使用 internal_sms_content

已完成测试：

- V240 JavaScript语法检查通过
- V241 JavaScript语法检查通过
- V2382 loader语法检查通过
- npm run test:v240 通过 74/74
- npm run test:v241 通过 29/29

仍需人工确认：

- 目前 included miles 使用 20 miles。
  如果你的真实基础覆盖范围不是20 miles，请在后台 Pricing/Menu Settings 的 Travel fee rules 中修改。
- 客户修改订单的正式保存依赖 Supabase Edge Function booking-lifecycle 部署到正式环境。
  如果只上传 GitHub Pages 前台文件，而没有部署 booking-lifecycle，客户可能看到按钮但无法真正保存到正式数据库。

不要做的事：

- 不要直接改正式 Supabase schema。
- 不要把 NJ Toll Fee 混进 Travel Fee；它应单独显示。
- 不要只上传 supabase/functions 而不部署 Edge Functions，否则正式邮件/PDF可能不会变化。
