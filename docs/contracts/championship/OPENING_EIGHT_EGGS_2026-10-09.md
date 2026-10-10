# 原作邀請順序與八蛋選擇

2026-10-09 最新 Owner 指示：原作證據與記憶有差異時依原作；撤回先正常孵化再邀請的改編。八選一是另一項明確 `OWNER_APPROVED_ADAPTATION`，不可寫成原版已有選蛋畫面。限既有 loopback 入口，沒有發布授權。

## EVIDENCE

既有 `R:\Projects\Championship2026\tutorial-phase2-20261009\private\PHASE2_OBSERVATIONS.json`：invitation phase0 為 species0／uid0 蛋；接受後 phase1、special state18，script1495–1497 後 command0x9B 指定 species17；拒絕 phase6 保留蛋。已查看邀請及接受後畫面。引用 [原作教學契約](INTERACTIVE_OPENING_TUTORIAL.v1.json) 及 [來源研究](../../research/INTERACTIVE_TUTORIAL_PREDICATES_2026-10-09.md)。MCP 不可用，使用現有證據，未重開模擬器研究。

## CONTRACT

1. 維持故事 → 信件 → 馴獸師姓名與確認 → 贈禮信件 → 八選一 → 原有蛋命名 → New Game。選蛋的返回保留名稱草稿／選擇；取消不觸發 newGame 或清除既有存檔。
2. 僅選現有 species0..7／e000..e007，使用已交付原創 HUD portrait。視覺標籤為第1..8顆；OC225..232設定稿不建立元素、能力或孵化結果對應。
3. 沿用同一 R2 starter resident `resident:species-000`，種類與 nativeProfile 改成所選蛋；不新增 resident、session、save key、schema、router 或 simulation。個體 ID 與目前種類本來就因進化可不同。
4. 選蛋由既有 native constructor 建立其原有資料。原本 species0 starter 保留 ancestry140=14；其他蛋沿用 constructor 的 ancestry228。正常孵化仍讀既有 history／RNG 規則，未依蛋的原創外觀創造指定物種路線，也未改任何 native hatch 函式。
5. New Game 在所選蛋尚未孵化時立即邀請。拒絕還原正常基底；接受使用獨立 species0 示範蛋，再走既有 special hatch17。示範狀態只在 live session，canonical projection 始終保留所選蛋、名字、RNG、道具、時間、名冊及其他基底內容。
6. Continue 不新增邀請；已有教學 checkpoint 可續接。完成／退出沿用原子恢復及保存，失敗維持隔離。保留先前版本已存的 hatched baseline 相容性，但新入口不再先正常孵化。
7. DOM 五語選蛋、native radio 鍵盤操作、44px以上按鈕；共用 styles.css、brandTerms.js 及既有字典文字修復不動。沿用唯一 Pixi Application／ticker。

## 驗證邊界

[本批報告](../../reports/opening-eight-eggs-2026-10-09/REPORT_ZH_TW.md)。8種蛋完整基底比較、拒絕／Continue、接受／checkpoint重載／special hatch、受控完成清理；五語正常 New Game UI；其中一語正常接受、重載、示範孵化、退出。完成段用明示 checkpoint fixture，不宣稱重新走過完整 Hunt／Battle 鏈。實體手機與母語審閱仍未完成。
