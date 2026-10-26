# 六角籠舍世界與全模式 HUD 重構：Phase 1 盤點（2026-10-27）

分支 `feat/hex-raising-hud-20261027`（自 main `b02ccf12`）。首頁、Logo、主選單、開場不在範圍內，以線上 main 為準（比對結果：三種視窗 0 差異）。

## 沿用（不改）

| 項目 | 路徑 |
|---|---|
| 首頁／主選單／開場／標題遊行 | `src/championship/app/titleParade.js`、`src/championship/app/main.js` 的 title 區段、`ui/screenLayout.css` Title 段 |
| 六角世界規則（24×24、100 格上限、同型邊合併、走路） | `src/championship/cage/productRanchGrid.js`、`ranchConnections.js`、`ranchEcology.js` |
| 世界↔原生座標（52° 佈局） | `src/championship/presentation/ranchThreeCoordinates.js` 的 `ranchNativeToWorld` |
| 籠舍 GLB 母檔 | `assets/production/cage/three-20261021/*.glb`（未修改） |
| 角色動作／音效 | 角色 runtime bundle、`src/championship/app/ui/arcadeFx.js`（`cm-fx`） |
| 戰鬥規則與 AI | `src/championship/app/battleRuntime.js` 等，不變 |
| 存檔 | `championshipStandaloneSave.js`，同一個 key |

## 修改（本批已做）

| 項目 | 路徑 |
|---|---|
| 相機仰角可切換 35/40/45/52（世界不變，只改視角） | `ranchThreeCoordinates.js`（`ranchViewProjection`）、`ranchThreeScene.js`、`main.js`（`?ranchPitch=`） |
| 螢幕↔地面換算與點選在各仰角下精確 | `intRh2/raisingFieldViewport.js`（`scaleY`）、`intRh2/createRaisingFieldPixiPresentation.js`、`ranchContactHeight.js`、`ranchGroundShadows.js` |
| 接觸陰影加深（.26 → .36） | `ranchGroundShadows.js` |
| 測試同步 | `tests/championship-ranch-shadow-depth-cases.mjs`、`tests/championship-ranch-v4-captured-roundtrip-cases.mjs`、`tests/championship-ranch-v4-runtime-regression-cases.mjs`、`tests/ci-test-scope.v1.json` |

## 新增（本批已做）

| 項目 | 路徑 |
|---|---|
| 程序化六角底座（上緣框、斜面底盤、佔位格薄邊、落地陰影） | `src/championship/presentation/ranchPlinth.js` |
| 仰角／點選／底座測試 | `tests/championship-ranch-view-pitch-cases.mjs` |
| HUD 技能與入口 | `.claude/skills/juicy-monster-ui/SKILL.md`、`CLAUDE.md` |

## HUD 版面重排計畫（下一批）

1. 頂部戰術視窗列：`championshipStatusBar.js`、`raisingHomeHud.css`、`intRh2Styles.css`。貨幣與次要膠囊改成有間距的直向堆疊，長數值縮字不換行。
2. 育成／建造底部指令列與六角格托盤：`championshipToolbar.js`、`hexWorldEditor.js`、`ui/arcade.css`；建造模式可選 300 ms 轉到 45–48°。
3. 夥伴檢視抽屜：`raisingHomeP1RView.js`（保留 `int-rh2-*` id 與 data hook）。
4. 狩獵捕獲視窗：`vs2Screens.js`、`gateHuntPresentationSource.js`、`huntMobile.css`。
5. 轉播式戰鬥 HUD：`vs5Screens.js`、`vs5Styles.css`；Data Arena（`dataArenaScreen.js`）維持自己的規則。
6. 商店／圖鑑主從版面：`vs4Screens.js`。
7. 進化湧動：只接 `lifecycle.evolution` 與 `int-rh2-evolution-choice` 的真實事件。

## 阻礙與待決

- 預設仰角：等 Owner 從 45°／40°／35° 截圖選定後，改 `RANCH_DEFAULT_VIEW_PITCH`（目前仍為 52°，所以預設畫面與線上相同）。
- 「12/12」容量膠囊：在目前 QA 存檔、四種視窗中都找不到這個膠囊，也沒有和貨幣膠囊重疊的情形；需要 Owner 提供出現的畫面或存檔。
- 專案沒有「客服」圖示，不另外編造。
- 新模組 `ranchPlinth.js` 發佈前要加入 `PUBLIC_RUNTIME_ALLOWLIST` 並更新 `WEB_BUILD_INPUTS`。
