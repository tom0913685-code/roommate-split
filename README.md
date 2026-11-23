# Circle & Sparrow 的分帳小本本

在 LINE 裡打開的室友分帳網頁。兩位成員都可以記帳，資料存在 Google 試算表；拿到連結的其他人只能看、不能改。

## 架構

```
LINE（LIFF）── 網頁 index.html（GitHub Pages）── Apps Script（apps-script/Code.gs）── Google 試算表
```

| 檔案 | 用途 |
|---|---|
| `index.html` | 網頁本體（上方 `LIFF_ID`、`API_URL` 兩個設定要填） |
| `circle.png`、`sparrow.png` | 頭像 |
| `apps-script/Code.gs` | 後端，貼到 Google 試算表的 Apps Script（上方 `CHANNEL_ID`、`LIFF_ID` 要填） |

## 權限設計

- **讀取**：任何人都可以（觀看模式）。
- **新增／刪除／結算／改比例**：後端會向 LINE 驗證 ID Token，只接受已綁定的兩位成員。
- **綁定成員**：用一次性的邀請連結（7 天內有效）。Circle 的邀請連結由 `setup()` 產生，Sparrow 的由 Circle 在網頁上按「邀請 Sparrow」產生。

## 設定步驟

### 1. GitHub Pages
1. 建立公開 repo `roommate-split`，把這個資料夾的檔案推上去。
2. repo 的 Settings → Pages → Source 選 `Deploy from a branch`，分支選 `main`、資料夾 `/ (root)`。
3. 記下網址：`https://<帳號>.github.io/roommate-split/`

### 2. LINE Developers
1. 到 <https://developers.line.biz/console/> 用 LINE 帳號登入，建立 Provider。
2. 建立可以加 LIFF 的 channel（依後台當下的選項，LINE MINI App 或 LINE Login channel）。
3. 在 channel 裡新增 LIFF app：
   - Size：`Full`
   - Endpoint URL：第 1 步的網址
   - Scopes：勾選 `openid`、`profile`、`chat_message.write`
   - Share target picker：開啟
4. 記下 **LIFF ID** 和 channel 的 **Channel ID**（Basic settings 頁面）。
5. 如果 channel 是「開發中（Developing）」狀態，只有被加為 Tester 的帳號能使用，記得發布（Publish）或把兩人都加為 Tester。

### 3. Google 試算表 + Apps Script
1. 新增一份 Google 試算表，命名為「分帳小本本」。
2. 擴充功能 → Apps Script，把 `apps-script/Code.gs` 的內容整份貼上，填好最上方的 `CHANNEL_ID`、`LIFF_ID`，存檔。
3. 上方函式選單選 `setup`，按「執行」，依提示授權。
4. 執行記錄會印出 **Circle 的邀請連結**，先複製下來。
5. 部署 → 新增部署作業 → 類型選「網頁應用程式」：
   - 執行身分：**我**
   - 誰可以存取：**所有人**
6. 記下網頁應用程式網址（結尾是 `/exec`）。

### 4. 填入設定並上線
1. `index.html` 最上方 `<script>` 裡填入 `LIFF_ID` 和 `API_URL`，推到 GitHub。
2. Circle 在手機 LINE 打開第 3 步的邀請連結 → 綁定完成。
3. 舊紀錄搬家：在電腦用原本的方式打開本機的 `index.html`（瀏覽器裡還留著舊資料），按「複製舊紀錄」；再到線上版登入，「設定 → 匯入舊紀錄」貼上。
4. 在網頁上按「邀請 Sparrow」，傳到聊天室給 Sparrow 點開即可。

## 常見狀況

- **修改 `Code.gs` 之後**：要到「部署 → 管理部署作業」編輯現有部署、版本選「新版本」，網址才會維持不變。
- **需要重新綁定成員**：在 Apps Script 執行 `resetMembers()`，再執行 `setup()`。
- **看到「登入已過期」**：關掉頁面重新打開即可。
