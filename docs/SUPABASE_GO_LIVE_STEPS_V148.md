# Phoenix Hibachi V148 — Supabase 上线步骤

## 你现在要做的顺序

### 1. 先跑数据库 SQL
Supabase Dashboard → SQL Editor → New query → 打开：

`supabase/migrations/001_phoenix_launch_schema_v148.sql`

复制全部内容，点击 Run。

这个 SQL 会创建/修复：

- `bookings`：客人 Booking 表单订单
- `profiles`：后台账号角色 Admin / Manager / Chef / Member
- `chef_applications`：师傅申请表
- `app_settings`：全站后台设置，菜单、价格、Recipes、Stories、Social Links、QR 都放这里
- `guest_reviews`：后面做网站内好评窗口用
- Storage buckets：`public-images`、`chef-application-files`、`order-pdfs`
- RLS 权限：客人只能提交，后台人员才能看和改

### 2. 创建 Admin 登录账号
Supabase Dashboard → Authentication → Users → Add user。

创建你自己的后台邮箱和密码。

然后回到 SQL Editor，运行：

```sql
update public.profiles
set role = 'admin', account_status = 'active'
where lower(email) = lower('你的后台邮箱');
```

### 3. 确认网站代码里的 Supabase URL / Publishable Key
打开 `script.js`，找到：

```js
const SUPABASE_URL = 'https://kyjiwwsqeyhlmzhncap.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_tZ6aXqUJXfFVavnAKshSOQ_HZLTfDTi';
```

必须填你 Supabase Project 的：

- Project URL
- Publishable key，或旧版 anon public key

不要把 `service_role` / `secret` key 放进网站前端。

### 4. 上传新版网站
用这一版 ZIP 上传到 Netlify / Vercel / Replit / 你的主机。

### 5. 上线前测试
必须测这 5 件事：

1. 客人提交 Booking 后，Supabase `bookings` 里出现订单。
2. Admin 登录后能看到订单。
3. 后台改 Add-ons / Social Links / QR 后，刷新无痕窗口也能看到变化。
4. 后台上传图片后，图片 URL 是 Supabase Storage 的 public URL。
5. 普通客人不能打开后台订单数据。

## 重要提醒

现在 V148 已经把后台内容从 localStorage 过渡到 Supabase `app_settings`。

也就是说：

- Add-ons 菜单可以全网同步
- Social Links / QR 可以全网同步
- Recipes / Stories / Shop / Hero Media 可以全网同步
- Pricing 可以全网同步
- Booking 订单会进入 Supabase

但短信、自动邮件、PDF 自动生成、付款链接，仍然建议下一步用 Supabase Edge Function / Stripe / Twilio / SendGrid 继续接。
