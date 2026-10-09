# 简体中文 App Store listing

App Store Connect → App Information → language dropdown (top right) → **Add Chinese (Simplified)**. Then switch both App Information and the `1.0` page to it and paste the fields below.

No price wording in name, subtitle, or promotional text (Guideline 2.3.7). Name only China-licensed AI vendors (see [listing.md](listing.md)).

## App Information

| Field | Value |
|---|---|
| Name | `Budgets Bro` |
| Subtitle | `每季度审一遍你的每笔账单` |
| Privacy Policy URL | `https://github.com/solomonxie/budgets-bro/blob/master/docs/release/privacy-policy.md` |

## `1.0` page

| Field | Value |
|---|---|
| Screenshots (iPhone 6.9") | `screenshots/zh-Hans/*.jpg`, in filename order |
| Support URL | `https://github.com/solomonxie/budgets-bro/issues` |
| Marketing URL | leave blank |

Keywords:

```
预算,记账,订阅,自动续费,账单,物价,通胀,零基预算,支出,离线,隐私,房贷,净资产
```

Promotional Text:

```
每季度帮你把每笔固定扣费过一遍：留、换、还是退。看清买的东西是否在涨价，没有收入时现金还能撑几个月。离线可用，无需账号。
```

Description:

```
Budgets Bro 不只是记账预算。它每季度把你所有的固定扣费拿出来让你逐一决定，告诉你常买的东西是不是在涨价、没有收入时现金还能撑几个月、贷款和到手收入相比是否健康。所有数据只留在你的 iPhone 上：无需账号，没有服务器，不连银行。

只在 Budgets Bro
• 季度复盘——从你自己的支出里识别每笔固定扣费（同一收款方、同一金额），每季度逐一决定：保留、找替代、改月付/年付、取消并退款。决定会变成待办，不会自动改动任何数据。
• 物价追踪——记下这一单买了什么，就能看到每样东西的价格走势和购买频率。
• 现金续航——没有收入时，现金还能撑几个月，逐月可见。
• 贷款健康——每笔贷款对照到手收入，外加房贷利率压力测试。
• 收款方 / 收入走势——钱流向谁、谁在给你钱，按月排名。
• 看房清单——看房时现场填写，与本地房价并排比较。
• 生活成本——一个城市的生活成本，和你的实际支出放在一起看。
• 完整历史——每一行的每次改动都有记录，一次导入可以一键撤销。
• 刻意不连银行——每笔支出亲手记，才会真正留意到它。

预算
• 零基预算：月初给每一块钱安排好分类
• 账户、收款方、分类、实时余额、标记交易
• 多币种：用一种货币记账，用其他货币看合计
• Baby Steps，每一步都有 12 个月的进度

计算器
• 房贷、再融资、购房能力、租房还是买房、压力测试
• 摊销、车贷、提前还清、负债收入比、所需收入
• 复利、投资增长、节税
• 中国房贷提前还款；加拿大购房与房贷规则

你的数据
• 本机数据库，断网也能完整使用
• 可选备份到你自己的 iCloud 云盘或 S3 存储桶
• 以普通文件或 CSV 导出；可导入 Register CSV 导出文件
• 面容 ID、触控 ID 或密码锁定

可选 AI
使用你自己的 DeepSeek、通义千问、Kimi、智谱 GLM 或文心的 API 密钥，就自己的数据提问。默认关闭。

无广告，无统计分析，无内购推销。
```
