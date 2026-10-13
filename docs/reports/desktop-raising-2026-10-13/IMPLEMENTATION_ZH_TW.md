# 桌面牧場同尺度視口（2026-10-13）

Owner 指定先完成牧場一場景，核心是在同尺度看到更多籠子。dot 規格已由 Library 支援流程 materialize 並開讀：`DESKTOP_LANDSCAPE_AND_OPENING_SPEC_20261013_ZH_TW.md`，4,202 bytes，SHA-256 `04c95a9f4f3e0f0f17b1e868117156e86fc30d2c903a5e1042a22fad5dda0d11`。片頭畫質／預載與其他場景配置不在本批。

## 實作與邊界

- 舊橫向限制來自共享 portrait frame：所有畫面均縮放為390px直向框。現在只有可用尺寸至少1024×600且顯示中的 `RAISING_HOME` 解除該外框；其他畫面與手機直向沿用原布局。現有畫面標記與一個可回收的 DOM observer 驅動切換，不建立新 app／router／store／save。
- 牧場仍使用同一 Pixi Application、ticker、場地、前景與指標轉換。桌面以390×844手機的正常場地390×675作為原像素倍率參考，增加可見寬度；角色／籠子比例、世界座標、碰撞、解鎖與藍蓋板沒有修改。
- 畫布最多顯示既有一圈場地的參考尺度寬度，加原有邊緣padding。超寬視窗不藉重複整圈增加假籠子；現有跨接縫片段與模擬繞環仍保留。
- 既有夥伴卡移到右側，保留原收合／詳細／前後按鈕；八功能仍是一套 DOM 工具列。沒有新側欄模型或全選單重寫。
- 瀏覽器量到由手機切到較矮桌面時，沿用數值垂直偏移會使主排 top=-43px（現代）／-50px（復古）。局部 resize 修正讓桌面主排 top 至少0；同一 fit 同時更新圖片、前景、角色與命中，下方藍蓋板及垂直scroll range保留。

## 同一QA存檔、同一夥伴與倍率的對照

| HUD | 外部寬度 | 畫布 | 每原生像素 | 完整可見已放置籠子 |
|---|---:|---:|---:|---:|
| 現代 | 390 | 390×675 | 2px | 0 |
| 現代 | 1366 | 1366×632 | 2px | 3 |
| 復古 | 390 | 386×689 | 2px | 0 |
| 復古 | 1366 | 1362×639 | 2px | 3 |

這份既有QA存檔只有3個已放置籠子；計數以實際合成地圖原始sprite界限、slot／fragment identity合併後完整落在畫布為準，原有接縫重複只算同一身份一次。等待室、藍蓋板及未開放裝飾不計。390時是部分可見，不能解讀為沒有籠子。選中個體皆為 `championship:2026:instance:0001`，兩種HUD／所有40布局情境的倍率皆2，既有解鎖20不變。

## 驗證

- 聚焦34/34：desktop場景／尺寸門檻、導航／resize／observer回收、相同scale與原圈寬上限、native指標round trip、既有portrait鍵盤／pinch、原圖native sizing／hit area與工具列回歸。
- 正式 `npm run test:ci` **1,750/1,750**，0 failed／skipped；新3項測試加入既有portable分類。
- 正式 `build:playtest`／`validate:playtest` 9,371檔；`validate:preload` 271源模組。沿用既有bundle與高優先首模組，只有牧場CSS query更新避免舊cache混用。
- 隔離全新 Playwright contexts、同一正式artifact、既有QA fixture：現代／復古 × 繁中／英／日／泰／越 × 390×844／1024×768／1366×768／1920×1080，共40情境。所有resize後無水平overflow，維持一張畫布／一套工具列，倍率／解鎖／同一選中個體一致；畫布與host尺寸一致。
- 正常DOM選手掌後，實際Pointer命中指定大夥伴；空地拖曳改變既有camera；夥伴實際held pointer進入native state6，移動與放開後離開carry且原位置改變；現有前後卡片導航帶入大夥伴；詳細彈窗界限與200%文字偏好檢查。操作與指標事件沒有直接修改模型欄位。
- 正常New Game DOM入口的教學邀請與第一步提示，390／1024／1366／1920及回390的resize界限檢查。未重做教學或演出。
- 無缺檔、pageerror或unhandledrejection。390與1366兩HUD截圖人工核對原角色／籠子尺度、主排与藍蓋板。`git diff --check`及自審原生變換、DOM限定作用域、同圈上限與observer清理完成。

## 接受範圍

屬 `OWNER_APPROVED_ADAPTATION` 的受控桌面瀏覽器／手機尺寸模擬；hasTouch context中的實際拖放使用Mouse Pointer Events，**沒有新增手機／觸控硬體實機驗收**。200%文字僅兩HUD的1366情境，未聲稱所有設定全排列。使用自有隔離QA存檔，未碰Owner進度或使用者main。沒有新增原作規則／商業發行／其他場景完整接受。
