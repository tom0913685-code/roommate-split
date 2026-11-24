# 室友分帳小本本（Circle & Sparrow）

## 溝通規則
- **所有回覆、說明、註解一律使用繁體中文。**
- 程式保持簡單易讀；有需要決定的地方先提出選項讓使用者決定。

## 這是什麼
在 LINE 裡打開的室友分帳網頁。Circle、Sparrow 兩人可以記帳，資料存在 Google 試算表；有連結的其他人只能看、不能改。
- 費用類別：水費、電費、瓦斯費、生活開支、其他（其他要填項目名稱）
- 每筆：付款日期、帳單月份、類別、分攤比例（Circle %）、金額、付款人
- 結算：依月份篩選，金流圖顯示「誰付給誰多少」，可傳到 LINE 聊天室
- 「結算完畢」= 把該月紀錄封存到試算表的「已結算」分頁（不刪除）
- 金額四捨五入到整數：Circle 份額先四捨五入，Sparrow = 總額 − Circle

## 已部署的位置
| 項目 | 位置 |
|---|---|
| 網頁（GitHub Pages） | https://tom0913685-code.github.io/roommate-split/ |
| LINE 打開的連結（LIFF） | https://liff.line.me/2012761151-1s9J91ca |
| GitHub repo（公開） | https://github.com/tom0913685-code/roommate-split |
| LIFF ID／Channel ID | `2012761151-1s9J91ca`／`2012761151` |
| 後端 Apps Script 網址 | 見 `index.html` 的 `API_URL` |
| 資料 | 使用者 Google 雲端硬碟的試算表「分帳小本本」（分頁：紀錄、已結算、預設比例） |

## 檔案
- `index.html`：網頁本體（前端全部在這一個檔案）
- `circle.png`（橘白貓）、`sparrow.png`（黑白貓）：頭像，由使用者提供的手繪圖裁切
- `apps-script/Code.gs`：後端。**修改後要請使用者手動貼回 Apps Script，並在「部署 → 管理部署作業」編輯現有部署、選「新版本」**，網址才不會變
- `README.md`：完整設定步驟

## 權限設計
- 讀取：公開
- 寫入：後端用 LINE ID Token 驗證（`https://api.line.me/oauth2/v2.1/verify`），只接受已綁定的成員
- 綁定：一次性邀請碼（7 天有效），存在 Apps Script 的 Script Properties（`member_Circle`、`member_Sparrow`、`invite`）
- 重新綁定：在 Apps Script 執行 `resetMembers()` 再執行 `setup()`

## 推送到 GitHub
- 電腦上的 `gh` 沒有登入。需要推送時，請使用者提供 GitHub token（帳號 tom0913685-code），用完提醒他撤銷。
- 推送方式：`git -c credential.helper= push "https://x-access-token:<TOKEN>@github.com/tom0913685-code/roommate-split.git" main`（不要把 token 存進 remote 或設定檔）

## 目前進度（2026-11-24）
- ✅ 網頁、後端、LIFF、試算表都已上線
- ✅ Circle 已綁定；舊紀錄 3 筆已匯入雲端
- ✅ 手機版表單出框已修正（日期欄位最小寬度、520px 以下改單欄）
- ⬜ LINE Developers channel 發布（Publish）或把 Sparrow 加為 Tester
- ⬜ 邀請 Sparrow 加入（網頁上的「邀請 Sparrow」按鈕）
- ⬜ 使用者撤銷這次對話用過的 GitHub token
