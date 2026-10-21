> **已被同日較新 Owner 指示取代。** 撤回「先正常孵化再邀請」；目前依原作在蛋時邀請，另新增八蛋選擇。此契約與原回條只保留歷史證據，現況見 `docs/contracts/championship/OPENING_EIGHT_EGGS_2026-10-09.md`。

# 孵化後邀請：Owner 指定網頁入口

2026-10-09，OWNER_APPROVED_ADAPTATION。本契約只調整既有本機 New Game 邀請時機，不是原作結論或發布授權。

## 原作與產品分開記錄

既有 DeSmuME 畫面 `tutorial-phase2-20261009/private/phase2-invitation.png` 及同目錄 `PHASE2_OBSERVATIONS.json`：phase0 邀請時名冊 species0、uid0、名字「あ」，尚是蛋。接受後 special state18，1495–1497 後 command0x9B 指定 species17。拒絕 phase6 保留 species0。來源契約為 `INTERACTIVE_OPENING_TUTORIAL.v1.json`，不改寫其原作記錄。

本輪實際查看邀請、接受後蛋畫面及既有完整開場追蹤索引，沒有啟動新模擬器研究。既有畫面／名冊不能支持「原作在邀請前已孵化」；Owner 的產品體驗指示優先，以下明示為 web adaptation。

## 行為

1. 原有 New Game 故事、信件、送蛋、馴獸師及蛋命名不變。
2. 先進既有 Raising，提示三次點蛋；沿用正常 actor 的觸碰、原有孵化動畫／目標選擇及唯一 ticker，沒有強制指定 species17 或修改正常孵化規則。
3. 正常起始夥伴真的孵化後，保留至少60個既有 actor update 的展示，再建立邀請。此展示等待不建立額外 ticker 或存檔 authority。
4. 邀請基底是此時真實的孵化後進度。取消直接回正常育成；保留名字、角色、道具、時間、RNG等。確定進隔離示範隊伍，另建示範蛋，再沿用教學 species17 段落。它不是重播開場或把玩家夥伴退回蛋。
5. 結束／完成教學沿用既有原子基底恢復及保存。保存失敗不解除隔離。
6. 一般 Continue 不建立新邀請，也不重播開場。既有未完成教學 checkpoint Continue 沿原義恢復；舊 egg 基底與新 hatched 基底均相容。不改 save schema/key。
7. 入口仍限既有 localhost eligibility；沒有擴大公開 URL 或部署範圍。

## 有界驗證

受影響的 opening、onboarding、tutorial actor/save 測試；五語最小 New Game→孵化→邀請→取消／確定→Continue／結束。Hunt／Battle 完整鏈沿用 Slice6，沒有無改動重跑。實體手機、母語審閱、全原版逐幀與發布均不在此次通過範圍。
