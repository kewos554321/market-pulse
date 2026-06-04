# CI/CD Cloudflare 自動部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push 到 GitHub `main` branch 後，自動部署 `api/`（Cloudflare Workers）與 `web/`（Cloudflare Pages）。

**Architecture:** 單一 GitHub Actions workflow 檔案，包含兩個並行 job（deploy-api、deploy-web），分別用 `wrangler deploy` 和 `wrangler pages deploy` 部署。Cloudflare 認證透過 GitHub Secrets 注入。

**Tech Stack:** GitHub Actions, wrangler CLI v4, Cloudflare Workers, Cloudflare Pages, Vite

---

## 檔案結構

- **建立：** `.github/workflows/deploy.yml`

---

### Task 1: 手動準備 — 取得 Cloudflare 憑證

> 這是手動操作步驟，不需要寫程式。

**Files:**
- 無（全部在 Cloudflare Dashboard 與 GitHub Settings 操作）

- [ ] **Step 1: 取得 Cloudflare Account ID**

  1. 登入 [https://dash.cloudflare.com](https://dash.cloudflare.com)
  2. 右側邊欄可直接看到 **Account ID**（32 位英數字串）
  3. 複製並記下來

- [ ] **Step 2: 產生 Cloudflare API Token**

  1. Cloudflare Dashboard → 右上角頭像 → **My Profile**
  2. 左側選 **API Tokens** → **Create Token**
  3. 選擇模板 **"Edit Cloudflare Workers"** → Use template
  4. 在 **Permissions** 區塊，點 **+ Add more** 加入：
     - `Account` → `Cloudflare Pages` → `Edit`
  5. **Account Resources** 設為 `Include - All accounts`
  6. **Zone Resources** 設為 `Include - All zones`
  7. 點 **Continue to summary** → **Create Token**
  8. 複製產生的 token（只顯示一次）

- [ ] **Step 3: 設定 GitHub Secrets**

  1. 前往你的 GitHub repo → **Settings** → **Secrets and variables** → **Actions**
  2. 點 **New repository secret**，新增：
     - Name: `CLOUDFLARE_API_TOKEN`，Value: 上一步複製的 token
  3. 再次點 **New repository secret**，新增：
     - Name: `CLOUDFLARE_ACCOUNT_ID`，Value: Step 1 取得的 Account ID

- [ ] **Step 4: 在 Cloudflare 建立 Pages 專案**

  1. Cloudflare Dashboard → **Workers & Pages** → **Create**
  2. 選 **Pages** → 選 **Direct Upload**（不要選 Connect to Git）
  3. 輸入專案名稱：`market-pulse-web`
  4. 點 **Create project**（不需要上傳檔案，只是建立空專案）

---

### Task 2: 建立 GitHub Actions Workflow

**Files:**
- 建立：`.github/workflows/deploy.yml`

- [ ] **Step 1: 確認 `.github/workflows/` 目錄存在**

  ```bash
  ls .github/workflows/
  ```

  預期輸出：看到 `scheduler.yml`（已存在）

- [ ] **Step 2: 建立 `deploy.yml`**

  建立 `.github/workflows/deploy.yml`，內容如下：

  ```yaml
  name: Deploy to Cloudflare

  on:
    push:
      branches: [main]

  jobs:
    deploy-api:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
        - run: npm ci
          working-directory: api
        - run: npx wrangler deploy
          working-directory: api
          env:
            CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
            CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

    deploy-web:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
        - run: npm ci
          working-directory: web
        - run: npm run build
          working-directory: web
        - run: npx wrangler pages deploy dist --project-name=market-pulse-web
          working-directory: web
          env:
            CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
            CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  ```

- [ ] **Step 3: Commit 並 push**

  ```bash
  git add .github/workflows/deploy.yml
  git commit -m "feat: add Cloudflare auto-deploy GitHub Actions workflow"
  git push origin main
  ```

---

### Task 3: 驗證部署成功

**Files:**
- 無（觀察 GitHub Actions 與 Cloudflare Dashboard）

- [ ] **Step 1: 確認 workflow 有被觸發**

  1. 前往 GitHub repo → **Actions** tab
  2. 看到名稱為 **"Deploy to Cloudflare"** 的 workflow run 正在執行（或已完成）

- [ ] **Step 2: 確認 deploy-api 成功**

  1. 點進 workflow run → 展開 **deploy-api** job
  2. 最後一步 `npx wrangler deploy` 應該輸出類似：
     ```
     Uploaded market-pulse-api (X.XXs)
     Deployed market-pulse-api triggers (X.XXs)
     ```
  3. Cloudflare Dashboard → **Workers & Pages** → 找到 `market-pulse-api`，確認 Last deployed 時間更新

- [ ] **Step 3: 確認 deploy-web 成功**

  1. 點進 workflow run → 展開 **deploy-web** job
  2. 最後一步 `wrangler pages deploy` 應該輸出類似：
     ```
     ✨ Deployment complete! Take a peek over at https://xxxxxx.market-pulse-web.pages.dev
     ```
  3. Cloudflare Dashboard → **Workers & Pages** → 找到 `market-pulse-web`，確認有 deployment 紀錄

- [ ] **Step 4: 若 deploy 失敗，常見原因排查**

  | 錯誤訊息 | 解法 |
  |---|---|
  | `Authentication error` | 確認 `CLOUDFLARE_API_TOKEN` secret 有設定且 token 有 Pages 權限 |
  | `Could not find Pages project market-pulse-web` | 確認在 Cloudflare Dashboard 有建立 `market-pulse-web` 專案 |
  | `Build failed` in deploy-web | 本地執行 `cd web && npm run build` 確認可以 build 成功 |
  | `wrangler: not found` | `npx wrangler` 應自動下載，確認 `api/package.json` 有 wrangler devDependency |
