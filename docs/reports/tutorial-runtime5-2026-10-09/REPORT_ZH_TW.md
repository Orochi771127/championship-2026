# 互動教學第5切片：Battle／completed 有界交接

日期：2026-10-09。分支 handoff/dot-continuation-20261001；HEAD 1fb7d5fd21d3da47775d34ab0d3a1a95f6623972。未提交、推送或發布。

## 本輪成果

接通既有 Raising → Battle 選單／場地／結果 → Raising1564／1565 → completed。賽事61、入口 entryMode4、核心 mode1、battleType0、示範個體189／212／207；party mask7 才能前進。入口模式4不等於密碼對戰核心模式4。

使用現有個體建構器、Battle runtime、screen stack、單一 Pixi Application/ticker。語意選單依原始 menu2→6→11→14、nested3+mask7、返回11→開始的順序，以既有 DOM 視圖投影；不是原版像素配置或所有戰術設定編輯的完整還原。

示範個體與複製自 frozen baseline 的 RNG 不進正常 roster。教學守門拒絕正常 Battle transaction/settlement；不入帳獎金、不增加戰績、頭銜、物品或註冊。completed 沿用同一 canonical save key，把起始 baseline 與完成標記一起保存；失敗期間保留隔離，重試再還原一次。舊存檔不注入邀請。

## 證據及邊界

來源：既有 INTERACTIVE_TUTORIAL_PREDICATES_2026-10-09、OVL10 0210BA24..0210BB20、021142C4/0211430D/0211438F VM、OVL8 0210D7F8..0210D864。新增只讀 native tutorial-battle-entry/party/live 檢查點：phase4，root+C98=1；party/live record61、field9；示範189／212／207。私有反組譯與觀察回條留在 tutorial-runtime5-20261009/private，沒有 runtime import。

原版只證明勝利路徑已觀察；loss/draw 是否到達 phase5 仍 UNKNOWN_REQUIRES_TRACE。Web 安全結束為 OWNER_APPROVED_ADAPTATION：顯示核心真實結果，再明示結束示範、繼續教學。未完成戰鬥重載從同一 entry seed 重來；已保存結果直接投影原結果，不重跑抽勝利。沒有強制勝利或反覆重抽。

## 驗證

- 294／294 focused regression，另48／48 Battle UI／field／highlight／calendar／toolbar保全；加強後 Battle7／7，其中6項與 focused重疊，共343個不重複測項。
- 17個 Battle/return stage、30個合法 checkpoint 值可安全恢復。21個選單值與2個育成值逐一驗證「下一步保存失敗→重載原 checkpoint→再操作」；running、6種 outcome/reason 投影及 completed另有隔離測試。
- 真實核心測試2830更新後 TEAM_DOWN／TEAM_ZERO_AHEAD。不是測試直接指定勝利。勝／負／LEVEL保存結果的六種投影恢復為受控資料測試，不宣稱原版三種結果都實跑。
- 五語 zh-Hant/en/ja/th/vi，360或390×844、DPR2、Chrome隔離情境：從受控 raising-battle-ready 經真實選單、三個隊員、戰鬥、1564/1565到completed，全數PASS。皆單canvas、零pageerror、baseline內容一致；completed重載不再邀請。繁中另驗證 running/result重載、start/end/completed保存失敗重試。
- 完整繁中正常操作鏈：新遊戲邀請→全部初段育成→Gate16→兩次真實圈繩/拉HP至0/手收取→育成→Battle→育成→completed，PASS。使用既有 developer presentation 的只讀畫面座標；無寫入actor/HP/RNG。重載/保存失敗僅在隔離測試存檔。
- 完整鏈包含疾病治療保存失敗、首捕保存失敗及重試、拉繩中重載、錯誤空地圈選/食物位置/射擊不前進；Battle running/result重載與start/end/completed保存失敗。baseline一致、單canvas、零pageerror。
- 進行中Battle退出預覽的保存失敗→重試→恢復baseline PASS。正常URL新遊戲390×844、Continue360×800，仍v1 opening、無邀請注入、單canvas、零pageerror。

完整回條見 [VALIDATION.json](VALIDATION.json)。測試腳本及逐步存檔在專案外同層 tutorial-runtime5-20261009。曾因測試選擇器／非同步Gate等待不完整而失敗，修正的是測試等待；成功回條優先，未刪除失敗紀錄。

## 尚未接受

正常新遊戲 eligibility 保持 false。本輪停在可交接的 Battle/completed 預覽里程碑。五語完整 Hunt/全鏈、正常URL五語接受/略過/退出後接續/完成不重邀請仍待驗證；不以五語Battle局部PASS替代。physical device、原版loss/draw、完整RNG順序與逐幀差分、phase3/5完整示範roster、最終視覺、權利及公開發布均未聲稱完成。頂部preview banner仍覆蓋部分HUD。

## Slice4 直接交接摘要

Slice4已有220／220測試、39個Gate/Hunt/return檢查點恢復並走完；繁中390×844 DPR2實際UI走完育成→Gate16→兩次捕獲→1553/1554育成，單canvas、零pageerror、baseline一致。首捕拉繩重載、治療/首捕保存失敗、錯空地/食物/射擊均有回條。五語完整育成是Slice3的驗證；Slice4完整Hunt只有繁中。正常新遊戲/Continue與中Hunt退出隔離已PASS。未驗證實機、五語完整Hunt、原版逐幀/RNG、權利或發布。

## 保存與傳檔

所有現有協作者修改、production美術、styles.css、五語共用字典/brandTerms與玩家存檔保留。只保留本輪必要before副本、來源/測試回條與scoped diff；沒有複製整個專案。沿用127.0.0.1:8766、PID38660，沒有新server、Git mutation或部署。

Library官方prepare_uploads在Slice4已回報不可用；本輪遵照指示不重試或使用替代上傳。沒有新Library ID，parent尚未看過本機PNG。原生報告與截圖保存在本機，final另提供可直接讀取的摘要。
