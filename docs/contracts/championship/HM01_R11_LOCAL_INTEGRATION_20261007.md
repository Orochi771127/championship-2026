# HM01 r11 本地接入與樹葉網點驗證 — 2026-10-07

狀態：LOCAL_QUERY_CANDIDATE / PRIVATE_QA。Owner 已選 r11 美術方向；本批完成本地候選接入，不升預設、手機、全角色或公開權利接受。

## 來源與範圍

Downloads 原檔保留。兩包複製至 `../handoff-review-20261007/hm01-r11-intake-20261007/`：art-layers 20,698,484B，SHA256 `fd98239cc64315472c95bdd2d1dadf6de215af105f7a194da772ae8aa11a8f2a`；source-QA 5,333,050B，SHA256 `99d8f8b469d5a54c0d3d8a8e6979a65615336bab9f785b2cf4885f9c4774613f`。CRC、73檔來源SHA、producer與numeric-input hash已核對。PNG實看，不重新生圖或render。

現有 loader 加 loopback `caveReview=natural-r11` 選項，配 `huntFoliage=dither-r1`。只換 field_hm01_01 的exact r11 frame、兩張atlas與2530 pieces；其餘29個h1 field相等。2048²世界、128²地形、遊戲綁定、nav/spawn/escape/radar/時間與原生角色比例/origin/ticks不變。原h1預設、r10入口、battle/VFX與他人dirty修改保留。新5個runtime檔共12,935,745B且納入private build boundary。

r11 clean SHA256 `65c0458cbdb3c4fb5a6b9456c3a7708b9d98d42fce9fb595d45d19c18521349a`。116片solid（含2片backcap）始終alpha1。所有758,352個非零atlas alpha RGB像素與clean來源一致。

## 實作修正

實際同版畫面發現原網點mesh加入層尾，會越過相同z的solid。改為插在它所替代的原sprite之前，保留同深度排序；增加equal-depth回歸断言。這是共享呈現helper的小修正，不改r10/r11美術。舊r10私人QA封包是歷史版本，不冒稱其實作SHA等於本次。

## 分開記錄的驗證

14項相關測試通過（9 depth/alpha/ordering/art-contract +5 map bundle）。390×844 DPR2 Chrome桌面模擬；沒有真手機測試。

受控9組×4模式：樹前、穿過、後方、X翻、Y翻加lift、双角色、m201強遮點、兩個solid洞口。用目前實際註冊 m201 delivered-r04 cell0，origin[112,164]、density4，沿現有renderer套world/native2，未重置中心或把nativeHD降成1x。QA額外預載該角色後只做presentation投影，未加正式spawn；36次simulation view完全相同。不是正常AI/nav實證，也不套用cloud static的可見百分比。

真正GPU sprite-alpha隔離擷取顯示，9組候選變化在實際角色alpha外0px，在opaque-vs無樹葉差異外0px。兩洞口四模式角色可見像素皆0，solid alpha1；樹前與第二洞口整張差異0。第一洞口仍有葉片邊緣1像素[378,112]由RGB[63,84,62]變[65,85,65]，在角色投影輪廓內、solid backcap後角色仍全隱，**不宣稱該洞整張畫面零差異**。

保留早期失敗診斷：2個CPU floor取樣落在精確texel邊界，與GPU浮點光柵各差1px；實際GPU角色遮罩符合候選。原mesh同z排序造成的3px外輪廓變化已修；另外保留修後嚴格整張洞口0差異斷言失敗。最終報告將真正角色可見度與包括shadow/ring的node可見度分列，沒有用較寬指標冒充角色alpha。

正常流程另驗 New Game→SYSTEM→Hunt→Grass→ROPE→Field→返回Home→再進入，不加m201預載、不投影actor、不改AI/ticks。自然AI同frame .42/dither A/B有2935變動像素且source view不變；新增72/72 mesh/shader/geometry離場釋放，重入同一Pixi Application，page/console errors皆0。正常DOM截圖與受控native canvas圖已實看。

## 證據、回退與接續

證據根目錄同上：`VALIDATION_SUMMARY.json`、`SOURCE_CONTENT_AUDIT.json`、`IMPLEMENTATION_SHA.json`、`SCOPED_IMPLEMENTATION.diff`、`browser/held-r11-v3/`、`browser/normal-r11-v2/`。早期失敗與每檔before副本保留；以目前SHA核对后才可逆套本批hunk，不可整檔覆寫或改正式存檔。移除query即可回既有候選/預設。

hm02／03／04已分別交付現行clean、RESEARCH_ONLY原作参照、只讀master/camera、depth與producer差異；27共用producer中25同版，另2工業選項差異不影響三圖CONFIG。不重傳完整hunt-scene/inventory，不覆蓋cloud較新的r11產線。192²仍僅提案。

仍待：三圖新交付後逐批核對接入、真手機/效能與主觀網點閱讀驗收；原有m454正常睡眠、蛋完整animator/request追蹤、未驗收角色Main/Sub與m401/m503修補、未批准branch門檻數值。全專案未完清單保留於Codex owned status/report，不將本批資料測試視為所有美術語意通過。
