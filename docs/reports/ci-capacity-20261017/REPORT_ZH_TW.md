# CI 修復與只讀容量分析交接

本次程式修復提交：`2d92fc6dc3786d911189ddf6237cac9da40bb962`。前一交接點為 `f10bb938e9e701740360c116949360b758665feb`。已完成修復、一次完整 CI、一次完整候選建置及正常流程驗證；**尚未 push、merge 或 deploy，新增公開驗證 URL 為空，實際發布角色為空**。

## 已修復與驗證

公開 HUD adapter 在 reader 重建後沒有沿用原本頁面生命週期的中繼資料快取。同兩隻角色的重建測試由 4 次請求降回 2 次；現在以 fetch 身分、URL、核准 SHA256 共用待完成 promise，驗證文字內容 hash 後才解析。HTTP、hash 或 JSON 失敗會移除失敗項目，可重試；角色按需載入及六個並行上限保留。沒有加入 SW、永久快取、全角色預載或玩家狀態快取。

保留舊 authoring 路線測試，另以真實 public 路線驗證跨 reader 共用、角色 alias、hash 改版隔離、失敗後重試。alternate-form 的移除 import 測試補入新 reader 依賴；glyph 測試使用已選入且 executable 等價的實際 vendor 模組，解決此 checkout 缺少 npm package entry metadata 的載入問題。原本 f10 的三項契約修正也在此次完整 CI 內。

聚焦測試 **17 通過、0 失敗、0 跳過**。完整 CI **2,535 項：2,488 通過、47 失敗、0 跳過、0 取消**；本續作只跑這一次完整 CI。沒有刪除、跳過或降低原測試要求。

已用安裝的 Chrome 155.0.8059.40 驗證手機 390×844、桌面 1440×1000 的 TITLE → 登入 → 牧場 → 系統 → 圖鑑 → species125。日焰獅 1448×1086 主圖及名稱正常，無橫向溢出；瀏覽器錯誤、缺檔及私有索引請求皆 0。這是固定本機候選檔案的受控正常 UI 驗證，**不是公開站讀回，也不是全部模式／角色驗收**。未下載瀏覽器。

## 原 53 項與目前 47 項失敗

`ORIGINAL_53_ROOT_CAUSES.json/.csv` 逐項保留原始失敗和修復歸因。原 53 項：47 項當時直接缺來源、2 項公開/私有欄位契約、1 項測試新常數注入、1 項 npm 入口中繼資料、1 項 legacy HUD 測試目標與公開快取回歸、1 項常數已移至 leaf module。測試 harness 修正後仍可能停在下一個缺檔，不能將 harness 修正當整項行為驗收完成。

已僅從此 repo 現有本機 Git 物件恢復 3 個逐 byte 相同的 tracked fixture：warglaymon runtime review、metaletemon origin geometry、retired evolution cell。其餘原 45 個本機 Git 物件不可用，沒有網路抓取。retired cell 的原失敗現在通過；alternate harness 現在前進至缺 motion-contract，未偽造通過。

目前 47 項的直接根因：9 項模組啟動缺 fixture、30 項直接或巢狀來源載入失敗、8 項明確檢查來源檔存在失敗。按資料分為 **26 項美術 authoring／baseline、20 項研究 CPU 證據、1 項測試快照**。目前列出的 47 個唯一路徑在本 checkout 均不存在；細項見 `REMAINING_47_ROOT_CAUSES.json/.csv` 與 `REMAINING_SOURCE_AVAILABILITY.json`。

部分來源在 HEAD 與 adc36510 的 Git blob 一致；這只證明版本，**未在相同來源可用環境執行基準 CI，因此不宣稱失敗原本就存在**。缺檔之後的動畫、數值、回放及契約語義仍待來源到齊後驗證。不能用新增 placeholder、改到公開投影、降低 assertion 或刪測試代替權威來源。

