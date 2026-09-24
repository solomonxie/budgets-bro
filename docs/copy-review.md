# Copy review — UI strings

Proposals only; nothing applied. Source: `src/i18n/en.ts`, `src/i18n/zh.ts` (1,350 keys), hardcoded literals in `src/`.
Judged against: `AGENTS.md`, `DESIGN.md`, `UIUX-DESIGN.md` (Languages → Copy), `design/uiux/*.md`.

## Rules

- **Sentence case** for every button, title, heading, menu item, tab and label. Today the app is split roughly half Title Case, half sentence case (`+ Add Account` vs `+ Add item`, `Clear History` vs `Select all`), so neither is the house style yet. Sentence case wins because it reads calmer and matches most hints. Keep capitals for proper nouns and product names: YNAB, iCloud Drive, S3, Face ID, Budgets Bro, Baby Steps (Ramsey's term). Section headings are uppercased by style, so their source case doesn't matter there, but fix it anyway so zh/en source stays consistent.
- **Say what the user sees, not what the code does.** No "row", "leg", "table", "database", "SQLite", "cache", "sync", "prune", "rewind", "migration", "ledger", "on-budget", "envelope", "reading", "log" (as a verb).
- **One word per concept.** Use the glossary below.
- **Short.** Hints: 1–2 sentences. Guide bodies: 2–3 sentences. Put the reasoning in `DESIGN.md`, not on screen.
- **Contractions** (can't, isn't, couldn't) everywhere. Today "Could not…" and "Couldn't…" are mixed.
- **No bracket plurals.** `payment(s)` breaks the design rule. And `{count} accounts` shows "1 accounts" (drawn that way in `insights.md`). Use a label form instead ("Accounts: {count}"), or add plural keys.
- **Spelling: Canadian.** -our and -ize, "cheque", "tire", "furnace". Fix `recognised`, `categorised`, `tyre`, `boiler`.
- **Quotes:** en uses “ ”, zh uses 「 」. zh currently mixes `"…"`, `“…”` and 「」.
- **zh:** use 点按 (not 点击), ——  with no spaces (not ` —— `), 「设置」 for UI names, and 交易 for a transaction (not 流水/记录/条). Use ASCII `+` for add links (`＋` is used twice).

## 1. Glossary

| concept | en | zh | replaces |
|---|---|---|---|
| A self-contained dataset | budget | 账本 | board, Budget Board, 预算账本 |
| Money record | transaction | 交易 | row, entry, 流水, 记录, 条 |
| Who was paid / who paid you | payee | 收付方 | 收款方 (wrong for income) |
| Money out / in (toggle) | spending / income | 支出 / 收入 | outflow, spend (noun) |
| Category bucket | category | 分类 | envelope, 信封, 类别 |
| Category group | group | 分组 | — |
| Give money a job | assign | 分配 | fund, budgeted, 拨款 |
| Money with no job | Unassigned | 未分配 | Unassigned Cash, unassigned cash, 未分配现金, 可分配金额 |
| Leftover from last month | carried over | 上月结余 | rollover, 结转 |
| Investment account kind | Investment | 投资 | Tracking, tracking account, 追踪, 跟踪 |
| Credit card kind | Credit cards | 信用卡 | Credit, 信用 |
| Giving account kind | Giving | 捐赠 | 奉献 |
| Value entered for an asset/investment | value | 估值 | reading, logged value, 读数, 价值, 市值 |
| Statement figure for a loan | statement balance | 对账单余额 | reading, 读数 |
| House worth | home value | 房屋估值 | House Value, 房屋价值, 房产价值 |
| Owner's share | equity | 净值 | 净资产 (clashes with net worth) |
| Net worth | net worth | 净资产 | — |
| Future / repeating item | scheduled | 定期交易 | recurring, pending, 周期交易, 计划中 |
| Post a scheduled item | approve | 确认入账 | 批准 |
| Items needing a look | To review | 待检查 | Flagged, 已标记, 标记的交易 |
| Two sides of a transfer | other side | 另一边 | leg, half, pair, row, 配对, 对应记录 |
| Copy of a budget elsewhere | backup / back up | 备份 | sync, synced, 同步 |
| Put a backup back | restore | 恢复 | 还原 |
| Full local copy before risky change | snapshot | 快照 | database snapshot |
| Change log | History | 历史 | Change History & Snapshots, 历史记录, 变更历史 |
| User's AI credential | AI key | AI 密钥 | AI connection, access key, 连接 |
| AI feature | AI analysis | AI 分析 | AI Insights, AI 洞察 |
| On-device reports tab | Insights | 分析 | 洞察 |
| Tools list on Insights | Tools | 工具 | Utilities (clashes with the utilities bill), 实用工具 |
| Line items on a transaction | items | 物品 | purchase items, 购买物品 |
| Enter a value | add / enter / update | 记录 / 更新 | log, logged |
| Ramsey plan | Baby Steps | 理财七步 | 7 个理财步骤 |

## 2. Findings

`=` means keep the current text. `—` means zh is unchanged. Long current strings are shortened with `…`.

### common, payeePicker, modals

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| common.experimental | Experimental · still being built. Read what this page says as a first draft — more… | Early version — this page may change. | 实验功能 · 仍在开发中。这一页说的先当草稿看… | 早期版本，内容可能还会调整。 | wordy |
| common.payee | = | = | 收款方 | 收付方 | glossary |
| common.noPayee | (No payee) | No payee | （无收款方） | 无收付方 | glossary, match needsPayee |
| common.effectivePrefix | effective {date} | from {date} | 生效于 {date} | {date} 起 | plainer |
| common.effectiveDateLabel | Effective Date | Starts on | — | — | plainer, case |
| common.cannotBeUndone | This cannot be undone. | This can't be undone. | — | — | contraction |
| payeePicker.renameHint | Give it a name already in the list and the two become one payee, on every… | Use a name already in the list to merge the two payees. | 改成列表中已有的名字，两者会合并为同一个收款方… | 改成列表里已有的名字，两个收付方会合并。 | long |
| payeePicker.renameTitle | Rename payee | = | 重命名收款方 | 重命名收付方 | glossary |
| payeePicker.renamePlaceholder | = | = | 收款方名称 | 收付方名称 | glossary |
| payeePicker.renameBlockedTitle | That name belongs to an account | An account already uses that name | 该名称属于某个账户 | 已有账户使用这个名字 | plainer |
| payeePicker.renameBlockedMessage | Paying that payee posts a transfer to the account it is named after. Pick… | Payees named after an account are used for transfers. Choose another name. | 付给该收款方会向同名账户记一笔转账… | 与账户同名的收付方专用于转账，请换一个名字。 | "posts" jargon |
| houseValueModal.title | Home Value | Home value | 房屋价值 | 房屋估值 | case, glossary |
| principalModal.title | Remaining Principal | What you still owe | — | — | plainer |
| principalModal.valueLabel | Amount still owed | Balance on statement | 当前还欠多少 | 对账单余额 | matches what's asked |
| rateChangeModal.title | Rate Change | Interest rate change | — | — | case |
| stubScreen.comingSoon | Coming soon — this screen is still being designed. | Coming soon. | 即将上线——该页面仍在设计中。 | 即将推出。 | dev-speak |

### assignedAmountModal

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| assignedAmountModal.availableAfter | Available after: {amount} | Left in category: {amount} | 调整后可用：{amount} | 分类余额：{amount} | "after" what? |
| assignedAmountModal.unassignedHint | Unassigned: {unassigned}   ·   Last month: {lastMonth} | Unassigned: {unassigned} · Assigned last month: {lastMonth} | 未分配：{unassigned}   ·   上月：{lastMonth} | 未分配：{unassigned} · 上月分配：{lastMonth} | "Last month" of what |
| assignedAmountModal.rolloverHint | = | = | 结转：{amount} | 上月结余：{amount} | accounting jargon |
| assignedAmountModal.exceedsError | Exceeds unassigned cash by {amount} | {amount} more than you have unassigned | 超出可分配金额 {amount} | 比未分配的钱多 {amount} | glossary |

### settings (budgets, appearance, AI keys)

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| settings.boardsHeading | Budget Boards | Budgets | 预算账本 | 账本 | "board" jargon |
| settings.boardsHint | A board is a self-contained budget you can switch between. | Keep separate budgets, like household and side business, and switch between them. | 账本是一个可切换的独立预算。 | 把不同的钱分开记，比如家庭和副业，随时切换。 | defines jargon |
| settings.newBoardLink | + New Board | + New budget | — | — | glossary |
| settings.createDemoBoard | Create Demo Board | Create demo budget | — | — | glossary |
| settings.creatingDemoBoard | Creating demo board — this takes a few seconds… | Creating demo budget… | 正在创建演示账本——需要几秒钟…… | 正在创建演示账本… | wordy |
| settings.createDemoBoardFailed | Could not create the demo board. | Couldn't create the demo budget. | — | — | glossary |
| settings.themeLightHint | Light theme is coming soon — your preference is saved for when it ships. | Light mode is coming. We'll switch when it's ready. | 浅色主题即将推出——你的选择已保存，上线后自动生效。 | 浅色模式即将推出，届时会自动切换。 | "ships" |
| settings.aiKeysHeading | AI Connections | AI keys | AI 连接 | AI 密钥 | glossary |
| settings.aiKeysHint | Connect your own AI account and AI Analysis can use it. Add more than one… | Add a key to use AI analysis. With more than one, the next takes over when one runs out. Tap a key to see what it sent. | 连接你自己的 AI 账户后… | 添加密钥即可使用 AI 分析。有多个时，一个用完会自动换下一个。点按密钥可查看它发送过的内容。 | glossary, tighter |
| settings.aiKeyRequestCount | {count} questions sent | Questions sent: {count} | — | — | "1 questions" |
| settings.addAiKeyLink | + Connect an AI | + Add AI key | + 连接一个 AI | + 添加 AI 密钥 | glossary |
| settings.deleteAiKeyConfirmTitle | Disconnect this AI? | Remove this key? | 断开这个 AI？ | 移除这个密钥？ | glossary |
| settings.deleteAiKeyConfirmMessage | AI Analysis stops using it immediately. Your account with that provider is untouched. | AI analysis stops using it. Your account with the provider isn't affected. | — | — | case |
| settings.aiKeyStrategySequential | Sequential | In order | — | — | jargon |
| settings.aiKeyStrategyRoundRobin | Round robin | Take turns | 轮询使用 | 轮流使用 | jargon |
| settings.deleteS3ConfigConfirmTitle | Delete "{name}"? | Delete “{name}”? | 删除"{name}"？ | 删除「{name}」？ | quotes |
| settings.privacyHeading | Privacy by Design | Privacy | 隐私即设计 | 隐私 | slogan; zh translationese |
| settings.privacyBody | Everything lives in one file on this iPhone and is worked out here — the app runs fine with… | Everything stays on this iPhone and works offline. There's no Budgets Bro server and no account, so we never see your data. It goes only where you send it: your iCloud or S3 for backups, your AI key for analysis. Delete the app and the data goes with it. | 所有数据都在这台 iPhone 上的一个文件里… | 所有数据都在这台 iPhone 上，断网也能用。Budgets Bro 没有服务器、无需注册，我们看不到你的任何数据。数据只去你指定的地方：备份到你的 iCloud 或 S3，AI 分析用你自己的密钥。删除应用，数据也随之删除。 | long |
| settings.lockHeading | App Lock | App lock | — | — | case |
| settings.bankHeading | Bank Sync | Bank connection | 银行同步 | 银行连接 | it's not a feature; "sync" |
| settings.newBoardTitle | New Board | New budget | — | — | glossary |
| settings.renameBoardTitle | Rename Board | Rename budget | — | — | glossary |
| settings.cantDeleteOnlyBoardTitle | Can’t delete your only board | Can't delete your only budget | — | — | glossary |
| settings.cantDeleteOnlyBoardMessage | Create another board first. | Create another budget first. | — | — | glossary |
| settings.deleteBoardFailed | Could not delete the board. | Couldn't delete the budget. | — | — | glossary |
| settings.restoreFailed | = | = | 还原失败。 | 恢复失败。 | glossary |
| settings.removeAllDataConfirmMessage | This permanently removes every budget and setting stored on this device, along with… | Deletes every budget, setting, saved key and local backup on this iPhone. You'll first get a .zip of all budgets to save; cancel that and nothing is deleted. Backups in iCloud Drive or S3 stay. | 此操作会永久删除本机保存的所有账本和设置… | 将删除本机所有账本、设置、已保存的密钥和本地备份。删除前会先给你一个包含全部账本的 .zip 文件；取消保存则不会删除任何内容。iCloud 云盘和 S3 中的备份不受影响。 | legalistic |
| settings.removeAllDataCompleteMessage | The data on this device was removed. A fresh empty budget is ready. | Everything on this iPhone was removed. You're starting with an empty budget. | — | — | passive |
| settings.removeAllDataFailedTitle | Could not remove app data | Couldn't remove app data | — | — | contraction |

### aiInfo, aiKeyModal, aiHistory

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| aiInfo.title | Bringing your own AI | Use your own AI key | 用你自己的 AI | 使用你自己的 AI 密钥 | clearer |
| aiInfo.what | AI Analysis can read your budget and answer questions about it in plain language… on the page you ask it from. | AI analysis reads your budget and answers in plain words: where the money went, or whether a month looks unusual. It only runs when you tap Run. | AI 分析可以读取你的预算…且只在你发起的那一页上运行。 | AI 分析会读取你的预算，用大白话告诉你钱去了哪、这个月是否反常。只有你点按「开始分析」时才会运行。 | long; odd clause |
| aiInfo.ownAccount | There is no AI built into this app, and no subscription to it. You open an account… | No AI is built in and there's no subscription. Get a key from an AI provider, paste it here, and the app talks to that provider directly from this iPhone. | 本应用内不含任何 AI… | 应用不内置 AI，也没有订阅。去 AI 服务商那里获取密钥，粘贴到这里，应用会从这台 iPhone 直接与服务商通信。 | long |
| aiInfo.whereToRegister | Sign up free at any of them and create a key: OpenAI (platform.openai.com), … | Get a key from OpenAI, Anthropic, Google Gemini, Groq, Mistral, DeepSeek or xAI. Pick one below and the link opens the right page. | 在以下任意一家免费注册并创建密钥… | 可从 OpenAI、Anthropic、Google Gemini、Groq、Mistral、DeepSeek 或 xAI 获取密钥。在下方选择服务商，链接会打开对应页面。 | not all free; list misses DeepSeek, xAI (`src/ai/aiKeys.ts`) |
| aiInfo.cost | You pay that provider directly for what you use, usually a fraction of a cent per question… nothing here to bill through. | You pay the provider directly, usually less than a cent per question. Nothing is billed through this app. | 费用由你直接支付给该服务商…因为它根本没有可经手的地方。 | 费用直接付给服务商，通常每次不到一分钱。本应用不收任何费用。 | clever tail |
| aiInfo.privacy | …and Privacy Mode strips payee names and memos before it goes… | Your key stays in this iPhone's Keychain and is never backed up. Each question sends only the numbers it needs. Privacy mode also rounds amounts and hides category names. Nothing is sent until you tap Run. | …开启「隐私模式」后还会先抹去收款方名称与备注… | 密钥保存在本机钥匙串中，不会进入备份。每次只发送回答所需的数字；开启「隐私模式」还会取整金额、隐藏分类名称。你点按「开始分析」之前不会发送任何内容。 | **wrong**: code rounds amounts + hides categories (`domain/aiAnalysis.ts` redactForPrivacy) |
| aiKeyModal.title | Connect an AI | Add AI key | — | — | glossary; en/zh mismatch |
| aiKeyModal.keyLabel | Access key | API key | — | — | vendors say API key; en/zh mismatch |
| aiKeyModal.getKeyHint | Don't have a {vendor} account yet? | Need a {vendor} key? | — | — | matches zh |
| aiKeyModal.missingKey | Paste your access key. | Paste your API key. | 请输入密钥。 | 请粘贴 API 密钥。 | glossary |
| aiKeyModal.testing | Checking the connection… | Checking the key… | 正在测试密钥…… | 正在检查密钥… | glossary |
| aiKeyModal.testFailed | Could not connect: {error} | Couldn't connect: {error} | — | — | contraction |
| aiHistory.system | System | Instructions | 系统提示 | 指令 | jargon |
| aiHistory.prompt | Prompt | Sent | 提示词 | 发送内容 | jargon |
| aiHistory.response | Response | Reply | — | — | plainer |
| aiHistory.clear | Clear History | Clear history | — | — | case |
| aiHistory.hint | Every request this key has sent, exactly as it went out. Kept on this device only — the last 50 per key… | Everything this key sent, exactly as sent. The last 50 are kept on this iPhone only, never in backups. | 这个密钥发出的每一次请求，原样保存。只存在本机 —— … | 这个密钥发出的全部内容，原样保存。仅保留最近 50 条，只存在本机，不进入备份。 | tighter, dash |

### s3ConfigModal, s3Browser

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| settings.addS3BackupLink | + Add S3 Backup | + Add S3 backup | — | — | case |
| s3ConfigModal.title | Add S3 Backup | Add S3 backup | — | — | case |
| s3ConfigModal.pasteInfo | paste info to add | paste to fill in | 粘贴信息添加 | 粘贴填写 | plainer |
| s3ConfigModal.backToFields | back to fields | type instead | 返回逐项填写 | 逐项填写 | plainer |
| s3ConfigModal.pasteHint | Any spelling, split on `:` or `=`. One paste fills the fields and takes you back… | Paste lines like “bucket: my-bucket”. The fields fill in and this box closes. Text here isn't hidden. | 各种写法都认，按第一个 `:` 或 `=` 拆分… | 粘贴形如 “bucket: my-bucket” 的几行，字段会自动填好。此处内容不会被遮挡。 | backticks, dev-speak |
| s3ConfigModal.keyPrefixPlaceholder | e.g. backups — for a bucket shared with other stuff | e.g. backups | 例如：backups —— 用于与其他内容共用同一存储桶时 | 例如 backups | wordy |
| s3ConfigModal.testing | Detecting region & testing connection… | Checking your bucket… | 正在检测区域并测试连接… | 正在检查存储桶… | jargon |
| s3ConfigModal.testFailed | Could not connect: {error} | Couldn't connect: {error} | — | — | contraction |
| s3ConfigModal.draftsHint | From past attempts — tap to refill, ✕ to remove. | Earlier attempts. Tap one to fill the form. | 来自之前的尝试 —— 点击可填入，✕ 可删除。 | 之前的尝试。点按即可填入。 | 点击 |
| s3Browser.title | Browse Bucket | Browse bucket | — | — | case |
| s3Browser.up | .. | ‹ Up one folder | .. | ‹ 上一级 | dev-speak; UIUX says no ".." row |
| s3Browser.restoreConfirmMessage | It comes back as a new board and the app switches to it. The board you are on now… | It opens as a new budget. Your current budget stays as it is — switch back any time in Settings. | 它会作为一个新账本恢复… | 它会作为新账本打开，当前账本保持不变，可随时在设置中切回。 | glossary |

### backup

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| backup.hint | Each switch backs this board up automatically, every time it changes. iCloud also… | Turn a place on and this budget is backed up there whenever it changes. With iCloud, it comes back by itself if you reinstall. Keys are never included. | 每个开关都会在账本发生变化时自动备份一次… | 打开任意一个，账本每次变动都会自动备份到那里。使用 iCloud 时，重装应用后会自动恢复。密钥不会进入备份。 | "each switch" |
| backup.icloudNotEntitled | This build of the app isn’t signed for iCloud | iCloud isn't available in this version of the app | 此版本的应用没有 iCloud 签名权限 | 此版本应用暂不支持 iCloud | dev-speak |
| backup.icloudLocation | = | = | 在「文件」→ iCloud 云盘 → Budgets Bro | 「文件」→ iCloud 云盘 → Budgets Bro | "在" dangles |
| backup.deleteConnection | Delete Connection | Remove this backup | 删除该连接 | 移除此备份位置 | "connection" jargon |
| backup.saveCopyHere | + Back Up This Board Here | + Back up now | + 把当前账本备份到这里 | + 立即备份 | wordy |
| backup.saveCopyFailed | Could not write the backup. | Couldn't save the backup. | 备份写入失败。 | 备份失败。 | "write" |
| backup.never | never synced | Not backed up yet | 从未同步 | 尚未备份 | glossary |
| backup.infoTitle | How a backup keeps this yours | How backups work | 备份如何让数据始终属于你 | 备份是怎么工作的 | clever |
| backup.infoNoServer | Your board lives in one SQLite file on this iPhone… because we run none. | Your budget lives only on this iPhone. There's no Budgets Bro server, account or login, so nothing of yours sits on a machine we run. | …一个 SQLite 文件… | 你的账本只存在这台 iPhone 上。Budgets Bro 没有服务器、没有账号、无需登录，你的数据不会放在我们的任何机器上。 | "SQLite" |
| backup.infoDestination | A backup is a full copy of one board, zipped on this device and written straight to… | A backup is a full copy of one budget, sent straight from this iPhone to your own iCloud Drive or S3 bucket. Nothing passes through us. | …你的 iCloud Drive… | 备份是一个账本的完整副本，从本机直接存到你自己的 iCloud 云盘或 S3 存储桶，不经过我们。 | long; zh "iCloud Drive" vs 云盘 |
| backup.infoSecrets | Keys are never in a backup… marked this-device-only… only board tables — … | Keys are never backed up. Your AI and S3 keys stay in this iPhone's Keychain and never move to another phone. A backup holds only your budget: accounts, categories, payees and transactions. | …备份只读取账本表… | 密钥从不进入备份。AI 和 S3 密钥只存在本机钥匙串中，也不会转移到新手机。备份只包含账本内容：账户、分类、收付方和交易。 | "tables" |
| backup.infoFullCopy | Every sync writes the whole board, not a change since last time… | Each backup is complete on its own, so the newest file is all you need. | 每次同步写入的都是整个账本… | 每个备份都是完整的，只需最新的那一个就够了。 | sync; long |
| backup.infoRestore | Restoring never overwrites. A restored zip arrives as a new board… pruned as they age… | Restoring never overwrites. A backup opens as a new budget next to your others, so picking the wrong file costs nothing. Older automatic backups are cleared over time; ones you name are kept. | …恢复的 zip 会成为一个新账本… | 恢复不会覆盖现有数据。备份会作为新账本出现在其他账本旁边，选错文件也没关系。较旧的自动备份会逐步清理；你命名的备份会一直保留。 | "pruned" |

### settings (data, repair, results)

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| settings.restoreCategories | Restore Categories from YNAB | Restore categories from YNAB | — | — | case |
| settings.exportBoard | Export this board | Export this budget | — | — | glossary |
| settings.exportBoardHint | A zip of this board, through the share sheet. | Save this budget as a .zip file. | 通过分享导出该账本的压缩包。 | 把当前账本存为 .zip 文件。 | "share sheet" |
| settings.importAppBackupHint | Restores one of those zips as a new board. | Opens a backup .zip as a new budget. | 把压缩包恢复成一个新账本。 | 把备份 .zip 作为新账本打开。 | glossary |
| settings.importYnabHint | Your YNAB export, merged into this board. | Adds a YNAB export to this budget. | 把 YNAB 导出合并进当前账本。 | 把 YNAB 导出文件并入当前账本。 | glossary |
| settings.fixTransfers | Fix Transfers | Check transfers | — | 检查转账 | it checks first; case |
| settings.fixTransfersHint | Names both halves of every transfer and links them back together. | Makes sure every transfer has both sides, named and linked. | 为转账两边补全名称并重新配对。 | 确保每笔转账两边齐全、名称正确并相互关联。 | "halves" |
| settings.fixTransfersHeading | Transfers Checked | Transfers checked | — | — | case |
| settings.fixTransfersFailed | Could not check transfers. | Couldn't check transfers. | — | — | contraction |
| settings.transferNamed | Legs named | Sides named | 已补全收付方 | = | "legs" |
| settings.transferRenamed | Renamed off themselves | Payee fixed | — | — | doesn't parse |
| settings.transferMissingLeg | No matching row | Other side missing | 没有对应记录 | 缺少另一边 | "row" |
| settings.purgeBackupsHint | Every copy, everywhere. Your data itself is untouched. | Deletes every backup. Your budget stays. | — | — | fragment |
| settings.purgeBackups | Delete All Backups | Delete all backups | — | — | case |
| settings.purgeBackupsMessage | Removes the backup zips on this phone, the database snapshots, the files in iCloud Drive, and the objects in every bucket… | Deletes backups on this iPhone, in iCloud Drive and in every S3 bucket, plus snapshots. Your budget and its history stay as they are. | 将删除本机的备份压缩包、数据库快照、iCloud Drive 中的文件，以及所有存储桶中的对象… | 将删除本机、iCloud 云盘和所有 S3 存储桶中的备份，以及快照。账本和历史不受影响。 | jargon |
| settings.purgeBackupsConfirm | Delete Backups | Delete backups | — | — | case |
| settings.purgeResultSnapshots | Database snapshots | Snapshots | 数据库快照 | 快照 | jargon |
| settings.purgeResultICloud | = | = | iCloud Drive | iCloud 云盘 | zh consistency |
| settings.purgeResultRefused | Bucket refused | Blocked by bucket | 存储桶拒绝删除 | = | reads like an error code |
| settings.restoreResultAlreadySet | Already had one | Already had a category | 原本就有 | 已有分类 | vague |
| settings.restoreResultNotFound | Not in this board | Not in this budget | — | — | glossary |
| settings.restoreResultCategoryMissing | Category since deleted | Category was deleted | — | — | awkward |
| settings.importResultBudgetWritten | Budgeted amounts written | Assigned amounts imported | 已写入预算金额 | 已导入分配金额 | glossary; "written" |
| settings.restoreResultBoard | Restored into board | Restored as | 已还原至账本 | 已恢复为 | glossary |
| history.openHint | Undo a single change, or roll the whole file back. | Undo a change, or go back to an earlier copy. | 撤销单次修改，或整体回滚数据库文件。 | 撤销某次修改，或恢复到之前的副本。 | "file", 数据库文件 |

### lock, bank

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| lock.modeBiometricUnavailable | = | = | Face ID | 面容 ID | Apple's zh name |
| lock.biometricFailed | Not recognised. Try again. | Not recognized. Try again. | — | — | spelling |
| lock.noBiometryTitle | Nothing enrolled on this iPhone | Face ID isn't set up | 本机尚未录入生物识别 | 本机尚未设置面容 ID 或触控 ID | "enrolled" |
| lock.noBiometryMessage | = | = | 请先在 iOS 设置中启用 Face ID 或 Touch ID… | 请先在 iOS 设置中启用面容 ID 或触控 ID，或在这里改用数字密码。 | Apple zh names |
| settings.bankAwareness | = | = | …这份"意识到"才是重点… | …这份「意识到」才是重点… | quotes |

### accounts, netWorth

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| accounts.netWorth | Net Worth | Net worth | — | — | case |
| accounts.includeInNetWorth | Include in Net Worth | Include in net worth | — | — | case |
| accounts.addAccount | + Add Account | + Add account | — | — | case |
| accounts.closedAccounts | Closed Accounts | Closed accounts | — | — | case |
| accounts.kindCredit | Credit | Credit cards | 信用 | 信用卡 | 信用 alone is meaningless |
| accounts.kindTracking | Tracking | Investments | 追踪 | 投资 | YNAB jargon; design says "investment" |
| accounts.kindLoan | Loan | Loans | — | — | group heading |
| accounts.kindAsset | Asset | Assets | — | — | group heading |
| accounts.kindGiving | = | = | 奉献 | 捐赠 | 奉献 is church-only; Baby Steps says 捐赠 |
| accounts.notInNetWorth | never counted in net worth | Not in net worth | — | — | wordy |
| netWorthBreakdown.heading | Where {month} came from | {month} breakdown | — | — | clever |
| netWorthBreakdown.noAccounts | No account had started by then. | No accounts yet this month. | — | — | awkward |
| netWorthBreakdown.sourceReading | logged value | your value | 已记录的价值 | 你记录的估值 | "logged" |
| netWorthBreakdown.sourceOldestReading | oldest value, carried back | earliest value used | 最早的价值，向前沿用 | 沿用最早估值 | jargon |
| netWorthBreakdown.sourceDerived | derived | estimated | 推算 | 估算 | jargon |
| netWorthBreakdown.explain | Touch the line, or hold and slide along it, to read a month. | Tap or drag along the line to see a month. | 点按折线，或按住并滑动，查看某个月的构成。 | 点按或沿折线拖动，查看某个月。 | wordy |
| netWorthInfo.title | How net worth is worked out | How net worth is calculated | — | — | plainer |
| netWorthInfo.recomputed | Assets minus debts, worked out from scratch every time you look — no total is stored anywhere… | Assets minus debts, recalculated each time you look. Fix a March transaction and March's point moves too. | …任何汇总数字都不会被存起来… | 资产减负债，每次查看时重新计算。改了三月的交易，三月那个点也会跟着变。 | dev-speak |
| netWorthInfo.assets | Assets: cash, savings and chequing accounts count as their opening balance plus every transaction… | Assets: cash and savings accounts count their transactions. Investments, assets and homes count the latest value you entered. | …投资类与资产类账户按你最近一次记录的价值计算… | 资产：现金和储蓄账户按交易累计；投资、资产和房屋按你最近记录的估值计算。 | long |
| netWorthInfo.debts | Debts: what each credit card owes, and for a loan or mortgage the remaining principal — your last logged reading… | Debts: what you owe on credit cards, plus each loan's estimated balance from your last statement and payments since. | …以你最近一次记录的读数为基准… | 负债：信用卡欠款，加上各贷款按最近一次对账单和之后还款估算出的余额。 | "reading" |
| netWorthInfo.history | Each month on the line uses what was true at that month’s end… honest estimate, not a fabrication… | Each point uses what was true at that month's end. Before your first value, the earliest one is used. Tap a point to see which accounts make it up. | …而不是凭空编造——所以早期历史是诚实的估算，而非虚构… | 每个点取当月月底的情况；在你第一次记录估值之前，沿用最早的那次。点按某个点可查看构成它的账户。 | defensive, long |
| netWorthInfo.excluded | Accounts you switched off under Customize are left out of all of it, the line included. | Accounts turned off in Customize are left out, including from the chart. | — | — | awkward |

### accountDetail, accountModal

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| accountDetail.remainingPrincipal | Remaining Principal | Remaining principal | — | — | case |
| accountDetail.scheduledHeading | = | = | 计划中（{count}） | 定期交易（{count}） | glossary |
| accountDetail.scheduledHint | Dated in the future — doesn't affect balance or budget until its date arrives. | Future-dated. Won't affect your balance or budget until that day. | — | — | tighter |
| accountDetail.cancelSchedule | Cancel Schedule | Cancel | 取消定期交易 | 取消 | case; context is the row |
| accountModal.editTitle | Edit Account | Edit account | — | — | case |
| accountModal.newTitle | New Account | New account | — | — | case |
| accountModal.typeCreditCard | Credit Card | Credit card | — | — | case |
| accountModal.typeSavings | = | = | 储蓄账户 | 储蓄 | match 现金 |
| accountModal.typeTracking | Tracking | Investment | 追踪账户 | 投资 | glossary |
| accountModal.typeGiving | = | = | 奉献 | 捐赠 | glossary |
| accountModal.trackingKindLabel | Plan type | = | 账户计划类型 | 计划类型 | clunky |
| accountModal.trackingKindHint | Only plans the app can describe are listed. Anything else stays General. | Not listed? Choose General. | 此处只列出应用能够准确描述的计划类型，其余一律归为「一般跟踪」。 | 没有你的类型？选「一般」。 | dev-voice |
| trackingKind.general | General tracking | General | 一般跟踪 | 一般 | glossary |
| accountModal.openingBalanceLabel | Starting Balance | Starting balance | — | — | case |
| accountModal.currentHouseValueLabel | Current House Value | Current home value | — | — | case; House vs Home |
| accountModal.currentReadingHint | Add an update below to change this — every reading keeps its own date, so the history stays true. | To change this, add an update below. Each one keeps its date. | 要修改请在下方添加一次更新——每条记录都有自己的日期，历史才如实保留。 | 如需修改，请在下方添加一次更新，每次更新都会保留日期。 | "reading" |
| accountModal.currentHouseValueHint | What the home is worth now, your own estimate. Recorded as a dated entry… | Your own estimate of what it's worth today. Add updates later from the account page. | — | — | tighter |
| accountModal.currentPrincipalLabel | Current Remaining Principal | What you owe now | 当前剩余本金 | 当前欠款 | plainer |
| accountModal.currentPrincipalHint | What you still owe today, straight off a statement. Between figures like this one, each payment you log covers… | From your latest statement. Payments you add keep it close until the next one. This doesn't add a transaction. | …记录它不会产生任何流水。 | 按最近一次对账单填写。之后记的还款会让它保持接近实际。填写不会产生交易。 | long; 流水 |
| accountModal.purchaseDateLabel | Purchase Date | Purchase date | — | — | case |
| accountModal.houseValueHistoryLabel | House Value History | Home value history | — | — | case; glossary |
| accountModal.principalHistoryLabel | Remaining Principal History | Statement balances | 剩余本金记录 | 对账单余额记录 | plainer |
| accountModal.currentValueLabel | Current Value | Current value | — | — | case |
| accountModal.currentValueHint | What it is worth now. This account’s balance is whatever was logged last, not a sum of its transactions. | What it's worth today. The balance is always the latest value you enter. | …不是流水的累加。 | 现在值多少。余额始终是你最近记录的估值。 | "logged"; 流水 |
| accountModal.valueHistoryLabel | Value History | Value history | — | — | case |
| accountModal.addValue | + Update Account Value | + Update value | + 更新账户估值 | + 更新估值 | wordy; case |
| accountModal.addHouseValue | + Update Home Value | + Update home value | — | — | case |
| accountModal.addPrincipal | + Update Remaining Principal | + Add statement balance | + 更新剩余本金 | + 记录对账单余额 | plainer |
| accountModal.latestBalanceLabel | Current Balance | Current balance | — | — | case |
| accountModal.latestBalanceHint | What the account really says today. Saving a different number logs one adjustment transaction to close the gap. | What your bank shows today. If it's different, one adjustment transaction makes up the gap. | …会自动记一笔调整流水来对平差额。 | 银行今天显示的余额。如果不同，会自动加一笔调整交易补齐差额。 | "logs"; 流水 |
| accountModal.interestRateHeading | Interest Rate | Interest rate | — | — | case |
| accountModal.interestRateHistoryLabel | Interest Rate History | Rate history | 利率变更历史 | 利率历史 | case; match accountInfo |
| accountModal.addRateChange | + Add Rate Change | + Add rate change | — | — | case |
| accountModal.interestRateAnnualLabel | Interest Rate (annual %) | Interest rate (% per year) | — | — | case; matches financeTools |
| accountModal.loanTermsHeading | Loan Terms (for the payoff projection on the account page) | Loan terms | 贷款条款（用于账户页面的还清预测） | 贷款条款 | heading as sentence |
| accountModal.loanPaymentCategoryPlaceholder | = | = | 选择还款类别 | 选择还款分类 | glossary |
| accountModal.originalPrincipalLabel | Amount Borrowed | Amount borrowed | — | — | case |
| accountModal.mortgageAmountLabel | Mortgage Amount | Mortgage amount | — | — | case |
| accountModal.originalHousePriceLabel | Purchase Price | Purchase price | — | — | case |
| accountModal.downPaymentLabel | Down Payment | Down payment | — | — | case |
| accountModal.principalExceedsHint | Mortgage amount exceeds the purchase price | Mortgage is more than the purchase price | — | — | plainer |
| accountModal.originationDateLabel | Origination Date | Loan start date | 起始日期 | 放款日期 | lender jargon (design rule) |
| accountModal.notePlaceholder | Anything the name does not say (optional) | Note (optional) | 名称说不清的信息（可选） | 备注（可选） | clever |
| accountModal.reopenAccount | Reopen Account | Reopen account | 重新开启账户 | 重新打开账户 | case |
| accountModal.closeAccount | Close Account | Close account | — | — | case |
| accountModal.closeAccountConfirmMessage | Hides it from your accounts list. Its transactions are kept, not deleted. | It's hidden from your accounts. Its transactions are kept. | — | — | tighter |
| interestRateCard.logRateChange | + Update Interest Rate | + Update interest rate | — | — | case |

### accountInfo, accountGuide (the ⓘ explainers)

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| accountInfo.trackingKindBody | What kind of registered account this is. It does not change any arithmetic — a balance is a balance — but… | Which kind of registered plan this is — retirement, first home, education — so reports can tell them apart. It doesn't change any numbers. | 用于标明这是哪一类注册账户。它不会改变任何计算——余额就是余额——… | 标明这是哪类注册计划（退休、首套房、教育），方便报表区分。不影响任何数字。 | long |
| accountInfo.trackingKindScope | Only plans whose rules the app could actually describe are offered, and nothing here claims… | Only plans the app can describe correctly are listed. Contribution limits and taxes aren't tracked yet. | …而不是被归入一个它并不遵循的计划。 | 只列出应用能准确描述的计划。暂不涉及供款上限和税务。 | legalistic |
| accountInfo.latestBalanceBody | Type what the bank actually says. Budgets Bro posts one uncategorized adjustment for the difference, payee "Balance Adjustment"… | Enter what your bank shows. The app adds one uncategorized “Balance adjustment” transaction for the difference. | — | — | "posts" |
| accountInfo.latestBalanceFlow | That adjustment runs through Unassigned Cash like any other uncategorized transaction… There is no separate reconciliation mode: this is it. | The adjustment changes your Unassigned money, up or down — money that isn't there has to leave the budget too. | …这里没有单独的对账模式，这就是对账。 | 这笔调整会让「未分配」相应增减——不存在的钱也要从预算中扣除。 | dev-voice |
| accountInfo.rateHistoryBody | A rate is a fact with a date on it, not one number… | Rates change — a renewal, a central-bank move. Each change starts on its own date and leaves earlier months alone. | 利率是带日期的事实，而不是一个数字… | 利率会变，比如续约或央行调息。每次变动从各自的日期起生效，不影响之前。 | philosophical |
| accountInfo.rateHistoryUse | Every projection reads the rate that was in force at the time. Adding a change rewrites nothing… Backdate freely… | Every figure uses the rate in effect at the time. You can add past changes too. | — | 所有数字都按当时生效的利率计算，也可以补录过去的变动。 | long |
| accountInfo.houseValueBody | Your own estimate of what the place is worth, logged whenever you feel like updating it. Nothing is fetched… | Your own estimate, updated whenever you like. Nothing is looked up online. | — | 你自己的估计，想更新随时更新。不会联网查询。 | "logged", "fetched" |
| accountInfo.houseValueUse | The latest logged value is what net worth counts as the asset against this mortgage’s debt… | Your latest value counts toward net worth against what you owe, so the account shows your equity. | — | 最近一次估值会与欠款一起计入净资产，账户因此显示房屋净值。 | "logged" |
| accountInfo.principalTitle | Remaining principal | What you still owe | — | — | plainer |
| accountInfo.principalBody | A loan’s balance is not the opening figure plus your payments: early on, most of a payment is interest… | Early payments are mostly interest, so this isn't just the loan minus your payments. It starts from your last statement, and each payment since pays that month's interest first. | …取自你最近一次记录的对账单金额，再按其后的每笔还款向前推算… | 早期还款大多是利息，所以这不等于贷款额减去还款。它从你最近一次对账单开始，之后每笔还款先付当期利息，余下的才减少欠款。 | long |
| accountInfo.principalUse | Logging a reading writes no transaction — it is a reading, not a ledger correction… | Entering a statement balance doesn't add a transaction. That's why loans have no Current balance adjustment: your statement is the source of truth. | 记录一次读数不会产生任何交易——它是读数，不是账目更正… | 记录对账单余额不会产生交易。所以贷款没有「当前余额」调整：以对账单为准。 | "reading", "ledger" |
| accountInfo.valueHistoryTitle | Value log | Value history | 价值记录 | 估值记录 | glossary |
| accountInfo.valueHistoryBody | This account’s balance is the latest total you logged… never type a gain — a gain is only true for the second you read it… | The balance is the latest total you entered, not a sum of transactions. Enter the total from your statement, not the gain. | …收益只在你读数的那一秒成立… | 余额是你最近记录的总额，不是交易累加。请照对账单填总额，不要填收益。 | clever |
| accountInfo.valueHistoryUse | = | = | 买入投入的资金仍记为普通交易… | 存入的钱仍记为普通交易，图表就能分开显示本金和收益。 | awkward zh |
| accountInfo.loanTermsBody | The contract rather than the ledger: how long it runs… | What your loan contract says: length, amount borrowed, price, start date. They set the payment, payoff date and down payment. None of them adds a transaction. | 这里记的是合同而非账目：… | 贷款合同上的内容：期限、借款金额、房价、开始日期。它们决定月供、还清日期和首付，都不会产生交易。 | "ledger" |
| accountInfo.loanTermsBorrowed | Amount borrowed and the ledger’s starting balance are the same number for a loan taken out on day one… | Amount borrowed and starting balance match for a brand-new loan, but not for one you've already paid down — so they're separate fields. | …「借款金额」与账本「初始余额」… | 新贷款的「借款金额」和「起始余额」相同；已经还了一部分的贷款则不同，所以分成两项。 | "ledger"; 初始余额 vs 起始余额 |
| accountInfo.toolsTitle | Amortization schedule | Payment schedule | — | — | jargon |
| accountInfo.toolsBody | Every payment from here to the end, split into interest and principal… | Every payment from now to the end, split into interest and principal, using this page's values (even unsaved ones). To try paying more, use the calculators. | — | 从现在到还清的每一期，分成利息和本金，按本页当前填写的内容计算（含未保存的修改）。想试算多还，请用计算器。 | long |
| accountInfo.loanCardBody | The rate in force, the scheduled payment… none of it stored. Change a rate or a payment and every figure here moves with it. | Current rate, payment, payoff date and interest left, all calculated from what you've entered. Change anything and these update. | …没有任何存储值… | 当前利率、月供、还清日期和剩余利息，都根据你填写的内容算出，修改后会随之更新。 | "stored" |
| accountGuide.cash.how | A chequing account, or the notes in your wallet… comes out of a category envelope. | A chequing account or the cash in your wallet. Its balance is the starting balance plus its transactions. Spending from it comes out of a category. | …都会从对应的分类信封里扣除。 | 支票账户，或钱包里的现金。余额 = 起始余额 + 交易；从这里花的钱会从对应分类扣除。 | "notes", envelope |
| accountGuide.cash.helps | This is where budgeting actually happens: only on-budget cash can be assigned… | This is where budgeting happens: only money in these accounts can be assigned to categories. That's what makes “$40 left in Groceries” mean something. | 预算真正发生的地方：只有纳入预算的现金… | 预算就在这里发生：只有这类账户里的钱能分配到分类，「食杂还剩 40 元」才有意义。 | "on-budget" |
| accountGuide.savings.how | The same ledger as a cash account — opening balance plus transactions — for money set aside… | Works like a cash account, for money set aside. Interest comes in as income you can mark as interest, so reports show it separately. | …以便在报表中与劳动收入分开统计。 | 和现金账户一样，只是用来存钱。利息作为收入入账，可标记为「利息」，报表会单独显示。 | "ledger"; 劳动收入 |
| accountGuide.savings.helps | Keeps an emergency fund or a sinking fund visible without pretending it is spendable… | Keeps an emergency fund or savings goal in view. Baby Steps reads the account you pick as your emergency fund. | — | — | "sinking fund" jargon |
| accountGuide.credit_card.how | A card you pay later… Paying the bill is a transfer: choose the card as the payee on a transaction from your cash account and both sides are posted for you. | A card you pay off later. Its balance is negative: what you owe. Card spending comes out of a category the day you spend. To pay the bill, add a transaction from your cash account with the card as payee; both sides are recorded. | …两边会自动同时记账。 | = | long, "posted" |
| accountGuide.loan.how | Money borrowed and being paid back… Its balance is the remaining principal, worked out from the last figure you logged… | Money you're paying back: car loan, student loan, line of credit. The balance is what you still owe, estimated from your last statement and payments since. Enter each payment as one transaction; no need to split it. | — | 正在偿还的借款：车贷、学生贷款、信用额度。余额是估算的剩余欠款，依据最近一次对账单和之后的还款。每次还款记一笔即可，无需拆分本金和利息。 | long |
| accountGuide.loan.helps | …Point a transaction at this account as its payee and the payment posts on both sides at once. | See what's left, what interest is costing you, and when it'll be paid off. Pick this account as the payee on a payment and both sides are recorded. | 把某笔交易的收款方指向该账户… | …把还款交易的收付方选为该账户，两边会同时记账。 | "posts"; glossary |
| accountGuide.tracking.how | An investment account: RRSP, TFSA, a brokerage… a gain is only true for the second you read it… | An investment account: RRSP, TFSA, brokerage. Its balance is the latest total you enter from your statement. Deposits stay ordinary transactions, so the chart can show what you put in vs what it earned. | …而「收益」只在你读数的那一秒成立… | 投资账户：RRSP、TFSA 或券商账户。余额是你按对账单记录的最新总额。存入的钱仍记为交易，图表能区分本金和收益。 | repeated clever line |
| accountGuide.asset.how | Something you own that loses value over time — a car, a watch, equipment… | Something you own: a car, a house, equipment. Its value is what you enter, updated whenever you like. | 你拥有、且会随时间贬值的东西… | 你拥有的东西：车、房子、设备。价值由你自己记录，随时可更新。 | wrong for houses (design lists House under Asset) |
| accountGuide.asset.helps | Keeps net worth honest in both directions: what you own counts, and it counts for less each year… | Counts what you own in your net worth without touching your budget. | …并且逐年计得更少… | 把你拥有的东西计入净资产，不影响预算。 | assumes depreciation |
| accountGuide.giving.how | …It is assigned like any other envelope… | Money set aside to give: tithing, charity, a family fund. You assign it like any category, but it's held in its own account so it isn't counted as spendable. | 预留出去用于捐赠的钱… 像其他信封一样被分配… | 留作捐赠的钱：什一奉献、慈善、家庭基金。它像其他分类一样分配，但放在单独账户里，不算作可自由支配的钱。 | envelope |

### houseValueCard, trackingValueCard, loanDetailsCard, investmentGrowth

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| houseValueCard.label | Home Value | Home value | 房屋价值 | 房屋估值 | case, glossary |
| houseValueCard.valueLabel | = | = | 房产价值 | 房屋估值 | glossary |
| houseValueCard.noValueYet | = | = | 尚未记录房屋价值。 | 尚未记录房屋估值。 | glossary |
| houseValueCard.updateButton | + Update Home Value | + Update home value | — | — | case |
| trackingValueCard.label | Balance Trend | Balance over time | — | — | case |
| trackingValueCard.logValueUpdate | + Update Account Value | + Update value | + 更新账户估值 | + 更新估值 | case; wordy |
| trackingValueCard.logBalanceUpdate | + Update Balance | + Update balance | — | — | case |
| trackingValueModal.title | Update Account Value | Update value | 更新账户估值 | 更新估值 | case |
| trackingValueModal.totalLabel | = | = | 当前总余额 | 当前总额 | en says value |
| loanDetailsCard.label | Loan Details | Loan details | — | — | case |
| loanDetailsCard.addHint | Add the interest rate, term, and original principal to see a payoff projection. | Add the rate, term and amount borrowed to see when it'll be paid off. | 添加利率、期限和初始本金即可查看还清预测。 | 填写利率、期限和借款金额，即可看到何时还清。 | field is "Amount borrowed" |
| loanDetailsCard.addTerms | Add Loan Terms | Add loan terms | — | — | case |
| loanDetailsCard.editTerms | Edit Loan Terms | Edit loan terms | — | — | case |
| loanDetailsCard.projectedPayoffLabel | Projected payoff | Paid off by | — | — | plainer |
| loanDetailsCard.paymentTooLow | Payment too low to pay off | Payment doesn't cover the interest | 还款金额过低，无法还清 | 还款额不足以支付利息 | says why |
| loanDetailsCard.remainingInterestLabel | Est. remaining interest | Interest left (est.) | — | — | reads naturally |
| loanDetailsCard.updatePrincipal | + Update Remaining Principal | + Add statement balance | + 更新剩余本金 | + 记录对账单余额 | glossary |
| loanDetailsCard.sinceReadingHint | Estimated from {count} payment(s) since you recorded {amount} owed on {date}… | Estimated from your {date} statement ({amount} owed) and the payments since, interest first. Add a new statement balance any time; it won't change your transactions. | …随时可以记一个新数字，不会产生任何流水。 | 依据你 {date} 的对账单（欠 {amount}）和之后的还款估算，每笔先付利息。随时可记录新的对账单余额，不会影响交易。 | bracket plural; 流水 |
| loanDetailsCard.sinceOriginHint | Estimated from the amount borrowed and {count} payment(s) since… | Estimated from the amount borrowed and the payments since, interest first. Add your latest statement balance to make it exact. | — | 依据借款金额和之后的还款估算，每笔先付利息。记录最近一次对账单余额即可校准。 | bracket plural |
| loanDetailsCard.noRateHint | No interest rate on file, so every payment counts fully against the principal… | No interest rate yet, so payments count in full against what you owe — this shows less than you really owe. | — | — | "on file" |
| loanDetailsCard.actualsOnlyHint | Projected from the scheduled payment and the principal still owed. To try extra payments, use the payoff and early-repayment calculators. | Based on your scheduled payment and what you owe now. To try paying more, use the payoff calculators. | — | — | tighter |
| investmentGrowth.notEnoughHistory | Log at least two value updates to see a trend. | Add at least two values to see a trend. | — | — | "log" |
| investmentGrowth.notEnoughYears | Log a value in two different years to see the trend. | Add values in two different years to see a trend. | — | — | "log" |
| investmentGrowth.noDepositsHint | No transactions logged on this account yet, so the whole balance shows as gain. Record deposits/withdrawals… | No deposits yet, so the whole balance shows as gain. Add deposits and withdrawals as transactions to separate them. | — | — | "logged", slash |

### closedAccounts

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| closedAccounts.tapToReopen | = | = | 点击以重新开启 | 点按重新打开 | 点按 |
| closedAccounts.deleteConfirmTitle | Delete '{name}' and its transactions? | Delete “{name}” and its transactions? | 删除「{name}」及其全部流水？ | 删除「{name}」及其全部交易？ | quotes; 流水 |
| closedAccounts.deleteConfirmMessage | Its transactions are deleted too, and stop counting toward category activity and Unassigned Cash. The other side of any transfer keeps its own entry… | Its transactions are deleted and stop counting in your categories and Unassigned. Transfers keep their other side. This can't be undone. | 其流水会一并删除… | 其交易会一并删除，不再计入分类和「未分配」。转账的另一边会保留。此操作无法撤销。 | jargon; 流水 |
| closedAccounts.deleteImpactMessage | Its transactions go too — including {amount} of categorised spending, which is what offset the cash that paid this account off… | This also deletes {amount} of spending from your categories. Your payments to this account stay, so Unassigned would become {deleted}. Keeping it closed is usually better. This can't be undone. | 流水会一并删除——其中包含 {amount} 的已分类支出，正是它抵消了… | 这会同时删除分类中 {amount} 的支出，而你给这个账户的还款仍在，「未分配」会变为 {deleted}。通常保持关闭更好。此操作无法撤销。 | doesn't parse; spelling |
| closedAccounts.absorbAction | = | = | 并入{name} | 并入「{name}」 | quotes |
| closedAccounts.absorbMessage | This account holds {amount} of categorised spending. Moving it to {into} keeps that history and collapses the payments between the two… | This account has {amount} of spending in your categories. Moving it to {into} keeps that history and cancels out payments between them, so Unassigned stays at {unassigned}. Deleting would make it {deleted}. | …并抵消两个账户之间的还款… | = | "collapses"; spelling |
| closedAccounts.absorbShiftMessage | …what this account still owed, or was opened owing, becomes cash treated as already spent… | This account has {amount} of spending in your categories. Moving it to {into} keeps that history, but Unassigned changes from {unassigned} to {absorbed}, because what it still owed counts as already spent. Deleting would make it {deleted}. | — | — | doesn't parse |

### aiAnalysis

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| aiAnalysis.title | AI Insights | AI analysis | AI 洞察 | AI 分析 | glossary; distinct from on-device Insights |
| aiAnalysis.noKeyHint | Add an OpenAI API key in Settings to run an analysis of your budget data. | Add an AI key in Settings to run an analysis. | 请先在设置中添加 OpenAI API 密钥… | 请先在设置中添加 AI 密钥。 | 7 vendors supported, not just OpenAI |
| aiAnalysis.openSettings | Open Settings | = | — | — | Settings is a proper name here |
| aiAnalysis.kindVariance | Variance | Budget vs actual | 差异 | 预算对比 | jargon |
| aiAnalysis.kindHealth | Health | Financial health | — | — | vague |
| aiAnalysis.kindComparison | Comparison | Compare with others | — | 与他人对比 | vague |
| aiAnalysis.profileHeading | About You (optional) | About you (optional) | — | — | case |
| aiAnalysis.profileHint | Feeds the Health and Comparison reports below — saved on this device, only sent to OpenAI as part of those two… | Used only by Financial health and Compare with others. Saved on this iPhone and sent only with those two. Leave any field blank. | …仅在运行这两项分析时发送给 OpenAI… | 仅用于「财务健康」和「与他人对比」。保存在本机，只随这两项发送。任何一项都可留空。 | OpenAI-only; "feeds" |
| aiAnalysis.privacyModeLabel | Privacy Mode | Privacy mode | — | — | case |
| aiAnalysis.privacyModeHint | Rounds every amount to the nearest $10 and replaces category names with generic labels ("Category 1")… Turn it off to have the AI talk about your real categories by name. | Rounds amounts to the nearest $10 and hides category names before sending. Turn it off to let the AI use your real category names. | …关掉它，AI 才会直呼你真实的分类名。 | 发送前把金额取整到 10 元，并隐藏分类名称。关闭后 AI 会使用你的真实分类名。 | tighter |
| aiAnalysis.runButton | Run Analysis | Run analysis | — | — | case |
| aiAnalysis.errorInvalidKey | OpenAI rejected the API key — check it in Settings. | The AI provider rejected your key. Check it in Settings. | OpenAI 拒绝了此 API 密钥… | AI 服务商拒绝了你的密钥，请在设置中检查。 | OpenAI-only |
| aiAnalysis.errorRateLimited | Rate-limited by OpenAI — try again in a moment. | Too many requests. Try again in a minute. | 已被 OpenAI 限流——请稍后重试。 | 请求太频繁，请稍后再试。 | jargon; OpenAI-only |
| aiAnalysis.errorNetwork | Couldn’t reach OpenAI — check your connection. | Couldn't reach the AI provider. Check your connection. | 无法连接 OpenAI——请检查网络。 | 无法连接 AI 服务商，请检查网络。 | OpenAI-only |

### calculators, amortizationSchedule

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| calculators.title | Mortgage / Loan Calculator | Loan calculator | — | 贷款计算器 | case |
| calculators.loanAmountLabel | Loan Amount | Loan amount | — | — | case |
| calculators.interestRateLabel | Interest Rate (annual %) | Interest rate (% per year) | — | — | case; match financeTools |
| amortizationSchedule.title | Amortization Schedule | Payment schedule | — | — | jargon; case |
| amortizationSchedule.inputsTitle | Loan inputs | Loan details | 贷款参数 | 贷款信息 | "inputs" |
| amortizationSchedule.scheduleTitle | Payment-by-payment schedule | Every payment | — | 每期明细 | wordy |

### babySteps, customGoalModal

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| babySteps.intro | A fixed order for money decisions: everything you can spare goes into the step you are on… what this page adds is reading them off your accounts instead of your memory. | Dave Ramsey's seven steps, in order: put everything you can spare into the current step until it's done, then move on. This page tracks your progress from your accounts. | 一套固定顺序的理财决策… | Dave Ramsey 的七个步骤，按顺序来：把能省下的钱都投入当前这一步，完成后再进入下一步。本页根据你的账户显示进度。 | long |
| babySteps.learnMore | = | = | 了解 Dave Ramsey 的 7 个理财步骤 → | 了解 Dave Ramsey 的理财七步 → | glossary |
| babySteps.whyBody | Step 1 is a buffer, not a cushion: a small fund stops a flat tyre from becoming fresh debt… | Step 1 is a small buffer, so a surprise bill doesn't become new debt. Step 2 clears debts smallest first, for momentum. Step 3 grows the buffer to 3–6 months of your own spending. Investing waits until Step 4, because a return earned while paying 20% card interest isn't a return. Steps 5–7 are what the first four make possible. | 第 1 步是缓冲，不是靠垫：… | 第 1 步是一小笔缓冲，让意外开支不变成新债。第 2 步从最小的债开始还，积累动力。第 3 步把缓冲扩大到 3–6 个月的开支。投资放到第 4 步，因为一边付 20% 的卡息一边投资并不划算。第 5–7 步是前四步带来的成果。 | long; "buffer, not a cushion" |
| babySteps.measuredHeading | How this page knows | Where the numbers come from | 这一页的数据从哪来 | = | clever |
| babySteps.measuredBody | Each step reads the accounts you choose for it — emergency fund, retirement, down payment — so the bars move when your ledger does, not when you say so… | Each step reads the accounts you pick for it, so progress moves with your real balances. Steps with nothing to measure, you mark done yourself. Add your own goals at the bottom. | …所以进度条随账本变动，而不是随你的说法变动… | 每一步读取你为它选的账户，进度随真实余额变化。无法计算的步骤由你自己标记完成。页面底部可添加自己的目标。 | long; "ledger" |
| babySteps.step1Blurb | …a flat tyre or a broken boiler you cannot cover simply becomes more debt. | …a flat tire or a broken furnace you can't cover just becomes more debt. | — | — | spelling (Canadian) |
| babySteps.step4NoAccounts | Not tracked yet | No accounts picked yet | — | — | en/zh mismatch |
| babySteps.step5Blurb | …an ESA or 529 rather than student loans… | …an RESP or 529 rather than student loans… | — | — | app is Canada-first |
| babySteps.markDone | Mark Done | Mark done | — | — | case |
| babySteps.accountsCount | {count} accounts | Accounts: {count} | — | — | "1 accounts" |
| babySteps.categoriesCount | {count} categories | Categories: {count} | — | — | "1 categories" |
| babySteps.goalsHeading | Your Goals | Your goals | — | — | case |
| babySteps.goalsHint | Your own targets — separate from the 7 Baby Steps above, and not counted in any of their progress… | Your own savings goals, like a car or a trip. Track them by hand or from an account's balance. They don't count toward the Baby Steps. | …与上面的 7 个理财步骤无关… | 你自己的储蓄目标，比如买车、旅行。可手动记录，或跟随某个账户的余额。不计入理财七步。 | long; glossary |
| babySteps.addGoal | + Add Goal | + Add goal | — | — | case |
| babySteps.goalsEmpty | No custom goals yet — set your own target above and track it manually or from a linked account. | No goals yet. | 还没有自定义目标——在上面设定你自己的目标… | 还没有目标。 | repeats hint; "above" is wrong |
| customGoalModal.modeManual | Manual (no linked account) | Track by hand | 手动（不关联账户） | 手动记录 | plainer |

### taxInsights

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| taxInsights.title | Tax Insights — {year} | Tax year {year} | 税务洞察 — {year} | {year} 年报税 | "Insights" overuse; zh translationese |
| taxInsights.disclaimer | Preliminary numbers from your ledger, for planning only. Not tax advice. | Estimates from your transactions, for planning only. Not tax advice. | 基于你的账本数据得出的初步估算… | 根据你的交易估算，仅供规划参考，不构成税务建议。 | "ledger" |
| taxInsights.noIncomeYet | No money in yet this year | No income yet this year | — | — | plainer |
| taxInsights.interestHint | Pick the category you tag interest transactions with, if any — deposits (e.g. savings interest) count as earned… | Pick the categories you use for interest. Money in counts as earned, money out as paid. | — | 选择你用来记利息的分类。收入算作所得，支出算作支付。 | long |
| taxInsights.categoriesCount | {count} categories | Categories: {count} | — | — | "1 categories" |
| taxInsights.investmentGainsHint | Raw value change on tracking accounts — actual taxable capital gain depends on the inclusion rate and adjusted cost base… | Change in value of your investment accounts. Your taxable gain depends on cost base and inclusion rate, which aren't calculated here. | 仅为追踪账户的原始价值变化… | 投资账户的价值变化。实际应税收益取决于成本基础和纳入率，此处不计算。 | glossary |
| taxInsights.noTrackingAccounts | No tracking accounts yet | No investment accounts yet | 还没有追踪类账户 | 还没有投资账户 | glossary |
| taxInsights.additionalInfoLabel | Anything else? | Other income and deductions | 还有其他信息吗？ | 其他收入与抵扣 | vague heading |
| taxInsights.estimatedTaxableIncomeHint | Ledger income + additional income − deductions. Interest, gains and donations above are shown for context and not double-counted here. | Income from your transactions, plus other income, minus deductions. Interest, gains and donations above aren't added again. | 账本收入 + 其他收入 − 抵扣额… | 交易中的收入 + 其他收入 − 抵扣额。上方的利息、收益和捐赠不会重复计入。 | "ledger" |
| taxInsights.askAi / aiSummaryMessage | Ask AI to summarize → / AI analysis needs an API key and provider setup — coming in a future update. | Hide the button until it works. | — | — | a button that opens "coming later" is a dead end (design: no silent no-ops) |
| taxInsights.guideBody | Not a return and not advice — this gathers the figures a return tends to ask for, out of the ledger you already keep… | The numbers a tax return usually asks for, gathered from your transactions: income by payee, interest, investment gains and donations. You choose which categories mean interest and giving. Not tax advice; nothing leaves this iPhone. | …从你已经在记的账本中… | 从你的交易中汇总报税常用的数字：各收付方的收入、利息、投资收益和捐赠。哪些分类算利息和捐赠由你指定。不构成税务建议，数据不会离开本机。 | long; "ledger" |

### transactions, review (Flagged)

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| transactions.searchPlaceholder | = | = | 搜索收款方或备注 | 搜索收付方或备注 | glossary |
| transactions.deleteSelectedConfirmTitle | = | = | 删除 {count} 条流水？ | 删除 {count} 笔交易？ | glossary |
| transactions.editPayee | Edit Payee | Change payee | 修改收款方 | 修改收付方 | case; glossary |
| transactions.editPayeeTitle | = | = | 为 {count} 条流水设置收款方 | 为 {count} 笔交易设置收付方 | glossary |
| transactions.allCategories | All Categories | All categories | — | — | case |
| transactions.allOthers | All Others | Everything else | 其他全部 | 其他 | case; plainer |
| transactions.allMonths | All Months | All months | — | — | case |
| transactions.needsPayee | No Payee | No payee | 无收款方 | 无收付方 | case; glossary |
| transactions.needsReview | Flagged | To review | 已标记 | 待检查 | glossary; YNAB "flags" mean something else |
| review.title | Flagged Transactions | To review | 标记的交易 | 待检查的交易 | glossary |
| review.guideBottomHeading | A flag is an observation, not a rule | Nothing here is urgent | 标记只是提示，不是规则 | 这些只是提醒，不急 | clever |
| review.guideBottomBody | Leave a row exactly as it is and it stays flagged, harmlessly… they write through the same paths as editing by hand… | Leave anything as it is; nothing here expires or changes on its own. Each fix does only what its button says, and you can undo it from History in Settings. | …都能在「设置 → 修改历史」中撤销。 | 可以原样不动，这里的内容不会过期，也不会自动更改。每个修复只做按钮上写的事，并可在「设置 → 历史」中撤销。 | long; wrong screen name |
| review.reasonMissingPayee | Payee | No payee | 收付方 | 无收付方 | chip names the field, not the problem |
| review.reasonMissingCategory | Category | No category | 分类 | 未分类 | same |
| review.reasonZeroAmount | Zero | $0 | 零额 | 金额为零 | 零额 isn't a word |
| review.reasonTransferMissingLeg | Unpaired | One-sided | 缺配对 | 缺另一边 | glossary |
| review.reasonTransferAmountMismatch | Mismatch | Amounts differ | 不一致 | 金额不符 | vague |
| review.reasonTransferSelfNamed | Self-named | Paid to itself | 自指 | 付给自己 | jargon |
| review.reasonTransferUnlinked | Unlinked | Not linked | — | — | plainer |
| review.fundCategory | Fund {amount} in {month} | Assign {amount} in {month} | 在 {month} 拨款 {amount} | 为 {month} 分配 {amount} | glossary |
| review.fundShortfall | Unassigned cash is {amount} short | Not enough unassigned: {amount} short | 未分配现金还差 {amount} | 未分配的钱还差 {amount} | glossary |
| review.explainMissingPayee | These rows don’t say who was paid. Pick a payee — or, for half of a transfer, name it after the account across from it in one tap. | These don't say who was paid. Pick a payee. For a transfer, one tap names the other account. | 这些记录没有写明收付方… | 这些交易没有写收付方。请选择一个；如果是转账，点按一下即可填上对方账户。 | "rows", "half" |
| review.explainMissingCategory | Money left a spending account without landing in a category, so it is missing from the budget entirely. | Money was spent without a category, so your budget doesn't see it. | — | 钱花出去了却没有分类，预算里看不到它。 | wordy |
| review.explainDuplicate | Same account, day, amount, payee and note… | Same account, date, amount, payee and memo. Either it was entered twice (delete one) or it's two parts of one purchase (Merge makes them one). | 账户、日期、金额、收付方和备注完全相同… | = | "note" vs memo |
| review.explainZeroAmount | A transaction for nothing at all. Almost always left behind by an import. | A $0 transaction, usually left over from an import. | — | — | cute |
| review.explainTransferMissingLeg | Half of a transfer whose other half was never written: money left one account and arrived nowhere… | A transfer with only one side: money left one account but never arrived. The fix adds the missing side to the other account. | 转账只有一半… | 这笔转账只有一边：钱从一个账户转出，却没有转入。修复会在对方账户补上另一边。 | "written", "half" |
| review.explainTransferAmountMismatch | Both halves exist but don’t cancel out… | Both sides exist but the amounts don't match. The fix sets the other side to match this one. | 两半都在，但金额对不上… | 两边都在，但金额对不上。修复会让另一边与这一笔对应。 | "halves" |
| review.explainTransferSelfNamed | The payee is the row’s own account, which says nothing about where the money went… | The payee is this same account, so it doesn't say where the money went. The fix uses the other account's name. | 收付方写的是这条记录自己的账户，等于什么也没说… | 收付方填的是本账户，看不出钱去了哪里。修复会改为对方账户。 | "row" |
| review.explainTransferUnlinked | The two halves are correct but nothing ties them together, so neither knows the other exists… | Both sides are right but aren't linked. The fix links them. | 两半都正确… | 两边都正确，但没有关联。修复会把它们关联起来。 | cute |
| review.explainCategoryOverspent | This category spent more than it had in that month. Funding assigns the shortfall into that same month, which lifts every month after it… | This category spent more than it had that month. Assigning the shortfall fixes that month and every month after. It comes out of Unassigned; no account balance changes. | 该分类在那个月花超了。拨款会把缺口补进那个月… | 该分类当月超支了。分配差额即可补上当月及之后各月，钱从「未分配」中扣除，账户余额不变。 | "Funding" |
| review.fixPostLeg | Create matching row | Add other side | 创建对应记录 | 补上另一边 | "row" |
| review.fixNameFromOtherSide | Name from other side | Use other account's name | — | — | unclear |
| review.fixLinkPair | Link to its match | Link the two sides | 关联对应记录 | 关联两边 | glossary |
| review.mergeConfirmMessage | = | = | 它们将合并为一笔，金额为两者之和，且无法撤销。 | 它们将合并为一笔，金额为总和。此操作无法撤销。 | may be more than two |
| review.fixDelete | Delete row | Delete | 删除此行 | 删除 | "row" |
| review.fixed | Solved | Fixed | — | — | matches Fix |
| review.pickPayee | = | = | 设置收款方 | 设置收付方 | glossary |
| review.allClear | Nothing is flagged. | Nothing to review. | 没有被标记的交易。 | 没有需要检查的交易。 | glossary |

### budget, pendingScheduled

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| budget.spentThisMonth | Spent This Month | Spent this month | — | — | case |
| budget.breakdownAhead | …of which given to later months | Including future months | ……其中分配给之后月份 | 其中已分配给未来月份 | fragment |
| budget.breakdownNote | Cash you hold today, less what your categories still hold across every month — future ones included… | Cash you have now, minus what's still in your categories, including future months. It's the same whichever month you're viewing. | 今天手上的现金，减去所有分类… | 你现在的现金，减去各分类（含未来月份）中还没花的钱。无论查看哪个月，这个数字都一样。 | long |
| budget.breakdownCardWarning | {amount} of this is spending already charged to a credit card. Card spending empties a category without leaving your cash… | {amount} of this is card spending you haven't paid off yet. It's already spent from your categories, so it isn't really free. | …所以这部分虽然显示为可用，其实已有归属。 | 其中 {amount} 是尚未还的信用卡消费。它已经从分类中花掉，并不是真正可用的钱。 | hard to parse |
| budget.avgLabel | 12 Months Avg | 12-month average | — | — | design rule: no abbreviations under uppercase |
| budget.reached | {percent}% reached | {percent}% of average | 已达 {percent}% | 达到平均的 {percent}% | reached what? |
| budget.addCategory | Add Category | Add category | — | — | case |
| budget.renameGroup | Rename Group | Rename group | — | — | case |
| budget.renameCategory | Rename Category | Rename category | — | — | case |
| budget.moveUp | Move Up | Move up | — | — | case |
| budget.moveDown | Move Down | Move down | — | — | case |
| budget.deleteGroup | Delete Group | Delete group | — | — | case |
| budget.newGroupButton | + New Group | + New group | — | — | case |
| budget.newGroupTitle | New Group | New group | — | — | case |
| budget.newCategoryTitle | New Category | New category | — | — | case |
| budget.pendingApprovals | {count} scheduled pending approval | Scheduled to approve: {count} | {count} 笔定期交易待批准 | {count} 笔定期交易待确认 | plural; 批准 |
| pendingScheduled.title | Pending Scheduled Transactions | Ready to approve | 待批准的定期交易 | 待确认的定期交易 | long; case |
| pendingScheduled.empty | Nothing waiting on approval. | Nothing to approve. | 暂无待批准的交易。 | 暂无待确认的交易。 | tighter |
| pendingScheduled.approve | = | = | 批准 | 确认入账 | bureaucratic |

### insights (hub), housing, houseStatus

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| nav.insights | = | = | 洞察 | 分析 | translationese |
| insights.spendingBreakdown | Spending Breakdown | Spending breakdown | — | — | case |
| insights.topCategories | Top Categories | Top categories | — | — | case |
| insights.categoryTrends | Category Trends | Category trends | — | — | case |
| insights.trendHint | = | = | …点击图标可隐藏／显示该分类… | …点按图标可隐藏或显示该分类… | 点按 |
| insights.utilities | Utilities | Tools | 实用工具 | 工具 | clashes with utility bills |
| insights.housing | Realtor Insights | House hunting | 房产洞察 | 看房 | it's for buyers, not realtors |
| insights.mortgageInsights | Mortgage Insights | Mortgage | 房贷洞察 | 房贷 | "Insights" ×6 |
| insights.loanInsights | Loan Insights | Loans | 借贷洞察 | 贷款 | same |
| insights.investmentInsights | Investment Insights | Investments | 投资洞察 | 投资 | same |
| insights.taxInsights | Tax Insights | Tax year | 税务洞察 | 报税 | same |
| insights.costOfLiving | Cost of Living | Cost of living | — | — | case |
| insights.exchangeInsights | Exchange Rates | Exchange rates | — | — | case |
| insights.trackedPrices | Tracked Prices | Tracked prices | — | — | case |
| insights.payeeTrend | Payee Trend | Payee trends | 收款方趋势 | 收付方趋势 | case; glossary |
| houseStatus.shortlisted | = | = | 入围 | 候选 | contest word |
| housing.carryingShort | {amount}/mo to carry | {amount}/mo to own | — | — | jargon |
| housing.carryingMonthly | Monthly to carry | Monthly cost to own | — | — | jargon |
| housing.name | Name it | Name | 起个名字 | 名称 | cute |
| housing.status | Where it stands | Status | 当前进度 | 状态 | vague |
| housing.openCalculator | Run it through the purchase calculator → | Open in purchase calculator → | — | 在购房测算中打开 → | wordy |
| housing.neighbourhood | The street and the neighbours | Neighbourhood | — | — | wordy |
| housing.pros | For | Pros | — | — | ambiguous |
| housing.cons | Against | Cons | — | — | ambiguous |
| housing.empty | No houses yet. Add one the moment you see a listing worth a second look — a name and a price is enough to start. | No houses yet. A name and a price is enough to start. | — | 还没有房源。有名字和价格就能开始。 | wordy |
| housing.detailGuideBody | Four viewings in and every house is "the one with the nice kitchen"… | Write it down at the viewing, before every house blurs into “the one with the nice kitchen.” Only the name is required. Don't skip the condition fields: an old roof or furnace comes off the price. | 看到第四套时… | 看房时就记下来，免得每套都成了「厨房不错的那套」。只有名称必填。别漏了房屋状况：旧屋顶、旧暖炉都该从价格里扣掉。 | long |
| housing.addBenchmark | + Log a community benchmark price | + Add benchmark price | + 记录社区基准价 | + 添加基准价 | "log" |
| housing.addBenchmarkHint | One figure, one month, one community. Log it whenever you read a new one and the line builds itself. | One price per community per month. Add each new one as it comes out. | …曲线会自己长出来。 | 每个社区每月一个价格，有新数据就添加一次。 | cute |
| housing.guideBody | Above, the places you are actually considering… Hold a house to pick it, pick two or three, and compare them side by side. | Top: houses you're considering, with their monthly cost. Bottom: community prices month by month, entered by you. Hold a house to select it, then compare two or three side by side. | — | 上方：你正在考虑的房源及每月成本。下方：你记录的社区月度价格。长按房源选中，选两三套即可并排对比。 | long |
| housing.sourceBody | Real-estate boards publish benchmark prices by community every month — but as PDFs… It is a minute a month… | Real-estate boards publish these monthly, but only as PDFs, and apps can't republish them. So you type in the number you trust, and the app keeps the history and draws the chart. | …而这些数字也无可争议地由你自己选定。 | 地产局每月公布，但只有 PDF，且不允许应用转载。所以由你输入信得过的数字，应用负责保存历史并画图。 | long |
| housing.compareGuideBody | Green is the better cell on rows where better is defined… two identical figures are not a finding… | Green marks the better value where there's a clear better (cheaper, bigger, newer, closer). Taste-only rows and ties aren't marked. Scroll sideways for more houses. | — | 绿色表示明显更好的一项（更便宜、更大、更新、更近）。取决于个人喜好的行和相同的数值不标记。左右滑动查看更多房源。 | long, clever |

### costOfLiving, fx

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| costOfLiving.fromTable | Compiled estimates, as of {date}. | Estimates as of {date}. | 整理的估算数据，截至 {date}。 | 估算数据，截至 {date}。 | wordy |
| costOfLiving.useTable | Back to the shipped figures | Use built-in figures | — | — | "shipped" |
| costOfLiving.askFailed | The AI did not return usable figures. The shipped ones are still shown. | The AI's answer couldn't be used. Showing built-in figures. | — | — | "shipped" |
| costOfLiving.needsAiKey | Connect an AI in Settings to ask for newer figures. | Add an AI key in Settings to ask for newer figures. | 请先在设置中连接一个 AI… | 请先在设置中添加 AI 密钥，才能获取更新的数据。 | glossary |
| costOfLiving.needsRate | Open Exchange Rates once to cache the {currency} rate, and these convert automatically. | Open Exchange rates once and these will show in {currency}. | …缓存 {currency} 汇率后… | 打开一次「汇率」页面，这里就会换算成 {currency}。 | "cache" |
| costOfLiving.compareHeading | You (last {months} months) against this city | You vs this city (last {months} months) | — | — | awkward |
| costOfLiving.mapSomething | Pick which of your categories count as each line, and your own figures appear beside the city’s. | Match your categories to each line to see your spending next to the city's. | — | — | awkward |
| costOfLiving.quadrantHint | City cost across, your spending up, and a dashed line where they are equal… | Across: city cost. Up: your spending. Above the dashed line, you spend more than typical here. | — | 横轴：当地成本；纵轴：你的支出。在虚线以上，说明你比当地一般水平花得多。 | long |
| costOfLiving.guideBody | Two questions, one page… | What would life cost somewhere else, and how does your spending compare to a place's normal? The second is the useful one. | — | 换个城市生活要花多少？你的花费和当地一般水平相比如何？后者更有用。 | long |
| costOfLiving.sourceBody | The city figures are estimates, not measurements… nobody can pin that to a date, and you cannot ask it for one… | City figures are estimates from published surveys, dated when compiled. The AI's figures are only as recent as its training. Your figures are exact: six months of your own transactions. Asking the AI sends only a city and a currency. | — | 城市数据是根据公开调查整理的估算，并标注日期。AI 的数据只和它的训练数据一样新。你的数字是准确的：来自你近六个月的交易。询问 AI 时只发送城市和货币。 | long |
| fx.guideHeading | Rates, and where they have been | Exchange rates | 汇率，以及它一路走来的样子 | 汇率与走势 | translationese |
| fx.guideBody | Convert at today’s published rate, then look at the same pair over five years… | Convert at today's rate, and see how the pair has moved over five years — is this a normal week to exchange? | — | 按今天的汇率换算，再看看过去五年的走势：现在换汇是否划算？ | wordy |
| fx.addCurrency | ＋ Currency | + Add currency | ＋ 货币 | + 添加货币 | full-width + |
| fx.allAdded | Every currency the ECB publishes is already on the list. | All available currencies are added. | 欧洲央行公布的货币都已在列表中。 | 所有可用货币都已添加。 | jargon |
| fx.against | Against | Compare with | — | — | vague |
| fx.noRateYet | No rate yet — pull once with a connection and it is cached. | No rates yet. Connect to the internet once to get them. | 尚无汇率——联网获取一次后即会缓存。 | 尚无汇率，联网一次即可获取。 | "pull", "cached" |
| fx.neverUpdated | Not fetched yet · tap to fetch | No rates yet · tap to update | 尚未获取 · 点按获取 | 尚无汇率 · 点按更新 | "fetch" |
| fx.offline | Could not reach the rate service. Showing the last rates fetched. | Couldn't update rates. Showing the last ones saved. | — | — | "fetched" |
| fx.change | Change over the window | Change over this period | — | — | "window" |
| fx.versusAverage | Today against that average | Today vs average | — | 今天相比平均 | awkward |
| fx.window1m / 1y / 5y | = | = | 1个月 / 1年 / 5年 | 1 个月 / 1 年 / 5 年 | spacing |
| fx.sourceBody | The European Central Bank’s daily reference rates, via frankfurter.app… | European Central Bank daily rates, via frankfurter.app: free, no account. Requests carry only currency codes and dates, nothing about you. Rates are saved so the page works offline. Your bank's rate will be a bit worse: that gap is their fee. | — | 来自欧洲央行每日汇率，经 frankfurter.app 获取，免费、无需账号。请求只包含货币代码和日期，不含你的任何信息。汇率会保存在本机，断网也能看。银行给的汇率会差一些，差额就是它们的手续费。 | long |

### trackedPrices, payeeTrend

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| trackedPrices.empty | Nothing named yet. Add items to a transaction (the Items row on the spend form) and they collect here. | No items yet. Add items when you enter a transaction and they'll show up here. | 还没有记录物品。在支出表单的「物品」一栏添加… | 还没有物品。记账时添加物品，就会显示在这里。 | "spend form" |
| trackedPrices.guideBody | The Items row on the spend form: type what you actually bought and what each thing cost… | Items you add to transactions, ranked by how often you buy them, with the total spent. Tap one to see its price over time. | 来自记账表单上的「物品」一栏… | 你在交易里添加的物品，按购买次数排序并显示总花费。点按查看价格变化。 | long; repeats `hint` |
| trackedPrices.guideBottomBody | A category tells you groceries cost $600 this month. An item tells you the coffee went from $14 to $19 since spring… | A category says groceries cost $600. An item says your coffee went from $14 to $19 since spring. Add only the items worth watching. | 分类只能告诉你… | 分类只告诉你食杂花了 600 元；物品会告诉你咖啡从春天的 14 元涨到了 19 元。只记值得关注的几样就好。 | long |
| payeeTrend.guideBody | The other half of a category: not what kind of spending it was, but whose hand it ended up in… on-budget account. | Who your money goes to, ranked by the last year's spending, each with monthly bars. Transfers and income aren't included. | 这是分类的另一面… 预算内账户流出的钱。 | 你的钱都付给了谁：按过去一年的支出排序，每个都有月度柱状图。不含转账和收入。 | long; "on-budget" |
| payeeTrend.guideBottomBody | A category tells you groceries cost $600 a month and leaves you nowhere to go… | A payee shows what a category hides: that most of it goes to one shop, a bill that keeps rising, or a subscription you forgot. A flat line you don't recognize is usually something to cancel. | 分类告诉你「买菜每月 600」，然后你就无从下手了… | 收付方能看出分类看不到的东西：大部分钱花在了哪家店、哪笔账单在涨、哪个订阅被你忘了。认不出的平直线，通常就该退订了。 | long |
| payeeTrend.paymentsCount | {count} payments | Payments: {count} | — | — | "1 payments" |
| payeeTrend.shareOfSpending | {percent}% of spend | {percent}% of spending | — | — | match totalOverWindow |
| payeeTrend.lastMonthUp | Last month ran {percent}% above their own average. | Last month was {percent}% above average. | 上个月比它自己的平均水平高出 {percent}%。 | 上个月比平均高 {percent}%。 | "their own" |
| payeeTrend.lastMonthDown | Last month ran {percent}% below their own average. | Last month was {percent}% below average. | 上个月比它自己的平均水平低了 {percent}%。 | 上个月比平均低 {percent}%。 | same |
| payeeTrend.smallerPayments | All the rest (smaller payments) | Smaller payees | 其余的（占比较小） | 其他较小的收付方 | wordy |
| payeeTrend.payeeCount | {count} payees | Payees: {count} | {count} 个收款方 | {count} 个收付方 | plural; glossary |
| payeeTrend.topPayee | = | = | 最大收款方 | 花得最多的收付方 | glossary |
| payeeTrend.othersHeading | = | = | 其他收款方 | 其他收付方 | glossary |
| payeeTrend.rowDetail | All time avg {average} per payment, across {months} months, including months with no payment. | Average {average} per payment over {months} months. | — | {months} 个月内平均每笔 {average}。 | wordy |
| payeeTrend.unnamed | {amount} of spending named no payee, so it is not on this page. Add one on the spend form and it joins the ranking. | {amount} of spending has no payee, so it isn't shown. Add a payee to include it. | …在支出表单里补上名字… | 还有 {amount} 的支出没有收付方，未显示在这里。补上收付方即可计入。 | "spend form" |
| payeeTrend.empty | No payees yet. Name who you paid on a transaction and they collect here, with what they cost you month by month. | No payees yet. Add who you paid on your transactions and they'll show up here. | 还没有收款方… | 还没有收付方。在交易里填上付给了谁，就会显示在这里。 | glossary |

### spend, purchaseItems, repeatField, addTransactionModal

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| spend.addTitle | Add Transaction | Add transaction | — | — | case |
| spend.editTitle | Edit Transaction | Edit transaction | — | — | case |
| spend.payeePlaceholder | = | = | 收款方 | 收付方 | glossary |
| spend.payeeSearchPlaceholder | = | = | 搜索或输入新的收款方 | 搜索或输入新的收付方 | glossary |
| settings.payeeSearchPlaceholder | = | = | 搜索或输入新的收款方 | 搜索或输入新的收付方 | glossary |
| spend.paidFromPlaceholder | Paid from account | Account | — | 账户 | wrong for income |
| spend.advanced | Advanced | More details | — | — | "Advanced" is dev-ish; en/zh mismatch |
| spend.itemsSection | Purchase items | Items | 购买物品 | 物品 | glossary |
| spend.deleteTransaction | Delete Transaction | Delete transaction | — | — | case |
| spend.deleteConfirmTitle | = | = | 删除该交易？ | 删除这笔交易？ | match review |
| repeatField.onDaysLabel | = | = | 在这些天 | 重复日 | translationese |
| addTransactionModal.endDateLabel | End Date | End date | — | — | case |

### financeTools, calculators (titles), canadaPurchase, requiredIncome

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| financeTools.equity | = | = | 净资产 | 净值 | clashes with net worth |
| financeTools.totalValue | = | = | 总市值 | 总值 | values are entered, not market |
| financeTools.inputs | Inputs | Your numbers | 输入 | 填写 | jargon |
| financeTools.enterInputs | Fill the inputs above to see the numbers. | Fill in the fields above to see results. | 填好上面的输入项就能看到结果。 | 填好上面各项即可看到结果。 | "inputs" |
| financeTools.modeBiweekly | Biweekly | Every two weeks | — | — | clashes with "Bi-weekly" |
| financeTools.addBracket | = | = | ＋ 加一档 | + 添加一档 | full-width + |
| financeTools.accountMissingValue | This account doesn't have that set yet — add it on the account to pull it in. | This account doesn't have this yet. Add it on the account page first. | — | — | "pull it in" |
| financeTools.bracketTopBand | top band | top bracket | — | — | consistency |
| canadaPurchase.paymentPerMonthEquivalent | Same, spread per month | Per month | — | — | awkward |
| calcCanadaPurchase.title | Home Purchase (Canada) | Home purchase (Canada) | — | — | case |
| calcRequiredIncome.title | Required Income | Income needed | — | — | case |
| calcPayoff.title | Mortgage Payoff | Mortgage payoff | — | — | case |
| calcAffordability.title | House Affordability | What house can I afford | — | — | case; plainer |
| calcPrepay.title | Early Repayment (China) | Early repayment (China) | — | — | case |
| calcRentVsBuy.title | Rent vs Buy | Rent or buy | — | — | case |
| calcRentVsBuy.subtitle | Net position year by year, including what the down payment could earn | Which comes out ahead, year by year | 逐年对比净头寸… | 逐年看哪种更划算 | "net position", 头寸 |
| calcLoanPayoff.title | Loan Payoff | Loan payoff | — | — | case |
| calcAutoLoan.title | Auto Loan | Car loan | — | — | case; plainer |
| calcDti.title | Debt-to-Income | Debt-to-income | — | — | case |
| calcCompound.title | Compound Interest | Compound interest | — | — | case |
| calcTaxSavings.title | Tax Deduction Savings | Tax saved by a deduction | 税前扣除节税 | 抵扣能省多少税 | case; plainer |
| calcAmortization.title | = | Payment schedule | — | — | jargon (matches amortizationSchedule) |

### nav, history

| key | current en | proposed en | current zh | proposed zh | why |
|---|---|---|---|---|---|
| nav.history | = | = | 历史记录 | 历史 | match history.title |
| history.open | Change History & Snapshots | History | 变更历史与快照 | 历史 | case; match screen title |
| history.snapshotsHint | A copy of the whole database, taken before anything that rewrites existing rows. Use one when you do not know what went wrong, or when the shape of the data changed… | Full copies of your data, saved automatically before big changes like an import or app update. Restore one if something went wrong and you're not sure what. | 在任何会改写既有数据的操作之前，对整个数据库做的完整备份… | 在导入、应用更新等大改动前自动保存的完整副本。出了问题又不确定原因时，可以恢复。 | "database", "rows", "shape" |
| history.snapshotNow | + Snapshot Now | + Take snapshot | — | — | case |
| history.snapshotManual | Taken by hand · {size} | Manual · {size} | — | — | wordy |
| history.snapshotBeforeMigration | Before update v{from} → v{to} · {size} | Before app update · {size} | 升级 v{from} → v{to} 之前 · {size} | 应用更新前 · {size} | schema versions are internal |
| history.restoreSnapshotMessage | The whole database goes back to how it was then. Everything since is lost. Close and reopen the app straight after. | All your data goes back to that moment; changes since are lost. Close and reopen the app afterwards. | 整个数据库会回到当时的状态… | 所有数据会回到当时的状态，之后的改动都会丢失。恢复后请关闭并重新打开应用。 | "database" |
| history.changesHint | Every row written, recorded by the database itself — including by updates to the app… | Every change to your data, including ones made by app updates. Undoing is recorded too, so you can undo an undo. | 由数据库自己记录的每一次行改动… | 你数据的每一次改动，包括应用更新做出的改动。撤销也会被记录，可以再撤销。 | "row", "database" |
| history.tableScheduled | recurring transactions | scheduled transactions | 周期交易 | 定期交易 | glossary |
| history.tableValueHistory | = | = | 价值记录 | 估值记录 | glossary |
| history.rowCount | {count} rows | {count} changes | {count} 行 | {count} 项改动 | "rows" |
| history.rewind | Rewind to here | Undo back to here | 回退到此处 | 撤销到这里 | "rewind" |
| history.rewindConfirmMessage | Everything written from this point on is put back, newest first — use this for an import or a repair, which land as many entries rather than one… | Undoes every change from here on, newest first. Handy for undoing an import or a fix in one go. This can be undone too. | 从这里开始的所有改动都会按从新到旧的顺序还原… | 撤销从这里开始的所有改动（从新到旧）。适合一次撤销整个导入或修复。此操作也可以再撤销。 | "written", "land" |
| history.undoConfirmTitle | Undo {count} rows in {table}? | Undo {count} changes to {table}? | 撤销 {table} 中的 {count} 行？ | 撤销{table}的 {count} 项改动？ | "rows" |
| history.undoConfirmMessage | Those rows go back to what they were. This is recorded too, so it can be undone again. | They go back to how they were. You can undo this too. | 这些行会恢复成原来的样子… | 它们会恢复原样。此操作也可以再撤销。 | "rows" |

### zh-only fixes (en fine)

| key | current zh | proposed zh | why |
|---|---|---|---|
| aiAnalysis.profileHint | "财务健康"与"对比" | 「财务健康」与「与他人对比」 | quotes |
| common.secretLengthHint | 共 {count} 个字符 —— 这类密钥通常是 {expected} 个。 | 共 {count} 个字符——这类密钥通常是 {expected} 个。 | dash spacing |
| s3ConfigModal.pasteHint / keyPrefixPlaceholder / draftsHint, aiHistory.hint, backup.icloudNotReady, financeTools.* (biweeklyNote, frontEndHint, backEndHint, neverBreaksEven, refinanceNote, compoundNote, bracketHint, accountMissingValue) | ` —— ` | `——` | dash spacing (one pass) |
| settings.creatingDemoBoard, budget.breakdownAhead | …… | … | ellipsis for status text |
| settings.purgeBackupsMessage, settings.removeAllDataConfirmMessage, backup.infoDestination, settings.purgeResultICloud | iCloud Drive | iCloud 云盘 | Apple zh name, matches backup.icloud |
| investmentGrowth.depositedLabel | 存入本金 | 存入 | 本金 is a loan term |
| accountGuide.savings.helps | 「财务七步」 | 「理财七步」 | glossary (the tab row says 理财七步) |
| review.fixSelected | 修复 {count} 项 | 修复 {count} 笔 | 笔 for transactions |
| housing.derivedNote | 外加每月 250 元水电杂费 | 外加每月 $250 水电杂费 | amounts are in the app's currency, not RMB |
| budget.categoryNamePlaceholder | 例如 🛒 日用百货 | 例如 🛒 食杂 | matches the 食杂 wording used in guides |

## 3. Hardcoded literals

Nothing below goes through `t()`, so zh users see English.

| file:line | current | proposed |
|---|---|---|
| src/domain/budgetMath.ts:82 | `Overspent by ${…}` | key `budget.captionOverspent`: "Overspent by {amount}" / "超支 {amount}" |
| src/domain/budgetMath.ts:84 | `Not budgeted` | `budget.captionUnassigned`: "Nothing assigned" / "未分配" |
| src/domain/budgetMath.ts:86 | `Fully spent ${…}` | `budget.captionFullySpent`: "Spent all {amount}" / "已全部花完 {amount}" |
| src/domain/budgetMath.ts:89 | `Spent ${…} of ${…}` | `budget.captionSpentOf`: "Spent {spent} of {assigned}" / "已花 {spent}，共 {assigned}" |
| src/domain/budgetMath.ts:90 | `Funded` | `budget.captionFunded`: "Ready to spend" / "可以花了" |
| src/components/ui/DropdownField.tsx:52 | `placeholder = 'Select…'` | `common.select`: "Choose…" / "请选择…" |
| src/components/ui/SearchableDropdownField.tsx:94 | `placeholder = 'Select…'` | `common.select` (same) |
| src/components/ui/S3BrowserModal.tsx:236 | `t('s3Browser.up')` → `'..'` | see s3Browser.up above |
| src/components/ui/S3BrowserModal.tsx:246 | `toLocaleDateString()` (device default) | pass the app locale, like DateField |
| src/screens/tax/TaxInsightsScreen.tsx:26 | `{ code: 'CA', name: 'Canada' }` | key `country.CA`: "Canada" / "加拿大" |
| src/screens/tax/TaxInsightsScreen.tsx:27–40 | province names hardcoded in English | use the existing `province.*` keys; add NT, NU, YT ("Northwest Territories" / 西北地区, "Nunavut" / 努纳武特地区, "Yukon" / 育空地区) |
| src/screens/tax/TaxInsightsScreen.tsx:61 | `toLocaleDateString('en-US', …)` | use the app locale; zh deadlines currently read "April 30, 2027" |
| src/secure/appLock.ts:46–47 | `'Face ID'`, `'Touch ID'` | keys: "Face ID" / "面容 ID", "Touch ID" / "触控 ID" |
| src/sync/parseBackupZip.ts:48 | `Not a recognized backup — pick the .zip from Settings’ "Export Board as .zip".` | "This isn't a Budgets Bro backup. Choose a .zip made with Export this budget." / "这不是 Budgets Bro 的备份。请选择用「导出当前账本」生成的 .zip。" — names a button that doesn't exist |
| src/import/pickYnabExport.ts:45, src/import/pickAppExport.ts:28 | `That file could not be read.` | "Couldn't open that file." / "无法打开该文件。" |
| src/import/pickYnabExport.ts:51 | `No Register CSV found inside the zip.` | "This doesn't look like a YNAB export. Choose the .zip from YNAB's Export budget." / "这不像是 YNAB 导出文件，请选择 YNAB「导出预算」生成的 .zip。" |
| src/import/appExportImporter.ts:19 | `${name} (Imported)`, `'Imported Board'` | "{name} (restored)" / "{name}（恢复）", "Restored budget" / "恢复的账本" |
| src/sync/s3Provider.ts:248, 250, 251, 295, 299 | `Bucket unreachable — …` (+ raw status/XML) | "Can't reach this bucket. Check the name." / "无法访问该存储桶，请检查名称。" — keep raw detail out of the UI |
| src/sync/s3Provider.ts:260, 280–281 | `Bucket allows anonymous (unsigned) access — restrict its bucket policy/ACLs` / `…enable "Block all public access"…` | "This bucket is public. Turn on “Block all public access” in AWS, then try again." / "该存储桶是公开的。请在 AWS 中开启「阻止所有公共访问」后重试。" |
| src/sync/s3Provider.ts:300 | `Could not determine the bucket's region — check the bucket name.` | "Couldn't find this bucket. Check the name." / "找不到该存储桶，请检查名称。" |
| src/sync/s3Provider.ts:324 | `Wrote a test object but could not read the same bytes back` | "The keys can write but not read. Give them read access too." / "密钥只能写入不能读取，请同时授予读取权限。" |
| src/sync/s3Provider.ts:215, 221, 228, 389, 421 | `S3 PUT/DELETE/GET/list failed: ${status} ${body}` | "Backup to {bucket} failed ({status}). Try again later." / "备份到 {bucket} 失败（{status}），请稍后重试。" — shown on the row via S3BrowserModal:109 |
| src/sync/s3Provider.ts:451–543 | `S3 config not found`, `S3 config "…" is missing its credentials` | "This backup's keys are missing. Remove it and add it again." / "此备份的密钥丢失，请移除后重新添加。" |
| src/ai/openaiCompatibleClient.ts:32–58, anthropicClient.ts:41–63, googleClient.ts:37–59 | `Network request to X failed.`, `X rejected the API key.`, `X rate-limited this request.`, `Unexpected response shape from X.` | surface via `aiKeyModal.testFailed`: reuse `aiAnalysis.error*` wording; "Unexpected response shape" → "{vendor} sent an answer the app couldn't read." / "{vendor} 返回的内容无法识别。" |
| src/ai/aiKeys.ts:222 | `No AI key configured.` | reuse `aiAnalysis.noKeyHint` |
| src/db/repositories/transactionsRepo.ts:470 | payee `'Balance Adjustment'` | localized at creation: "Balance adjustment" / "余额调整" (en doc and zh accountInfo already name it) |
| src/db/repositories/accountsRepo.ts:177, 206 | group `'Loan Payments'` | "Loan payments" / "贷款还款" |
| src/hooks/useBoards.ts:87, 92 | new budget seeds `'Cash'`, `'Savings'` | `accountModal.typeCash` / `typeSavings` → 现金 / 储蓄 |
| src/db/seed/demoBoard.ts:12 | `DEMO_BOARD_NAME = 'Demo'` | "Demo" / "演示" (demo payee/category names can stay English: they're sample data) |
