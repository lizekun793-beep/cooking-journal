# 做菜手帐

个人做菜记录 / 菜谱手帐，暖纸色 scrapbook × 吉卜力厨房插画。Vite + React 18 + TypeScript。浏览器把数据存在 `localStorage`；Android 包装（Capacitor）把快照写到应用私有文件，避免照片撑爆 WebView 配额。没有云端账号或业务服务器。

## 运行

```bash
cd cooking-journal-app
npm install
npm run dev
```

终端会打印本地地址（默认 `http://localhost:5173`）。用手机宽度看最贴近设计稿。

生产构建与测试：

```bash
npm test
npm run build
npm run preview
```

## 页面

| 路径 | 说明 |
|---|---|
| `/` | 首页目录：筛选、列表、背景切换 |
| `/recipe/:id` | 菜谱详情 |
| `/new` | 记下这道菜（自由做法） |
| `/edit/:id` | 编辑手帐 |
| `/share`、`/share/:id` | 分享卡片（视觉待定稿） |
| `/categories` | 分类占位 |
| `/profile` | 我的：厨房背景、整理筛选、导出/导入备份、版本更新 |

首页厨房背景可在「默认 / 男生做饭」间切换，选择会记住。

## 数据

网站仍使用这三个键（迁移到 App 时只读、不删除）：

- `cooking-journal.recipes`
- `cooking-journal.bg`
- `cooking-journal.custom-bgs`

首次打开且没有任何本地记录时写入 4 道示例（红烧肉、蒜蓉西兰花、葱油拌面、番茄牛腩炖土豆）。上传的实拍会压成 JPEG。Android 上完整快照在 `Directory.Data` 的 `journal/snapshot.json`，并保留 `snapshot.prev.json` 作为上一份恢复副本。

「我的 → 数据与版本」可导出/导入带照片的 JSON 备份，并在半屏里检查同一仓库 `lizekun793-beep/cooking-journal` 的 GitHub Release。导入前会确认，格式或图片地址不合法时不会覆盖现有手帐。

## Android

包名 `cn.kitchenjournal.app`，加载打包后的 `dist/`，不指向远程 `server.url`。步骤、签名备份、GitHub 发行与网站↔APK 导入手帐见 [docs/android.md](docs/android.md)。