| 目前失敗測試模組 | 項數 |
|---|---:|
| `tests/championship-alternate-form-assets-cases.mjs` | 1 |
| `tests/championship-art-a1-map-tech-cases.mjs` | 2 |
| `tests/championship-art-production-a0-cases.mjs` | 1 |
| `tests/championship-assembled-ui-cases.mjs` | 1 |
| `tests/championship-battle-owned-party-cases.mjs` | 2 |
| `tests/championship-battle-packed-atlas-cases.mjs` | 2 |
| `tests/championship-cage-authoring-contract-cases.mjs` | 1 |
| `tests/championship-cage-faithful-hd40-cases.mjs` | 2 |
| `tests/championship-cage-hd-remaster-cases.mjs` | 3 |
| `tests/championship-character-animation-timeline-cases.mjs` | 1 |
| `tests/championship-character-faithful-hd-cases.mjs` | 2 |
| `tests/championship-completed-character-contract-cases.mjs` | 1 |
| `tests/championship-faithful-map-technical-qa-cases.mjs` | 2 |
| `tests/championship-free-battle-cases.mjs` | 1 |
| `tests/championship-hunt-contact-shadow-cases.mjs` | 1 |
| `tests/championship-hunt-direction-unassigned-cases.mjs` | 1 |
| `tests/championship-hunt-faithful-hd30-cases.mjs` | 2 |
| `tests/championship-hunt-hd-remaster-cases.mjs` | 2 |
| `tests/championship-hunt-history-cases.mjs` | 1 |
| `tests/championship-hunt-individual-pool-cases.mjs` | 1 |
| `tests/championship-hunt-live-encounter-cases.mjs` | 1 |
| `tests/championship-hunt-movement-cases.mjs` | 3 |
| `tests/championship-hunt-normal-entry-cases.mjs` | 2 |
| `tests/championship-hunt-original-input-evidence-cases.mjs` | 1 |
| `tests/championship-hunt-persistent-sources-cases.mjs` | 1 |
| `tests/championship-hunt-spawn-cases.mjs` | 1 |
| `tests/championship-licensed-hunt-runtime-cases.mjs` | 1 |
| `tests/championship-medal-art-corrections-cases.mjs` | 1 |
| `tests/championship-native-individual-profile-cases.mjs` | 1 |
| `tests/championship-raising-evolution-cases.mjs` | 1 |
| `tests/championship-raising-lifecycle-cases.mjs` | 1 |
| `tests/championship-rounds-cases.mjs` | 1 |
| `tests/championship-tutorial-cases.mjs` | 1 |
| `tests/product-species-extensions-cases.mjs` | 1 |

九個啟動阻擋包含：metaletemon 的 `motion-contract.json`、`ART_PRODUCTION_CROSSWALK.json`、armadimon baseline `runtime.json`、Hunt touch replay／gameplay mode catalog／spawn CPU、native individual CPU、raising evolution CPU、`tests/base-display.json`。完整精確相對路徑均已保存。

## 17 張 PNG 的用途與角色編號

全部是共用 UI，**角色編號一律不適用**，沒有角色主圖或動作圖。Bits 與鑽石各 7 個尺寸，工具列 3 張 64×64。正常狀態列引用 24px 及 48px（2x）；其餘 10 個貨幣尺寸未見正常引用，合計 725,782 bytes，僅列為可清理候選，尚未刪除。

| 圖檔 | 尺寸 | 用途 | 正常程式引用 |
|---|---:|---|---|
| `bits-128.png` | 128×119 | 共用狀態列 Bits 金幣圖示 | 未見正常載入引用 |
| `bits-24.png` | 24×22 | 共用狀態列 Bits 金幣圖示 | 是 |
| `bits-256.png` | 256×238 | 共用狀態列 Bits 金幣圖示 | 未見正常載入引用 |
| `bits-32.png` | 32×30 | 共用狀態列 Bits 金幣圖示 | 未見正常載入引用 |
| `bits-48.png` | 48×45 | 共用狀態列 Bits 金幣圖示 | 是 |
| `bits-512.png` | 512×477 | 共用狀態列 Bits 金幣圖示 | 未見正常載入引用 |
| `bits-64.png` | 64×60 | 共用狀態列 Bits 金幣圖示 | 未見正常載入引用 |
| `diamond-128.png` | 128×128 | 共用狀態列鑽石圖示 | 未見正常載入引用 |
| `diamond-24.png` | 24×24 | 共用狀態列鑽石圖示 | 是 |
| `diamond-256.png` | 256×256 | 共用狀態列鑽石圖示 | 未見正常載入引用 |
| `diamond-32.png` | 32×32 | 共用狀態列鑽石圖示 | 未見正常載入引用 |
| `diamond-48.png` | 48×48 | 共用狀態列鑽石圖示 | 是 |
| `diamond-512.png` | 512×512 | 共用狀態列鑽石圖示 | 未見正常載入引用 |
| `diamond-64.png` | 64×64 | 共用狀態列鑽石圖示 | 未見正常載入引用 |
| `hand-rest.png` | 64×64 | 工具列 hand 圖示 | 是 |
| `manage-rest.png` | 64×64 | 管理選單入口圖示 | 是 |
| `system-rest.png` | 64×64 | 系統選單入口圖示 | 是 |

17 張來源、公開衍生、RGBA 的完整 SHA256 及大小見 `PNG17_PURPOSE_AND_SPECIES.json/.csv`。先前只移除每張 150 bytes 的文字中繼資料，合計 **2,550 bytes**；RGBA、尺寸及色度 chunk 均保留。這是公開中繼資料清理，無法解決大容量問題。

## 建置與只讀容量量測

本次 buildId：`b73ad98e986ff47b05999f1af97d1c680835a501f8b36fe7eef765cc68ddb53f`。候選 **8,000 檔，1,146,830,318 bytes（含 pages-build.json）**，超過未變更的 1,000,000,000 bytes 門檻 **146,830,318 bytes**。錯誤內的 1,008,138,213 是逐檔累加第一次越線值，不是完整候選大小。建置已走至檔案集合、選定 hash／內容、公開 index 與 payload 欄位檢查之後的容量 assertion；整個建置仍是失敗，不能發布。

