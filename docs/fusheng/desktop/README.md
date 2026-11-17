# 浮生千年 Windows 桌面版

把 `docs/fusheng/` 的網頁版包成 Windows 程式，內容完全沿用（規則、事件、圖片）。

```
npm install      # 第一次
npm start        # 直接開視窗試玩
npm run pack     # 產生 dist/FushengMillennia-win32-x64/FushengMillennia.exe
```

- `F11` 或 `Alt+Enter` 切換全螢幕；遊戲的「系統」裡也有全螢幕與離開。
- 字型在打包時放進程式裡，沒有網路也能正常顯示。
- 存檔除了留在程式內，還會另寫到 `%AppData%\浮生千年\saves\*.json`，給 Steam 雲端同步。
- Steam 成就：放一個 `steam_appid.txt`（內容是 App ID）並開著 Steam 才會啟用，否則自動略過。
- 路徑太深時 Windows 會安裝失敗，請把這個資料夾複製到較短的路徑再安裝。
- 上架步驟見 `steam/上架清單.md`。
