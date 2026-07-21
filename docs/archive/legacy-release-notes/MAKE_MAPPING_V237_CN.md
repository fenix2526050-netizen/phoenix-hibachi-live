# Phoenix Hibachi V2.3.7 — Make 映射说明

> Make 字段映射沿用 V2.3.5；V2.3.7 只升级正式品牌邮件与订单详情字段。

# Phoenix Hibachi V2.3.5 — Make 最终映射

现有场景保持：`Custom Webhook → Router → Quo / Gmail`。不需要重建场景。

## 1. 让 Webhook 重新识别新字段

1. 打开 Make 场景 `Phoenix Customer Notifications`。
2. 打开 Webhooks 模块，点击 **Redetermine data structure / Detect new values**。
3. 点击底部 **Run once**。
4. 运行随包提供的 `test-make-v235.ps1`，填入你自己的 Webhook URL 和 15 位 API Key。
5. Make 应识别以下核心字段：

- `event_type`
- `booking_number`
- `customer_name`
- `customer_phone`
- `customer_email`
- `event_date`
- `event_time`
- `payment_status`
- `deposit_status`
- `amount_paid`
- `balance_due`
- `currency`
- `sms_opt_in`
- `sms_content`
- `email_subject`
- `email_html`
- `email_text`

## 2. Quo 模块最终设置

- **SMS Content**：映射 `Webhooks → sms_content`
- **FROM**：`(516) 518-3325`
- **TO**：打开 Map，映射 `Webhooks → customer_phone`
- **Set Inbox Status**：留空

在 `Router → Quo` 线路的小扳手添加过滤器：

- 名称：`Transactional SMS consent required`
- 条件一：`sms_opt_in` **Equal to** `true`
- 条件二：`customer_phone` **Exists / Is not empty**

删除以前的测试固定号码、固定 PHX-TEST 内容、`Catch all → Skip`，以及任何 `__A2P_PENDING__` 临时过滤器。

## 3. Gmail 模块最终设置

- **To**：映射 `Webhooks → customer_email`
- **Subject**：映射 `Webhooks → email_subject`
- **Body type**：`Raw HTML`
- **Content**：映射 `Webhooks → email_html`
- **From**：`Team Phoenix <phoenixhibachi.team@gmail.com>`（当前已验证身份）
- **Reply-To**：`booking@phoenix-hibachi.com`（在 Additional email headers 中设置 Reply-To）

Gmail 路线无需 `sms_opt_in` 过滤器。只需要过滤 `customer_email` 不为空。

## 4. 事件类型

Supabase 自动生成不同内容，不需要在 Make 再建立七套文案：

- `booking_request_received`
- `booking_confirmed`
- `deposit_paid`
- `paid_in_full`
- `booking_rescheduled`
- `booking_cancelled`
- `event_reminder_72h`
- `event_reminder_42h`

## 5. 正式开启

完成网站、SQL、Edge Functions 和真实测试后，打开：

`Immediately as data arrives`

不要设置成每 15 分钟；预约通知应即时执行。
