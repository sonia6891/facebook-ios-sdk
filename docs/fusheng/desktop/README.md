# 浮生千年 Windows 桌面版

把 `docs/fusheng/` 的網頁版包成 Windows 程式，內容完全沿用（規則、事件、圖片）。

```
npm install      # 第一次
npm start        # 直接開視窗試玩
npm run pack     # 產生 dist/FushengMillennia-win32-x64/FushengMillennia.exe
```

- `F11` 或 `Alt+Enter` 切換全螢幕。
- 存檔在使用者的應用程式資料夾，重開程式仍在；也可在遊戲的「系統」匯出。
- 路徑太深時 Windows 會安裝失敗，請把這個資料夾複製到較短的路徑再安裝。
- 尚未接 Steam（成就、雲端存檔需要 Steam 的 App ID）。