容量分析以修復前固定候選 1,146,828,708 bytes 為基準，核對 7,998 個 payload SHA256，另計 receipt，沒有 mismatch。本次候選只增加 1,610 bytes；下列預測保守將其全部帶入。所有編碼均在記憶體 BytesIO 執行，沒有改寫、刪除或重新選擇任何來源／衍生資產，也沒有更改 allowlist 或容量 gate。

| 項目 | 量測結果與限制 |
|---|---|
| byte 完全相同的重複檔 | 65 群、別名重整毛額 2,503,498 bytes；須保持 URL/載入契約，不能直接移除必要入口 |
| RGBA 相同群 | 59 群、2,175,388 bytes；屬上述重複範圍，不重複加總 |
| PNG 無損容器轉換 | 859 張全部實測；保留 17 張帶色度 chunk 的 UI PNG，另 842 張精確 RGBA roundtrip 可省 40,116,728 bytes；格式與 URL 改動仍須實作／驗證 |
| 現有 WebP 無損重編樣本 | 14 張分層樣本，58,560,958 bytes 僅省 132,094 bytes（約 0.226%）；不能當所有 WebP 的保證 |
| 確認未引用貨幣變體 | 10 張、725,782 bytes；尚未移除 |
| 其他未引用候選 | 88 檔、2,798,532 bytes；尚未完成所有動態 loader 閉包證明，不稱作安全可刪 |
| 編譯輸入與發布輸出分離候選 | 392 JS/MJS + 44 JSON，共 16,275,951 bytes；須完整驗證動態路徑與 build gate，尚未證明可直接刪除 |
| 共用既有分頁取代獨立 battle pack | species177、189、190、207、210、212，共 370 個 frame 已證明 RGBA、動畫、geometry 相等；候選獨立包 33,271,546 bytes。檔案數／請求數會改變，尚未量測戰鬥載入延遲 |

battle 共用頁面已在**本機候選**，尚未發布。偵測到的 system background 模板路徑與貨幣 srcset 已排除假陽性，沒有把正常背景當未引用刪檔機會。原始資料、圖鑑品質、動作與 WebP alpha 均未降級。

合併預算已避免 PNG 轉換與 duplicate 重複計入。單靠 PNG 無損可省 40.12 MB；加確認未用貨幣與 aliases 約 42.82 MB；再加 source packaging 候選約 59.10 MB；再共用 battle representation 約 **92.37 MB**。連尚未證明安全的其他 88 檔都樂觀計入，約 **94.00 MB**，候選仍約 **1,052,830,419 bytes**，還差 **52,830,419 bytes**。因此目前證據**不足以保證保留全部功能就能省到 146.83 MB**。

## 需要產品決策的具體選項（均未實施）

| 選項 | 玩家影響 | 預估候選大小與限制 |
|---|---|---:|
| A 保留全部功能，繼續研究 | 圖像、影片、動作、流程皆保留；本次不發布 | 已量測候選組合最多約 1,052,830,419 bytes，仍超限 |
| B 停用 TITLE 58 秒影片自動播放／重播及其三版本與海報，搭配無損 PNG／別名／未用貨幣／source packaging | 不再播放該段選配影片；互動式新遊戲開場及全部角色圖保留。像素無損，但需格式與 URL/hash 回歸驗證 | 約 **985,914,415 bytes**，約 14.09 MB 空間 |
| C 同樣停用 TITLE 影片，六隻 battle 改用候選內相同像素分頁，搭配別名／未用貨幣／source packaging，不重編圖片 | 同 B 的影片影響；角色像素與動作不變，battle 請求數增加，須量測載入與可互動時間 | 約 **992,236,611 bytes**，約 7.76 MB 空間 |

影片相關現有 payload 為 101,816,930 bytes。B/C 是估算，尚未實作、未含改寫 metadata 的最終增減，不能當 build 通過承諾。source packaging 尤其需要實際閉包驗收；沒有採用降解析度、降品質、刪原圖、外部 CDN 或付費服務。

## 阻擋與安全限制

沒有命令連線卡住或 uncertain operation。當前確定的阻擋是：(1) 缺少測試所需的 47 個來源路徑，(2) build 超出容量門檻；選項 B/C 尚待產品決策與後續實作驗證。未反覆重跑完整 CI 或建置。

`ART_PRODUCTION_INDEX.json` 未變，SHA256 `3e7b7694a88c3b7d75e444b1e04bb769923480bfeecb2df19e68005c6b6eb87f`，未上傳。之前該權威索引的上傳拒絕、其他工作樹來源讀取拒絕及私有程式碼 Google Drive 上傳拒絕均保留，沒有重試或替代目的地／任務繞過。沒有讀取被拒的 R: 或 task-2/task-4/repair/task-5 來源。四個不可檢查工作樹的 dirty 狀態仍為 UNKNOWN，不以舊 HEAD 當新狀態。

canonical `c479b2387a23df24a3972f3f094ba009c2e5c03b`、species116 雪印零偶、MA50/MA62 修正、核准主圖與原動作綁定範圍保留。最新程式修復僅在本獨立分支；先前 59 個公開主圖候選及 held 範圍未變。本回合實際上線角色／hash 清單為空；沒有新的公開讀回 URL，不以本機截圖宣稱上線。
