# R5 首頁背景有界取消載入

基線：de54307bd7c4133fdb4e42d19448da87891a1aba。Owner／parent 在 P0 完成後明確授權：只修首頁 CSS arena 退出後仍下載的局部，完整返回還原通過後依既有批准流程發佈。

## 證據 → 契約

來源：現行 opening.css 的 arena.webp 網路 URL；titleImageLifecycle.js 的 CSS none 還原；main.js 的 hidden／音樂狀態同步；R3 browser-first-chunk abort 與 R4 真實網路 trace。R3 已證明 abort 後無新 bytes，10 秒未完成還原只代表限時內未證明，不是不可還原。

本輪驗收：單一 title owner fetch 同一 arena；CSS 不再另請求原圖；generation guard 拒絕失效 fetch／decode 完成。退出取消 unfinished request、清除背景並 revoke object URL；完成圖最多保留一份 Blob，返回可重用、不預抓其它資產。dispose 必須 abort/revoke/釋放快取且不能再次啟動。初次完成前保留原底色、版面與可操作入口；最終原圖 bytes、尺寸、center/cover/no-repeat 與視覺必須相同。

測試先用本地隔離受控延遲，驗證取消、失效完成、返回只一個請求與完整還原、dispose。完整正常 title→ranch→title 需通過；只取一次公開同 fixture 的取消與 bytes 記錄。沒有壓图、重畫、改 music 內容、存檔、玩法、RNG、router 或 Pixi authority。冷載整體仍 OPEN；不在本批啟動 room、OAuth、host 或外部服務。


## 已完成驗證

- 8 項新生命週期案例，加相關 loading／music／opening 合計 33/33 通過。過時 body 或 decode 不會恢復畫面；錯誤不因重複音樂通知而重試；dispose 釋放 URL 與單份快取。
- 控制瀏覽器延遲 native fetch 回應，退出出現 net::ERR_ABORTED；一次返回完成單一請求，再返回無新 HTTP 請求。停用後的遲到回應不恢復畫面。此處延遲是在 headers 前；body/decode 遲到由單元案例驗證，CDN body 中斷取消仍沿用 R3 證據及本輪一次公開實測界線。
- 原圖 SHA256 `a7c8f01413abe0b8448bfeb33266753f35f96bbb2e3d106169ec3eba3564eca1`，2,057,534 bytes，941×1672。Blob 還原與原 URL 的面板截圖完全相同，保留 center／cover／no-repeat。
- 正式候選成品正常 Login → Continue → 角色全 ready／單一 canvas → 保存並結束 → 原圖完整返回通過。未完成模式取消一次、返回一個請求；已完成模式返回零個請求。已完成背景不會因 login music initial buffering 消失，快取返回也不需等待音樂緩衝。原曲正常播放，沒有音檔改動。
- 構建／驗證 9,290 個檔案通過，原協作工作區 67 檔雜湊未變。播放器、schema、保存與遊戲邏輯未改。

公開 commit／CI／取消 bytes 收據由本批 Library 交接包記錄；本地受控成功不等於 CDN 性能或實機接受。唯一批准範圍是首頁背景 owner 的取消與完整還原；其餘冷載停滯仍 OPEN。


## Publication authorization and acceptance boundary

Two earlier combined commit/push attempts were rejected before execution because automatic approval review did not accept the relayed broad authorization as direct approval for this exact R5 publication. Neither attempt created a commit or changed origin/main. Both remained at de54307bd7c4133fdb4e42d19448da87891a1aba.

The parent then obtained the explicit R5 confirmation below. Question Sentinel_118419395ac88191997d2051521f0f5a specifically asked permission to commit and push the title-background cancellation change to championship-2026 main and publish the public game. After the Owner asked about impact, explanation Sentinel_98270b637ccc81918e4ced9262294f56 described canceling unfinished title-arena downloads on leaving, reloading when required on return, retaining completed artwork, preserving image quality/save/gameplay, and requiring online measurement without promising to fix all stalls. Owner Sentinel_05aafe2fba988191a1e4d00d5607dab1 replied: "喔喔 那就照你的意思做啊，然後一樣你要發佈就發佈". The parent requested publication of exactly the reviewed nine staged files, normal non-force push, CI/Pages verification and one public cancellation/bytes/return verification. A further review rejection must stop publication, with no bypass.

Local restoration acceptance is complete. CI, Pages and the single public cancellation/bytes/return sample remain separate post-push gates; their actual outcome belongs in the Library handoff receipt. This source report does not claim post-push acceptance or closure of broader cold-loading performance.
