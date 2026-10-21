# BM03 R2 本機接入範圍

Owner 選定雲端 R2 的 52° clean 場景；45°、靜態混合角色陰影及 review composites 不進 runtime。來源私人包 SHA256 `394587d2d3e850001ccd65485e44872b3f7c0c31f7b1e97248bde9c640194394`，本機解包回條保存在專案外 intake 目錄。

僅 loopback `?battleReview=bm03-volcano-r2` 選用候選 manifest，arena 2 正常對應 `BATTLE_VOLCANO`，不修改競賽解鎖、站位、角色尺寸、原動畫 ticks、AI、傷害或存檔。其餘場地保持原 manifest 記錄。此處不是公開／商業發布批准。

採雲端 `review_grounding.py` 的 SUN / camera 微分投影與兩種高度輪廓，移植成 m201、m454 的逐格 alpha 接影近似。保留穩定 native origin/baseBounds，不逐格重置足點。朝向翻轉先於投影，光向固定；跳躍只位移 cast 並抑制 contact。128 Main 格 × 兩朝向的 256 姿勢預烘；稀有非零旋轉反應使用既有便宜 blob 回退，禁止在 ticker 同步計算新影像。全部角色 RGBA、Main/Sub 及 tick 資料不變。

陰影使用獨立 runtime 紋理、現有 Pixi application/ticker；只在候選場景啟用。接收遮罩由同相機 GROUND collection 的 ID pass 匯出，LAVA / CLIFFS / DETAIL / GUIDES 保持遮擋但不接影，沒有碰撞或導航權威。缺少相同來源的角色資料時保留既有 neutral shadow。

驗收須分列：来源與位元資料核對、投影／快取／釋放受控檢查、正常練習 UI 選 arena 2 到結果／返回、实际截图及播放。不得宣稱真實 3D 投影、完整 222 角色語意驗收、真手機或商業權利通過。火焰／角／尾巴高度及每格真正腳掌接觸仍是 alpha 幾何估計，不能升級成已知原作或物理真相。
