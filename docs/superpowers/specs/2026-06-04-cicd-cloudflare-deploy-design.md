# CI/CD — Cloudflare 自動部署設計

**日期：** 2026-06-04  
**狀態：** 已核准，待實作

## 目標

Push 到 GitHub `main` branch 後，自動部署：
- `api/` → Cloudflare Workers
- `web/` → Cloudflare Pages

## 架構概覽

單一 workflow 檔案 `.github/workflows/deploy.yml`，包含兩個並行 job，互不依賴。

```
push to main
     │
     ├── deploy-api  (Cloudflare Workers)
     │     1. checkout
     │     2. setup Node 20
     │     3. cd api && npm ci
     │     4. wrangler deploy
     │
     └── deploy-web  (Cloudflare Pages)
           1. checkout
           2. setup Node 20
           3. cd web && npm ci && npm run build
           4. wrangler pages deploy dist/
```

## GitHub Secrets

需在 GitHub repo → Settings → Secrets and variables → Actions 新增：

| Secret 名稱 | 說明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token，需有 Workers + Pages 編輯權限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

## 事前準備步驟

### 1. 取得 Cloudflare Account ID
登入 Cloudflare Dashboard，右側邊欄直接顯示 Account ID。

### 2. 產生 Cloudflare API Token
1. Cloudflare Dashboard → My Profile → API Tokens → Create Token
2. 選用 **"Edit Cloudflare Workers"** 模板
3. 額外加上權限：`Cloudflare Pages: Edit`
4. Zone Resources 設為 `All zones`
5. 建立並複製 token

### 3. 設定 GitHub Secrets
1. GitHub repo → Settings → Secrets and variables → Actions
2. New repository secret：`CLOUDFLARE_API_TOKEN`
3. New repository secret：`CLOUDFLARE_ACCOUNT_ID`

### 4. 建立 Cloudflare Pages 專案
1. Cloudflare Dashboard → Workers & Pages → Create → Pages
2. 選擇 **Direct Upload**（不連結 Git，由 wrangler CLI 部署）
3. 專案名稱：`market-pulse-web`

## Workflow 檔案

路徑：`.github/workflows/deploy.yml`

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

## 行為說明

- 兩個 job 並行執行，deploy 失敗互不影響
- 只有 push 到 `main` 才觸發（PR 不觸發）
- `api/` 的 D1 migrations 不在此 workflow 中自動執行，需手動執行 `npm run migrate:prod`
- Logs 統一在 GitHub Actions 查看

## 不在此 spec 範圍內

- D1 schema migrations 的自動化
- 路徑過濾（只改 api/ 才部署 api/）
- Staging / Preview 環境
