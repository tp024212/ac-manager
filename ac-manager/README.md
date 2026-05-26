# 冷氣安裝管理系統

## 技術架構
- **前端**: React 18 + Vite
- **後端**: Supabase (PostgreSQL + Storage)
- **行動版**: Capacitor (Android APK)

---

## 第一步：Supabase 初始化

### 1. 建立資料表（SQL Editor）

```sql
create table customers (
  id text primary key,
  name text not null,
  company text default '',
  phone text default '',
  email text default '',
  address text default '',
  notes text default '',
  created_at bigint
);

create table quotes (
  id text primary key,
  customer_id text,
  items jsonb default '[]',
  notes text default '',
  discount numeric default 0,
  subtotal numeric default 0,
  total numeric default 0,
  status text default 'pending',
  created_at bigint,
  updated_at bigint
);

create table installations (
  id text primary key,
  quote_id text,
  customer_id text,
  status text default 'active',
  stages jsonb default '{}',
  photos jsonb default '{}',
  created_at bigint
);

alter table customers disable row level security;
alter table quotes disable row level security;
alter table installations disable row level security;
```

### 2. 建立 Storage Bucket
- Supabase → Storage → New Bucket
- 名稱：`ac-photos`
- 勾選 **Public bucket**

---

## 第二步：本地開發

```bash
npm install
npm run dev
# 開啟 http://localhost:5173
```

---

## 第三步：部署到 Vercel（網頁版）

```bash
# 方法一：GitHub + Vercel（建議）
# 1. 把這個資料夾上傳到 GitHub
# 2. 前往 https://vercel.com → New Project → Import GitHub repo
# 3. 設定 Framework = Vite，點 Deploy
# 4. 完成！Vercel 會給你一個 https://xxx.vercel.app 網址

# 方法二：Vercel CLI
npm install -g vercel
vercel
```

---

## 第四步：打包 Android APK

### 前置需求
- [Node.js 18+](https://nodejs.org)
- [Android Studio](https://developer.android.com/studio)（含 Android SDK）
- Java JDK 17+

### 步驟

```bash
# 1. 安裝 Capacitor CLI
npm install -g @capacitor/cli

# 2. 建置 Web App
npm run build

# 3. 初始化 Capacitor（首次）
npx cap init "冷氣安裝管理" "com.acmanager.app" --web-dir dist

# 4. 加入 Android 平台（首次）
npx cap add android

# 5. 同步到 Android
npx cap sync android

# 6. 在 Android Studio 開啟
npx cap open android
```

### 在 Android Studio 產生 APK
1. 等待 Gradle 同步完成
2. 選單 → **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. APK 位置：`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 更新 App 流程

每次修改程式碼後：
```bash
npm run build
npx cap sync android
# 再從 Android Studio Build APK
```

---

## PWA 安裝（免 APK，更簡單）

部署到 Vercel 後，用 Android Chrome 開啟網址：
- 點選瀏覽器選單 → **新增到主畫面**
- App 會出現在桌面，像原生 App 一樣全螢幕運行
