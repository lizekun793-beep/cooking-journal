# Android 包装与发布

本地离线应用，包名固定 `cn.kitchenjournal.app`。Capacitor 读取打包后的 `dist/`，**不要**配置 `server.url`。

源码和 APK 都发布在同一个公开仓库：`github.com/lizekun793-beep/cooking-journal`。不要再建 `cooking-journal-releases`。

当前源码树还没有 `android/` 目录。首次在本机或 CI 执行 `npx cap add android` 后再 `npx cap sync android`。

## 版本

唯一数字来源：`src/app-version.json`

| 字段 | 用途 |
|---|---|
| `versionName` | 对外版本，须与 `package.json` 的 `version` 一致 |
| `versionCode` | Android 整数，**每次上架都必须变大** |
| `appId` | 必须保持 `cn.kitchenjournal.app` |

升级同一安装包必须使用**同一份签名密钥**。换密钥无法覆盖安装。

应用内「当前版本」在 Android 上读 `App.getInfo()` 的已安装 `versionName` / `versionCode`；网页会标明「（网页）」，不会假装是安装包版本。

## 本机构建（生成 android 工程之后）

需要 JDK 21 与 Android SDK。编码阶段不安装它们，也不签名、不推送。

```bash
npm test
npm run build
npx cap add android          # 仅第一次
node scripts/prepare-android-version.mjs
npx cap sync android
cd android
./gradlew assembleDebug      # 调试包
./gradlew assembleRelease    # 发行包，需签名
```

`node scripts/android-build.mjs` 会校验版本号；若还没有 `android/` 则打印上述步骤。

## 签名密钥备份

1. 在离线可信机器生成一次 keystore（不要放进仓库，也不要在此项目里生成）。
2. 备份 `.jks` / `.keystore` 到至少两处离线介质。
3. 记录 `keyAlias` 与密码，和文件分开存放。
4. GitHub Actions 使用仓库 Secrets，不要把密码写进 yaml 或源码：
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
5. 密钥丢失后无法对 `cn.kitchenjournal.app` 做覆盖更新，只能换包名。

本地可复制 `keystore.properties.example` 为 gitignored 的 `keystore.properties`。

## GitHub 工作流（同一仓库）

文件：`.github/workflows/android-release.yml`

- 手动 `workflow_dispatch` 或推送 `v*` 标签触发。
- 权限：`contents: write`。用工作流自带的 `GITHUB_TOKEN` 在**本仓库**创建 GitHub Release（APK + `version.json`）。
- 不需要跨仓库 token，也不要配置 `DIST_GITHUB_TOKEN`。
- 当前 run 仍会上传 artifact `kitchen-journal-apk`。

应用内检查更新读取：

`https://api.github.com/repos/lizekun793-beep/cooking-journal/releases/latest`

用发行资产里的 `version.json` 比较 `versionCode`。404 视为尚无发行版，不会说「已经是最新版本」。下载只接受该仓库的 HTTPS GitHub URL 以及 GitHub 官方资源跳转域名。下载只打开系统浏览器，没有静默安装、没有假进度条、也不会声称安装成功。

## 网站数据迁到 APK

两端都是本地手帐，没有云同步。

1. 在网站「我的 → 数据与版本 → 导出备份」，得到含照片的 JSON。
2. 把文件拷到手机。
3. 打开 Android 应用，同一入口「导入备份」，确认后再写入。
4. 导入前会把当前数据另存恢复副本；格式不对或图片地址不合法时**不会覆盖**现有手帐。
5. 反向（APK → 网站）同样用这份 JSON。

离线不影响备份导入导出。启动时的版本检查是静默的，不会弹出半屏、也不会打断正在编辑的手帐。

Android 上将菜谱快照写在 `Filesystem.Directory.Data`（`journal/snapshot.json`，上一份为 `journal/snapshot.prev.json`），避免把照片推进 WebView 的 localStorage 配额。网站仍用原来的三个 `cooking-journal.*` 键；迁到 App 时只读取这些键，**不会删除**它们。
