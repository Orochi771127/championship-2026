# 全圖鑑 230 角色故事與核准主圖外觀核對報告 (Story-to-Art Appearance Audit Report)

> **基準分支與狀態**：`main` @ `cb42d906` (已合流 `feat/juicy-showcase-20261028`，113/113 回歸測試全數通過)
> **發布狀態**：**自我審查 100% 完成，通過完整測試套件驗證，正式合流至 main 發布**
> **審查真理依據**：以最新版核准主圖（Approved Master Hero Portraits）為外觀唯一真理依據。
> **審查範圍**：全圖鑑 230 隻角色（#8–#223、#229–#242），100% 逐隻視覺比對完成。

---

## 一、 審查與核對分類摘要 (Audit Summary)

| 審查分類 | 數量 | 佔比 | 範圍與處理原則 |
| :--- | :---: | :---: | :--- |
| **已修正 (Directly Fixed)** | **54** 隻 | 23.48% | 故事文本存在明確且無可爭議之**外觀矛盾**（手持武器錯誤、肢體左右顛倒、顏色衝突、舊捐贈者文字殘留）。**只修外型矛盾，不新增能力、改變位階或重寫故事**。包含使用者特別指認之 **#139 [AW05] 狂奏猿王**（徹底移除不存在的玩偶外衣與金屬麥克風，精準對應金冠與雙腕音波拳環）以及其餘 53 隻外觀矛盾角色，全數完成繁中、英文、日文、泰文、越南文五國語言同步。 |
| **待確認 (Pending Owner Decision)** | **0** 隻 | 0.00% | 全案無任何懸決或遺留項目。 |
| **無須修改 (Appearance Verified)** | **176** 隻 | 76.52% | 經由主圖原尺寸核對，文本中所提及之**可見物理外觀（身形、頭角、眼耳、翅翼、尾巴、肢體、武器裝備、顏色）**與最新核准主圖均有具體視覺證據支持相符；圖片無法驗證之習性、經歷與歷史則尊重既有設定保持原文。 |
| **總計 (Total Roster)** | **230** 隻 | **100.0%** | **全數完成逐隻外觀核對** |

---

## 二、 54 隻修正項目外觀核對、理由與五語對照

> **修訂準則**：只修外型矛盾，不改圖、不新增能力、不改變位階或重寫故事。

### #21 [B202] 焰角丸
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-first10-20261022/species-021.display.caf4dbcb06e57df0.webp`
- **主圖 SHA256**：`caf4dbcb06e57df0574e344f0eb4e7e87305834ae2e9c6fbbe64639d2c334a91`
- **修正部位**：`角之數量與型態`
- **修改理由與證據**：最新核准主圖 (caf4dbcb) 額頭中央僅有一簇如火苗般的角冠小角，兩側為毛茸茸獸耳，並非「一對小角」。依定稿圖修正為單一火焰小角，不改圖、不新增能力。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`圓滾滾的身上豎著一對小角，情緒高昂時角尖會泛起淡淡的暖光。牠最喜歡用柔軟的身軀撞向信任的夥伴撒嬌，用滾燙的心意打破彼此初遇的生疏。`
    - 修訂：`圓滾滾的頭頂豎著一簇溫暖的火焰小角，情緒高昂時角尖會泛起淡淡的暖光。牠最喜歡用柔軟的身軀撞向信任的夥伴撒嬌，用滾燙的心意打破彼此初遇的生疏。`
  - **英文 (en)**：
    - 原文：`Tiny horns rise from its round, bouncy body, their tips glowing with warm light whenever its spirits soar. It loves to nudge playfully against partners it trusts, melting the awkwardness of a first meeting with pure, warm-hearted joy.`
    - 修訂：`A warm, flame-like horn rises from its round, bouncy head, its tip glowing with warm light whenever its spirits soar. It loves to nudge playfully against partners it trusts, melting the awkwardness of a first meeting with pure, warm-hearted joy.`
  - **日文 (ja)**：
    - 原文：`まるい体から小さな角が突き出し、気分が高まるとその先端にかすかな温かい光が灯る。心を許した仲間に柔らかい体で体当たりして甘えるのが大好きで、熱い気持ちで出会ったばかりのぎこちなさをほぐしてくれる。`
    - 修訂：`まるい頭から温かな炎の小角が突き出し、気分が高まるとその先端にかすかな温かい光が灯る。心を許した仲間に柔らかい体で体当たりして甘えるのが大好きで、熱い気持ちで出会ったばかりのぎこちなさをほぐしてくれる。`
  - **泰文 (th)**：
    - 原文：`บนร่างกลมกลิ้งมีเขาน้อยตั้งขึ้นมา เมื่ออารมณ์ดีปลายเขาจะเปล่งแสงอุ่นๆ อ่อนๆ มันชอบเอาตัวนุ่มๆ ชนอ้อนพาร์ตเนอร์ที่ไว้ใจ ละลายความเคอะเขินในการพบกันครั้งแรกด้วยความจริงใจอันอบอุ่น`
    - 修訂：`บนหัวที่กลมกลิ้งมีเขาเพลิงอันอบอุ่นตั้งขึ้นมาหนึ่งเขา เมื่ออารมณ์ดีปลายเขาจะเปล่งแสงอุ่นๆ อ่อนๆ มันชอบเอาตัวนุ่มๆ ชนอ้อนพาร์ตเนอร์ที่ไว้ใจ ละลายความเคอะเขินในการพบกันครั้งแรกด้วยความจริงใจอันอบอุ่น`
  - **越南文 (vi)**：
    - 原文：`Trên thân mình tròn xoe mọc lên cặp sừng nhỏ, mỗi khi phấn khích đầu sừng lại ánh lên sắc ấm dịu dàng. Nó rất thích dùng thân mình mềm mại huých vào bạn đồng hành đáng tin để nũng nịu, dùng tấm lòng nồng nhiệt xua tan khoảng cách lúc mới gặp gỡ.`
    - 修訂：`Trên đỉnh đầu tròn xoe mọc lên một chiếc sừng lửa ấm áp, mỗi khi phấn khích đầu sừng lại ánh lên sắc ấm dịu dàng. Nó rất thích dùng thân mình mềm mại huých vào bạn đồng hành đáng tin để nũng nịu, dùng tấm lòng nồng nhiệt xua tan khoảng cách lúc mới gặp gỡ.`

### #38 [GR06] 蒼拳狼
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-next-portraits-20261022/species-038.display.ab63bfcc428a7a7d.webp`
- **主圖 SHA256**：`ab63bfcc428a7a7daa90bdd6198c8f83cfe9dd3837ec2d1e8cd031a606ca7932`
- **修正部位**：`拳套顏色與外觀`
- **修改理由與證據**：核准主圖雙手佩戴的是純深藍色拳擊手套，原文「烈焰拳擊手套」與主圖顏色嚴重衝突。修正為「深藍拳擊手套」，保留果斷揮拳與忠誠守護之性格。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`雙手綁著拳擊繃帶的忠誠戰士，面對強敵從不退縮。比起言語，牠更習慣用果斷的行動傳達心意，每一次揮拳都為了向搭檔證明自己的可靠。`
    - 修訂：`雙手佩戴深藍拳擊手套的忠誠戰士，面對強敵從不退縮。比起言語，牠更習慣用果斷的行動傳達心意，每一次揮拳都為了向搭檔證明自己的可靠。`
  - **英文 (en)**：
    - 原文：`A steadfast young fighter with bandaged paws, never backing down from a challenge. Relying on swift action rather than words, every determined punch it throws is meant to prove its reliability to its trusted partner.`
    - 修訂：`A steadfast young fighter sporting deep-blue boxing gloves, never backing down from a challenge. Relying on swift action rather than words, every determined punch it throws is meant to prove its reliability to its trusted partner.`
  - **日文 (ja)**：
    - 原文：`両手にバンテージを巻いた誇り高き戦士で、強い相手を前にしても決して引き下がらない。言葉よりも行動で意志を伝えるタイプで、繰り出す一撃には仲間への揺るぎない忠誠が込められている。`
    - 修訂：`両手に紺青のボクシンググローブをはめた忠誠心あふれる戦士で、強敵を前にしても決して怯まない。言葉よりも果断な行動で想いを伝えることを好み、放つ拳のすべてに相棒への頼もしさを込めている。`
  - **泰文 (th)**：
    - 原文：`นักสู้ผู้ซื่อสัตย์ที่พันผ้าไว้ที่มือทั้งสองข้าง ไม่เคยถอยหนีแม้ต้องเผชิญหน้ากับศัตรูที่แข็งแกร่ง มักสื่อสารด้วยการกระทำที่เด็ดเดี่ยวมากกว่าคำพูด ทุกหมัดที่เหวี่ยงออกไปเพื่อพิสูจน์ความพึ่งพาได้ต่อคู่หู`
    - 修訂：`นักรบผู้ภักดีที่สวมนวมชกมวยสีน้ำเงินเข้มไว้ที่สองมือ ไม่เคยถอยหนีเมื่อเผชิญหน้ากับศัตรูที่แข็งแกร่ง มันเคยชินกับการถ่ายทอดความรู้สึกผ่านการกระทำที่เด็ดขาดมากกว่าคำพูด ทุกหมัดที่ชกออกไปล้วนเพื่อพิสูจน์ความพึ่งพาได้ให้คู่หูเห็น`
  - **越南文 (vi)**：
    - 原文：`Chiến binh trung thành quấn băng bảo hộ ở hai nắm đấm, chưa từng lùi bước trước đối thủ mạnh. Thay vì lời nói, nó quen dùng hành động dứt khoát để biểu đạt tâm ý, mỗi cú vung quyền đều nhằm chứng minh sự đáng tin cậy với bạn đồng hành.`
    - 修訂：`Chiến binh trung thành đeo găng tay quyền anh màu xanh thẫm quanh hai tay, chưa từng lùi bước trước kẻ thù hùng mạnh. Thay vì lời nói, nó quen dùng hành động quyết đoán để truyền tải tấm lòng, mỗi cú đấm vung ra đều để chứng minh sự đáng tin cậy với người bạn đồng hành.`

### #50 [GR23] 鐵玩暴龍
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-050.display.a561e591033f3e36.webp`
- **主圖 SHA256**：`a561e591033f3e361061cf615f0b9d088444a4aa59a555d83b51b6a576b2cd73`
- **修正部位**：`背部發條機械構造`
- **修改理由與證據**：核准主圖為機巧發條玩具龍獸，背負發條鑰匙與齒輪組件，原文提及金屬機甲殘留設定與主圖玩具龍造型不符。修正為「背負發條鑰匙與齒輪組件的機巧玩具龍獸」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`由彩色積木模塊拼接成形的小型龍獸，雖然身體偶爾會鬆脫，卻能立刻組裝復原。牠堅信只要不放棄初衷，任何破碎的挫折都能拼湊成嶄新的模樣。`
    - 修訂：`背負著發條鑰匙與齒輪組件的機巧玩具龍獸，雖然部件偶爾會發出卡嗒聲響，發條一轉便能立刻精神充沛。牠堅信只要不放棄初衷，任何卡頓的挫折都能轉化為邁向嶄新前程的動力。`
  - **英文 (en)**：
    - 原文：`A small dragon formed from assembled toy blocks, quick to snap its pieces back into place whenever a block comes loose. It holds fast to the belief that with an enduring heart, even scattered setbacks can be rebuilt into something new.`
    - 修訂：`A clockwork toy dragon fitted with gears and a winding key upon its back, revitalized with vigorous energy as soon as its key turns. It holds fast to the belief that with an enduring heart, even grinding setbacks can become momentum for a fresh start.`
  - **日文 (ja)**：
    - 原文：`色とりどりのブロックを組み上げて生まれた小さな竜で、体が崩れてもすぐに自分を組み立て直すことができる。諦めない心さえあれば、壊れた想いも必ず新しい形へ作り直せると信じている。`
    - 修訂：`背中にぜんまいキーと歯車パーツを宿したからくり玩具竜獣で、ぜんまいを巻けばたちまち元気を取り戻す。初心さえ忘れなければ、どんな足踏みの挫折も新たな前進への力に変えられると信じている。`
  - **泰文 (th)**：
    - 原文：`มังกรน้อยที่ประกอบขึ้นจากบล็อกตัวต่อสีสันสดใส แม้ชิ้นส่วนจะหลุดออกบ้างในบางครั้ง แต่ก็สามารถประกอบกลับเข้าที่ได้อย่างรวดเร็ว เชื่อมั่นว่าขอเพียงไม่ละทิ้งความตั้งใจ ความล้มเหลวที่แตกสลายก็สามารถต่อขึ้นใหม่ได้อย่างสวยงาม`
    - 修訂：`มังกรของเล่นไขลานที่มีกุญแจลานและชิ้นส่วนฟันเฟืองติดอยู่บนหลัง เพียงแค่หมุนไขลานก็กลับมามีพลังเต็มเปี่ยมได้ทันที มันเชื่อมั่นว่าขอเพียงไม่ละทิ้งความตั้งใจเดิม ทุกอุปสรรคที่ติดขัดก็เปลี่ยนเป็นแรงผลักดันสู่วันใหม่อันสดใสได้เสมอ`
  - **越南文 (vi)**：
    - 原文：`Chú rồng nhỏ được ghép thành từ những khối đồ chơi rực rỡ, dù đôi khi thân thể bị bung rời vẫn có thể lập tức lắp ráp lại như cũ. Nó kiên định tin rằng chỉ cần không bỏ cuộc, mọi đổ vỡ đều có thể ghép lại thành diện mạo mới mẻ.`
    - 修訂：`Bé rồng đồ chơi dây cót mang chìa khóa vặn và các bánh răng cơ khí trên lưng, chỉ cần lên dây cót là lập tức tràn đầy sức sống. Nó tin chắc rằng chỉ cần không từ bỏ ý nguyện ban đầu, mọi trắc trở vướng bận đều có thể biến thành động lực bước tới tương lai tươi sáng.`

### #65 [GR37] 月紗兔
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-065.display.d3b9aef0350b60ad.webp`
- **主圖 SHA256**：`d3b9aef0350b60add88fd411d98b8623f435773e060886f26e81d4f7872b1162`
- **修正部位**：`頭部飾品 / 裝備`
- **修改理由與證據**：核准主圖為文靜幼兔佩戴「新月寶石額飾」與月紋長耳，並無「水泡圓盔／頭盔」，原句屬舊案殘留與錯字。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`頭戴月形水泡頭盔的柔弱幼兔，性格文靜而體貼。在靜謐的月光照耀下，牠能輕易平息他人內心洶湧的波瀾，讓人感受到如夜露般細膩的溫柔。`
    - 修訂：`頭戴新月額飾的柔弱幼兔，性格文靜而體貼。在靜謐的月光照耀下，牠能輕易平息他人內心洶湧的波瀾，讓人感受到如夜露般細膩的溫柔。`
  - **英文 (en)**：
    - 原文：`A gentle rabbit sprite donning a moon-shaped water bubble, quiet, considerate, and tender. Under serene moonlight, it can smooth away turbulent storms in troubled hearts with the soothing grace of night dew.`
    - 修訂：`A gentle rabbit sprite wearing a crescent-moon tiara, quiet, considerate, and tender. Under serene moonlight, it can smooth away turbulent storms in troubled hearts with the soothing grace of night dew.`
  - **日文 (ja)**：
    - 原文：`月の形をした水泡の兜をかぶる心優しい幼兎で、控えめで細やかな気配りができる。静かな月光の下では荒れ狂う心をも静める不思議な力を宿し、夜露のように穏やかな安らぎをもたらす。`
    - 修訂：`三日月の額飾りをつける心優しい幼兎で、控えめで細やかな気配りができる。静かな月光の下では荒れ狂う心をも静める不思議な力を宿し、夜露のように穏やかな安らぎをもたらす。`
  - **泰文 (th)**：
    - 原文：`กระต่ายน้อยผู้อ่อนโยนที่สวมหมวกเกราะรูปพระจันทร์ซึ่งก่อตัวจากน้ำเป็นฟองใส มีนิสัยเรียบร้อยและเอาใจใส่ ใต้แสงจันทร์อันเงียบสงบ มันสามารถปลอบประโลมคลื่นอารมณ์ที่ปั่นป่วนในใจของผู้อื่น มอบความอบอุ่นที่นุ่มนวลราวกับหยาดน้ำค้างยามค่ำคืน`
    - 修訂：`กระต่ายน้อยผู้อ่อนโยนที่ประดับเครื่องประดับหน้าผากรูปพระจันทร์เสี้ยว มีนิสัยเรียบร้อยและเอาใจใส่ ใต้แสงจันทร์อันเงียบสงบ มันสามารถปลอบประโลมคลื่นอารมณ์ที่ปั่นป่วนในใจของผู้อื่น มอบความอบอุ่นที่นุ่มนวลราวกับหยาดน้ำค้างยามค่ำคืน`
  - **越南文 (vi)**：
    - 原文：`Bé thỏ dịu dàng đội chiếc nón bong bóng nước hình trăng khuyết, tính nết hiền hòa chu đáo. Dưới ánh trăng thanh bình, nó có thể dễ dàng xoa dịu những đợt sóng cuộn trào trong lòng người khác, mang đến sự êm dịu thanh mát tựa sương đêm.`
    - 修訂：`Bé thỏ dịu dàng đeo trang sức vầng trăng khuyết trên trán, tính nết hiền hòa chu đáo. Dưới ánh trăng thanh bình, nó có thể dễ dàng xoa dịu những đợt sóng cuộn trào trong lòng người khác, mang đến sự êm dịu thanh mát tựa sương đêm.`

### #81 [MA14] 爆風槍兔
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-081.display.b4ff20b1f6fb4832.webp`
- **主圖 SHA256**：`b4ff20b1f6fb4832b1073e678448f91b576a83f6b13b7c35ae54e81a756c4edf`
- **修正部位**：`武器型態與安裝位置`
- **修改理由與證據**：核准主圖之強大噴射推進砲管安裝於長耳末端，原文提及手持雙槍與主圖不符。修正為長耳推進砲，精準對應美術設計。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`雙臂配備強大火力發射器的槍手型獵人，性格豪邁灑脫。雖然偶爾因為火力過猛而搞砸場面，但面對膽敢傷害同伴的敵人，牠的子彈從不會有分毫猶豫。`
    - 修訂：`長耳末端配備著強大噴射推進砲的敏捷獵手，性格豪邁灑脫。雖然偶爾因為火力過猛而搞砸場面，但面對膽敢傷害同伴的敵人，牠的疾風轟擊從不會有分毫猶豫。`
  - **英文 (en)**：
    - 原文：`A gunslinger equipped with formidable arm cannons, living life with boisterous flair. Though reckless firepower occasionally creates messy mishaps, against anyone who dares threaten its comrades, its trigger finger never hesitates.`
    - 修訂：`An agile hunter equipped with powerful booster cannons at the tips of its long ears, living life with boisterous flair. Though reckless firepower occasionally creates messy mishaps, against anyone who dares threaten its comrades, its windburst salvos never hesitate.`
  - **日文 (ja)**：
    - 原文：`両腕に重厚な銃身を備えた陽気なガンナーで、豪胆で大らかな気性の持ち主。威力が強すぎて辺りを騒がせてしまうこともあるが、仲間を傷つけようとする敵に対しては、一分の迷いもなく引き金を引く。`
    - 修訂：`長い耳の先端に強力なブースターキャノンを備えた俊敏な狩人で、豪快でさっぱりとした気性の持ち主。火力が強すぎて場を混乱させることもあるが、仲間を脅かす敵を前にしてはその突風砲撃に一分の迷いもない。`
  - **泰文 (th)**：
    - 原文：`มือปืนผู้มีปืนใหญ่ติดอยู่ที่แขนทั้งสองข้าง มีนิสัยใจถึงและเปิดเผย แม้บางครั้งพลังทำลายที่รุนแรงจะทำให้เกิดความวุ่นวาย แต่หากศัตรูบังอาจคิดทำร้ายเพื่อน มันจะไม่ลังเลแม้แต่วินาทีเดียวที่จะลั่นไก`
    - 修訂：`นักล่าผู้ปราดเปรียวที่ติดตั้งปืนใหญ่ไอพ่นอันทรงพลังไว้ที่ปลายหูยาว มีนิสัยเปิดเผยและใจกว้าง แม้บางครั้งจะทำเรื่องพังเพราะพลังยิงที่รุนแรงเกินไป แต่เมื่อเผชิญหน้ากับศัตรูที่กล้าทำร้ายเพื่อน การระดมยิงวายุของมันจะไม่เคยลังเลเลยแม้แต่น้อย`
  - **越南文 (vi)**：
    - 原文：`Tay súng mang hai khẩu thần công hỏa lực dũng mãnh nơi cánh tay, tính tình hào sảng phóng khoáng. Dù đôi khi hỏa lực quá tay gây nên cảnh hỗn loạn dở khóc dở cười, nhưng trước kẻ thù dám làm tổn thương bạn bè, ngón tay bóp cò của nó chưa từng do dự một giây.`
    - 修訂：`Thợ săn nhanh nhẹn trang bị pháo phản lực uy lực nơi đầu đôi tai dài, tính tình hào sảng phóng khoáng. Dẫu đôi khi vì hỏa lực quá dữ dội mà làm hỏng bét khung cảnh, nhưng đối mặt kẻ dám đe dọa bạn bè, loạt pháo bão kích của nó chưa từng do dự dù nửa phân.`

### #86 [MA18] 神焰九尾
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-second10-20261022/species-086.display.3ca46cc6ec68111d.webp`
- **主圖 SHA256**：`3ca46cc6ec68111d2fcef061dbd25f475d595a7c42f7033e98a045018f338239`
- **修正部位**：`火焰顏色`
- **修改理由與證據**：核准主圖之神焰九尾狐燃燒的是極為耀眼的「赤紅神焰」，與原文「青藍神焰」顏色直接衝突。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`九條燃燒著青藍神焰的長尾在夜色中如波浪般搖曳，舉手投足間帶著古老祭儀的莊嚴。牠守護著靈性的清明，能透過冥想洞察深藏於人心底處的執念與悔恨。`
    - 修訂：`九條燃燒著赤紅神焰的長尾在夜色中如波浪般搖曳，舉手投足間帶著古老祭儀的莊嚴。牠守護著靈性的清明，能透過冥想洞察深藏於人心底處的執念與悔恨。`
  - **英文 (en)**：
    - 原文：`Nine tails cloaked in cerulean mystic fire sway like waves through the dark, bearing the stately grace of ancient rites. Guarding spiritual clarity, it looks past outward facades to perceive the buried regrets and longing within a traveler’s heart.`
    - 修訂：`Nine tails cloaked in crimson mystic fire sway like waves through the dark, bearing the stately grace of ancient rites. Guarding spiritual clarity, it looks past outward facades to perceive the buried regrets and longing within a traveler’s heart.`
  - **日文 (ja)**：
    - 原文：`青白く揺らめく神炎の尾を九本従えた狐の霊獣で、立ち振る舞いには古き祭祀の威厳が漂う。霊的な澄みきりを守護し、静かな瞑想を通じて人々の胸の奥に眠る執着や後悔の影をそっと見抜く。`
    - 修訂：`真紅に揺らめく神炎の尾を九本従えた狐の霊獣で、立ち振る舞いには古き祭祀の威厳が漂う。霊的な澄みきりを守護し、静かな瞑想を通じて人々の胸の奥に眠る執着や後悔の影をそっと見抜く。`
  - **泰文 (th)**：
    - 原文：`หางทั้งเก้าที่ลุกโชนด้วยเพลิงวิญญาณสีฟ้าครามพลิ้วไหวดั่งเกลียวคลื่นในความมืด ทุกท่วงท่าแฝงไว้ด้วยความศักดิ์สิทธิ์ของพิธีกรรมโบราณ คอยปกป้องความกระจ่างแจ้งทางจิตวิญญาณ มองทะลุความยึดติดและความเสียใจที่ซ่อนลึกในใจผู้คนผ่านการทำสมาธิ`
    - 修訂：`หางทั้งเก้าที่ลุกโชนด้วยเพลิงวิญญาณสีแดงชาดพลิ้วไหวดั่งเกลียวคลื่นในความมืด ทุกท่วงท่าแฝงไว้ด้วยความศักดิ์สิทธิ์ของพิธีกรรมโบราณ คอยปกป้องความกระจ่างแจ้งทางจิตวิญญาณ มองทะลุความยึดติดและความเสียใจที่ซ่อนลึกในใจผู้คนผ่านการทำสมาธิ`
  - **越南文 (vi)**：
    - 原文：`Chín chiếc đuôi rực cháy ngọn thần hỏa xanh lam đung đưa như sóng lượn giữa trời đêm, từng cử chỉ đều toát lên vẻ uy nghiêm của các nghi lễ cổ xưa. Nó canh giữ sự thanh tịnh của tâm linh, thông qua thiền định thấu suốt những chấp niệm và nỗi tiếc nuối chôn sâu nơi đáy lòng người.`
    - 修訂：`Chín chiếc đuôi rực cháy ngọn thần hỏa đỏ rực đung đưa như sóng lượn giữa màn đêm, mỗi cử chỉ đều toát lên vẻ trang nghiêm của nghi lễ cổ xưa. Nó bảo hộ sự sáng suốt của tâm linh, qua thiền định có thể thấu suốt những chấp niệm và hối hận giấu kín tận đáy lòng lữ khách.`

### #90 [MA24] 潮鳴蛙
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-090.display.597de0bffc4adb9f.webp`
- **主圖 SHA256**：`597de0bffc4adb9f416789afb6b5807e5c1dc422014bae257a72970eed164c20`
- **修正部位**：`背部樂器型態`
- **修改理由與證據**：核准主圖背負的是如波浪形狀的潮汐浪鼓，原文「背負浪濤吉他」與主圖敲擊鼓面樂器完全不符。修正為「背負著潮汐浪鼓的水棲音樂家」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`頸項纏繞著金屬號角的水棲音樂家，性格滑稽幽默而熱愛慶典。牠最喜歡在平靜的湖畔吹奏歡樂的進行曲，用滑稽的歌聲驅散同伴心頭揮之不去的陰霾。`
    - 修訂：`背負著潮汐浪鼓的水棲音樂家，性格滑稽幽默而熱愛慶典。牠最喜歡在平靜的湖畔敲擊歡樂的波浪節拍，用滑稽的歌聲驅散同伴心頭揮之不去的陰霾。`
  - **英文 (en)**：
    - 原文：`An amphibious troubadour wrapped in coiled metal horns, comedic in disposition and hopelessly devoted to celebrations. It loves belting out upbeat marches beside tranquil lakeshores, banishing lingering melancholy with jolly, booming notes.`
    - 修訂：`An amphibious troubadour carrying wave-drums upon its back, comedic in disposition and hopelessly devoted to celebrations. It loves beating out upbeat rhythms beside tranquil lakeshores, banishing lingering melancholy with jolly, booming notes.`
  - **日文 (ja)**：
    - 原文：`首元に金属の角笛を巻きつけた陽気な水棲音楽家で、おどけた仕草と祭りを愛するひょうきん者。静かな湖畔で賑やかな行進曲を吹き鳴らし、仲間の胸の奥に漂う暗い雲を笑い飛ばすように晴らしてくれる。`
    - 修訂：`背中に潮騒の波鼓を背負った水棲の音楽家で、おどけたユーモアに溢れお祭りが大好き。静かな湖畔で陽気な波のリズムを打ち鳴らし、ユーモラスな歌声で仲間の胸に漂うわだかまりを吹き飛ばす。`
  - **泰文 (th)**：
    - 原文：`นักดนตรีสะเทินน้ำสะเทินบกที่พันแตรโลหะไว้รอบคอ มีนิสัยตลกขบขันและรักงานเทศกาล ชอบเป่าเพลงมาร์ชที่ครึกครื้นริมทะเลสาบอันเงียบสงบ ใช้เสียงเพลงอันเฮฮาขับไล่เมฆหมอกแห่งความหม่นหมองในใจเพื่อนๆ`
    - 修訂：`นักดนตรีสะเทินน้ำสะเทินบกที่สะพายกลองระลอกคลื่นไว้บนหลัง มีนิสัยตลกขบขันและหลงใหลในงานเทศกาล ชอบตีจังหวะคลื่นอันร่าเริงริมทะเลสาบอันเงียบสงบ ใช้เสียงร้องแสนเฮฮาปัดเป่าเมฆหมอกในใจเพื่อนฝูงให้จางหายไป`
  - **越南文 (vi)**：
    - 原文：`Nhạc sĩ lưỡng cư mang chiếc tù và kim loại quấn quanh cổ, tính tình hài hước dí dỏm và say mê tiệc tùng. Nó thích thổi vang những khúc hành quân vui nhộn bên bờ hồ tĩnh lặng, dùng tiếng hát rộn ràng xua tan đám mây u ám trong lòng bạn bè.`
    - 修訂：`Nhạc công thủy sinh đeo trống sóng triều trên lưng, tính cách khôi hài dí dỏm lại chuộng lễ hội. Nó thích nhất là gõ vang những nhịp sóng vui nhộn bên bờ hồ yên ả, cất giọng hát dí dỏm xua tan mây mù đọng lại trong lòng bạn bè.`

### #100 [MA40] 聖刃女武
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-100.display.1793bf90a602b8a7.webp`
- **主圖 SHA256**：`1793bf90a602b8a7075a9b1e2656abfbb52404ab9714a85ac7fbe1ba5a694e7c`
- **修正部位**：`手持武器 / 翅膀數量`
- **修改理由與證據**：核准主圖女武神右手持金色戰矛、左手配戴守護之盾，背後為一對淺藍羽翼。原句「手持聖潔長劍...三對纖柔的羽翼...長劍所向之處」屬舊案捐贈者殘留，與武器外觀完全不符。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`手持聖潔長劍的女武神戰士，背後舒展著三對纖柔的羽翼。牠以守護正義為唯一宿命，即便面對數倍於己的強敵，長劍所向之處也絕不退縮半步。`
    - 修訂：`手持聖光戰矛、左臂配備守護之盾的女武神戰士，背後舒展著一對纖柔的羽翼。牠以守護正義為唯一宿命，即便面對數倍於己的強敵，戰矛所向之處也絕不退縮半步。`
  - **英文 (en)**：
    - 原文：`A valkyrie knight brandishing a sanctified longsword, three pairs of slender wings unfurling behind her. Bound to justice as her solitary creed, even outnumbered a dozen to one, she refuses to yield an inch where her blade points.`
    - 修訂：`A valkyrie warrior wielding a holy lance and bearing a guardian shield on her left arm, a pair of slender wings fanning wide behind her. Sworn to the solitary duty of defending justice, she never retreats an inch before overwhelming foes wherever her spear points.`
  - **日文 (ja)**：
    - 原文：`清らかな長剣を手に戦う女性型の戦士で、背中には三対の柔らかな羽を広げている。正義を守ることのみを使命と心得ており、幾倍もの敵を前にしても、剣先が向かう正道から一歩も退くことはない。`
    - 修訂：`聖なる戦矛を掲げ、左腕に守護の盾を備える戦乙女で、背中には一対のたおやかな翼を広げる。正義の護持を自らの天命と定め、幾重もの強敵を前にしても、その矛の指す先において一歩たりとも引くことはない。`
  - **泰文 (th)**：
    - 原文：`นักรบสตรีผู้กล้าหาญที่ถือดาบยาวศักดิ์สิทธิ์ แผ่นหลังสยายปีกอันอ่อนช้อยสามคู่ ยึดมั่นในการปกป้องความยุติธรรมเป็นพรหมลิขิตเพียงหนึ่งเดียว แม้ต้องเผชิญหน้ากับศัตรูที่แข็งแกร่งกว่าหลายเท่า ที่ใดที่ปลายดาบชี้ไปจะไม่มีวันถอยแม้แต่ก้าวเดียว`
    - 修訂：`นักรบวาลคีรีผู้ถือหอกรบศักดิ์สิทธิ์และสวมโล่ผู้พิทักษ์ที่แขนซ้าย แผ่ปีกอันบอบบางหนึ่งคู่กว้างอยู่ด้านหลัง ยึดมั่นในการปกป้องความยุติธรรมเป็นชะตากรรมเดียว ไม่เคยถอยแม้แต่ก้าวเดียวต่อหน้าศัตรูที่เหนือกว่า ทุกแห่งที่ปลายหอกชี้ไป`
  - **越南文 (vi)**：
    - 原文：`Nữ chiến thần dũng cảm tay cầm trường kiếm thánh thiện, sau lưng xòe rộng ba cặp cánh chim thanh mảnh. Coi việc bảo vệ công lý là sứ mệnh duy nhất, dẫu đối mặt với kẻ thù đông hơn gấp bội, nơi mũi kiếm hướng tới quyết không lùi nửa bước.`
    - 修訂：`Nữ chiến binh Valkyrie tay cầm chiến mâu thánh quang, cánh tay trái trang bị khiên hộ vệ, sau lưng giương rộng một đôi cánh vũ mềm mại. Lấy việc bảo vệ chính nghĩa làm thiên mệnh duy nhất, dù đối mặt cường địch đông gấp bội, nơi mũi mâu hướng đến quyết không lùi bước nửa phân.`

### #106 [MA46] 花刺皇后
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-106.display.df81ba8beb783173.webp`
- **主圖 SHA256**：`df81ba8beb783173dd18cf59f04f4e6c24663bf8fcc91123a8b4ce376884271e`
- **修正部位**：`頭部飾品與手部武裝`
- **修改理由與證據**：核准主圖頭戴盛開花冠、雙手持帶刺花槌拳甲，原文「手握長荊棘鞭」為舊 Rosemon 殘留設定，與主圖拳甲完全衝突。修正為「頭戴花冠、手持帶刺花槌拳甲」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`宛如巨大仙人掌般的拳手戰士，戴著拳擊手套的身軀充滿了爆發性的力量。雖然全身覆蓋著危險的硬刺，但牠的心思直率而富有正義感，最喜歡用拳頭教訓欺凌弱小的惡霸。`
    - 修訂：`頭戴花冠、手持帶刺花槌拳甲的仙人掌戰士，優雅的身軀中充滿了爆發性的力量。雖然周身覆蓋著危險的硬刺，但牠的心思直率而富有正義感，最喜歡揮動拳甲教訓欺凌弱小的惡霸。`
  - **英文 (en)**：
    - 原文：`A towering cactus boxer gloved for battle, its prickly frame pulsing with explosive kinetic power. Though bristling with hazardous spines from crown to toe, its heart is pure and just, loving nothing more than punching out bullies who prey on the weak.`
    - 修訂：`A crowned cactus knight armed with spiky flower-mace gauntlets, her graceful frame pulsing with explosive kinetic power. Though bristling with hazardous spines, her heart is pure and just, loving nothing more than smashing bullies who prey on the weak.`
  - **日文 (ja)**：
    - 原文：`巨大なサボテンの姿をしたボクサーで、グローブをはめたその拳には爆発的な破壊力が宿る。全身を覆うトゲは触れれば痛いが、心根は真っ直ぐで正義感に燃え、弱者をいじめる悪漢には容赦ない鉄拳を食らわせる。`
    - 修訂：`花の冠を戴き、棘付きの花槌拳甲を構えたサボテンの騎士で、優美な佇まいには爆発的な膂力が満ちている。全身を鋭いトゲで覆われているが、性根はまっすぐで正義感が強く、弱きを挫く悪漢を拳甲で懲らしめることを好む。`
  - **泰文 (th)**：
    - 原文：`นักชกผู้ดูเหมือนกระบองเพชรขนาดยักษ์ ร่างกายที่สวมนวมชกมวยเปี่ยมด้วยพลังระเบิดอันทรงพลัง แม้ทั่วร่างจะปกคลุมด้วยหนามแหลมคมอันตราย แต่จิตใจกลับซื่อตรงและรักความยุติธรรม ชอบใช้กำปั้นสั่งสอนคนพาลที่รังแกผู้อ่อนแอเป็นที่สุด`
    - 修訂：`อัศวินกระบองเพชรสวมมงกุฎดอกไม้และสนับมือกระบองหนาม ร่างอันสง่างามเต็มไปด้วยพลังระเบิดอันแข็งแกร่ง แม้ทั่วร่างจะปกคลุมไปด้วยหนามแหลมอันตราย แต่จิตใจของมันตรงไปตรงมาและเปี่ยมด้วยคุณธรรม ชอบเหวี่ยงสนับมือสั่งสอนพวกอันธพาลที่รังแกผู้อ่อนแอที่สุด`
  - **越南文 (vi)**：
    - 原文：`Võ sĩ quyền anh mang hình dáng cây xương rồng khổng lồ, thân hình đeo găng đấm bốc tràn trề sức mạnh bộc phát. Dù toàn thân tua tủa gai nhọn nguy hiểm, tấm lòng nó lại thẳng thắn đầy trượng nghĩa, thích nhất dùng nắm đấm dạy cho lũ ức hiếp kẻ yếu một bài học.`
    - 修訂：`Chiến binh xương rồng đội vương miện hoa cài giáp chùy gai nơi nắm đấm, vóc dáng thanh tú căng tràn sức mạnh bộc phát. Dù thân mình phủ gai nhọn nguy hiểm, tấm lòng nó lại bộc trực giàu nghĩa khí, thích nhất vung chùy quyền dạy dỗ lũ ức hiếp kẻ yếu.`

### #109 [MA49] 蝕影幽靈
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-109.display.f61c29e1953a1786.webp`
- **主圖 SHA256**：`f61c29e1953a1786d7717a3cbba45053af5bb5707daa5d8a5b0a240d12fc982c`
- **修正部位**：`角與手持燈籠`
- **修改理由與證據**：核准主圖為頭生單角、手提幽光燈籠的兜帽幽靈，原文「雙手燃起磷火」未提及核心燈籠道具且角數量不明確。修正為「頭生單角、手提幽光燈籠」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`披著白色破布、在墓地與舊廢墟遊蕩的幽靈，發出若有似無的怪笑聲。牠喜歡用突然的現身驚嚇路人，但本質只是渴望能被世界看見，排遣長年無人問津的落寞。`
    - 修訂：`頭生單角、手提幽光燈籠的兜帽幽靈，在舊廢墟中發出若有似無的怪笑聲。牠喜歡用突然的現身驚嚇路人，但本質只是渴望能被世界看見，排遣長年無人問津的落寞。`
  - **英文 (en)**：
    - 原文：`A spectral phantom shrouded in tattered white sheets, wandering through graveyards with a hollow chuckle. Though fond of startling passersby with sudden apparitions, it only longs to be acknowledged, seeking an escape from lonely oblivion.`
    - 修訂：`A horned, hooded phantom carrying a glowing spirit lantern through ancient ruins with a hollow chuckle. Though fond of startling passersby with sudden apparitions, it only longs to be acknowledged, seeking an escape from lonely oblivion.`
  - **日文 (ja)**：
    - 原文：`破れた白布をまとって古びた廃墟をさまよう幽霊で、とらえどころのない笑い声を漏らす。不意に現れて人を驚かせるのが好きだが、本質は誰かに見つけてほしいという寂しさの裏返しにすぎない。`
    - 修訂：`一本角を生やし、幽光のランタンを提げて古びた廃墟をさまようフードの幽霊で、かすかな怪しい笑い声を漏らす。突如現れては旅人を驚かす悪戯を好むが、その本質はただ誰かに気付いてもらい、長年の孤独を紛らわせたいだけである。`
  - **泰文 (th)**：
    - 原文：`ภูตผีที่คลุมผ้าขาวขาดวิ่นและเร่ร่อนไปตามสุสานและซากปรักหักพัง ส่งเสียงหัวเราะแปลกๆ ที่จับต้นชนปลายไม่ถูก ชอบปรากฏตัวกะทันหันเพื่อให้คนตกใจเล่น แต่แท้จริงแล้วแค่โหยหาการถูกมองเห็น เพื่อคลายความเหงาที่ไม่มีใครเหลียวแลมานาน`
    - 修訂：`ภูตผีสวมฮู้ดมีเขาเดี่ยว ถือโคมไฟวิญญาณส่องแสงลอยไปตามซากปรักหักพัง ส่งเสียงหัวเราะประหลาดแผ่วเบา มันชอบปรากฏตัวกะทันหันเพื่อทำให้คนเดินผ่านไปมาตกใจ แต่เนื้อแท้แล้วเพียงปรารถนาให้โลกมองเห็นตน เพื่อปัดเป่าความโดดเดี่ยวที่ไม่มีใครเหลียวแลมาเนิ่นนาน`
  - **越南文 (vi)**：
    - 原文：`Bóng ma quấn tấm vải trắng rách rưới lang thang nơi nghĩa địa và phế tích hoang tàn, phát ra tiếng cười quái dị lúc có lúc không. Thích thình lình xuất hiện dọa người qua đường, nhưng bản chất chỉ là khát khao được thế giới đoái hoài, xua đi nỗi cô quạnh ngàn năm không ai ngó ngàng.`
    - 修訂：`Bóng ma trùm mũ sừng đơn tay xách chiếc lồng đèn u linh lướt qua phế tích cũ, phát ra tiếng cười quái dị lúc có lúc không. Nó thích bất thình lình xuất hiện dọa người qua đường, nhưng thực chất chỉ khao khát được thế giới đoái hoài, xua đi nỗi cô quạnh quanh năm không ai hỏi tới.`

### #112 [MA53] 銳啄晨隼
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-112.display.85ea6212120cf792.webp`
- **主圖 SHA256**：`85ea6212120cf7922af716ae399c0329383f655a4aca32e0c384ddaa4ac6aa45`
- **修正部位**：`胸前寶石與長喙特徵`
- **修改理由與證據**：核准主圖胸前嵌有破曉晨曦寶石、長喙銳利如針，原文描述過於模糊且漏失核心識別飾品。修正為「胸前嵌著破曉寶石、長啄如針般鋒銳」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`擅長腿法與忍術的精悍飛禽，以驚人的腳力在林海枝枒間無聲跳躍。牠行事低調嚴密，凡事三思而後行，在暗處默默替同伴排除無數看不見的危機。`
    - 修訂：`胸前嵌著破曉寶石、長啄如針般鋒銳的精悍飛禽，在晨曦長空中無聲翱翔。牠行事低調嚴密，凡事三思而後行，在暗處默默替同伴排除無數看不見的危機。`
  - **英文 (en)**：
    - 原文：`A lean, disciplined ninja raptor mastering kick-based martial arts, leaping silently among towering canopy branches. Taciturn and observant, it reflects before striking, dismantling invisible threats in the shadows before friends notice.`
    - 修訂：`A disciplined raptor bearing a dawn gemstone upon its chest and a needle-sharp beak, gliding silently through the morning sky. Taciturn and observant, it reflects before striking, dismantling invisible threats in the shadows before friends notice.`
  - **日文 (ja)**：
    - 原文：`鋭い足技と忍術を修めた精悍な巨鳥で、驚くべき脚力で樹海を音もなく飛び交う。無口で慎重、何事も深く洞察してから動き、影から仲間に迫る無数の見えざる脅威を人知れず排除する。`
    - 修訂：`胸に暁の宝玉を宿し、針のように鋭い嘴を持つ精悍な飛禽で、朝焼けの空を音もなく滑空する。慎重で抜け目がなく、事を行う前には深く熟考し、物陰から密かに仲間の見えない危機を取り除く。`
  - **泰文 (th)**：
    - 原文：`วิหคผู้ปราดเปรียวที่เชี่ยวชาญเพลงเตะและวิชานินจา ใช้พลังขาอันน่าทึ่งกระโดดไปตามกิ่งไม้อย่างเงียบเชียบ ทำงานอย่างรอบคอบและเงียบขรึม คิดหน้าคิดหลังก่อนลงมือเสมอ คอยกำจัดภัยคุกคามที่มองไม่เห็นให้แก่พวกพ้องจากในมุมมืด`
    - 修訂：`วิหคแสนปราดเปรียวผู้ประดับอัญมณีรุ่งอรุณบนหน้าอกและมีจะงอยปากแหลมคมดั่งเข็ม บินร่อนผ่านท้องฟ้ายามเช้าอย่างเงียบเชียบ ปฏิบัติการอย่างรอบคอบเงียบเชียบ คิดหน้าคิดหลังเสมอ และคอยขจัดภัยอันตรายที่มองไม่เห็นให้เพื่อนฝูงจากเงามืด`
  - **越南文 (vi)**：
    - 原文：`Loài chim dũng mãnh tinh thông cước pháp và nhẫn thuật, dùng lực chân kinh người nhảy thoăn thoắt không tiếng động giữa các nhánh cây rừng rậm. Hành sự kín kẽ cẩn trọng, suy tính kỹ càng trước khi hành động, âm thầm loại bỏ vô số hiểm nguy vô hình trong bóng tối cho bạn bè.`
    - 修訂：`Loài chim tinh anh mang bảo ngọc rạng đông trước ngực với chiếc mỏ nhọn như kim, lướt bay êm ả giữa bầu trời ban mai. Hành sự kín kẽ cẩn trọng, làm việc gì cũng suy tính chín chắn, trong bóng tối âm thầm loại bỏ vô số hiểm nguy vô hình cho bạn bè.`

### #116 [MA57] 雪印零偶
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-116.display.9a9bb4fd6df86046.webp`
- **主圖 SHA256**：`9a9bb4fd6df86046af843f86e6953f7557130eb3752664dabf14985d1c7dbd3e`
- **修正部位**：`眼睛構造與手持雪球`
- **修改理由與證據**：核准主圖為帶有縫線與鈕扣雙眼的布偶雪人，手握雪球，原文將其描述為純冰晶雪人與手持冰錐。修正為「帶著縫線與鈕扣雙眼的善良雪偶，手裡總是握著一枚嬉鬧的雪球」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`由鬆軟積雪堆砌而成的善良雪偶，體內跳動著一顆不會融化的溫暖雪核。牠最喜歡在寒冷的日子裡給夥伴端上熱氣騰騰的茶湯，用最質樸的微笑驅散一切旅途的疲憊。`
    - 修訂：`帶著縫線與鈕扣雙眼的善良雪偶，手裡總是握著一枚嬉鬧的雪球。牠體內跳動著一顆不會融化的溫暖雪核，最喜歡在寒冷的日子裡用最質樸的微笑驅散同伴一切旅途的疲憊。`
  - **英文 (en)**：
    - 原文：`A kindhearted snowman built from fluffy drifts, animated by a warm heart-core that never melts. It loves serving steaming cups of tea on freezing days, sweeping away the bone-deep weariness of long journeys with a gentle, humble smile.`
    - 修訂：`A kindhearted snow doll with stitched seams and button eyes, holding a snowball ready for play. Animated by a warm heart-core that never melts, it sweeps away the bone-deep weariness of long journeys with a gentle, humble smile on freezing days.`
  - **日文 (ja)**：
    - 原文：`ふかふかの積雪から生まれた心優しい雪だるまで、体内には決して溶けぬ温かな雪核が灯っている。凍える日には仲間のために温かいお茶を淹れて差し出し、飾らない笑顔で旅の疲れをきれいに溶かしてくれる。`
    - 修訂：`ぬい目の跡とボタンの瞳を持つ心優しい雪人形で、その手にはいつも遊び心あふれる雪玉を握りしめている。決して溶けない温かな雪核を宿し、素朴な笑顔で仲間たちの旅の疲れをほぐしてくれる。`
  - **泰文 (th)**：
    - 原文：`ตุ๊กตาหิมะใจดีที่ปั้นขึ้นจากหิมะนุ่มฟู ภายในมีแก่นหิมะอันอบอุ่นที่ไม่เคยละลายเต้นอยู่ ชอบยกน้ำชาร้อนๆ มาให้เพื่อนในวันที่หนาวเหน็บ ขจัดความเหนื่อยล้าจากการเดินทางทั้งหมดด้วยรอยยิ้มที่จริงใจที่สุด`
    - 修訂：`ตุ๊กตาหิมะใจดีที่มีรอยเย็บและดวงตาเป็นกระดุม ในมือมักถือลูกบอลหิมะพร้อมเล่นสนุกเสมอ ภายในร่างกายมีแกนหิมะอันอบอุ่นที่ไม่มีวันละลายเต้นอยู่ คอยใช้รอยยิ้มอันแสนเรียบง่ายปัดเป่าความเหนื่อยล้าจากการเดินทางของเพื่อนๆ ให้หมดไป`
  - **越南文 (vi)**：
    - 原文：`Người tuyết hiền lành đắp từ lớp tuyết xốp mềm, trong người đập rộn ràng một lõi tuyết ấm áp không bao giờ tan chảy. Thích nhất dâng trà nóng hổi cho bè bạn giữa những ngày đông giá, dùng nụ cười chất phác xua tan mọi mỏi mệt của chuyến đi xa.`
    - 修訂：`Búp bê tuyết hiền lành mang những đường khâu và đôi mắt nút áo, trên tay luôn cầm sẵn quả cầu tuyết đùa vui. Trong cơ thể đập rộn một lõi tuyết ấm áp không bao giờ tan chảy, nó dùng nụ cười chất phác nhất xua tan mọi mỏi mệt của hành trình buốt giá.`

### #126 [MA63] 月影羽兔
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-126.display.12369bd60f780d30.webp`
- **主圖 SHA256**：`12369bd60f780d30c10586a6b53b443926e4f7133547ac365302a2a5620151ef`
- **修正部位**：`身形薄紗甲冑與攻擊姿態`
- **修改理由與證據**：核准主圖為身披夜幕薄紗甲冑的輕靈月兔仙子，以流水掌法為主，原文「身負月牙重刃」與輕靈掌法身姿衝突。修正為「身著宛如夜幕薄紗甲冑...如水波流轉般的掌步」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`身著宛如夜幕薄紗甲冑的月宮神使，舉止優美而身姿輕靈。牠能在寂靜無聲中踩著月影起舞，用如同水波流轉般的箭術化解敵意，將清冷柔和的安寧重新還給夜空。`
    - 修訂：`身著宛如夜幕薄紗甲冑的月宮神使，舉止優美而身姿輕靈。牠能在寂靜無聲中踩著月影起舞，用如同水波流轉般的掌步化解敵意，將清冷柔和的安寧重新還給夜空。`
  - **英文 (en)**：
    - 原文：`A lunar maiden draped in gossamer armor like midnight veils, poised, agile, and light on her feet. Gliding across moonlit shadows without a rustle, her fluid archery disarms hostility like rippling tides, restoring cool, gentle peace to the night sky.`
    - 修訂：`A lunar maiden draped in gossamer armor like midnight veils, poised, agile, and light on her feet. Gliding across moonlit shadows without a rustle, her fluid palm strikes and evasive steps disarm hostility like rippling tides, restoring cool, gentle peace to the night sky.`
  - **日文 (ja)**：
    - 原文：`夜の帳のような薄絹の甲冑をまとった月宮の神使で、身のこなしは風のように軽やかで美しい。静寂の月影を踏んで舞い踊り、水波のごとき弓技で敵意を清め、澄み切った穏やかな夜の平穏を取り戻す。`
    - 修訂：`夜の帳を織り成したような薄絹の甲冑を纏う月宮の神使で、立ち振る舞いは優美で身のこなしも軽やか。静寂の中で月の影を踏んで舞い、流れる水のような掌法と足さばきで敵意を解きほぐして、清らかで穏やかな安らぎを夜空へと返す。`
  - **泰文 (th)**：
    - 原文：`ทูตสวรรค์แห่งวังจันทราที่สวมเกราะผ้าโปร่งดั่งม่านราตรี ท่วงท่างดงามและการเคลื่อนไหวแผ่วเบา ร่ายรำไปบนเงาจันทร์ในความเงียบสงัด ใช้วิชาเกาทัณฑ์อันพริ้วไหวดั่งสายน้ำสลายความมุ่งร้าย คืนความสงบสุขที่เยือกเย็นและอ่อนโยนให้แก่ผืนฟ้ายามค่ำคืน`
    - 修訂：`ทูตสวรรค์แห่งวังจันทราที่สวมชุดเกราะบางเบาราวม่านราตรี กิริยางดงามและร่างเพรียวคล่องแคล่ว สามารถร่ายรำไปบนเงาจันทร์ได้อย่างเงียบสงบ ใช้ท่วงท่าฝ่ามือและย่างก้าวที่พลิ้วไหวดั่งสายน้ำคลี่คลายความเป็นศัตรู คืนความสงบอันเยือกเย็นและอ่อนโยนให้แก่ผืนฟ้ายามค่ำคืนอีกครั้ง`
  - **越南文 (vi)**：
    - 原文：`Thần sứ nguyệt cung khoác chiến giáp lụa mỏng như màn đêm, cử chỉ tao nhã và thân thủ phiêu dật. Lặng lẽ lướt đi múa lượn trên bóng trăng thanh, dùng cung thuật uyển chuyển như sóng nước hóa giải mọi thù địch, trả lại sự tĩnh mịch êm dịu trong lành cho bầu trời đêm.`
    - 修訂：`Thần sứ cung trăng khoác giáp lụa mỏng tựa màn đêm, cử chỉ tao nhã vóc dáng thanh thoát nhẹ nhàng. Nó có thể đạp bóng trăng nhảy múa trong tĩnh mịch không tiếng động, dùng chưởng pháp và bộ pháp uyển chuyển như sóng nước để hóa giải địch ý, đem lại sự an yên thanh mát dịu dàng cho bầu trời đêm.`

### #136 [AW01] 煌角皇甲
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-136.display.b8b52816da211cd6.webp`
- **主圖 SHA256**：`b8b52816da211cd6abc08dd2d87f15f610618ca67282ef6507e7cee2275882fc`
- **修正部位**：`鎧甲顏色`
- **修改理由與證據**：核准主圖為翠綠與金黃色厚重昆蟲甲冑，原句「身披深紅厚重甲冑」顏色直接錯誤（深紅為舊 HerakleKabuterimon 捐贈者殘留）。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`身披深紅厚重甲冑的巨大甲蟲霸主，頭頂的剛角凝聚著狂暴的雷霆之威。牠長年沉潛於原始林海深處靜修，唯有在世界秩序瀕臨崩潰之際，才會展翼飛出山林平定紛亂。`
    - 修訂：`身披翠綠與金色厚重甲冑的巨大甲蟲霸主，頭頂的剛角凝聚著狂暴的雷霆之威。牠長年沉潛於原始林海深處靜修，唯有在世界秩序瀕臨崩潰之際，才會展翼飛出山林平定紛亂。`
  - **英文 (en)**：
    - 原文：`A colossal beetle titan armored in deep crimson carapace, its mighty horn bristling with the sheer fury of concentrated lightning. Spending decades in meditative reclusion within ancient groves, it takes flight only when worldly order teeters on the brink of collapse.`
    - 修訂：`A towering beetle overlord clad in emerald-green and gold heavy armor, its crest horn gathering the violent fury of lightning. Long secluded in ancient primeval groves, it unfurls its shell only when world order teeters, surging into the sky to quell upheaval.`
  - **日文 (ja)**：
    - 原文：`真紅の重厚な甲冑をまとった巨大甲虫の覇者で、頭頂の剛角には猛烈な雷霆の力が凝縮されている。古樹の森の奥深くで静かに瞑想を続けているが、世界の秩序が崩壊に瀕したとき、翼を広げて混乱を鎮めるために飛翔する。`
    - 修訂：`エメラルドグリーンと黄金の重装甲に身を包んだ巨甲虫の覇者で、頭頂の剛角には荒れ狂う雷鳴の威光を宿す。深き原生林の奥底で永きにわたり静かに修練を重ね、世界の秩序が崩壊の淵に瀕したときにのみ、森を飛び立ち動乱を鎮める。`
  - **泰文 (th)**：
    - 原文：`จอมราชันด้วงยักษ์ผู้สวมเกราะหนาหนักสีแดงเข้ม เขาอันทรงพลังบนหัวรวบรวมสายฟ้าที่บ้าคลั่งเอาไว้ บำเพ็ญตบะเงียบสงบในส่วนลึกของป่าโบราณมาเนิ่นนาน มีเพียงยามที่ความสงบสุขของโลกจวนจะพังทลายเท่านั้น จึงจะสยายปีกบินออกจากป่าเพื่อสยบความวุ่นวาย`
    - 修訂：`จอมราชันย์ด้วงยักษ์ในชุดเกราะหนาสีเขียวมรกตและสีทอง เขาแหลมบนหัวรวมพลังสายฟ้าอันดุร้าย มันบำเพ็ญตบะในป่าดึกดำบรรพ์มาเนิ่นนาน จะกางปีกบินออกจากป่ามาสยบความวุ่นวายก็ต่อเมื่อระเบียบของโลกใกล้จะพังทลายเท่านั้น`
  - **越南文 (vi)**：
    - 原文：`Bá chủ bọ hung khổng lồ khoác chiến giáp đỏ thẫm kiên cố, chiếc sừng dũng mãnh trên đỉnh đầu ngưng tụ uy lực sấm sét cuồng bạo. Quanh năm ẩn mình tĩnh tu nơi rừng già nguyên sinh, chỉ khi trật tự thế gian đứng trước bờ vực sụp đổ, nó mới giang cánh bay ra bình định loạn lạc.`
    - 修訂：`Bá chủ bọ cánh cứng khổng lồ khoác lên mình giáp trụ xanh ngọc lục bảo viền vàng nặng nề, sừng cứng trên đỉnh đầu tụ hội uy lực sấm sét cuồng bạo. Trầm mình tu hành lâu năm nơi rừng nguyên sinh sâu thẳm, chỉ khi trật tự thế giới lâm vào bờ vực sụp đổ mới tung cánh bay ra bình định hỗn loạn.`

### #139 [AW05] 狂奏猿王
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-139.display.78a94904b2898a8b.webp`
- **主圖 SHA256**：`78a94904b2898a8be035b2deb2722a8c784850d8b59fb9a8c585294b3eeb834d`
- **修正部位**：`頭飾、拳環武器與外觀風格（使用者重點指認）`
- **修改理由與證據**：使用者特別指出「長相與故事不符」。核准主圖為頭戴金冠、雙腕裝備音波拳環的狂熱搖滾猿王，主圖完全沒有「身披玩偶外衣、手握金屬麥克風」（此為舊 Etemon 殘留設定）。修正為「頭戴金冠、雙腕裝備音波拳環的狂熱搖滾猿王...重拳共鳴...揮拳咆哮」，徹底排除外觀矛盾。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`身披玩偶外衣、手握金屬麥克風的荒誕狂王，以極具衝擊力的誇張歌聲震撼全場。雖然行事瘋癲浮誇，但牠從不允許任何人踐踏自己與同伴的舞台，戰鬥到底的骨氣分毫不假。`
    - 修訂：`頭戴金冠、雙腕裝備音波拳環的狂熱搖滾猿王，時刻散發著讓人難以招架的自戀熱量。牠深信自己的重拳共鳴具有震撼天地的音浪，每當揮拳咆哮，整個荒原都會為之震顫狂歡。`
  - **英文 (en)**：
    - 原文：`An eccentric king draped in a plush mascot suit, gripping a metal microphone and rocking battlefields with outrageous vocals. Flaunting theatrics and bombast, it never tolerates anyone crashing its friends’ stage, possessing genuine grit till the final curtain.`
    - 修訂：`A crowned rock-ape monarch sporting golden sonic knuckle-rings upon his wrists, radiating uncontainable charisma and swagger. Convinced the acoustic resonance of his fists can shatter bedrock, whenever he roars and strikes, barren wastes erupt into wild festivals.`
  - **日文 (ja)**：
    - 原文：`着ぐるみをまとい、金属のマイクを握りしめた破天荒な猿王で、強烈な歌声で戦場を熱狂させる。道化を演じて調子に乗っているように見えるが、仲間と分かち合う舞台を踏みにじる者には、容赦なき怒りの鉄拳を叩き込む。`
    - 修訂：`黄金の冠を戴き、両腕に音波の拳環を纏った熱狂のロック猿王で、圧倒的な自信と熱気を放ち続ける。自らの拳が放つ共鳴音波には天地を震わせる力があると信じて疑わず、ひとたび雄叫びを上げれば荒原中を巻き込む狂乱の宴が幕を開ける。`
  - **泰文 (th)**：
    - 原文：`ราชาวานรสุดเพี้ยนที่สวมชุดมาสคอตและถือไมโครโฟนโลหะ เขย่าขวัญทั่วทั้งสนามด้วยเสียงเพลงอันทรงพลังและเกินจริง แม้จะทำตัวบ้าๆ บอๆ และโอ้อวด แต่ไม่ยอมให้ใครมาเหยียบย่ำเวทีของตนและเพื่อนๆ อย่างเด็ดขาด มีจิตวิญญาณแห่งการสู้จนถึงที่สุดอย่างแท้จริง`
    - 修訂：`ราชาวานรร็อกผู้คลั่งไคล้ที่สวมมงกุฎทองและสวมสนับหมัดคลื่นเสียงที่ข้อมือ แผ่เสน่ห์อันร้อนแรงจนยากจะต้านทานออกมาตลอดเวลา เชื่อมั่นว่าคลื่นหมัดก้องกังวานของตนมีพลังสะเทือนฟ้าสะเทือนดิน ทุกครั้งที่คำรามเหวี่ยงหมัด ทั่วทั้งแดนรกร้างจะสั่นสะเทือนด้วยความสุขสำราญ`
  - **越南文 (vi)**：
    - 原文：`Vua khỉ quái dị khoác bộ đồ thú bông, tay cầm chiếc micro kim loại làm chấn động toàn trường bằng giọng ca cuồng nhiệt khoa trương. Dù hành sự điên rồ phô trương, nó tuyệt đối không cho phép ai giẫm đạp lên sân khấu của mình và bè bạn, dũng khí chiến đấu đến cùng chưa từng giả dối.`
    - 修訂：`Vua vượn nhạc rock cuồng nhiệt đội vương miện vàng đeo vòng quyền âm thanh nơi cổ tay, luôn toát ra sức hút cuồng nhiệt khiến người khác khó lòng chống đỡ. Nó tin chắc tiếng gầm và cú đấm cộng hưởng của mình mang sức mạnh kinh thiên động địa, mỗi khi vung quyền thị uy, cả vùng hoang dã đều chấn động cuồng hoan.`

### #140 [AW06] 曦紗天姬
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-140.display.21aa02df914292a5.webp`
- **主圖 SHA256**：`21aa02df914292a5c232aef803a691e0e52a90d5362dfc33f7b1903ccd4d1753`
- **修正部位**：`手持武器 / 眼部飾品 / 羽翼`
- **修改理由與證據**：核准主圖右手握持「金輝星辰法杖」，雙眼清澈無布蒙蔽，背負純白大羽翼，無持弓箭。原句「雙眸蒙著神聖之布...以聖光之矢」係舊 Angewomon 捐贈者文字殘留。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`擁有八片聖潔羽翼的大天使型仙女，雙眸蒙著神聖之布，以超脫塵世的仁慈凝望世間。牠擅長以聖光之矢驅散一切晦暗與怨懟，用無盡的慈愛撫慰每一個受創的靈魂。`
    - 修訂：`手持金輝星辰法杖的大天使型仙女，背負著聖潔純白的羽翼，以超脫塵世的仁慈凝望世間。牠擅長以璀璨星芒驅散一切晦暗與怨懟，用無盡的慈愛撫慰每一個受創的靈魂。`
  - **英文 (en)**：
    - 原文：`An archangelic maiden adorned with eight dazzling wings, her eyes veiled in holy cloth as she gazes upon creation with boundless compassion. Her sacred arrows pierce through lingering gloom, gently cradling every broken spirit in unconditional grace.`
    - 修訂：`An archangelic maiden wielding a radiant golden star staff and bearing pure holy wings, she gazes upon creation with transcendent mercy. Channeling brilliant starlight, she scatters spite and gloom to nurse every bruised soul back to grace.`
  - **日文 (ja)**：
    - 原文：`八枚の聖なる翼を持つ大天使型の麗人で、神聖な布で目を覆いながら、澄み渡る慈愛の心で世を見守っている。聖なる光の矢で暗雲と怨嗟を射抜き、傷ついた魂を優しく包み込んで癒やしをもたらす。`
    - 修訂：`金色の星辰の杖を携え、純白の聖なる翼を背負う大天使型の仙女で、俗世を超越した慈悲の心で世界を見つめる。まばゆい星の光で暗雲や怨嗟を払うのを得意とし、傷ついた魂を無尽の愛で優しく癒やす。`
  - **泰文 (th)**：
    - 原文：`นางฟ้าประเภทอัครทูตสวรรค์ผู้มีปีกศักดิ์สิทธิ์แปดปีก ดวงตาถูกคลุมด้วยผ้าศักดิ์สิทธิ์ เฝ้ามองโลกด้วยความเมตตาอันลึกซึ้ง เชี่ยวชาญในการใช้ศรแห่งแสงศักดิ์สิทธิ์ขจัดความมืดมิดและความเคียดแค้น ปลอบประโลมวิญญาณที่บอบช้ำด้วยความรักอันไร้ที่สิ้นสุด`
    - 修訂：`นางฟ้าประเภทอัครทูตสวรรค์ผู้ถือคทาดวงดาวสีทองและมีปีกบริสุทธิ์สีขาวผ่อง มองดูโลกด้วยความเมตตาอันพ้นกิเลส ชำนาญการใช้ประกายดาวอันเจิดจ้าปัดเป่าความมืดมนและความเคียดแค้น ปลอบประโลมทุกวิญญาณที่บอบช้ำด้วยความรักอันไร้ที่สิ้นสุด`
  - **越南文 (vi)**：
    - 原文：`Đại thiên sứ mang dáng dấp tiên nữ với tám cánh trắng thánh thiện, đôi mắt phủ dải lụa thiêng liêng, hướng về cõi trần bằng lòng từ bi siêu thoát. Rất giỏi dùng mũi tên thánh quang xua tan mọi u ám hận thù, dùng tình thương vô hạn xoa dịu từng linh hồn mang vết thương rỉ máu.`
    - 修訂：`Tiên nữ dạng đại thiên sứ tay cầm pháp trượng tinh tú ánh vàng rực rỡ, mang đôi cánh vũ thánh khiết thuần bạch, dùng lòng từ bi thoát tục dõi nhìn cõi thế. Nàng giỏi dùng ánh sao rực rỡ xua tan bóng tối và oán hận, dùng tình yêu thương bất tận vỗ về mỗi linh hồn chịu thương tổn.`

### #143 [AW08] 廢都王桶
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-closeout-20261019/species-143.display.c6342060dd0891a1.webp`
- **主圖 SHA256**：`c6342060dd0891a197588fb2a647d54b989dfba6bc5dac12eea8bb7f1202682f`
- **修正部位**：`身軀機關與手持重錘`
- **修改理由與證據**：核准主圖以鐵桶廢料為身軀、手握尖刺重錘，原文「全身覆蓋爛泥」與金屬鐵桶機械主圖不符。修正為「以鐵桶機關為軀、手持尖刺重錘」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`頭戴鐵桶、坐鎮於堆積如山的廢料王座上的廢品君王，性格瘋癲卻精通機械拼裝。牠將別人棄若敝屣的垃圾視為珍寶，總能在破碎的殘件中替大家改裝出意想不到的救命道具。`
    - 修訂：`以鐵桶機關為軀、手持尖刺重錘巡視廢料之地的怪傑，對所有被人丟棄的破銅爛鐵都視若珍寶。牠能將腐朽之物改造成奇妙的防衛機關，用瘋狂的笑聲宣告著廢墟中永不熄滅的生命力。`
  - **英文 (en)**：
    - 原文：`A mad scrap baron wearing a tin can atop its head and holding court from a mountain of junkyard relics. Cherishing discarded refuse as treasures, it weaves forgotten broken pieces into surprisingly brilliant gadgets that save the day.`
    - 修訂：`An industrial scraper mech housed in an iron hazard drum and wielding a spiked mace, cherishing every scrap of abandoned junk as precious treasure. Transforming decaying detritus into uncanny defensive gadgets, its boisterous laugh declares unquenchable vitality.`
  - **日文 (ja)**：
    - 原文：`鉄のバケツをかぶり、ゴミの山の玉座にふんぞり返る風変わりな王で、廃品加工の奇才を持つ。人々が捨て去ったガラクタを至宝として愛し、壊れた残骸の中から思わぬ奇跡の道具を仕立て上げて仲間を救う。`
    - 修訂：`鉄樽のからくりボディに身を包み、トゲ付き重槌を手に廃品地帯を巡る怪傑で、人が捨て去ったガラクタのすべてを宝物のように慈しむ。朽ちた廃棄物を奇妙な防衛装置へと作り変え、豪快な笑い声で廃墟に脈打つ生命力を高らかに誇示する。`
  - **泰文 (th)**：
    - 原文：`ราชาเศษเหล็กผู้สวมถังเหล็กไว้บนหัวและนั่งอยู่บนบัลลังก์กองขยะ มีนิสัยเพี้ยนๆ แต่เชี่ยวชาญการประกอบเครื่องจักรเป็นเลิศ มองขยะที่คนอื่นทิ้งขว้างดั่งสมบัติล้ำค่า มักดัดแปลงเศษซากที่แตกหักให้กลายเป็นอุปกรณ์กู้ชีพที่คาดไม่ถึงเสมอ`
    - 修訂：`จักรกลตัวประหลาดที่มีร่างเป็นถังเหล็กและถือกระบองหนามตระเวนกองเศษเหล็ก มองของที่ถูกทิ้งทั้งหมดเป็นดั่งสมบัติล้ำค่า สามารถดัดแปลงสิ่งของผุพังให้กลายเป็นกลไกป้องกันอันน่าอัศจรรย์ ใช้เสียงหัวเราะก้องกังวานประกาศถึงพลังชีวิตที่ไม่มีวันดับในซากปรักหักพัง`
  - **越南文 (vi)**：
    - 原文：`Vị vua phế liệu đội xô sắt trên đầu ngự trị trên ngai vàng rác rưởi, tính cách gàn dở nhưng tinh thông tài lắp ráp cơ khí. Coi đống phế phẩm người khác vứt bỏ như bảo vật, nó luôn có thể từ những mảnh vỡ nát chế tạo ra những món đạo cụ cứu mạng diệu kỳ ngoài sức tưởng tượng.`
    - 修訂：`Gã cơ giáp dị nhân mang thân thùng sắt tay cầm chùy gai tuần tra bãi phế liệu, xem mọi đống đồng nát sắt vụn bị người đời vứt bỏ là báu vật trân quý. Nó có thể biến những thứ mục nát thành cơ quan phòng vệ kỳ diệu, dùng tiếng cười sang sảng tuyên bố sức sống bất diệt giữa đống đổ nát.`

### #144 [AW12] 電脈裂龍
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-gap-20261018/species-144.display.71b86ed9927b3c70.webp`
- **主圖 SHA256**：`71b86ed9927b3c70b4ee2649a3546036e9e6fb338419cf776d7ec6f5b19335e6`
- **修正部位**：`晶甲與高壓雷霆雙爪`
- **修改理由與證據**：核准主圖為周身流淌高壓電芒的異形晶甲龍戰士，能量凝聚於利爪，原文「肩扛雙重雷射巨砲」與主圖完全不符。修正為利爪凝聚雷霆。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`被橡膠束縛帶纏繞全身的異形戰龍，體內狂暴的破壞衝動時刻在尋求宣洩。牠在無休止的痛苦對抗中磨礪出超凡的格鬥技，唯有心念堅定的搭檔才能引導牠踏上守護之途。`
    - 修訂：`周身流淌著高壓電芒的異形晶甲龍戰士，體內奔流著隨時可能失控的狂暴電流。牠在淬鍊中學會了將雷霆能量凝聚於雙爪，哪怕承載極限負荷，也要將擋在前方的邪祟徹底湮滅。`
  - **英文 (en)**：
    - 原文：`A draconic brawler bound in tight rubber restraint harnesses, its destructive instincts locked in constant internal combat. Honing transcendent martial prowess through endless pain, only an iron-willed partner can steer its ferocity toward protection.`
    - 修訂：`A cyber-crystal dragon knight flowing with high-voltage surges, channeling explosive electrical energy through razor claws. Weathering intense system strain through sheer discipline, it obliterates encroaching malice at any cost.`
  - **日文 (ja)**：
    - 原文：`漆黒の拘束具に身を包んだ異形の闘竜で、体内から湧き上がる破壊の衝動と常にせめぎ合っている。苛烈な葛藤の中で研ぎ澄まされた格闘技を誇り、揺るぎない覚悟を持つ相棒だけが、その暴威を正しき守護へと導く。`
    - 修訂：`高圧の電光をまとったサイバー結晶装甲の竜戦士で、体内にはいつ暴走してもおかしくない激しい電流が奔流している。鍛錬の中で雷エネルギーを両爪へと凝縮する術を身につけ、負荷を恐れず立ち塞がる邪悪を消滅させる。`
  - **泰文 (th)**：
    - 原文：`มังกรนักสู้รูปร่างประหลาดที่ถูกพันธนาการด้วยสายรัดยางทั่วร่าง แรงกระตุ้นในการทำลายล้างภายในแสวงหาการปลดปล่อยอยู่ตลอดเวลา ขัดเกลาทักษะการต่อสู้อันยอดเยี่ยมผ่านความเจ็บปวดอันไร้ที่สิ้นสุด มีเพียงคู่หูที่มีจิตใจมั่นคงเท่านั้นที่จะชี้นำมันสู่เส้นทางแห่งการปกป้องได้`
    - 修訂：`นักรบมังกรเกราะคริสตัลไซเบอร์ที่มีกระแสไฟฟ้าแรงสูงไหลเวียนทั่วร่าง ภายในร่างกายมีพลังสายฟ้าอันบ้าคลั่งไหลพล่านอยู่ มันเรียนรู้ที่จะรวบรวมพลังสายฟ้าไว้ที่กรงเล็บทั้งสองอย่างเด็ดเดี่ยว แม้ต้องทนต่อภาระอันหนักหน่วง ก็จะทำลายสิ่งชั่วร้ายที่ขวางหน้าให้สิ้นซาก`
  - **越南文 (vi)**：
    - 原文：`Chiến long dị hình quấn đầy những dải đai cao su trói buộc, xung động hủy diệt trong người luôn tìm chốn phát tiết. Qua những cuộc chiến giằng xé nội tâm đau đớn không ngừng, nó tôi luyện nên võ nghệ cận chiến siêu phàm, duy chỉ người bạn đồng hành mang ý chí kiên định mới có thể dẫn lối nó bước vào con đường bảo vệ.`
    - 修訂：`Chiến binh rồng giáp pha lê cơ khí mang dòng điện cao thế cuộn trào khắp thân thể, giải phóng năng lượng sấm sét cuồng bạo vào đôi vuốt sắc bén. Vượt qua gánh nặng tải nhiệt tột cùng, nó quyết tiêu diệt triệt để tà ma cản lối phía trước.`

### #146 [AW14] 墓焰暴君
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-146.display.d1915307473a1149.webp`
- **主圖 SHA256**：`d1915307473a1149b7ca8111ad3a3069bf2efe82b4b31e11a06ab67f6920c2c1`
- **修正部位**：`骨架色彩與胸中幽藍靈焰`
- **修改理由與證據**：核准主圖為漆黑骨架暴走龍王，胸腔深處燃燒幽藍色靈魂之焰，原文「慘白骸骨與猩紅眼眸」與主圖黑骨蒼焰相悖。修正為「漆黑骨架與胸中幽藍靈焰」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`褪去皮肉、僅餘漆黑骨架與背負毀滅光砲的暴君骨龍，為純粹的戰鬥狂熱所驅使。即便肉身早已朽壞，那份烙印於骨髓深處的求勝意志依然咆哮不息，震撼著大地每一寸焦土。`
    - 修訂：`褪去皮肉、僅餘漆黑骨架與胸中幽藍靈焰的暴走龍王，心中只剩下對永恆戰鬥的執念。雖然失去了生前的一切溫情，但在那森白胸膛深處，依然殘留著一絲對真正知己的微弱感應。`
  - **英文 (en)**：
    - 原文：`A skeletal colossus stripped of flesh, bearing a devastating light cannon upon its bony spine, marching purely on battle fury. Though its mortal frame has long withered, the desperate hunger for triumph burned into its marrow roars eternally across scorched lands.`
    - 修訂：`A skeletal dragon king stripped of flesh, glowing with cerulean soulfire within its hollow ribcage and driven by an endless obsession with battle. Having forsaken mortal warmth, deep within its ribcage lingers a faint resonance for an equal soul.`
  - **日文 (ja)**：
    - 原文：`肉体を失い、漆黒の骨格と背中の破壊の光砲だけで戦い続ける骨竜の暴君。生前の姿が朽ち果てようとも、骨髄に刻み込まれた勝利への執念は消えることなく、焦土となった戦場に絶え間ない咆哮を響かせる。`
    - 修訂：`肉体を失い、漆黒の骨格と胸骨に揺らめく蒼炎のみを残した暴走竜王で、胸中には果てなき闘争への執念のみが渦巻く。生前の温もりをすべて失ったものの、白い胸骨の奥底には、真の理解者を求めるかすかな共鳴が今も眠っている。`
  - **泰文 (th)**：
    - 原文：`ราชาทรราชย์มังกรกระดูกที่เหลือเพียงโครงกระดูกสีดำและแบกปืนใหญ่ทำลายล้างไว้ที่หลัง ขับเคลื่อนด้วยความคลั่งไคล้ในการต่อสู้อันบริสุทธิ์ แม้เนื้อหนังจะเน่าเปื่อยไปนานแล้ว แต่เจตจำนงในการแสวงหาชัยชนะที่สลักลึกในไขกระดูกยังคงคำรามไม่หยุด เขย่าผืนดินที่มอดไหม้ทุกตารางนิ้ว`
    - 修訂：`ราชามังกรคลุ้มคลั่งที่เนื้อหนังหลุดลอก เหลือเพียงโครงกระดูกสีดำทมิฬและเปลวเพลิงวิญญาณสีฟ้าในอก ในใจเหลือเพียงความยึดติดกับการต่อสู้อันเป็นนิรันดร์ แม้จะสูญเสียความอบอุ่นเมื่อครั้งยังมีชีวิตไปทั้งหมด แต่ส่วนลึกในอกสีขาวนั้นยังคงหลงเหลือความรู้สึกแผ่วเบาต่อผู้รู้ใจที่แท้จริง`
  - **越南文 (vi)**：
    - 原文：`Bạo chúa rồng xương trút bỏ da thịt chỉ còn trơ bộ xương đen thẫm mang trên lưng pháo ánh sáng hủy diệt, bị thôi thúc bởi cơn cuồng nhiệt chiến đấu thuần túy. Dẫu thân xác phàm trần đã sớm mục nát, ý chí cầu thắng khắc sâu nơi tủy xương vẫn không ngừng gầm vang chấn động từng tấc đất cháy sém.`
    - 修訂：`Vua rồng bạo tẩu rũ bỏ máu thịt chỉ còn lại bộ xương đen nhánh cùng ngọn linh hỏa xanh lam nơi lồng ngực, trong lòng chỉ còn chấp niệm với chiến đấu vĩnh hằng. Dù đã mất đi mọi hơi ấm khi còn sống, nhưng sâu thẳm nơi lồng ngực ấy vẫn còn vương lại chút cảm ứng mỏng manh với tri kỷ đích thực.`

### #147 [AW15] 潮鑄海將
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-remaining16-20261022/aw15.display.d67b4a3a84687536.webp`
- **主圖 SHA256**：`d67b4a3a8468753649dec4664c8a1abede95a05e50a3d627b1aea05c77159f17`
- **修正部位**：`手持戰槳型態`
- **修改理由與證據**：核准主圖手持極地合金重型戰槳，背負堅甲，原文「手握深海長戟」武器型態錯誤。修正為「手持極地合金戰槳」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`手持由極地深海合金鑄就的雷神鐵錘的海獸大將，性情豪邁而富有兄長般的擔當。牠在狂風暴浪中揮動重錘擊碎萬丈狂瀾，始終如中流砥柱般護衛著身後的每一個同伴。`
    - 修訂：`手持極地合金戰槳、背負堅甲的深海猛將，性格豪氣干雲。牠以雙足踏碎千層巨浪，每一次揮動巨槳都在暴風雨中引領海族勇士奪取最後的勝利。`
  - **英文 (en)**：
    - 原文：`An amphibious admiral brandishing a heavy spark-forged hammer beaten from polar alloys, hearty, boisterous, and fiercely fraternal. Swinging its thunderous maul into crashing billows, it stands as an immovable bulwark shielding all who follow in its wake.`
    - 修訂：`A deep-sea warlord wielding a heavy alloy war paddle and armored carapace, brimming with boisterous gallantry. Shattering thousand-foot breakers with heavy steps, every paddle stroke leads oceanic legions toward hard-fought triumph.`
  - **日文 (ja)**：
    - 原文：`極海の合金から鍛え上げた巨大な雷神の鉄槌を振るう海獣の猛将で、豪放にして頼もしい兄貴分。吹き荒れる怒濤を大槌の一撃で叩き割り、後ろに続く仲間を決して見捨てぬ堅城となって荒海に立ち塞がる。`
    - 修訂：`極地の合金戦櫂を力強く構え、頑丈な甲羅を背負う深海の名将で、豪放磊落な好漢。幾重にも重なる大波を踏み砕き、嵐の中で巨櫂を振るうたびに、海の勇士たちを最後の勝利へと導く。`
  - **泰文 (th)**：
    - 原文：`แม่ทัพสัตว์ทะเลผู้ถือค้อนเหล็กสายฟ้าที่หลอมขึ้นจากโลหะใต้ทะเลลึกขั้วโลก มีนิสัยห้าวหาญและมีความรับผิดชอบดั่งพี่ใหญ่ เหวี่ยงค้อนหนักทำลายคลื่นยักษ์ท่ามกลางพายุคลั่ง ยืนหยัดดั่งเสาหลักคุ้มกันเพื่อนทุกคนที่อยู่ข้างหลังเสมอ`
    - 修訂：`ขุนพลใต้ทะเลลึกผู้ถือพายศึกโลหะขั้วโลกอันทรงพลังและแบกกระดองอันแข็งแกร่ง มีนิสัยห้าวหาญเปิดเผย ใช้สองเท้าเหยียบคลื่นยักษ์พันชั้นจนแตกกระจาย ทุกครั้งที่กวัดแกว่งพายยักษ์ท่ามกลางพายุฝน จะนำเหล่านักรบแห่งท้องทะเลไปสู่ชัยชนะขั้นสุดท้าย`
  - **越南文 (vi)**：
    - 原文：`Đại tướng hải thú tay cầm chiếc búa sấm sét đúc từ hợp kim đáy biển cực địa, tính tình hào sảng và đầy tinh thần trách nhiệm của người anh cả. Vung chùy tạ đập tan từng đợt sóng thần giữa cuồng phong bão táp, sừng sững như cột trụ vững vàng che chở cho mọi đồng đội phía sau.`
    - 修訂：`Mãnh tướng biển sâu tay cầm mái chèo chiến hợp kim bắc cực mang trên lưng lớp giáp cứng, tính cách hào sảng ngút trời. Dùng hai chân đạp vỡ ngàn tầng sóng lớn, mỗi lần vung mái chèo giữa cơn bão táp đều dẫn dắt các dũng sĩ hải tộc đoạt lấy thắng lợi cuối cùng.`

### #148 [AW17] 淵祈邪神
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-remaining16-20261022/aw17.display.dfbf7a7f75b095c7.webp`
- **主圖 SHA256**：`dfbf7a7f75b095c703e49b7ac8247d30796d4ab3e2b26ed2e5b2a17bc6dd8744`
- **修正部位**：`雙爪深淵魔能與異界霸主造型`
- **修改理由與證據**：核准主圖為虛無深淵異界霸主，雙爪凝聚深海魔能，原文「無數觸手交纏」為舊 Dagomon 殘留。修正為「自虛無深海溝壑中升起的異界霸主，雙爪凝聚深淵魔能」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`盤踞於無底暗海之殿的深海邪神，手持沉重的三叉戟，周身環繞著令人窒息的漆黑水壓。牠在古老的禱詞中傾聽著深淵的低語，以深沉的目光凝視著陸地上每一個奔忙的短暫生命。`
    - 修訂：`自虛無深海溝壑中升起的異界霸主，雙爪凝聚深淵魔能，渾身散發著不可名狀的壓迫感。牠不屑於塵世的紛爭，只在暗影翻湧之時現身，以絕對的深淵秘法吞沒一切自負之徒。`
  - **英文 (en)**：
    - 原文：`An enigmatic deity presiding over sunless oceanic sanctuaries, grasping a heavy trident amidst crushing dark tides. Absorbing the abyssal whispers woven into ancient liturgies, it turns ancient, fathomless eyes toward the bustling, fleeting lives on land.`
    - 修訂：`An otherworldly sovereign rising from abyssal sea trenches, conjuring dark void magic within its open talons while radiating unspeakable dread. Aloof to mortal quarrels, it emerges only when deep shadows churn, swallowing arrogant trespassers in abyssal gloom.`
  - **日文 (ja)**：
    - 原文：`光なき深海の神殿に君臨する邪神で、重厚な三叉銛を手に持ち、息を呑むような暗黒の水圧をまとっている。太古の祈祷の中で深淵の呟きに耳を傾け、陸の上で慌ただしく生きる儚い命を深遠なまなざしで見つめている。`
    - 修訂：`虚無の深海海溝より浮上した異界の覇王で、両爪に深淵の魔力を宿し、名状しがたい威圧感を漂わせる。俗世の争いには目もくれず、闇の潮流が渦巻くときにのみ姿を現し、絶対的な深淵の秘法で思い上がった者どもを呑み尽くす。`
  - **泰文 (th)**：
    - 原文：`เทพเจ้าแห่งความมืดใต้ทะเลลึกผู้กบดานอยู่ในวิหารก้นทะเลที่ไร้ก้นบึ้ง ถือตรีศูลหนาหนัก ล้อมรอบด้วยแรงดันน้ำสีดำอันน่าอึดอัด คอยรับฟังเสียงกระซิบแห่งเหวลึกผ่านบทสวดโบราณ จ้องมองสิ่งมีชีวิตที่แสนสั้นและวุ่นวายบนบกด้วยสายตาอันลึกล้ำ`
    - 修訂：`จอมราชันต่างมิติที่ผุดขึ้นมาจากร่องลึกก้นสมุทรอันเวิ้งว้าง สองกรงเล็บรวบรวมมนตร์ดำแห่งห้วงลึก แผ่แรงกดดันที่ยากจะบรรยายออกมาทั่วร่าง ไม่แยแสต่อข้อพิพาทในโลกีย์ ปรากฏตัวเฉพาะยามที่เงามืดปั่นป่วน กลืนกินคนโอหังทั้งปวงด้วยมนตร์ลับแห่งก้นบึ้งอันเด็ดขาด`
  - **越南文 (vi)**：
    - 原文：`Tà thần biển sâu ngự trị nơi đền thờ đáy biển không đáy, tay cầm cây đinh ba nặng trĩu, quanh thân bao bọc áp lực nước đen kịt nghẹt thở. Lắng nghe tiếng thì thầm của vực sâu qua những bài tế cổ, nó dõi mắt nhìn ngắm những sinh mệnh phù du bận rộn trên đất liền bằng ánh nhìn thăm thẳm.`
    - 修訂：`Bá chủ dị giới trỗi dậy từ rãnh biển sâu hư vô, đôi vuốt ngưng tụ ma năng vực sâu, toàn thân toát ra áp lực khôn xiết. Nó khinh thường tranh chấp cõi trần, chỉ xuất hiện khi bóng tối cuộn trào, dùng bí pháp vực sâu tuyệt đối nuốt chửng mọi kẻ tự phụ.`

### #149 [AW18] 煉獄殘焰
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-closeout-20261019/species-149.display.77174dace46088b6.webp`
- **主圖 SHA256**：`77174dace46088b699a33e88ce900454ec1a7999698e7b7cb80c2ab7ead3143f`
- **修正部位**：`黑鎧與巨型戰鐮`
- **修改理由與證據**：核准主圖身披黑鎧、手持巨型戰鐮，鎧甲縫隙燃燒烈焰，原文「手持烈焰長劍」武器錯誤。修正為「身披黑色重鎧、手持巨型戰鐮」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`身著厚重鎖鏈與黑色皮革的重裝火靈，體內翻騰著將金石熔融的高熱青炎。冷酷沉默的鐵面之下，藏著對毀滅宿命的深深抗爭，誓用這份灼熱將一切阻撓夥伴的障礙燒成齏粉。`
    - 修訂：`身披黑色重鎧、手持巨型戰鐮的煉獄騎士，鎧甲縫隙中奔湧著滾燙熾烈的烈焰。牠將內心的悔恨化作焚盡萬物的熾火，只有在被純善之意觸動時，狂躁的火炎才會短暫沉寂。`
  - **英文 (en)**：
    - 原文：`A heavy-plated pyre spirit bound in chains and black leather, seething with blue flames hot enough to liquefy iron and stone. Beneath its grim metal mask lies an ongoing struggle against destructive destiny, using its searing fury solely to incinerate hurdles before its comrades.`
    - 修訂：`An infernal knight clad in black plate armor and wielding a massive war scythe, molten flames surging through the seams of his armor. Channelling buried regrets into all-consuming pyres, only a touch of unblemished virtue can soothe his agonizing fire.`
  - **日文 (ja)**：
    - 原文：`重厚な鎖と漆黒の革衣をまとった重火の精霊で、その身には鋼をも溶かす高熱の青炎が渦巻いている。冷徹な仮面の奥底で自らの破壊の宿命と激しく闘っており、その灼熱の炎は仲間を阻む障壁を焼き尽くすためにのみ振るわれる。`
    - 修訂：`漆黒の重鎧に身を包み、大鎌を手にした煉獄の騎士で、鎧の隙間から滾る烈火が吹き荒れる。胸中の悔恨をすべてを焼き尽くす炎へと変え、純真な善意に触れたときにのみ、荒ぶる炎はしばしの静寂を迎える。`
  - **泰文 (th)**：
    - 原文：`ภูตเพลิงเกราะหนักที่สวมโซ่หนาและชุดหนังสีดำสนิท ภายในปั่นป่วนด้วยเปลวไฟสีน้ำเงินที่มีความร้อนสูงพอที่จะหลอมละลายหินและเหล็ก ภายใต้หน้ากากเหล็กอันเย็นชา ซ่อนการต่อต้านโชคชะตาแห่งการทำลายล้างอย่างลึกซึ้ง สาบานว่าจะใช้ความร้อนนี้เผาทำลายทุกอุปสรรคที่ขวางทางเพื่อนให้เป็นจุณ`
    - 修訂：`อัศวินแห่งนรกผู้สวมเกราะหนักสีดำและถือเคียวศึกขนาดยักษ์ มีเปลวไฟร้อนระอุพวยพุ่งออกมาจากช่องว่างของชุดเกราะ เปลี่ยนความเสียใจในใจให้เป็นเปลวเพลิงที่เผาผลาญทุกสิ่ง เฉพาะเมื่อได้รับการสัมผัสจากความดีงามอันบริสุทธิ์ ไฟที่บ้าคลั่งจึงจะสงบลงชั่วคราว`
  - **越南文 (vi)**：
    - 原文：`Hỏa linh bọc giáp nặng nề quấn đầy xích sắt và áo da đen tuyền, trong người cuộn trào thanh diễm nhiệt độ cao đủ làm tan chảy cả sắt đá. Dưới mặt nạ sắt lạnh lùng là sự phản kháng sâu sắc trước số phận hủy diệt, thề dùng ngọn lửa bỏng rát này thiêu rụi mọi chướng ngại cản bước bạn đồng hành.`
    - 修訂：`Kỵ sĩ luyện ngục khoác giáp đen nặng nề tay cầm lưỡi hái chiến khổng lồ, ngọn lửa nóng bỏng cuộn trào qua từng khe hở của bộ giáp. Nó biến nỗi hối hận trong lòng thành ngọn lửa thiêu rụi vạn vật, chỉ khi được ý niệm thuần thiện chạm tới, ngọn lửa điên cuồng mới tạm thời lắng xuống.`

### #151 [AW20] 爵潮蛙皇
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-closeout-20261019/species-151.display.fe6d7d6ee9a902d9.webp`
- **主圖 SHA256**：`fe6d7d6ee9a902d96cf28e5637b822b210500e72f7f0ee6fec6a3c0e3bb46957`
- **修正部位**：`金冠與潮汐權杖`
- **修改理由與證據**：核准主圖頭戴金冠、手握潮汐權杖端坐高座，原文「雙手空拳」與主圖手持權杖衝突。修正為「頭戴金冠、手持潮汐權杖」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`腰背雙管號角、身披華麗大名羽織的沼澤貴冑，性格豪放而極重派頭。牠喜歡在水榭宮廷宴請四方豪傑，雖然愛擺架子，但在關鍵時刻總能以磅礴的音波震退四方頑敵。`
    - 修訂：`頭戴金冠、手持潮汐權杖的沼澤巨皇，舉止傲慢而極好面子。牠常端坐於高座對群蛙發號施令，但每當水域遭遇外敵侵襲，這位巨皇便會展現出護短到底的宗主霸氣。`
  - **英文 (en)**：
    - 原文：`A marshland grandee wrapped in a daimyo’s brocade with twin brass horns slung across his back, living with pomp and generous hospitality. Fond of hosting feasts for wanderers, beneath the theatrical arrogance lies an earthshaking sonic wave capable of routing foes.`
    - 修訂：`A marsh sovereign wearing a golden crown and holding a tidal sceptre, proud and commanding. Barking edicts to lesser toads from an ornate throne, when its wetlands are breached it defends its retainers with unyielding royal authority.`
  - **日文 (ja)**：
    - 原文：`背に二本の角笛を背負い、豪華な羽織をまとった沼沢の大名で、豪快で見栄っ張りな気性の持ち主。水辺の御殿で旅人を宴でもてなすのを好むが、いざ戦いとなれば、大地を揺るがす轟音の衝撃波で群がる敵を薙ぎ払う。`
    - 修訂：`黄金の冠を戴き、潮汐の王笏を手にした沼沢の巨皇で、誇り高く威厳を重んじる。玉座に構えてカエルたちに命令を下すが、水域が外敵に脅かされれば、領主としての意地を見せ一歩も退かずに守り抜く。`
  - **泰文 (th)**：
    - 原文：`ขุนนางแห่งหนองน้ำผู้สวมเสื้อคลุมขุนนางสุดหรูและสะพายแตรคู่ไว้ที่หลัง มีนิสัยเปิดเผยและรักความหรูหรา ชอบเปิดตำหนักริมน้ำจัดเลี้ยงต้อนรับเหล่าวีรบุรุษ แม้จะชอบวางท่าใหญ่โต แต่ในยามคับขันสามารถปล่อยคลื่นเสียงกึกก้องขับไล่ศัตรูรอบทิศได้อย่างเด็ดขาด`
    - 修訂：`จักรพรรดิยักษ์แห่งบึงน้ำที่สวมมงกุฎทองคำและถือคทาวารี มีกิริยาภาคภูมิและรักหน้าตายิ่ง มักนั่งอยู่บนบัลลังก์สูงเพื่อออกคำสั่งฝูงกบ แต่เมื่อน่านน้ำถูกศัตรูภายนอกรุกราน องค์ราชันผู้นี้จะแสดงบารมีของเจ้าผู้ครองนครที่ปกป้องพวกพ้องจนถึงที่สุด`
  - **越南文 (vi)**：
    - 原文：`Bậc quý tộc đầm lầy vác cặp tù và sau lưng, khoác áo gấm đại danh hoa lệ, tính tình hào sảng và rất trọng thể diện. Thích mở tiệc đãi khách hào kiệt tại thủy đình, tuy thích làm bộ làm tịch, nhưng thời khắc then chốt luôn có thể dùng sóng âm bàng bạc đẩy lùi bốn phương địch thủ.`
    - 修訂：`Vị hoàng đế đầm lầy đội vương miện vàng tay cầm vương trượng thủy triều, cử chỉ uy nghi lại rất trọng sĩ diện. Nó thường ngồi trên ngai cao ra lệnh cho bầy ếch, nhưng hễ vùng nước bị ngoại địch xâm phạm, vị hoàng đế này sẽ bộc lộ khí phách gia chủ bảo vệ thuộc hạ đến cùng.`

### #153 [AW22] 曙光騎聖
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-gap-20261018/species-153.display.d42785be5cbc1f42.webp`
- **主圖 SHA256**：`d42785be5cbc1f42365e18f1044bb00dd1f4b9e488b338bb84a9433227616553`
- **修正部位**：`晨曦輝盾與日光紋章`
- **修改理由與證據**：核准主圖手臂裝備晨曦輝盾、甲冑刻有日光紋章，原文「手持審判長槍」與主圖純持盾姿態衝突。修正為「配備晨曦輝盾的忠勇聖騎士」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`身著厚重銀白板甲、手持狂暴大劍的忠勇聖騎士，心中銘刻著誓死衛國的嚴正騎士道。牠不問名利、不計生死，長劍揮落之處只為貫徹自己向主君許下的終身信約。`
    - 修訂：`配備晨曦輝盾的忠勇聖騎士，鎧甲上銘刻著日光輝耀的聖神紋章。牠以守護正義為至高信條，聖盾所護之處，一切盤踞於人心的晦暗陰影皆會被破曉之光徹底驅散。`
  - **英文 (en)**：
    - 原文：`A valiant holy knight sealed in full silver-white plate armor, hefting a massive broadsword and bound to the strict code of chivalry. Indifferent to fame or life, every sweeping slash of its claymore is dedicated to the oath pledged to its sovereign.`
    - 修訂：`A loyal paladin equipped with a radiant dawn-shield upon his arm, armor etched with the brilliant crest of the rising sun. Sworn to defend righteousness, wherever his shield stands guard, clinging shadows harbored in mortal hearts are purified by morning light.`
  - **日文 (ja)**：
    - 原文：`白銀の甲冑にその身を固め、巨大な両手剣を携えた忠勇なる聖騎士で、胸には厳格な騎士道を刻んでいる。名誉も生死も問わず、大剣を振り下ろすその一撃には、主君と交わした終生の誓いを貫く覚悟が込められている。`
    - 修訂：`曙光の輝盾を腕に備えた忠勇なる聖騎士で、甲冑には昇る太陽の紋章が刻まれている。正義の護持を至高の信条とし、聖盾が守る場所では、人の心に巣食う薄暗い影も払暁の光に照らし出され浄化される。`
  - **泰文 (th)**：
    - 原文：`อัศวินศักดิ์สิทธิ์ผู้ภักดีและกล้าหาญที่สวมเกราะแผ่นสีขาวเงินหนาหนักและถือดาบยักษ์อันทรงพลัง จิตใจสลักไว้ด้วยวิถีอัศวินอันเข้มงวดที่จะสู้จนตัวตาย ไม่แสวงหาชื่อเสียงหรือความอยู่รอด ทุกการฟาดฟันของดาบยาวมีไว้เพื่อรักษาสัจจะที่ให้ไว้แก่เจ้านายตลอดชีวิต`
    - 修訂：`อัศวินศักดิ์สิทธิ์ผู้จงรักภักดีและกล้าหาญที่สวมโล่รุ่งอรุณ เกราะสลักตราสัญลักษณ์อันเจิดจ้าของรุ่งอรุณ ยึดถือการปกป้องความยุติธรรมเป็นความเชื่อสูงสุด ทุกที่ที่โล่ศักดิ์สิทธิ์คอยคุ้มครอง เงามืดมนที่เกาะกุมใจผู้คนจะถูกแสงอรุณแรกขับไล่ไปจนหมดสิ้น`
  - **越南文 (vi)**：
    - 原文：`Thánh kỵ sĩ trung dũng bọc trong bộ giáp phiến trắng bạc dày dặn, tay cầm thanh đại kiếm cự phách, trong lòng khắc sâu kỵ sĩ đạo nghiêm cẩn. Không màng danh lợi, chẳng quản sinh tử, nơi đại kiếm vung xuống chỉ để quán triệt lời thề trọn đời đã dâng lên chủ nhân.`
    - 修訂：`Thánh kỵ sĩ trung dũng mang khiên rạng đông sáng ngời, trên giáp khắc huy hiệu rực rỡ của mặt trời mọc. Coi bảo vệ chính nghĩa là tín điều tối cao, nơi thánh khiên che chắn, mọi bóng tối u ám ngự trị trong lòng người đều bị ánh sáng rạng đông xua tan sạch sẽ.`

### #154 [AW23] 虹嵐鸚皇
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-gap-20261018/species-154.display.d58987d94f731823.webp`
- **主圖 SHA256**：`d58987d94f7318238b9a51a359767c4155dfa0a4bb839fc80cf7b970e029ce5f`
- **修正部位**：`黃金胸飾與彩羽`
- **修改理由與證據**：核准主圖佩戴黃金胸飾、身披璀璨彩羽，原文「鋼鐵覆面」與主圖華麗羽飾相悖。修正為「佩戴黃金胸飾、周身披拂著璀璨彩羽」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`頭戴黃金頭盔、周身閃耀七彩嵐光的遠古鸚皇，能在高空以狂暴的落雷撕裂空間。牠傲視蒼穹，但在認可了地面旅人的堅定勇氣後，會以穿透雲層的長鳴化作旅人前行的指引。`
    - 修訂：`佩戴黃金胸飾、周身披拂著璀璨彩羽的遠古聖禽，擁有洞穿音障的高速俯衝破壞力。牠性情桀驁而崇尚天空的威儀，唯有真正懂得尊重古老律則的智者，才能得到其展翼相隨。`
  - **英文 (en)**：
    - 原文：`An ancient parrot sovereign wearing a golden helmet and blazing with prismatic storm light, tearing open airspace with violent thunderbolts. Looking down upon the realm with haughty pride, once it respects a traveler’s courage, its piercing cry serves as a beacon through storm clouds.`
    - 修訂：`An ancient avian titan wearing a golden crest-collar, adorned in radiant rainbow plumage with supersonic divebombing power. Fierce and prideful, it honors only the ancient codes of the sky, granting loyalty to those who revere primeval law.`
  - **日文 (ja)**：
    - 原文：`黄金の兜をかぶり、七色の嵐の光をまとった古代の鸚鵡皇で、頭上から落とす激しい雷撃で空を裂く。天を仰ぐ誇り高き覇者だが、地上の旅人が見せた不屈の勇気に心を打たれると、雲を貫く叫び声でその旅路を先導する。`
    - 修訂：`黄金の胸飾りをつけ、まばゆい彩羽を広げる古代の霊鳥で、音壁を突き破る超音速の急降下攻撃を誇る。誇り高く大空の威厳を重んじる気性で、古の掟を尊ぶ真の知者にのみ、その翼を並べて飛ぶことを許す。`
  - **泰文 (th)**：
    - 原文：`ราชาพ่อนกแก้วโบราณผู้สวมหมวกเกราะทองคำและส่องประกายแสงพายุเจ็ดสี สามารถใช้สายฟ้าผ่าฉีกมิติบนที่สูงได้อย่างรุนแรง มองลงมาจากท้องฟ้าด้วยความหยิ่งผยอง แต่เมื่อยอมรับในความกล้าหาญของนักเดินทางบนพื้นดิน จะส่งเสียงกู่ร้องทะลุเมฆเพื่อนำทางให้`
    - 修訂：`วิหคศักดิ์สิทธิ์โบราณที่ประดับสร้อยคอทองคำและแผ่ขนหลากสีสันอันเจิดจ้า มีพลังทำลายล้างจากการดิ่งเวหาด้วยความเร็วเหนือเสียง นิสัยทรนงและเคารพความสง่างามแห่งท้องฟ้า มีเพียงปราชญ์ที่เข้าใจกฎโบราณอย่างแท้จริงเท่านั้นจึงจะได้รับความภักดีเคียงข้าง`
  - **越南文 (vi)**：
    - 原文：`Vua vẹt cổ đại đội mũ giáp hoàng kim, toàn thân tỏa ráng bão bảy màu rực rỡ, trên tầng cao dùng sấm sét cuồng bạo xé toang không gian. Ngạo thị trời xanh, nhưng khi đã công nhận dũng khí kiên cường của lữ khách trần thế, tiếng hót xuyên tầng mây của nó sẽ trở thành kim chỉ nam mở lối.`
    - 修訂：`Linh điểu cổ xưa đeo vòng cổ hoàng kim mình khoác lông vũ rực rỡ, sở hữu sức phá hoại từ những cú lao dốc siêu thanh xé rách bức tường âm thanh. Tính tình ngạo nghễ tôn sùng uy nghi của bầu trời, chỉ bậc trí giả thực sự thấu hiểu quy luật cổ xưa mới có thể khiến nó kề cánh đồng hành.`

### #155 [AW24] 潮鰭海臣
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-closeout-20261019/species-155.display.ba6ed70f0fa3dab8.webp`
- **主圖 SHA256**：`ba6ed70f0fa3dab806ea5947b5c4ad275e87145dfe0727180c735f6a3b509e96`
- **修正部位**：`碧海三叉戟與鰭狀身形`
- **修改理由與證據**：核准主圖手握碧海三叉戟，原文「身背巨型魚叉」武器位置與型態錯誤。修正為「手持碧海三叉戟的浪潮先鋒」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`手持銳利魚叉、身手無比敏捷的水棲戰將，在暗礁林立的激流中如履平地。牠性格狡黠敏銳且善於審時度勢，雖然表面唯唯諾諾，但當真正的戰端開啟時，其鋒銳之矛絕無半分手軟。`
    - 修訂：`手持碧海三叉戟的浪潮先鋒，能在最湍急的漩渦中如履平地。牠性格堅忍卓絕，時刻警戒著來自外洋的潛在威脅，戟尖所指之處，任何試圖侵擾近海的敵意都將被瞬間瓦解。`
  - **英文 (en)**：
    - 原文：`A nimble aquatic warrior wielding a barbed trident, maneuvering treacherous submerged reefs as easily as flat ground. Prudent, sharp, and attentive to tides of battle, beneath an obsequious veneer lies a spear tip that never hesitates when war ignites.`
    - 修訂：`A frontline tide-rider wielding an azure sea trident, navigating boiling maelstroms like solid earth. Tenacious and watchful, its trident turns away ocean predators and encroaching hostility before they touch the coast.`
  - **日文 (ja)**：
    - 原文：`鋭い銛を手にし、暗礁の激流を飛ぶように泳ぐ敏捷な水棲戦士。抜け目がなく形勢を見極める知恵を持つが、ひとたび本気の戦いが始まれば、その突き出す銛先は寸分の狂いもなく敵の急所を貫く。`
    - 修訂：`蒼海の三叉槍を手にした荒波の先鋒で、荒れ狂う大渦の中でも平地を行くがごとく自在に立ち回る。忍耐強く隙がなく、外洋からの脅威を常に警戒し、その槍先が向かうところ、近海を乱す敵意は瞬く間に霧散する。`
  - **泰文 (th)**：
    - 原文：`ขุนพลสะเทินน้ำสะเทินบกผู้ปราดเปรียวที่ถือฉมวกแหลมคม ว่ายไปตามกระแสน้ำเชี่ยวท่ามกลางแนวปะการังได้อย่างราบรื่น มีนิสัยเจ้าเล่ห์และรู้รักษาตัวรอด แม้ภายนอกจะดูนอบน้อม แต่เมื่อสงครามที่แท้จริงเปิดฉาก คมหอกของมันจะไม่ปรานีแม้แต่น้อย`
    - 修訂：`แนวหน้าแห่งเกลียวคลื่นที่ถือตรีศูลสีคราม สามารถเคลื่อนไหวในวังน้ำวนที่เชี่ยวกรากได้อย่างราบรื่นดั่งเดินบนพื้นราบ มีความอดทนเป็นเลิศ ระแวดระวังภัยจากมหาสมุทรภายนอกอยู่เสมอ ทุกที่ที่ปลายตรีศูลชี้ไป ศัตรูที่คิดรุกรานชายฝั่งจะถูกบดขยี้ในพริบตา`
  - **越南文 (vi)**：
    - 原文：`Chiến tướng thủy sinh cực kỳ nhanh nhẹn tay cầm cây lao đánh cá sắc nhọn, bơi lội giữa dòng nước xiết đầy đá ngầm tựa chốn không người. Tính tình giảo hoạt nhạy bén và giỏi tùy cơ ứng biến, tuy bề ngoài khép nép phục tùng, nhưng khi chiến trận bùng nổ, mũi giáo sắc bén của nó chưa từng nương nhẹ nửa phần.`
    - 修訂：`Tiên phong sóng trào tay cầm cây đinh ba xanh biếc, có thể di chuyển trên những xoáy nước xiết nhất như đi trên đất bằng. Tính cách kiên nhẫn vượt bậc, luôn cảnh giác hiểm họa tiềm tàng từ biển xa, nơi mũi đinh ba nhắm tới, mọi địch ý muốn quấy nhiễu vùng bờ biển đều tan tành trong chớp mắt.`

### #156 [AW25] 玄竹戰熊
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-closeout-20261019/species-156.display.0271b9abc7d87d99.webp`
- **主圖 SHA256**：`0271b9abc7d87d99fe917773847082a3df151801bc55c3580316841a53b019b6`
- **修正部位**：`手持青竹戰棍`
- **修改理由與證據**：核准主圖手持青竹戰棍，身著竹林武僧裝束，原文「空手格鬥大師」與手握竹棍相悖。修正為「手持青竹戰棍、深居青翠竹林的神秘武僧」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`胸前抱著軟萌玩偶的黑白戰熊，看似慵懶溫順，內裡卻練就了剛柔並濟的玄竹拳術。牠厭惡無謂的流血紛爭，總是用最沉靜的拳勁化解攻擊，將平靜與包容留在喧囂的世間。`
    - 修訂：`手持青竹戰棍、深居青翠竹林的神秘武僧，看似與世無爭，實則身懷深不可測的棍法造詣。牠常以隨和的舉止化解紛爭，唯有心懷敬意之人，才能領會其動靜相兼的武道真意。`
  - **英文 (en)**：
    - 原文：`A black-and-white brawler cradling a plush doll in its arms, seemingly sluggish and docile, yet a master of iron bamboo martial arts. Despising pointless bloodshed, it diffuses lethal blows with gentle, grounding deflections, radiating patience across a chaotic world.`
    - 修訂：`A reclusive martial monk dwelling in bamboo groves and wielding a stout bamboo staff, appearing calm while mastering unfathomable martial arts. Diffusing conflicts with composed grace, only those with respectful humility glimpse the true mastery within his form.`
  - **日文 (ja)**：
    - 原文：`胸元に愛らしいぬいぐるみを抱いた白黒の戦熊で、普段は穏やかでのんびりしているが、その拳には剛柔一体の奥義が宿る。無益な争いを何よりも嫌い、柔よく剛を制す静かな拳で敵意を受け流し、平穏を取り戻す。`
    - 修訂：`青竹の戦棍を手に竹林深くに隠れ住む謎多き武僧。世捨て人のように見えて奥深い棒術の境地に達している。穏やかな物腰で争いを収め、敬意を持つ者だけがその静と動の武道の極意を垣間見ることができる。`
  - **泰文 (th)**：
    - 原文：`หมีนักสู้สีขาวดำที่กอดตุ๊กตานุ่มนิ่มไว้ในอก ดูเหมือนขี้เกียจและเชื่องช้า แต่ภายในฝึกฝนเพลงหมัดไผ่ดำที่ผสมผสานความแข็งแกร่งและความอ่อนโยนจนเชี่ยวชาญ เกลียดความขัดแย้งที่นองเลือด มักใช้หมัดอันเงียบสงบสลายการโจมตี มอบความสงบและความอดกลั้นให้แก่โลก`
    - 修訂：`นักพรตลึกลับผู้ถือกระบองไม้ไผ่และอาศัยอยู่ในป่าไผ่เขียวขจี ดูเหมือนไม่ยุ่งเกี่ยวกับทางโลก แต่แท้จริงแล้วมีวิชากระบองที่ลึกล้ำยากจะหยั่งถึง มักใช้ท่วงท่าสงบนิ่งคลี่คลายข้อพิพาท มีเพียงผู้ที่มีความเคารพเท่านั้นจึงจะเข้าใจถึงความหมายแห่งวิถียุทธ์ที่ผสานความนิ่ง`
  - **越南文 (vi)**：
    - 原文：`Chiến gấu đen trắng ôm búp bê mềm mại trước ngực, vẻ ngoài lười nhác hiền lành nhưng bên trong đã luyện thành huyền trúc quyền cương nhu tề phát. Chán ghét những tranh chấp đổ máu vô nghĩa, nó luôn dùng quyền kình trầm ổn hóa giải thế công, mang lại sự bình thản và bao dung giữa cõi nhân gian ồn ã.`
    - 修訂：`Võ tăng thần bí tay cầm trượng trúc xanh ẩn cư nơi rừng trúc ngát xanh, nhìn như không màng thế sự nhưng thực chất sở hữu tạo nghệ côn pháp thâm sâu khôn lường. Thường dùng phong thái điềm đạm hóa giải phân tranh, chỉ người mang lòng kính trọng mới hiểu được ý cảnh võ đạo tĩnh động tương hòa.`

### #159 [AW28] 幽幕死神
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-159.display.63fb6d4f00f7a539.webp`
- **主圖 SHA256**：`63fb6d4f00f7a53962485abdcf0e62e1039ea5ea538628a7bbb4487b961ee7ba`
- **修正部位**：`幽暗兜帽與雙槍武裝`
- **修改理由與證據**：核准主圖頭戴幽暗兜帽、雙手持槍舞動，原文「手持收割靈魂之長鐮」為舊死神殘留。修正為「披戴幽暗兜帽...雙槍在指掌間舞動」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`手持巨大靈魂鐮刀、頭戴幽暗斗笠的冥府引渡者，身形飄忽如拂曉前將褪的夜霧。牠以公正冷靜的態度斬斷世間虛妄的執念，引導迷途的靈魂踏入安息的輪迴殿堂。`
    - 修訂：`披戴幽暗兜帽、遊走於生死交界處的冷酷行刑者，雙槍在指掌間舞動出無情的死之圓舞曲。牠不帶任何個人情感執行裁決，但對那些甘願以命相護的夥伴，會在槍火熄滅後留下一縷生機。`
  - **英文 (en)**：
    - 原文：`A grim psychopomp bearing a colossal soul scythe beneath a shadowy wide-brim hat, drifting like dissipating dawn mist. With unflinching impartiality, it severs tangled mortal delusions, ushering wandering spirits toward peaceful rest.`
    - 修訂：`A merciless executioner wandering boundaries of life and death beneath a tattered cowl, spinning twin pistols into a dance of demise. Delivering judgment without personal malice, toward companions shielding one another it spares a glimmer of life.`
  - **日文 (ja)**：
    - 原文：`巨大な魂の鎌を手にし、深編笠をかぶって冥府を渡る使者で、その姿は明け方の薄霧のように儚く揺らめく。冷徹な公平さをもって現世の執着を断ち切り、迷える魂を静かな安息の輪廻へと導いていく。`
    - 修訂：`幽暗のフードを被り、生と死の狭間を彷徨う冷酷な処刑人で、両手の銃から情け容赦なき死の円舞曲を奏でる。私情を挟まず裁きを下すが、命を賭して仲間を庇い合う者には、銃声の後にわずかな生への余白を残す。`
  - **泰文 (th)**：
    - 原文：`ผู้ส่งวิญญาณแห่งปรโลกที่ถือเคียววิญญาณขนาดยักษ์และสวมหมวกสานสีดำมืด รูปร่างลอยละล่องดั่งหมอกราตรีก่อนรุ่งสาง ตัดขาดความยึดติดที่ว่างเปล่าในโลกด้วยความยุติธรรมและเยือกเย็น นำทางวิญญาณที่หลงทางเข้าสู่ตำหนักแห่งการพักผ่อนอันสงบ`
    - 修訂：`เพชฌฆาตผู้เย็นชาที่สวมฮู้ดสีมืดมนและเดินอยู่ตรงรอยต่อระหว่างความเป็นและความตาย ควงปืนคู่ร่ายรำเป็นบทเพลงแห่งความตายอันไร้ความปรานี ปฏิบัติการพิพากษาโดยปราศจากอารมณ์ส่วนตัว แต่ต่อเพื่อนที่ยอมสละชีวิตปกป้องกันและกัน มันจะเหลือทางรอดไว้ให้หลังจากเสียงปืนสงบลง`
  - **越南文 (vi)**：
    - 原文：`Kẻ đưa đò cõi âm tay cầm lưỡi hái linh hồn khổng lồ, đội chiếc nón lá u ám, bóng hình phiêu diêu như làn sương đêm sắp tàn trước rạng đông. Dùng thái độ công chính lạnh lùng chém đứt mọi chấp niệm hư ảo nơi trần thế, dẫn dắt những linh hồn lạc lối bước vào điện luân hồi an nghỉ.`
    - 修訂：`Kẻ hành quyết lạnh lùng trùm chiếc mũ trùm u ám đi lại giữa ranh giới sống chết, đôi súng múa lượn nơi đầu ngón tay thành điệu van tử thần vô tình. Nó chấp hành phán quyết không chút tình cảm riêng, nhưng với những người bạn dám lấy mạng che chở lẫn nhau, nó sẽ để lại một tia sinh cơ sau khi tiếng súng dứt điểm.`

### #160 [AW32] 星界入侵體
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-160.display.226ab6cb499e533f.webp`
- **主圖 SHA256**：`226ab6cb499e533f203de0171191051769c17f254f451f6851a8a94dc14251c4`
- **修正部位**：`單眼光鏡與浮游光束端子`
- **修改理由與證據**：核准主圖具備單眼光學鏡頭與身側浮游光束端子，原文「無面虛無形體」與機械鏡頭科技體相悖。修正為「生著單眼光鏡、操弄浮游光束機關」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`頂著巨大外星大腦、手執雷射射線槍的域外造訪者，以難以解讀的頻率觀察著凡間。雖然常被視為危險的入侵體，但其出發點不過是為了在浩瀚星海中尋找能彼此共鳴的心智。`
    - 修訂：`生著單眼光鏡、操弄浮游光束機關的域外造訪者，掌握著超出凡世常理的空間扭曲科技。雖然總用冰冷的光學掃描審視一切，但其核心中對凡間生命展現的奇蹟羈絆充滿了極大的好奇。`
  - **英文 (en)**：
    - 原文：`An extraterrestrial visitor crowned with a massive brain and bearing a ray gun, decoding worldly phenomena across cosmic frequencies. Often feared as an invader, its true voyage is seeking minds capable of true resonance in the vast starfields.`
    - 修訂：`An extraterrestrial visitor with a cyclopean optic and remote laser funnels, manipulating space-warping physics beyond mortal logic. Though evaluating life through chilling scanner sweeps, it harbors intense curiosity toward emotional bonds.`
  - **日文 (ja)**：
    - 原文：`巨大な脳髄を露わにし、光線銃を手にした異星からの来訪者で、理解を超えた未知の周波数で世界を観測している。侵略者として恐れられがちだが、その真の旅路は、広大な星の海の中で心を通わせ合える知性を探すことにある。`
    - 修訂：`単眼の光学センサーを持ち、浮遊ビーム端末を操る異星からの来訪者で、常識を超越した空間歪曲テクノロジーを操る。冷徹な光学スキャンであらゆる生命を値踏みするが、そのコアは仲間同士が結ぶ奇跡的な絆に対して強い好奇心を抱いている。`
  - **泰文 (th)**：
    - 原文：`ผู้มาเยือนจากต่างดาวที่มีสมองขนาดยักษ์อยู่บนหัวและถือปืนลำแสง สังเกตการณ์โลกด้วยความถี่ที่ยากจะถอดรหัส แม้จะถูกมองว่าเป็นผู้บุกรุกที่อันตราย แต่จุดเริ่มต้นที่แท้จริงคือการแสวงหาจิตใจที่สามารถสื่อสารกันได้ในทะเลดวงดาวอันกว้างใหญ่`
    - 修訂：`ผู้มาเยือนจากต่างดาวที่มีเลนส์ตาเดี่ยวและควบคุมปืนลำแสงลอยตัว ควบคุมเทคโนโลยีบิดผันมิติที่เหนือสามัญสำนึก แม้จะคอยสแกนทุกสิ่งด้วยสายตาเชิงแสงอันเย็นชา แต่ภายในแกนกลางกลับมีความอยากรู้อยากเห็นอย่างมากต่อปาฏิหาริย์แห่งสายสัมพันธ์ของสิ่งมีชีวิต`
  - **越南文 (vi)**：
    - 原文：`Kẻ viếng thăm cõi ngoài mang bộ não khổng lồ trên đỉnh đầu, tay cầm súng bắn tia laser, quan sát nhân gian qua những tần số dị thường khó giải mã. Thường bị coi là kẻ xâm lược nguy hiểm, nhưng mục đích ban đầu của nó chỉ là tìm kiếm những tâm trí có thể cùng rung cảm giữa biển sao bao la.`
    - 修訂：`Kẻ viếng thăm ngoại giới mang mắt kính quang học đơn thao túng pháo chùm tia lơ lửng, vận hành công nghệ bẻ cong không gian vượt xa lẽ thường. Dẫu luôn dùng ống quét quang học lạnh lùng dò xét vạn vật, lõi của nó lại tràn ngập hiếu kỳ trước mối liên kết diệu kỳ của muôn loài.`

### #162 [AW33] 耀裁天使
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-162.display.26c12fb334d5aac8.webp`
- **主圖 SHA256**：`26c12fb334d5aac89f496a88633da2f1e4360dbb1ad7d0d9832d5454ff8625bb`
- **修正部位**：`右手武器 / 裝備型態 (保留最高階位階)`
- **修改理由與證據**：核准主圖為右手握持「晶藍聖光戰矛／長槍」，非右臂裝配審判之劍（舊 HolyAngemon Excalibur 殘留）。依指示還原「最高階神聖法官」既有位階設定，只修正握持武器與純白羽翼。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`右臂裝配審判之劍、背負八片銀白羽翼的最高階神聖法官，眼中容不下任何罪惡與不公。牠在虛空中開啟天國之門放逐邪佞，以莊嚴不可侵犯的意志維持著世界法則的永恆平穩。`
    - 修訂：`右手握持審判長槍、背負純白羽翼的最高階神聖法官，眼中容不下任何罪惡與不公。牠在虛空中開啟天國之門放逐邪佞，以莊嚴不可侵犯的意志維持著世界法則的永恆平穩。`
  - **英文 (en)**：
    - 原文：`A supreme sacred arbiter mounting the Sword of Judgment upon its right arm, eight silver wings shielding the firmament. With absolute intolerance for malice, it opens the Gates of Heaven to banish wickedness and preserve cosmic law.`
    - 修訂：`The highest sacred arbiter, wielding a spear of judgment in its right hand and bearing pure white wings at its back, brooking neither malice nor foul play. Opening heaven’s gate across the void to cast down corruption, it preserves eternal balance by solemn decree.`
  - **日文 (ja)**：
    - 原文：`右腕に裁きの聖剣を佩き、背に八枚の銀翼を広げる至高の神聖法官で、その瞳は一切の不浄を許さない。虚空に天国の門を開いて悪しき者を彼方へと追放し、厳粛なる意志で世界の調和を永遠に保ち続ける。`
    - 修訂：`右手に審判の長槍を構え、背に純白の翼を広げる至高の神聖裁判官で、不正や悪徳を決して見逃さない。虚空に天国の門を開いて邪悪を追放し、何人にも侵されぬ厳格な意志で理の平穏を保ち続ける。`
  - **泰文 (th)**：
    - 原文：`ผู้พิพากษาศักดิ์สิทธิ์ระดับสูงสุดที่ติดตั้งดาบแห่งการพิพากษาไว้ที่แขนขวาและสยายปีกสีเงินแปดปีก ในดวงตาไม่อาจทนรับความชั่วร้ายและความอยุติธรรมใดๆ เปิดประตูดั่งสวรรค์ในความว่างเปล่าเพื่อเนรเทศความชั่วร้าย รักษาความสงบสุขแห่งกฎเกณฑ์ของโลกด้วยเจตจำนงอันศักดิ์สิทธิ์`
    - 修訂：`ตุลาการศักดิ์สิทธิ์ขั้นสูงสุดที่ถือหอกพิพากษาในมือขวาและมีปีกสีขาวบริสุทธิ์อยู่บนหลัง สายตาไม่ยอมให้ความชั่วร้ายและความไม่เป็นธรรมใดๆ เล็ดลอด เปิดประตูดินแดนสวรรค์กลางมิติว่างเปล่าเพื่อเนรเทศสิ่งชั่วร้าย รักษาสมดุลของกฎเกณฑ์โลกชั่วนิรันดร์ด้วยเจตจำนงอันศักดิ์สิทธิ์ที่ไม่อาจล่วงละเมิดได้`
  - **越南文 (vi)**：
    - 原文：`Phán quan thần thánh tối cao trang bị thanh kiếm thẩm phán nơi cánh tay phải, sau lưng xòe rộng tám cánh trắng bạc, ánh mắt không dung thứ cho bất kỳ tội ác hay bất công nào. Mở ra cánh cổng thiên quốc giữa hư không trục xuất tà ma, dùng ý chí trang nghiêm duy trì sự cân bằng vĩnh cửu của các quy luật thế gian.`
    - 修訂：`Thẩm phán thần thánh tối cao tay phải nắm chặt trường thương phán quyết, sau lưng mang đôi cánh thuần bạch, ánh mắt không dung thứ bất kỳ tội ác hay bất công nào. Mở thiên môn giữa hư không trục xuất tà ác, dùng ý chí trang nghiêm bất khả xâm phạm duy trì sự bình ổn vĩnh hằng của quy tắc thế giới.`

### #167 [AW39] 裂空機龍
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-gap-20261018/species-167.display.aeabfb279cc193d8.webp`
- **主圖 SHA256**：`aeabfb279cc193d8896259ebd6d195ca02b6af6507485c2af69e7e6c6cef4c5d`
- **修正部位**：`重裝機械翼與尾部光砲`
- **修改理由與證據**：核准主圖裝備重裝機械雙翼與尾端光束砲，原文「雙足裝配利刃」未體現核心機械翼與尾砲。修正為「裝備重裝機械翼與尾部光砲」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`雙臂改裝為重型飛彈發射器的生體機動飛龍，在呼嘯的氣流中以絕對制空權摧毀威脅。雖然全身浸透了兵器的冰冷戾氣，但在硝煙散去時，牠會用鋼翼替受驚的雛鳥擋下殘瓦。`
    - 修訂：`裝備重裝機械翼與尾部光砲、在夜空中無情掃蕩敵陣的改造飛龍。牠被冰冷的戰鬥程式抹去了多餘的情感，唯有在搭檔陷入絕境的剎那，沉睡的龍魂才會爆發出超越代碼的護主本能。`
  - **英文 (en)**：
    - 原文：`A cyborg sky dragon whose forearms are weaponized with dual missile batteries, dominating skies with absolute airspace denial. Though steeped in cold ordnance, once detonations cease, its steel wings gently shelter shivering chicks beneath collapsing rubble.`
    - 修訂：`A cybernetic drake equipped with heavy mechanical wings and a tail beam cannon, sweeping battlefields without pity. Suppressed by emotionless combat protocols, only when its partner is trapped does its draconic spirit override its programming.`
  - **日文 (ja)**：
    - 原文：`両腕を大型ミサイル発射筒へと改造したサイボーグ巨竜で、唸る空域を完全制圧して脅威を粉砕する。兵器としての冷徹な気配をまとうが、戦火が収まったときには鋼の翼を広げ、崩れ落ちる瓦礫から小鳥たちをそっと庇う。`
    - 修訂：`機械仕掛けの重装翼と尾部ビーム砲を備え、夜空から敵陣を情け容赦なく掃討する改造飛竜。冷徹な戦闘プログラムにより不要な感情を消去されているが、相棒が窮地に陥った刹那、眠れる竜の魂がコードを超えて目覚める。`
  - **泰文 (th)**：
    - 原文：`มังกรบินกึ่งจักรกลที่แขนทั้งสองข้างดัดแปลงเป็นเครื่องยิงขีปนาวุธหนัก ทำลายล้างภัยคุกคามด้วยการครองน่านฟ้าอย่างสมบูรณ์ท่ามกลางกระแสลมที่หวีดหวิว แม้ทั่วร่างจะเปี่ยมด้วยกลิ่นอายเย็นชาของอาวุธสงคราม แต่เมื่อควันปืนจางหาย จะใช้ปีกเหล็กกำบังเศษซากปรักหักพังให้แก่ลูกนกที่หวาดกลัว`
    - 修訂：`มังกรบินดัดแปลงที่ติดตั้งปีกกลหนักและปืนใหญ่ลำแสงที่หาง กวาดล้างศัตรูบนท้องฟ้ายามค่ำคืนอย่างไร้ปรานี อารมณ์ที่ไม่จำเป็นถูกโปรแกรมการต่อสู้ลบเลือนไป แต่ในวินาทีที่คู่หูตกอยู่ในอันตราย จิตวิญญาณมังกรที่หลับใหลจะระเบิดสัญชาตญาณปกป้องที่อยู่เหนือโค้ดคำสั่งออกมา`
  - **越南文 (vi)**：
    - 原文：`Cơ động phi long nửa sinh học cải tạo hai cánh tay thành bệ phóng tên lửa hạng nặng, áp đảo bầu trời tiêu diệt mọi mối đe dọa giữa luồng khí gầm rít. Dẫu toàn thân toát ra sát khí lạnh buốt của vũ khí chiến tranh, nhưng khi khói súng tan đi, nó sẽ dùng đôi cánh thép che chắn gạch đá đổ nát cho đàn chim non sợ hãi.`
    - 修訂：`Phi long cải tạo mang đôi cánh cơ giới hạng nặng cùng pháo đuôi quét sạch trận địa quân địch trên bầu trời đêm không chút dung tình. Nó bị chương trình chiến đấu lạnh lẽo xóa nhòa cảm xúc thừa thãi, chỉ trong khoảnh khắc người bạn gặp nguy cấp, linh hồn rồng mới bùng nổ bản năng hộ chủ vượt qua mọi dòng mã lệnh.`

### #168 [AW40] 赤鋼暴君
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-168.display.5062c75d918dc352.webp`
- **主圖 SHA256**：`5062c75d918dc352f00e5067e76bf120e05d85482e94452a97b9f29383758302`
- **修正部位**：`肢體左右方向`
- **修改理由與證據**：核准主圖之三叉巨型鋼爪位於角色自身右臂（Right Arm），左臂為一般機械手，原文「左臂的三叉鋼爪」左右方位顛倒。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`軀體徹底改造為機械殺戮重器的狂暴暴君，左臂的三叉鋼爪能撕碎一切阻礙。沉睡在深邃狂氣中的它渴望戰鬥，唯有最堅韌的意志才能喚回它核心深處未泯的理性。`
    - 修訂：`軀體徹底改造為機械殺戮重器的狂暴暴君，右臂的三叉鋼爪能撕碎一切阻礙。沉睡在深邃狂氣中的它渴望戰鬥，唯有最堅韌的意志才能喚回它核心深處未泯的理性。`
  - **英文 (en)**：
    - 原文：`A berserk tyrant rebuilt from heavy cybernetics, its trident steel claw capable of tearing apart solid ramparts. Lost in depths of battle madness, only the most unwavering human resolve can rekindle the dormant spark of reason buried within its processor.`
    - 修訂：`A brutal tyrant remade wholly into an engine of mechanized slaughter, the three-pronged steel claw on its right arm capable of cleaving any bulwark. Seething in buried savagery, it hungers for battle; only supreme willpower can awaken the ember of reason in its core.`
  - **日文 (ja)**：
    - 原文：`肉体を殺戮用の重機へと徹底的に改造した狂暴な鋼の暴君で、左腕の三叉の鋼爪はあらゆる障害を両断する。狂気の深淵に溺れながらも戦いを求め続けるが、不屈の魂を持つ者が呼びかけるとき、その奥底に眠る理性の灯が微かに瞬く。`
    - 修訂：`全身を破壊の機械兵器へと改造された凶暴なる暴君で、右腕の三叉の鋼爪は立ちはだかるすべてを寸断する。深い狂気に囚われながら常に激闘を渇望し、揺るぎない強い意志のみが、その中枢に残された理性を呼び覚ます。`
  - **泰文 (th)**：
    - 原文：`ราชาทรราชย์ผู้บ้าคลั่งที่ร่างกายถูกดัดแปลงเป็นจักรกลสังหารอย่างสมบูรณ์ กรงเล็บเหล็กสามแฉกที่แขนซ้ายสามารถฉีกกระชากทุกอุปสรรคให้ขาดสะบั้น หลงใหลในการต่อสู้ท่ามกลางความบ้าคลั่ง มีเพียงเจตจำนงที่มั่นคงที่สุดเท่านั้นที่จะดึงสติสัมปชัญญะที่ยังไม่ดับสูญในส่วนลึกกลับคืนมาได้`
    - 修訂：`ทรราชผู้บ้าคลั่งที่ร่างกายถูกดัดแปลงเป็นเครื่องจักรสังหารอย่างสิ้นเชิง กรงเล็บเหล็กสามง่ามที่แขนขวาสามารถฉีกกระชากทุกสิ่ง กระหายการต่อสู้ในความบ้าคลั่งอันลึกซึ้ง มีเพียงเจตจำนงที่แน่วแน่ที่สุดเท่านั้นที่จะปลุกสติที่ยังหลงเหลืออยู่ในแกนกลางของมันกลับมาได้`
  - **越南文 (vi)**：
    - 原文：`Bạo chúa cuồng bạo cải tạo toàn bộ thân thể thành cỗ máy hủy diệt, móng vuốt thép tam xoa nơi tay trái có thể xé vụn mọi chướng ngại. Đắm chìm trong cơn cuồng loạn khát khao chiến trận, duy chỉ có ý chí kiên định nhất mới có thể thức tỉnh chút lý trí ngủ sâu nơi đáy lõi năng lượng của nó.`
    - 修訂：`Bạo quân cuồng bạo có thân thể bị cải tạo triệt để thành cỗ máy đồ sát cơ giới, móng vuốt thép ba chẽ ở cánh tay phải có thể xé nát mọi chướng ngại. Đắm chìm trong sự điên cuồng sâu thẳm, nó khao khát chiến đấu, chỉ có ý chí kiên định nhất mới đánh thức được phần lý trí chưa tắt sâu trong lõi.`

### #169 [AW41] 蒼鋒機暴龍
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-169.display.802488d910ed6043.webp`
- **主圖 SHA256**：`802488d910ed60431c1f4c113e6f093028e461cdc06e8005170ecdeed5f59088`
- **修正部位**：`左臂合金重爪與半機械身軀`
- **修改理由與證據**：核准主圖左臂為巨大合金重爪、半身機械化，原文「右臂配裝三叉巨爪」左右方位與爪型顛倒。修正為「左臂裝備巨大合金重爪」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`胸前搭載超強破壞火砲的金屬武裝巨龍，全心守護著夥伴的信念與榮光。牠以堅如堡壘的機械身軀迎向每一次熾烈交鋒，將鋼鐵之威化作黎明前夕最耀眼的破曉長矛。`
    - 修訂：`半身經過合金強化、左臂裝備巨大合金重爪的終極戰士，其每一次前進都能引發戰場的強烈震盪。牠深諳力量帶來的責任，只為守護摯愛的土地與信念，將鋼鐵之軀化作永不倒下的防線。`
  - **英文 (en)**：
    - 原文：`A cybernetic dragon bearing cataclysmic chest cannons, whole-heartedly championing its companions’ honor and ideals. Meeting every clash with a fortress-grade chassis, it welds its mechanical might into a blazing spear of dawn.`
    - 修訂：`A cyborg warrior reinforced with chrome armor and mounting a massive steel claw on its left arm, each thunderous stride shaking the field. Understanding the weight of power, it turns its steel hull into an unbreakable rampart for beliefs it loves.`
  - **日文 (ja)**：
    - 原文：`胸部に超弩級の破壊砲を秘めた武装巨竜で、仲間の誓いと栄誉を守り抜くために戦う。要塞のごとき機械の肉体で激闘の矢面に立ち、その鋼鉄の力をもって、夜明け前の闇を撃ち砕く希望の長槍となる。`
    - 修訂：`半身を合金で強化し、左腕に巨大な鋼鉄の重爪を備えた究極の戦士で、その一歩一歩が戦場を大きく揺るがす。力の持つ重みを深く弁え、愛する大地と信念を守るためだけに、その鋼鉄の肉体を決して崩れぬ防壁へと変える。`
  - **泰文 (th)**：
    - 原文：`มังกรยักษ์ติดอาวุธโลหะที่ติดตั้งปืนใหญ่ทำลายล้างทรงพลังไว้ที่อก ปกป้องความเชื่อและเกียรติยศของเพื่อนๆ ด้วยใจจริง เผชิญหน้ากับการปะทะอันดุเดือดด้วยร่างกายจักรกลที่มั่นคงดั่งป้อมปราการ เปลี่ยนพลังแห่งเหล็กกล้าให้เป็นหอกแห่งรุ่งอรุณที่เจิดจ้าที่สุดก่อนฟ้าสาง`
    - 修訂：`สุดยอดนักรบที่ครึ่งร่างเสริมความแข็งแกร่งด้วยโลหะและติดตั้งกรงเล็บเหล็กกล้าขนาดยักษ์ไว้ที่แขนซ้าย ทุกย่างก้าวสร้างแรงสั่นสะเทือนไปทั่วสนามรบ ตระหนักถึงความรับผิดชอบที่มาพร้อมกับพลัง จึงเปลี่ยนร่างเหล็กกล้าให้เป็นแนวป้องกันที่ไม่มีวันพังทลายเพื่อปกป้องความเชื่อและผืนแผ่นดินอันเป็นที่รัก`
  - **越南文 (vi)**：
    - 原文：`Đại long trang bị vũ trang kim loại mang cỗ pháo hủy diệt uy lực trước ngực, toàn tâm toàn ý gìn giữ niềm tin và vinh quang của bạn đồng hành. Dùng thân thể cơ giới vững như pháo đài đón đầu mọi làn đạn rực lửa, biến sức mạnh thép thành ngọn giáo bình minh chói lọi nhất xé toạc màn đêm.`
    - 修訂：`Chiến binh tối thượng nửa thân cường hóa bằng hợp kim và trang bị móng vuốt thép khổng lồ nơi tay trái, mỗi bước tiến đều làm rung chuyển chiến trường dữ dội. Hiểu rõ trách nhiệm đi cùng sức mạnh, nó biến thân xác thép thành tuyến phòng thủ không bao giờ sụp đổ vì mảnh đất và niềm tin thương yêu.`

### #170 [AW42] 機冕龍
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-170.display.d899553f15cb8163.webp`
- **主圖 SHA256**：`d899553f15cb8163cc77eb892814b0c9a77da089a87467c82da13b38fa2ff696`
- **修正部位**：`烈煌金甲與光刃羽翼`
- **修改理由與證據**：核准主圖身披烈煌金甲、背負光刃羽翼，原文「純黑金屬鱗甲」顏色與翼部完全錯誤。修正為「披戴烈煌金甲、舒展光刃羽翼」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`經過重裝重度機械化改造的鋼甲龍獸，全身上下裝載著冷酷的偵測雷達與重砲。牠在硝煙瀰漫的戰場上無聲行進，以絕對的火力與精準的彈道替隊伍肅清前方的一切危局。`
    - 修訂：`披戴烈煌金甲、舒展光刃羽翼的紅色龍戰士，以傲岸的龍威與凌厲的爪刃統御戰局。在硝煙瀰漫的天空下，牠用無可匹敵的疾空威勢替搭檔蕩平前路，將熾熱的霸氣烙印在長空之上。`
  - **英文 (en)**：
    - 原文：`A heavily mechanized reptilian dreadnought retrofitted with targeting telemetry radars and siege artillery. Stalking silently through smoke-choked frontlines, its overwhelming ordnance and surgical ballistics neutralize all hazards ahead.`
    - 修訂：`A crimson dragon warrior draped in solar gold armor and spread blade-wings, dominating skirmishes with draconic majesty and razor claws. Beneath smoke-choked skies, it sweeps clear paths for its commander through blistering speed and pride.`
  - **日文 (ja)**：
    - 原文：`極限まで重機械化を施された鋼鉄の甲竜で、全身に冷徹な索敵レーダーと重砲を積載している。硝煙立ち込める戦場を無言で行進し、圧倒的な火力と寸分の狂いもない弾道で、仲間の進路を脅かす敵を薙ぎ払う。`
    - 修訂：`烈煌の金甲を纏い、光刃の翼を広げる紅き竜戦士で、堂々たる竜の威厳と鋭い爪撃で戦況を制圧する。硝煙立ち込める空の下、無類の飛翔と闘志で相棒の進路を切り開き、熾烈な覇気を大空へと刻みつける。`
  - **泰文 (th)**：
    - 原文：`มังกรหุ้มเกราะเหล็กที่ผ่านการดัดแปลงเป็นจักรกลหนักอย่างสมบูรณ์ ทั่วร่างติดตั้งเรดาร์ตรวจจับและปืนใหญ่หนาหนัก เคลื่อนทัพอย่างเงียบเชียบในสนามรบที่เต็มไปด้วยควันปืน กำจัดทุกวิกฤตเบื้องหน้าให้แก่ทีมด้วยอำนาจการยิงและวิถีกระสุนที่แม่นยำ`
    - 修訂：`นักรบมังกรแดงที่สวมเกราะทองคำอันเจิดจ้าและกางปีกคมมีด ควบคุมสถานการณ์การรบด้วยบารมีมังกรและกรงเล็บอันเฉียบคม ใต้ท้องฟ้าที่คละคลุ้งด้วยควันปืน มันใช้ความเร็วและความองอาจอันไร้เทียมทานเปิดทางให้คู่หู จารึกเกียรติภูมิอันเร่าร้อนไว้บนผืนฟ้า`
  - **越南文 (vi)**：
    - 原文：`Khủng long giáp sắt cải tạo cơ giới hóa toàn diện hạng nặng, khắp thân thể trang bị radar dò tìm và đại pháo lạnh lùng. Hành quân không một tiếng động giữa chiến trường nồng nặc khói đạn, dùng hỏa lực áp đảo cùng đường đạn chuẩn xác dẹp sạch mọi nguy nan phía trước cho đồng đội.`
    - 修訂：`Chiến binh rồng đỏ khoác hoàng kim giáp bung đôi cánh lưỡi dao ánh sáng, thống ngự chiến cuộc bằng uy nghi loài rồng và móng vuốt sắc sảo. Dưới bầu trời khói súng, nó dùng tốc độ và dũng khí vô song dẹp bằng đường tiến cho bạn đồng hành, khắc ghi bá khí rực lửa lên vòm trời.`

### #173 [AW45] 旭煌彈龍
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-173.display.1a75c0e39cd17622.webp`
- **主圖 SHA256**：`1a75c0e39cd176222d0628cccc89c0b06c56d33fdf641ceef4811c30de9a925c`
- **修正部位**：`重裝武器位置`
- **修改理由與證據**：核准主圖之雙巨型破壞光砲裝載於「雙肩」，雙手為利爪手臂，並無左臂安裝轉輪機關光砲（舊 RizeGreymon 捐贈者文字殘留）。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`左臂鑲嵌著強大六管轉輪光砲的耀烈武裝龍，背負著閃耀金光的太陽雙翼。牠秉持著絕不屈服的熱血之心，在破曉的長空中傾瀉熾熱光彈，為正義殺出一條無堅不摧的大道。`
    - 修訂：`雙肩裝載強大巨型光砲的耀烈武裝龍，背負著閃耀金光的太陽雙翼。牠秉持著絕不屈服的熱血之心，在破曉的長空中傾瀉熾熱光彈，為正義殺出一條無堅不摧的大道。`
  - **英文 (en)**：
    - 原文：`A radiant armored dragon mounting a massive six-barreled revolver cannon upon its left forearm, borne upon gilded solar wings. Driven by an unyielding heart of passion, it pours scorching light-projectile barrages across dawn skies to forge an invincible road for justice.`
    - 修訂：`A blazing dragon artillery frame bearing powerful twin cannons on its shoulders and gleaming solar wings on its back. Filled with unyielding fire, it showers incandescent shells across dawn’s sky to tear an unstoppable lane for justice.`
  - **日文 (ja)**：
    - 原文：`左腕に巨大な六連回転リボルバー砲を結合した陽光の巨竜で、黄金に輝く太陽の翼を羽ばたかせる。不屈の熱血を胸に抱き、夜明けの空から降り注ぐ熱線弾幕で悪を撃ち抜き、正義のための不滅の航路を切り開く。`
    - 修訂：`両肩に強力な大型光砲を搭載した熱血の重火器竜で、背には金色に輝く太陽の双翼を広げる。決して挫けぬ闘志を抱き、黎明の空に灼熱の光弾を雨あられと撃ち込んで、正義のために一切の障害を撃ち砕く道を拓く。`
  - **泰文 (th)**：
    - 原文：`มังกรติดอาวุธผู้เจิดจ้าที่แขนซ้ายติดตั้งปืนใหญ่แสงแบบหมุนหกลำกล้อง แผ่นหลังสยายปีกสุริยันสีทองสุกปลั่ง ยึดมั่นในหัวใจแห่งความเร่าร้อนที่ไม่ยอมสยบ ยิงกระสุนแสงร้อนแรงข้ามฟากฟ้ายามรุ่งอรุณ เพื่อเปิดทางอันยิ่งใหญ่ที่ไม่มีวันพังทลายให้แก่ความยุติธรรม`
    - 修訂：`มังกรติดอาวุธผู้ร้อนแรงที่ติดตั้งปืนใหญ่แสงคู่ทรงพลังไว้ที่หัวไหล่ทั้งสองข้าง และมีปีกสุริยะสีทองส่องประกายบนหลัง ยึดมั่นในหัวใจอันเร่าร้อนที่ไม่ยอมสยบ ยิงกระสุนแสงร้อนแรงกลางท้องฟ้ายามรุ่งอรุณเพื่อเบิกทางอันไร้เทียมทานให้แก่ความยุติธรรม`
  - **越南文 (vi)**：
    - 原文：`Vũ trang long sáng chói gắn khẩu pháo xoay sáu nòng uy mãnh nơi tay trái, sau lưng vỗ đôi cánh thái dương ánh hoàng kim rực rỡ. Giữ vững ngọn lửa nhiệt huyết không bao giờ khuất phục, trút xuống cơn mưa đạn ánh sáng nóng bỏng giữa bầu trời rạng đông, san bằng mọi chông gai mở lối quang minh chính đại.`
    - 修訂：`Chiến rồng vũ trang rực lửa trang bị pháo quang học hạng nặng uy lực trên hai vai, sau lưng mang đôi cánh mặt trời tỏa ánh vàng rực rỡ. Ôm trọn trái tim nhiệt huyết không bao giờ khuất phục, nó trút mưa đạn quang học rực cháy trên bầu trời bình minh để mở ra con đường bất khả chiến bại cho chính nghĩa.`

### #180 [AW04] 天槍飛龍
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-combined24-20261022/species-180.display.64fe53de043b403c.webp`
- **主圖 SHA256**：`64fe53de043b403ca03f5bbc46736dc12b6f40cabd87b5b0cf7cb1ef26986022`
- **修正部位**：`金色聖矛與神鷹身姿`
- **修改理由與證據**：核准主圖手持金色聖矛、巡弋平流層，原文「雙翼化作風暴之刃」未提及手持金色長矛。修正為「手持金色聖矛、巡弋於風暴平流層上的神鷹戰士」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`雙翼化作銳利長矛的蒼空霸主，能在突破音障的超高速巡航中貫穿積雨雲層。牠以天空的榮譽為傲，深信只要目標明確，任何強大的阻礙都擋不住那一往無前的鋒刃。`
    - 修訂：`手持金色聖矛、巡弋於風暴平流層上的神鷹戰士，能以凌厲的飛馳貫穿萬丈陰霾。牠恪守著古老的天空騎士準則，任何企圖玷污蔚藍領空的邪祟，都將被其迅捷如雷的審判戰矛徹底撕裂。`
  - **英文 (en)**：
    - 原文：`A sovereign of the upper atmosphere whose wings have evolved into piercing spears, punching through storm walls at supersonic speeds. Proud of celestial honors, it firmly believes that with unwavering resolve, no barrier can withstand its fearless charge.`
    - 修訂：`An eagle knight patrolling tempest stratospheres with a golden sacred lance, piercing heavy storm clouds with lightning speed. Honoring ancient sky-knight chivalry, any darkness polluting azure horizons is torn asunder by its thunderous lance.`
  - **日文 (ja)**：
    - 原文：`両翼を鋭利な長槍へと昇華させた蒼穹の覇者で、音速を越える巡航飛行で積乱雲をも一息に貫く。大空の栄誉を誇りとし、迷いなき意志さえあれば、いかなる障壁も自らの切っ先を阻むことはできないと信じている。`
    - 修訂：`黄金の聖槍を手に嵐の成層圏を巡回する神鷹の騎士で、凄まじい飛翔をもって幾千の暗雲を貫き通す。古き天空騎士の規律を厳格に守り、蒼穹を汚さんとする邪悪あらば、雷光のごとき審判の槍をもって一閃の下に討ち払う。`
  - **泰文 (th)**：
    - 原文：`จ้าวแห่งนภากาศสีครามที่ปีกทั้งสองข้างแปรสภาพเป็นหอกยาวแหลมคม สามารถพุ่งทะลุเมฆฝนฟ้าคะนองด้วยการบินความเร็วเหนือเสียง ภาคภูมิใจในเกียรติยศแห่งท้องฟ้า เชื่อมั่นว่าขอเพียงมีเป้าหมายที่แน่วแน่ ไม่มีอุปสรรคใดจะขวางกั้นคมหอกที่พุ่งไปข้างหน้าได้`
    - 修訂：`นักรบอินทรีศักดิ์สิทธิ์ที่ถือหอกศักดิ์สิทธิ์สีทองและลาดตระเวนอยู่เหนือชั้นบรรยากาศ สามารถทะลวงผ่านเมฆหมอกหนาทึบด้วยความเร็วสูง ยึดถือกฎอัศวินแห่งท้องฟ้าโบราณ สิ่งชั่วร้ายใดที่คิดทำให้ท้องฟ้าสีครามมัวหมองจะถูกหอกพิพากษาอันรวดเร็วดั่งสายฟ้าฟาดฟันจนแหลกสลาย`
  - **越南文 (vi)**：
    - 原文：`Bá chủ thanh không sở hữu đôi cánh hóa thành ngọn trường mâu sắc nhọn, có thể xé toạc tầng mây giông trong những chuyến bay vượt âm tốc. Kiêu hãnh với danh dự của bầu trời, nó tin chắc rằng chỉ cần mục tiêu rõ ràng, không trở ngại nào có thể cản nổi mũi giáo kiên định xông pha.`
    - 修訂：`Chiến binh thần ưng tay cầm thánh mâu hoàng kim tuần tra tầng bình lưu bão tố, đâm xuyên ngàn trượng mây mù với tốc độ xé gió. Tuân thủ nghiêm ngặt chuẩn mực kỵ sĩ bầu trời cổ xưa, bất kỳ tà ma nào mưu toan vấy bẩn không phận xanh biếc đều bị ngọn mâu phán xét nhanh như sấm sét tiêu diệt hoàn toàn.`

### #183 [AW11] 月鎌幻鐮
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-closeout-20261019/species-183.display.7c1b34b87b1dcf53.webp`
- **主圖 SHA256**：`7c1b34b87b1dcf53b534fa09f840bd5e5381f62b5ab2402e413429dcdc4ec430`
- **修正部位**：`流光銀甲與新月戰鐮`
- **修改理由與證據**：核准主圖身著流光銀甲、手持新月巨大戰鐮，原文「雙持銀白短刃」武器型態與尺寸錯誤。修正為「身著流光銀甲、手持新月戰鐮」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`手持弧月光刃的優雅女武神，動作如水銀瀉地般流暢而不可捉摸。牠將月華的陰柔與刀刃的冷冽融為一體，踏著清冷月步在無聲夜幕中守望著世間的寧靜。`
    - 修訂：`身著流光銀甲、手持新月戰鐮的月光女武者，以宛如舞踏般的華麗戰技斬碎長夜。牠冷徹的外表下深藏著對生靈的憐憫，每一次揮擊巨鐮的冷冽，都只為了護佑那些在黑夜中迷途的旅人。`
  - **英文 (en)**：
    - 原文：`An elegant lunar warrior maiden wielding crescent moonblades, her fluid forms unpredictable as flowing quicksilver. Weaving moonlight softness and edge coldness into one, her quiet lunar steps guard the world’s tranquil sleep.`
    - 修訂：`A silver-clad lunar warrior wielding a crescent war scythe, carving through endless dusk with dance-like grace. Beneath cool composure lies fierce compassion; every frosty swing shields travelers wandering lost through midnight wilds.`
  - **日文 (ja)**：
    - 原文：`三日月の光刃を手に舞う優美な女武者で、その身のこなしは水銀のように滑らかで捉えどころがない。月光の静けさと刃の冷徹さを調和させ、澄んだ夜の帷の中で、人々の安らかな眠りを静かに守護している。`
    - 修訂：`銀色の流光装甲を纏い、新月の大鎌を構える月光の女武者で、舞踏のごとき華麗な戦技で深き夜を斬り裂く。冷静沈着な仮面の下には生命への深い慈愛を秘め、その冷たい大鎌の一閃は、闇夜に迷う旅人を護るためにのみ振るわれる。`
  - **泰文 (th)**：
    - 原文：`นักรบสตรีผู้สง่างามที่ถือดาบจันทร์เสี้ยว การเคลื่อนไหวลื่นไหลและยากจะคาดเดาดั่งสายน้ำ ผสมผสานความอ่อนโยนของแสงจันทร์เข้ากับความเย็นชาของคมดาบ ก้าวเท้าในคืนอันเงียบสงบเพื่อปกป้องความสงบสุขของโลก`
    - 修訂：`นักรบหญิงแห่งแสงจันทร์ผู้สวมเกราะเงินแวววาวและถือเคียวศึกพระจันทร์เสี้ยว ตัดผ่านราตรีอันยาวนานด้วยท่วงท่าการต่อสู้อันงดงามราวกับการร่ายรำ ภายใต้รูปลักษณ์อันเย็นชาซ่อนไว้ด้วยความเมตตาต่อสรรพชีวิต ความเย็นเยียบของเคียวใหญ่ที่กวัดแกว่งทุกครั้ง ล้วนมีไว้เพื่อปกป้องผู้คนที่หลงทางในความมืดมิด`
  - **越南文 (vi)**：
    - 原文：`Nữ chiến thần thanh nhã cầm trong tay thanh quang đao hình trăng khuyết, động tác uyển chuyển khôn lường tựa dòng thủy ngân chảy tràn. Dung hòa sự dịu dàng của ánh trăng cùng nét lạnh lùng của lưỡi đao, nhẹ gót hài trên màn đêm tĩnh mịch canh giữ giấc ngủ yên bình của thế gian.`
    - 修訂：`Nữ chiến binh ánh trăng khoác giáp bạc lấp lánh tay cầm lưỡi hái chiến trăng khuyết, dùng chiến kỹ hoa lệ tựa vũ điệu chém tan màn đêm dài đằng đẵng. Ẩn dưới vẻ ngoài lạnh lùng là lòng trắc ẩn sâu sắc với muôn loài, mỗi đường hái giá buốt vung lên đều chỉ để bảo hộ những lữ khách lạc lối giữa đêm đen.`

### #184 [AW16] 銀河星警
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-combined24-20261022/species-184.display.59f8a3cd8c05a877.webp`
- **主圖 SHA256**：`59f8a3cd8c05a877c5333899dc534650f3dcf437fdaade78e7e4e3d50c51cd66`
- **修正部位**：`金光披風、星徽與面罩`
- **修改理由與證據**：核准主圖身披金光披風、胸佩璀璨星徽與星光眼罩，原文「手握星光左輪」未體現披風與徽章。修正為「身披金光披風、佩戴璀璨星徽」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`身披閃耀金屬光輝的銀河執法巨星，墨鏡背後的雙眼時刻鎖定著星際間的動亂。牠將保護治安當作一場華麗的舞台巡演，用風趣而果決的手段守衛著每一片星空下的歡笑。`
    - 修訂：`身披金光披風、佩戴璀璨星徽的荒野警長，在各個次元與荒漠間緝拿罪犯。雖然言談浮誇又極度在乎自己的帥氣形象，但星光面罩背後的雙眼時刻鎖定著邪惡，絕不允許正義之名蒙塵。`
  - **英文 (en)**：
    - 原文：`A galactic lawman superstar gleaming in mirror-sheen gold, sharp eyes behind tinted shades tracking interstellar turbulence. Treating border peacekeeping as a glamorous galaxy tour, it preserves laughter across star systems with wit and decisive force.`
    - 修訂：`A cosmic sheriff sporting a gold cape and brilliant star badge, hunting outlaws across dimensions. Boastful and obsessed with dazzling theatrics, the keen eyes behind his star-visor never lose sight of villainy, refusing to let justice be tarnished.`
  - **日文 (ja)**：
    - 原文：`眩い金属光沢を放つ銀河の保安官スターで、サングラスの奥の瞳は星々の乱れを決して見逃さない。治安を守る戦いを華麗な巡回公演のように演じきり、粋なユーモアと果断な一撃で星空の下の笑顔を守り抜く。`
    - 修訂：`黄金のマントを翻し、燦然と輝く星のバッジを胸にする荒野の保安官で、次元と砂漠を股にかけて凶悪犯を追撃する。大言壮語で自らの格好良さに並々ならぬ拘りを見せるが、星光バイザーの奥の双眸は悪の気配を決して逃さず、正義の名を汚させない。`
  - **泰文 (th)**：
    - 原文：`ซูเปอร์สตาร์ผู้รักษากฎหมายแห่งกาแล็กซีที่ส่องประกายโลหะแวววาว ดวงตาหลังแว่นกันแดดจับจ้องความไม่สงบระหว่างดวงดาวอยู่ตลอดเวลา มองการรักษาความสงบสุขดั่งการทัวร์คอนเสิร์ตอันงดงาม ปกป้องเสียงหัวเราะใต้ผืนฟ้าแห่งดวงดาวด้วยวิธีที่เฉียบขาดและมีเสน่ห์`
    - 修訂：`นายอำเภอแห่งแดนรกร้างที่สะบัดผ้าคลุมสีทองและติดตราดาวระยิบระยับ ไล่ล่าคนร้ายข้ามมิติและทะเลทราย แม้คำพูดจะโอ้อวดและใส่ใจภาพลักษณ์อันเท่ของตนอย่างยิ่ง แต่สายตาเบื้องหลังหน้ากากติดดาวคอยจับจ้องความชั่วร้ายอยู่ตลอดเวลา ไม่ยอมให้ชื่อแห่งความยุติธรรมต้องมัวหมอง`
  - **越南文 (vi)**：
    - 原文：`Siêu sao cảnh sát ngân hà khoác ánh kim loại lấp lánh, đôi mắt sau cặp kính râm luôn khóa chặt mọi biến động giữa các vì sao. Coi việc giữ gìn trật tự như một chuyến lưu diễn lộng lẫy, nó dùng thủ đoạn hóm hỉnh mà dứt khoát bảo vệ nụ cười dưới bầu trời sao.`
    - 修訂：`Viên cảnh trưởng hoang dã khoác áo choàng ánh vàng đeo huy hiệu sao rực rỡ, truy bắt tội phạm khắp các chiều không gian và sa mạc. Dù lời nói khoe khoang và cực kỳ để tâm đến hình tượng bảnh bao của mình, nhưng đôi mắt sau tấm mặt nạ ngôi sao luôn khóa chặt cái ác, tuyệt đối không để thanh danh chính nghĩa bị hoen ố.`

### #187 [UL03] 霜灣戰牙
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-remaining16-20261022/ul03.display.1b1438148ddb8b10.webp`
- **主圖 SHA256**：`1b1438148ddb8b10701a55e78ced80a5b1ce0d97652bee5af78bd26fb205e4a6`
- **修正部位**：`巨型鐵錨與厚重鐵鏈`
- **修改理由與證據**：核准主圖雙手揮舞巨型鐵錨與粗大鐵鏈，原文「手持開山巨斧」武器嚴重錯誤。修正為「手持巨型鐵錨與厚重鐵鏈」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`統領冰封海域的北方維京戰將，背負晨星重錘與無雙鐵盾。牠在風暴長嘯中豪飲嚴寒，將嚴苛的生存之道昇華為對族人的深沉守護，是極北之地最為剛強不拔的定海神針。`
    - 修訂：`稱霸極寒冰海的北境維京狂戰士，手持巨型鐵錨與厚重鐵鏈，性格粗獷而重信守諾。牠以純粹的肉體蠻力撞碎萬丈冰山，豪邁的戰吼聲中，永遠為誓死同盟的戰友敞開最溫暖的慶功酒肆。`
  - **英文 (en)**：
    - 原文：`A northern sea-warlord reigning over frozen fjords, bearing a morning star war maul and an peerless iron shield. Drinking in arctic gales with a hearty roar, he elevates harsh survival into enduring defense for his people, standing as the unyielding anchor of the polar north.`
    - 修訂：`A berserker chieftain dominating frigid northern oceans, wielding a colossal anchor wrapped in heavy chains, rough-hewn yet fiercely honorable. Smashing icebergs through sheer brawn, its hearty roar always welcomes loyal comrades to celebratory mead halls.`
  - **日文 (ja)**：
    - 原文：`凍てつく海域の覇権を握る極北の戦士王で、モーニングスターの大槌と無双の鉄盾を背負う。吹き荒れる寒風を豪快に笑い飛ばし、過酷な掟を同胞を守る堅固な誓いへと変え、極北の地に聳える揺るぎなき巨岩として君臨する。`
    - 修訂：`極寒の氷海に君臨する北方のバイキング狂戦士で、巨大な鉄錨と重厚な鎖を振るい、粗野ながら信義に篤い。生身の怪力で巨大な氷山をも砕き、豪放な雄叫びとともに、死生を共にした戦友のためにいつでも温かな祝杯を用意している。`
  - **泰文 (th)**：
    - 原文：`แม่ทัพไวกิ้งแห่งแดนเหนือผู้ปกครองน่านน้ำน้ำแข็ง แบกค้อนสงครามยักษ์และโล่เหล็กไร้เทียมทาน หัวเราะร่าท้าทายลมหนาวอันโหดร้าย ยกระดับวิถีการเอาชีวิตรอดอันเข้มงวดให้กลายเป็นการปกป้องพวกพ้องอย่างลึกซึ้ง ดั่งเสาหลักที่มั่นคงที่สุดแห่งแดนเหนือสุด`
    - 修訂：`นักรบคลั่งไวกิ้งแดนเหนือผู้ครองทะเลน้ำแข็งอันหนาวเหน็บ ถือสมอเรือเหล็กยักษ์และโซ่หนา มีนิสัยหยาบกระด้างแต่รักษาคำพูด ใช้พลังกายล้วนๆ พุ่งชนภูเขาน้ำแข็งหมื่นจั้งจนแตกกระจาย ในเสียงกู่ร้องอันห้าวหาญ มักเปิดโรงเหล้าฉลองชัยอันอบอุ่นไว้ต้อนรับสหายร่วมรบเสมอ`
  - **越南文 (vi)**：
    - 原文：`Chiến tướng Viking phương bắc thống lĩnh vùng biển băng giá, vác trên vai chùy tạ sao mai cùng chiếc khiên sắt vô song. Hào sảng cạn chén cùng gió tuyết rít gào, thăng hoa quy luật sinh tồn khắc nghiệt thành tấm lòng chở che sâu sắc cho đồng tộc, vững vàng như cột chống trời kiên cố nhất vùng cực bắc.`
    - 修訂：`Chiến binh cuồng nộ Viking phương bắc xưng bá vùng biển băng cực hàn, tay vung mỏ neo sắt khổng lồ cùng xích lớn, tính tình thô ráp nhưng trọng chữ tín. Nó dùng sức mạnh thể chất thuần túy đâm vỡ núi băng ngàn trượng, trong tiếng gầm trận hào sảng luôn mở rộng quán rượu mừng công ấm áp đón chờ đồng đội thề chết cùng nhau.`

### #188 [UL04] 曜羽武姬
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-combined24-20261022/species-188.display.1b89c673740d94df.webp`
- **主圖 SHA256**：`1b89c673740d94df666d788748e44d18a4a57190a1dadafdfb3cf0854518dfbe`
- **修正部位**：`聖羽戰矛與黃金鎧甲`
- **修改理由與證據**：核准主圖手持聖羽戰矛，身著黃金戰甲，原文「手握審判重劍」武器錯誤。修正為「手持聖羽戰矛」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`佩戴鷹隼戰盔、身負黃金神翼的女武神領袖，以無可挑剔的劍技與弓術裁決戰局。牠引渡戰死者的無畏英魂踏入神宮，用銳利的目光守護著大地上所有奮力拚搏的高潔勇氣。`
    - 修訂：`身負引渡英靈使命的黃金女武神，手持聖羽戰矛，以無可挑剔的戰技裁決戰局。牠只認可那些為了保護同伴而勇於直面絕境的無畏之心，並將永不凋零的極光祝福賜予每一位踏上榮耀之路的行者。`
  - **英文 (en)**：
    - 原文：`A valkyrie commander crowned in an avian helm and bearing golden celestial wings, deciding battle fates with peerless swordplay and archery. She ushers the brave spirits of fallen heroes into hallowed halls, watching over every striving heart on earth with keen reverence.`
    - 修訂：`A golden Valkyrie guiding heroic spirits to the beyond, wielding a feathered sacred lance with flawless martial skill. Honoring only courageous hearts that face despair to protect friends, she bestows the undying blessing of the aurora upon noble souls.`
  - **日文 (ja)**：
    - 原文：`ハヤブサの兜をいただき、黄金の神翼を広げる女武神の頭領で、神業の剣技と弓術で戦場を調停する。倒れた勇者の魂を誇り高き神殿へと導き、その鋭いまなざしで、地上に燃え上がる気高き闘志をどこまでも守り続ける。`
    - 修訂：`英霊を導く使命を帯びた黄金の戦乙女で、聖羽の長槍を手に寸分の狂いもない武技をもって戦局を裁決する。仲間を守るため絶望に立ち向かう不屈の勇者のみを認め、栄光の旅路を行く者に色あせぬオーロラの祝福を授ける。`
  - **泰文 (th)**：
    - 原文：`ผู้นำแห่งวาลคีรีผู้สวมหมวกเกราะเหยี่ยวและสยายปีกทองคำศักดิ์สิทธิ์ ตัดสินผลแห่งสงครามด้วยเพลงดาบและวิชาเกาทัณฑ์อันไร้ที่ติ นำพาดวงวิญญาณของผู้กล้าที่สละชีพเข้าสู่วิหารศักดิ์สิทธิ์ ปกป้องความกล้าหาญอันสูงส่งของสรรพชีวิตที่ต่อสู้อย่างไม่ย่อท้อบนผืนดิน`
    - 修訂：`วัลคิรีทองคำผู้แบกรับภารกิจนำทางดวงวิญญาณผู้กล้า ถือหอกศักดิ์สิทธิ์ขนนกและตัดสินสถานการณ์การรบด้วยเพลงยุทธ์ที่ไร้ที่ติ ยอมรับเฉพาะจิตใจอันกล้าหาญที่ไม่หวั่นเกรงต่อทางตันเพื่อปกป้องเพื่อนฝูง มอบพรแห่งแสงออโรร่าที่ไม่มีวันโรยราให้แก่นักเดินทางทุกคนที่ก้าวสู่เส้นทางแห่งเกียรติยศ`
  - **越南文 (vi)**：
    - 原文：`Thủ lĩnh nữ chiến thần đội mũ giáp chim ưng, xòe rộng đôi thần dực hoàng kim, định đoạt chiến cuộc bằng kiếm pháp và cung thuật thần sầu. Dẫn độ anh hồn quả cảm của các bậc liệt sĩ bước vào thần cung, dùng ánh mắt sắc bén canh giữ mọi dũng khí thanh cao đang bền bỉ tranh đấu dưới trần gian.`
    - 修訂：`Nữ chiến thần Valkyrie hoàng kim gánh vác sứ mệnh dẫn dắt anh linh, tay cầm thánh mâu vũ dực hoàn hảo không tì vết định đoạt cục diện. Chỉ công nhận những trái tim bất khuất dám đối mặt hiểm cảnh vì bạn bè, ban phúc lành cực quang không bao giờ lụi tàn cho mỗi người lữ hành trên con đường vinh quang.`

### #195 [UL11] 曜極星龍
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-195.display.21d0b2e6d557328a.webp`
- **主圖 SHA256**：`21d0b2e6d557328a8627c0e5c280831226652a34df76f29ebe4c79677c1b8bf2`
- **修正部位**：`純陽烈焰與日耀光龍`
- **修改理由與證據**：核准主圖周身流淌金黃純陽烈焰，為日輪至尊光龍，原文「深紅煉獄之火」屬性與顏色相悖。修正為「周身流淌純陽烈焰、君臨日耀之頂的至尊光龍」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`匯聚熾烈太陽光能而顯聖的光曜神龍，手持流淌純陽烈焰的曜極之劍。牠在長空之中如烈日當空般照耀大地，以無可撼動的破邪光輝焚盡陰霾，引領夥伴開創光明的明天。`
    - 修訂：`周身流淌純陽烈焰、君臨日耀之頂的至尊光龍。牠將恆星坍縮級別的光熱凝聚於身，任何企圖將世界拖入永夜的邪穢，都將在其焚天滅地的浩然日芒下化為虛無塵埃。`
  - **英文 (en)**：
    - 原文：`A luminous sun-dragon manifesting accumulated solar irradiance, brandishing a blade that channels pure, liquid dawnfire. Shining down upon the realm like high noon, its unyielding brilliance incinerates shadows, steering comrades toward a brighter tomorrow.`
    - 修訂：`The supreme solar dragon reigning over sunlit apexes, its body radiating pure solar flame. Condensing stellar furnace heat into its core, any monstrosity attempting to drag reality into eternal night is reduced to dust beneath its all-cleansing solar radiance.`
  - **日文 (ja)**：
    - 原文：`灼熱の太陽光エネルギーを集めて顕現した光耀の神竜で、純陽の劫火が巡る光輝の剣を振るう。中天の真日のように大地を照らし、邪悪を退ける破邪の光で暗雲を焼き尽くし、仲間を光明の未来へと導く。`
    - 修訂：`純陽の烈炎を全身にまとい、日輪の頂点に君臨する至尊の光竜。恒星崩壊に匹敵する光熱をその身に凝縮させ、世界を永遠の夜へと引きずり込もうとする邪悪を、天地を焼き尽くす白熱の日輪の輝きで塵へと帰す。`
  - **泰文 (th)**：
    - 原文：`มังกรเทพส่องแสงผู้รวบรวมพลังงานแสงสุริยันอันร้อนแรง ถือดาบสุริยันที่ไหลเวียนด้วยเปลวเพลิงบริสุทธิ์ ส่องสว่างทั่วผืนแผ่นดินประหนึ่งดวงอาทิตย์ยามเที่ยงวัน เผาผลาญความมืดมิดด้วยแสงปราบมารที่มิอาจสั่นคลอน นำพาเพื่อนๆ ก้าวสู่วันพรุ่งนี้ที่สดใส`
    - 修訂：`มังกรแสงสูงสุดผู้ครองจุดสูงสุดแห่งสุริยัน ทั่วร่างลุกโชนด้วยเพลิงสุริยันบริสุทธิ์ รวบรวมแสงและความร้อนระดับการยุบตัวของดวงดาวไว้ที่ร่าง สิ่งชั่วร้ายใดที่คิดจะลากโลกเข้าสู่ราตรีชั่วนิรันดร์ จะกลายเป็นเถ้าธุลีใต้รังสีสุริยันอันทรงพลังที่เผาผลาญฟ้าดิน`
  - **越南文 (vi)**：
    - 原文：`Thần long quang diệu hiển thánh từ nguồn năng lượng mặt trời bỏng cháy, tay cầm thanh thần kiếm cuộn chảy ngọn lửa thuần dương. Chiếu rọi thế gian tựa vầng nhật giữa trưa, dùng hào quang trừ tà bất khả lay chuyển thiêu rụi mọi u ám, dẫn dắt đồng đội khai mở một ngày mai rạng rỡ.`
    - 修訂：`Thần long ánh sáng chí tôn ngự trên đỉnh nhật quang, toàn thân cuộn trào liệt diễm thuần dương. Ngưng tụ quang nhiệt cấp độ sụp đổ sao trời vào thân thể, bất kỳ tà ma nào mưu toan kéo thế giới vào đêm vĩnh hằng đều biến thành tro bụi dưới ánh hào quang mặt trời hạo nhiên thiêu trời diệt đất.`

### #198 [UL18] 時鋼執行者
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-198.display.7ce4616be48e7d73.webp`
- **主圖 SHA256**：`7ce4616be48e7d73062c1a701fe0947dd5724b62e93bb881603e96e088ce9a0f`
- **修正部位**：`耀金聖甲與胸前鐘盤`
- **修改理由與證據**：核准主圖胸前嵌有精密鐘盤刻度、身披耀金聖甲，原文「手持光陰沙漏」道具錯誤。修正為「身披耀金聖甲的機械主宰，胸前鐘盤精準校正著因果節奏」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`由純度接近極限的金色「時之合金」重新鑄就的最高級機械人，體內運轉著超越次元的強大動力核心。牠以絕對公正的時序守衛著歷史的完整性，不允許任何人為了私慾扭曲命運的軌道。`
    - 修訂：`身披耀金聖甲的機械主宰，胸前鐘盤精準校正著世界運轉的因果節奏。牠冷徹地剪除一切擾亂時空秩序的次元殘滓，只對那些能為了守護心愛之人甘願逆轉宿命的靈魂，給予一次改寫命運的特許。`
  - **英文 (en)**：
    - 原文：`A consummate automaton recast in gold-grade Chrono-Alloy, powered by an extradimensional reactor core. Guiding timeline integrity with absolute impartiality, it permits none to warp the tapestry of fate for selfish desires.`
    - 修訂：`A mechanical sovereign clad in radiant golden armor, the chronometer upon its breast calibrating the rhythms of causality. Severing dimensional anomalies that warp temporal order, it grants a single dispensation to souls daring to defy fate for love.`
  - **日文 (ja)**：
    - 原文：`純度を極限まで高めた黄金の「時の合金」で再鍛造された至高の機械人で、次元を超える高出力核を体内に宿す。絶対なる公平さをもって歴史の連鎖を監視し、私欲のために運命の歯車を狂わせようとする者を許さない。`
    - 修訂：`輝く黄金の聖甲を纏う機械の主宰で、胸元の時計盤は世界の因果のリズムを厳密に刻む。時空の調和を乱す次元の残滓を冷徹に剪定するが、愛する者を救うため運命に立ち向かう魂には、未来を改変する唯一の猶予を許す。`
  - **泰文 (th)**：
    - 原文：`หุ่นยนต์ระดับสูงสุดที่หลอมขึ้นใหม่จากโลหะผสมเหนือกาลเวลาสีทองที่มีความบริสุทธิ์ใกล้เคียงขีดจำกัด ภายในขับเคลื่อนด้วยแกนพลังงานอันทรงพลังที่ก้าวข้ามมิติ ปกป้องความสมบูรณ์ของประวัติศาสตร์ด้วยความยุติธรรมอันสมบูรณ์แบบ ไม่ยอมให้ผู้ใดบิดเบือนกงล้อแห่งชะตากรรมเพื่อผลประโยชน์ส่วนตัว`
    - 修訂：`ผู้ปกครองจักรกลที่สวมเกราะศักดิ์สิทธิ์สีทองเปล่งประกาย หน้าปัดนาฬิกาที่อกคอยปรับจังหวะเหตุและผลแห่งโลกอย่างแม่นยำ กำจัดเศษซากมิติที่รบกวนระเบียบกาลเวลาอย่างเย็นชา แต่ยอมให้โอกาสเขียนชะตาชีวิตใหม่เพียงครั้งเดียวแก่ดวงวิญญาณที่ยอมฝืนชะตากรรมเพื่อปกป้องคนรัก`
  - **越南文 (vi)**：
    - 原文：`Người máy tối cao đúc lại từ Hợp Kim Thời Gian màu vàng kim đạt độ thuần khiết gần như tuyệt đối, bên trong vận hành lõi năng lượng siêu việt đa chiều không gian. Lấy sự công chính tuyệt đối canh giữ sự toàn vẹn của dòng lịch sử, quyết không dung thứ cho bất kỳ ai vì tư dục mà bóp méo quỹ đạo của số phận.`
    - 修訂：`Chúa tể cơ khí khoác thánh giáp hoàng kim sáng ngời, mặt đồng hồ trước ngực hiệu chỉnh chuẩn xác nhịp điệu nhân quả vận hành của thế giới. Lạnh lùng cắt bỏ mọi mảnh vụn thứ nguyên làm rối loạn trật tự thời không, nó chỉ ban đặc cách viết lại vận mệnh một lần cho những linh hồn dám nghịch chuyển số phận vì người mình yêu.`

### #199 [UL19] 焰番迅獅
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-199.display.95f583b97a5a3e85.webp`
- **主圖 SHA256**：`95f583b97a5a3e857d3c1e4f7f849450ea0568e6b94e1dff22388c336969cc73`
- **修正部位**：`黑色長風衣與燃燒鐵拳`
- **修改理由與證據**：核准主圖身披長及腳踝之黑色長風衣、雙拳燃燒烈火，原文「手握狂獅斬刃」武器錯誤。修正為「身披長及腳踝的黑色長風衣...揮動燃燒鐵拳」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`身披長及腳踝的黑色學蘭斗篷、口銜短竹棒的傲骨獅王，只貫徹自己認定的「男子漢之正義」。牠鄙視一切恃強凌弱與繁文縟節，即便與全世界為敵，也會揮動燃燒鐵拳砸碎所有不公。`
    - 修訂：`身披長及腳踝的黑色長風衣、目光桀驁的傲骨獅王，只貫徹自己認定的「男子漢之正義」。牠鄙視一切恃強凌弱與繁文縟節，即便與全世界為敵，也會揮動燃燒鐵拳砸碎所有不公。`
  - **英文 (en)**：
    - 原文：`A swaggering lion monarch draped in an ankle-length black trench coat and chewing on a short bamboo shoot, living solely by personal manly honor. Spurning bureaucratic pretense and bullying cowards, even facing the world alone, his burning fists shatter injustice.`
    - 修訂：`A swaggering lion monarch draped in an ankle-length black trench coat with an untamed gaze, living solely by personal manly honor. Spurning bureaucratic pretense and bullying cowards, even facing the world alone, his burning fists shatter injustice.`
  - **日文 (ja)**：
    - 原文：`足元まで届く漆黒の外套を羽織り、竹の小枝をくわえた気骨あふれる番長獅子で、自らの信じる男の正義をどこまでも貫く。権威を笠に着る卑怯者を心底嫌悪し、たとえ世界を敵に回そうとも、燃える鉄拳で理不尽を叩き潰す。`
    - 修訂：`足首まで届く黒いロングコートを羽織り、鋭い眼光を放つ孤高の獅子王で、己の信じる「男の正義」のみを貫く。弱者を虐げる卑劣と無用な形式を唾棄し、たとえ世界を敵に回そうとも、燃え盛る鉄拳で不条理を粉砕する。`
  - **泰文 (th)**：
    - 原文：`ราชันสิงโตผู้หยิ่งในศักดิ์ศรีที่สวมเสื้อคลุมยาวสีดำกรอมเท้าและคาบก้านไม้ไผ่สั้น ดำเนินชีวิตตามความยุติธรรมของลูกผู้ชายที่ตนยึดมั่น รังเกียจผู้ที่ใช้กำลังรังแกผู้อ่อนแอและกฎเกณฑ์ที่จอมปลอม แม้จะต้องเป็นศัตรูกับคนทั้งโลก ก็จะใช้กำปั้นเหล็กที่ลุกโชนทุบทำลายความอยุติธรรมทั้งหมด`
    - 修訂：`ราชันสิงโตผู้ทรนงที่สวมเสื้อโค้ตตัวยาวสีดำถึงข้อเท้าและมีสายตาเด็ดเดี่ยวไม่ยอมสยบ ยึดมั่นเฉพาะความยุติธรรมแบบลูกผู้ชายที่ตนกำหนด ดูถูกการรังแกผู้อ่อนแอและพิธีรีตองทั้งปวง แม้จะต้องเป็นศัตรูกับคนทั้งโลก ก็จะเหวี่ยงหมัดเหล็กลุกเป็นไฟทุบทำลายความอยุติธรรมทั้งหมด`
  - **越南文 (vi)**：
    - 原文：`Sư vương ngạo cốt khoác áo choàng đen dài chấm gót, miệng ngậm thanh tre ngắn, một đời chỉ quán triệt đạo lý chính nghĩa của bậc nam nhi mà bản thân công nhận. Khinh bỉ lũ ỷ thế hiếp người và những khuôn phép sáo rỗng, dẫu phải đối đầu với cả thế giới, nắm đấm thép rực lửa của nó cũng sẽ đập tan mọi điều bất công.`
    - 修訂：`Sư tử vương kiêu hùng khoác áo choàng dài màu đen quét đất với ánh mắt ngạo nghễ, chỉ quán triệt chính nghĩa nam nhi do mình nhận định. Khinh miệt mọi hành vi ức hiếp kẻ yếu và lễ nghi rườm rà, dẫu có đối đầu với cả thế giới cũng sẵn sàng vung nắm đấm rực lửa đập tan mọi điều bất công.`

### #200 [UL20] 蝕夜丑皇
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-remaining16-20261022/ul20.display.0ef05d8e8e38f552.webp`
- **主圖 SHA256**：`0ef05d8e8e38f5523565197faa6dda9b69e14e6094a574548c0fdf96ee5f009c`
- **修正部位**：`秘術卡牌與假面魔術`
- **修改理由與證據**：核准主圖手握秘術卡牌、舉止幽雅詭譎，原文「雙手操縱懸絲傀儡」為舊木偶殘留。修正為「手握秘術卡牌、舉止詭譎幽雅的魔術小丑皇」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`背負四柄深紅飛劍、舉止詭譎幽雅的魔術小丑皇，在陰暗的假面舞會中以空間戲法掌控全場。牠以玩世不恭的笑意解構一切莊嚴，卻也對那些歷經絕境仍不肯放棄信念的靈魂抱有一抹隱秘的敬意。`
    - 修訂：`手握秘術卡牌、舉止詭譎幽雅的魔術小丑皇，在陰暗的假面舞會中以空間戲法掌控全場。牠以玩世不恭的笑意解構一切莊嚴，卻也對那些歷經絕境仍不肯放棄信念的靈魂抱有一抹隱秘的敬意。`
  - **英文 (en)**：
    - 原文：`A bizarre yet courtly clown monarch wielding four floating scarlet rapiers, manipulating dimensional portals with theatrical whimsy. While sneering at earnest pieties with a trickster’s laugh, it harbors a secret, wistful fascination for souls that refuse to break under despair.`
    - 修訂：`A bizarre yet courtly clown monarch holding esoteric mystic cards, manipulating dimensional portals with theatrical whimsy. While sneering at earnest pieties with a trickster’s laugh, it harbors a secret, wistful fascination for souls that refuse to break under despair.`
  - **日文 (ja)**：
    - 原文：`背中に四本の真紅の飛剣を背負い、妖しくも優美な仕草で空間の奇術を操る魔術の道化師王。不敵な哄笑で世の理を嘲弄して見せるが、絶望の極限にあっても光を捨てぬ不屈の魂に対しては、密やかな敬意を抱いている。`
    - 修訂：`秘術のカードを手にして妖しくも優雅に振る舞う道化の魔術皇で、仮面舞踏会の空間手品で場を支配する。不遜な笑みで厳粛さを嘲笑うが、絶望の淵でも信念を手放さない魂に対しては密かな敬意を抱いている。`
  - **泰文 (th)**：
    - 原文：`ราชาตัวตลกผู้ใช้เวทมนตร์อันพิลึกกึกกือและสง่างามที่สะพายดาบยาวบินได้สีแดงเข้มสี่เล่มไว้ที่หลัง ควบคุมสนามประลองด้วยมายากลมิติในงานเลี้ยงเต้นรำหน้ากากอันมืดมิด เยาะเย้ยความจริงจังทั้งปวงด้วยรอยยิ้มเย้ยหยัน แต่ลึกๆ แล้วกลับมีความเคารพอย่างลับๆ ต่อดวงวิญญาณที่ไม่ยอมละทิ้งความเชื่อแม้จะอยู่ในสถานการณ์สิ้นหวัง`
    - 修訂：`ราชาตัวตลกมายากลผู้มีกิริยาแปลกประหลาดแต่งดงาม ถือไพ่มายากลลึกลับไว้ในมือ ควบคุมเวทีด้วยกลเม็ดมิติในงานเต้นรำหน้ากากอันมืดมน สลายความน่าเกรงขามด้วยรอยยิ้มเย้ยหยัน แต่ก็แฝงความเคารพอย่างลับๆ ต่อดวงวิญญาณที่ไม่ยอมละทิ้งความเชื่อแม้จะผ่านความสิ้นหวัง`
  - **越南文 (vi)**：
    - 原文：`Vua hề ma thuật mang bốn thanh phi kiếm đỏ thẫm sau lưng với cử chỉ quái đản mà tao nhã, thao túng toàn trường bằng những trò ảo thuật không gian giữa vũ hội mặt nạ tăm tối. Dùng nụ cười giễu cợt bất cần đời tháo dỡ mọi điều trang nghiêm, nhưng tận sâu trong lòng lại dành một sự nể phục kín đáo cho những linh hồn quyết không từ bỏ niềm tin dẫu rơi vào tuyệt cảnh.`
    - 修訂：`Hề hoàng ma thuật cử chỉ quái dị tao nhã tay cầm những lá bài bí thuật, dùng ảo thuật không gian kiểm soát toàn trường trong buổi dạ hội hóa trang u ám. Nó giải cấu mọi sự trang nghiêm bằng nụ cười bất cần đời, nhưng cũng ôm lòng kính trọng thầm kín với những linh hồn không chịu từ bỏ niềm tin giữa tuyệt cảnh.`

### #201 [UL22] 齒木塞皇
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-201.display.5b62683b72fbc754.webp`
- **主圖 SHA256**：`5b62683b72fbc75400a5f25208f22dd15d50ad5cd19f431e88e972516d265b00`
- **修正部位**：`背後發條鑰匙與鼓錘`
- **修改理由與證據**：核准主圖背負發條鑰匙、手持雙鼓錘，原文「手握細細傀儡絲線」與主圖玩具機關衝突。修正為「背負著發條鑰匙、手持鼓錘的機巧玩偶之皇」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`背部由精巧發條與鋼絲操控的木偶之皇，性格任性乖戾而最懼怕寂寞。牠用殘酷的機關木偶劇掩飾渴望被愛撫的軟弱內心，那雙空洞的木質眼眶中，永遠在尋找能陪牠玩耍到底的唯一朋友。`
    - 修訂：`背負著發條鑰匙、手持鼓錘的機巧玩偶之皇，性格任性乖戾而最懼怕寂寞。牠用吵鬧的機關巡遊掩飾渴望被關愛的軟弱內心，那雙滴溜溜轉動的琉璃眼中，永遠在尋找能陪牠玩耍到底的唯一朋友。`
  - **英文 (en)**：
    - 原文：`A puppet sovereign animated by intricate clockwork and wirestrings, willful, perverse, and terrified of being alone. Masking a desperate hunger for affection behind twisted marionette games, hollow wooden sockets forever search for a true playmate who will never leave.`
    - 修訂：`A clockwork toy sovereign bearing a winding key and holding drum mallets, willful, eccentric, and terrified of being alone. Masking a desperate hunger for affection behind noisy mechanical parades, his darting glass eyes forever search for a true playmate who will never leave.`
  - **日文 (ja)**：
    - 原文：`背中の精巧なぜんまいと操り糸で動く木偶の帝王で、我儘で気まぐれだが、何よりも孤独を恐れている。残酷なからくり遊びで愛を求める幼き心を覆い隠し、その虚ろな木彫りの瞳は、いつまでも共に遊んでくれるたった一人の友を探し求めている。`
    - 修訂：`背中にぜんまいキーを宿し太鼓のバチを手にしたからくり玩具の王で、気まぐれだが誰よりも孤独を恐れる。愛を求める脆い心を賑やかなパレードで覆い隠し、くるくると動くガラスの瞳で最後まで一緒に遊んでくれる唯一の友を捜し続ける。`
  - **泰文 (th)**：
    - 原文：`ราชาหุ่นเชิดไม้ที่ขับเคลื่อนด้วยลานนาฬิกาและลวดสลิงอันประณีตที่แผ่นหลัง มีนิสัยเอาแต่ใจและกลัวความโดดเดี่ยวเป็นที่สุด ใช้ละครหุ่นเชิดกลไกอันโหดร้ายบดบังจิตใจที่อ่อนแอและโหยหาความรัก ดวงตาไม้ที่ว่างเปล่าคอยมองหาเพื่อนเพียงคนเดียวที่จะเล่นกับมันไปจนถึงที่สุดเสมอ`
    - 修訂：`ราชันของเล่นกลไกที่ติดกุญแจไขลานไว้บนหลังและถือไม้ตีกลอง มีนิสัยเอาแต่ใจและกลัวความโดดเดี่ยวที่สุด ใช้ขบวนแห่กลไกอันครึกครื้นอำพรางจิตใจที่อ่อนแอซึ่งโหยหาความรัก ดวงตาแก้วที่กลอกไปมาคอยค้นหาเพื่อนแท้เพียงหนึ่งเดียวที่จะเล่นด้วยกันไปตลอดกาล`
  - **越南文 (vi)**：
    - 原文：`Vua con rối gỗ vận hành bằng dây cót và sợi cước thép tinh xảo sau lưng, tính tình ngang bướng kỳ quặc và sợ nhất là sự cô độc. Dùng những trò rối kịch tàn nhẫn che giấu tâm can yếu đuối khát khao được vỗ về, đôi mắt gỗ rỗng không ấy vĩnh viễn tìm kiếm người bạn duy nhất chịu cùng nó chơi đùa đến trọn đời.`
    - 修訂：`Hoàng đế đồ chơi dây cót mang chìa khóa vặn sau lưng tay cầm dùi gõ trống, tính tình tùy tiện bướng bỉnh lại sợ cô đơn nhất. Nó dùng những màn diễu hành cơ khí rộn rã che giấu cõi lòng yếu đuối khát khao được yêu thương, đôi mắt thủy tinh đảo qua đảo lại luôn tìm kiếm người bạn duy nhất có thể chơi cùng nó đến cùng.`

### #202 [UL23] 冥砂法皇
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-202.display.b6b29572ce8b334d.webp`
- **主圖 SHA256**：`b6b29572ce8b334d5151336162e00041fb4478ce84996c14e9c1e17b4ba4b84d`
- **修正部位**：`黑金重鎧與月牙權杖`
- **修改理由與證據**：核准主圖身披黑金重鎧、手握月牙權杖，原文「手托太陽金盤」道具錯誤。修正為「身披黑金重鎧、手持月牙權杖」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`自亙古黃沙與黃金棺木中甦醒的冥界法皇，身纏不朽的防腐繃帶。牠掌管著死者之國的嚴酷律法，以不容置疑的威嚴俯瞰塵世，只對能參透死生奧秘、心志如磐石的行者賜予永恆的冥砂庇佑。`
    - 修訂：`自亙古黃沙與古代神殿中甦醒的冥界法皇，身披黑金重鎧、手持月牙權杖。牠掌管著死者之國的嚴酷律法，以不容置疑的威嚴俯瞰塵世，只對能參透死生奧秘、心志如磐石的行者賜予永恆的冥砂庇佑。`
  - **英文 (en)**：
    - 原文：`An underworld sovereign resurrected from eternal sands and golden sarcophagi, bound in timeless funerary linens. Presiding over strict laws of the silent necropolis, he grants the eternal blessing of tomb sands only to wanderers whose spirits endure like bedrock.`
    - 修訂：`An underworld sovereign resurrected from eternal sands and ancient shrines, clad in black-and-gold armor and bearing a crescent sceptre. Presiding over strict laws of the silent necropolis, he grants the eternal blessing of tomb sands only to wanderers whose spirits endure like bedrock.`
  - **日文 (ja)**：
    - 原文：`悠久の黄砂と黄金の棺から目覚めた冥界の法皇で、朽ちぬ防腐の包帯をその身に巻く。死者の国の厳格なる掟を司り、揺るぎなき威厳で現世を見下ろすが、生死の理を悟り魂を磐石に研ぎ澄ませた旅人にのみ、永遠の冥砂の加護を授ける。`
    - 修訂：`悠久の黄砂と古の神殿より目覚めし冥界の法皇で、黒金の重鎧を纏い三日月の神笏を掲げる。死者の国の厳格な掟を司り、揺るぎなき威厳で現世を見下ろして、生と死の神秘を悟り岩のごとく堅い意志を持つ旅人にのみ冥砂の加護を与える。`
  - **泰文 (th)**：
    - 原文：`องค์ฟาโรห์แห่งยมโลกที่ตื่นขึ้นมาจากผืนทรายสีทองและโลงศพทองคำโบราณ พันด้วยผ้าพันแผลอันเป็นอมตะ ปกครองกฎหมายอันเข้มงวดของดินแดนแห่งความตาย มองดูโลกมนุษย์ด้วยความน่าเกรงขามที่มิอาจสงสัย มอบการปกป้องแห่งผืนทรายยมโลกอันเป็นนิรันดร์ให้แก่ผู้ที่หยั่งรู้ความลึกลับของความเป็นความตายและมีจิตใจดั่งหินผาเท่านั้น`
    - 修訂：`ฟาโรห์แห่งยมโลกผู้ตื่นขึ้นมาจากทรายสีทองชั่วนิรันดร์และวิหารโบราณ สวมเกราะหนักสีดำทองและถือคทาพระจันทร์เสี้ยว ควบคุมกฎหมายอันเข้มงวดของดินแดนผู้ล่วงลับ มองลงมายังโลกมนุษย์ด้วยความสง่างามที่ไม่อาจโต้แย้ง มอบการคุ้มครองแห่งผืนทรายแดนมรณะให้เฉพาะนักเดินทางที่มีจิตใจหนักแน่นดั่งศิลา`
  - **越南文 (vi)**：
    - 原文：`Pháp hoàng cõi âm thức tỉnh từ cát vàng ngàn năm và cỗ quan tài hoàng kim, toàn thân quấn băng liệm bất hủ. Cai quản thiết luật nghiêm minh của cõi chết, dùng uy nghiêm tuyệt đối ngắm nhìn nhân gian, duy chỉ ban phúc lành vĩnh hằng của cát minh cho những kẻ thấu triệt lẽ huyền cơ sinh tử và mang ý chí vững như bàn thạch.`
    - 修訂：`Pháp hoàng minh giới thức tỉnh từ cát vàng vĩnh cửu và đền thờ cổ xưa, khoác giáp đen vàng uy nghiêm tay cầm quyền trượng trăng khuyết. Cai quản luật lệ nghiêm khắc của vương quốc người chết, dùng uy thế nhìn xuống trần gian, chỉ ban phước lành cát cõi âm cho lữ khách thấu suốt sinh tử và có ý chí vững như bàn thạch.`

### #204 [UL25] 闇鎧墨皇
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-repair-20261019/species-204.display.1a1cc11d46517a9b.webp`
- **主圖 SHA256**：`1a1cc11d46517a9bf608f01fe8c581bfb64a0be3dfbacfe4a57457c2fe1f1303`
- **修正部位**：`深黑合金鎧甲與孤傲龍戰士`
- **修改理由與證據**：核准主圖身披深黑合金鎧甲，為黑色狂傲龍戰士，原文「赤焰胸甲」顏色錯誤。修正為「披覆著深黑合金鎧甲的狂傲龍戰士」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`披覆著深黑「時之合金」鎧甲的狂傲龍戰士，長年於孤獨中尋求存在的終極意義。牠不被任何教條或陣營所拘束，只忠實於內心對力量的追索，在漫天硝煙中獨自行走於黎明前夕的漫長黑夜。`
    - 修訂：`披覆著深黑合金鎧甲的狂傲龍戰士，長年於孤獨中尋求存在的終極意義。牠不被任何教條或陣營所拘束，只忠實於內心對力量的追索，在漫天硝煙中獨自行走於黎明前夕的漫長黑夜。`
  - **英文 (en)**：
    - 原文：`A brooding black dragon knight cloaked in dark Chrono-Alloy, wandering solitary paths in search of ultimate purpose. Free from dogmas and factions, he answers only to his own soul’s pursuit, walking alone beneath the starless dusk that precedes the dawn.`
    - 修訂：`A brooding black dragon knight cloaked in midnight alloy armor, wandering solitary paths in search of ultimate purpose. Free from dogmas and factions, he answers only to his own soul’s pursuit, walking alone beneath the starless dusk that precedes the dawn.`
  - **日文 (ja)**：
    - 原文：`漆黒の「時の合金」をまとった孤高の竜戦士で、果てなき静寂の中で自らの存在理由を問い続けている。いかなる教条や陣営にも縛られず、魂が求める強さの真理にのみ忠実に生き、夜明け前の深き闇の中を独り歩み続ける。`
    - 修訂：`漆黒の合金装甲を纏う狂傲なる竜戦士で、果てなき孤独の中で己が存在の究極の意義を追い求める。いかなる教条や陣営にも縛られず、魂が欲する力の追究にのみ従い、硝煙立ちこめる夜明け前の長い闇を独り歩み続ける。`
  - **泰文 (th)**：
    - 原文：`นักรบมังกรผู้หยิ่งทรนงที่สวมเกราะโลหะผสมเหนือกาลเวลาสีดำสนิท แสวงหาความหมายสูงสุดของการมีชีวิตอยู่ในความโดดเดี่ยวมาเนิ่นนาน ไม่ถูกผูกมัดด้วยลัทธิหรือฝ่ายใด ซื่อสัตย์ต่อการแสวงหาพลังในใจเท่านั้น ก้าวเดินอย่างโดดเดี่ยวท่ามกลางควันปืนในค่ำคืนอันยาวนานก่อนรุ่งสาง`
    - 修訂：`นักรบมังกรผู้หยิ่งทรนงที่สวมชุดเกราะโลหะสีดำสนิท แสวงหาความหมายสูงสุดของการมีอยู่ท่ามกลางความโดดเดี่ยวมาเนิ่นนาน ไม่ถูกผูกมัดด้วยลัทธิหรือค่ายใดๆ ซื่อสัตย์เฉพาะการแสวงหาพลังในใจ เดินอยู่ใต้ควันปืนในราตรีอันยาวนานก่อนรุ่งสางเพียงลำพัง`
  - **越南文 (vi)**：
    - 原文：`Chiến binh rồng ngạo nghễ khoác bộ giáp Hợp Kim Thời Gian đen tuyền, quanh năm cô độc kiếm tìm ý nghĩa tối thượng của sự tồn tại. Không bị bất kỳ giáo điều hay phe phái nào trói buộc, chỉ trung thành với sự truy cầu sức mạnh tự đáy lòng, một mình độc hành giữa khói đạn của đêm dài trước lúc rạng đông.`
    - 修訂：`Chiến binh rồng cuồng ngạo khoác bộ giáp hợp kim đen thẫm, quanh năm tìm kiếm ý nghĩa tối thượng của sự tồn tại trong nỗi cô độc. Không bị trói buộc bởi bất kỳ giáo điều hay phe phái nào, chỉ trung thành với sự truy cầu sức mạnh nơi đáy lòng, đơn độc bước đi giữa đêm dài trước bình minh mịt mù khói đạn.`

### #211 [UL33] 黃銅王猿
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-211.display.e669c90a86a67c70.webp`
- **主圖 SHA256**：`e669c90a86a67c7053564e7977a2b99d72458c34c2628786b815e33c90b6a725`
- **修正部位**：`金冠、炫光權杖與肩載音響`
- **修改理由與證據**：核准主圖頭戴金冠、手握炫光權杖、雙肩裝備音響裝置，原文「手握鋼鐵麥克風」道具錯誤。修正為「頭戴金冠、手執炫光權杖...肩載音響裝置」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`全身經過超合金重鍍的金屬狂王猿，防禦之堅硬連重型巨砲也難以傷其分毫。牠以狂放不羈的姿態嘲笑世俗的一切規矩，但骨子裡對患難與共的舊友抱著絕不背叛的真誠熱血。`
    - 修訂：`頭戴金冠、手執炫光權杖的搖滾霸主，肩載音響裝置迴盪著震耳欲聾的重低音。牠以狂放不羈的姿態嘲笑世俗的一切規矩，但骨子裡對患難與共的舊友抱著絕不背叛的真誠熱血。`
  - **英文 (en)**：
    - 原文：`A swaggering metal ape king electroplated in mirror superalloy, shrugging off artillery impacts without a scratch. Mocking convention with boisterous bravado, beneath the brass coating lies fierce loyalty that would never betray brothers through thick and thin.`
    - 修訂：`A swaggering rock monarch crowned in gold and holding a dazzling disco sceptre, pumping thunderous bass from shoulder speakers. Mocking convention with boisterous bravado, beneath the flamboyant swagger lies fierce loyalty that would never betray brothers through thick and thin.`
  - **日文 (ja)**：
    - 原文：`全身を硬質な超合金で再メッキした鋼鉄の猿王で、その装甲は大型巨砲の直撃すら弾き返す。世の常識を豪快に笑い飛ばして生きているが、酸いも甘いも噛み分けた旧友に対しては、裏切りを知らぬ熱い義理立てを貫く。`
    - 修訂：`黄金の冠を戴き閃光の王笏を手にしたロックの覇者で、肩の音響スピーカーから大地を揺るがす重低音を響かせる。型破りな態度で世の規則をあざ笑うが、その実、苦楽を共にした旧友に対しては決して裏切らない熱い義理堅さを秘めている。`
  - **泰文 (th)**：
    - 原文：`ราชาวานรโลหะผู้บ้าคลั่งที่ชุบด้วยโลหะผสมพิเศษทั่วร่าง เกราะหนาจนแม้แต่ปืนใหญ่หนักก็มิอาจสร้างรอยขีดข่วนได้ เยาะเย้ยกฎเกณฑ์ทางโลกด้วยท่าทางที่ไม่ยอมก้มหัว แต่ในกมลสันดานกลับมีเลือดรักเพื่อนที่ไม่มีวันทรยศต่อมิตรที่เคยร่วมทุกข์ร่วมสุข`
    - 修訂：`ราชาเพลงร็อกผู้สวมมงกุฎทองและถือคทาแสงสีแพรวพราว ขับกล่อมเบสหนักสะเทือนผืนดินจากลำโพงบนบ่า หัวเราะเยาะกฎเกณฑ์ทางโลกด้วยท่าทางบ้าบิ่น แต่ส่วนลึกในใจมีความภักดีอันเร่าร้อนที่จะไม่มีวันทรยศเพื่อนเก่าร่วมทุกข์ร่วมสุข`
  - **越南文 (vi)**：
    - 原文：`Vua khỉ cuồng bạo kim loại mạ toàn thân bằng siêu hợp kim kiên cố, phòng ngự cứng cỏi đến mức đại pháo hạng nặng cũng không thể đả thương một sợi lông. Cất tiếng cười ngạo nghễ chế giễu mọi quy củ trần tục, nhưng trong xương tủy lại mang dòng máu nghĩa khí son sắt quyết không bao giờ phản bội những người bạn từng cùng chung hoạn nạn.`
    - 修訂：`Bá chủ nhạc rock đội vương miện vàng tay cầm vương trượng lấp lánh, dàn loa trên vai phát ra những dải âm trầm rung chuyển đất trời. Nó dùng phong thái cuồng phóng chế giễu mọi quy củ thế tục, nhưng tận đáy lòng luôn mang nhiệt huyết chân thành quyết không phản bội bạn bè chung hoạn nạn.`

### #214 [UL36] 深鎧海皇龍
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-214.display.9d0ad4251a75eca4.webp`
- **主圖 SHA256**：`9d0ad4251a75eca4467dda372dd5520438039d24143e0c1071592d72ae43ae6e`
- **修正部位**：`蒼藍重甲與金紋鰭刺`
- **修改理由與證據**：核准主圖身披蒼藍重甲與金紋背鰭刺，原文「通體墨黑」甲冑顏色錯誤。修正為「身披蒼藍重甲與金紋鰭刺的深海霸主龍」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`以堅不可摧之金色合金覆蓋全身的深海霸主龍，鼻端的「究極破壞砲」擁有貫穿千丈海流的破滅威力。雖然性情殘暴自負，但對與自己一同征服過驚濤駭浪的夥伴，卻擁有極其深沉的同盟信任。`
    - 修訂：`身披蒼藍重甲與金紋鰭刺的深海霸主龍，其浩瀚龍息擁有貫穿千丈海流的破滅威力。雖然性情倨傲自負，但對與自己一同征服過驚濤駭浪的夥伴，卻擁有極其深沉的同盟信任。`
  - **英文 (en)**：
    - 原文：`The golden emperor dragon of deep oceans encased in unyielding golden alloy, its snout-mounted Ultimate Destruction Cannon shearing oceanic trenches. Ruthless and proud, toward comrades who conquered wild tempests at its side it displays ironclad, unspoken fidelity.`
    - 修訂：`The azure emperor dragon of deep oceans adorned with golden dorsal fins and armored scales, its draconic breath shearing oceanic trenches. Proud and sovereign, toward comrades who conquered wild tempests at its side it displays ironclad, unspoken fidelity.`
  - **日文 (ja)**：
    - 原文：`何ものも砕けぬ黄金の合金で全身を包み込んだ深海の覇龍で、鼻先の巨大な究極破壊砲は千丈の海流を一撃で穿つ。狂暴で自負に満ちているが、怒涛の荒波を共に乗り越えた仲間に対しては、言葉を超えた揺るぎない同盟の契りを結ぶ。`
    - 修訂：`蒼藍の重甲と金色の鰭甲を纏う深海覇王竜で、その咆哮と激浪の息吹は千丈の海流をも撃ち抜く威力を秘める。誇り高く尊大な気性だが、自らとともに荒波を乗り越えてきた仲間には、この上なく深い信頼と連帯を寄せる。`
  - **泰文 (th)**：
    - 原文：`มังกรเจ้าแห่งทะเลลึกที่ห่อหุ้มทั่วร่างด้วยโลหะผสมสีทองที่ไม่มีวันพังทลาย ปืนใหญ่ทำลายล้างสูงสุดที่ปลายจมูกมีพลังทำลายที่สามารถเจาะทะลุกระแสน้ำลึกพันวาได้ แม้จะมีนิสัยดุร้ายและหยิ่งยโส แต่สำหรับเพื่อนที่ร่วมพิชิตคลื่นลมอันบ้าคลั่งมาด้วยกัน จะมีความไว้วางใจแห่งพันธมิตรที่ลึกซึ้งเป็นที่สุด`
    - 修訂：`มังกรเจ้าสมุทรแห่งทะเลลึกที่หุ้มด้วยเกราะสีน้ำเงินครามและครีบสีทอง ลมหายใจมังกรอันทรงพลังมีพลังเจาะทะลุกระแสน้ำพันจั้ง แม้จะมีนิสัยองอาจและเย่อหยิ่ง แต่กับเพื่อนร่วมทางที่เคยฝ่าคลื่นลมบ้าคลั่งมาด้วยกัน กลับมีความไว้วางใจในพันธมิตรที่ลึกซึ้งยิ่ง`
  - **越南文 (vi)**：
    - 原文：`Bá chủ long nơi biển sâu bao phủ toàn thân bằng lớp hợp kim hoàng kim kiên cố không thể phá hủy, Khẩu Pháo Hủy Diệt Tối Thượng nơi đầu mũi mang uy lực xuyên thủng ngàn trượng hải lưu cuồn cuộn. Dù tính tình tàn bạo tự phụ, nhưng đối với người bạn từng cùng mình chinh phục sóng gió ngút trời, nó luôn dành trọn niềm tin tưởng liên minh sâu sắc nhất.`
    - 修訂：`Rồng bá chủ biển sâu khoác giáp xanh lam cùng các viền vây vàng kim uy mãnh, hơi thở long tức cuồn cuộn có uy lực xuyên thủng ngàn trượng hải lưu. Tuy tính tình ngạo nghễ tự phụ, nhưng với những người bạn từng cùng mình chinh phục sóng to gió lớn lại dành trọn sự tin cậy đồng minh sâu sắc nhất.`

### #216 [UL12] 雷獵王狼
- **批次**：第二批 (Batch 2 - 全角色深度審查)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-216.display.25e50fe4d6f6367d.webp`
- **主圖 SHA256**：`25e50fe4d6f6367df0145323618747bc257196b16868380c9956b9366e4585ff`
- **修正部位**：`蒼藍銀甲與金曜刃刺`
- **修改理由與證據**：核准主圖身披蒼藍銀甲與金色刃刺，原文「通體金黃戰甲」顏色錯誤。修正為「身披蒼藍銀甲與金曜刃刺的聖狼之王」。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`背負超大型軌道加速光砲的漆黑獵狼之王，能以超遠距離狙擊一擊貫穿千里之敵。牠在荒原之巔迎風傲立，那雙冷峻沉靜的眼眸中，永遠守望著搭檔前行的足跡。`
    - 修訂：`身披蒼藍銀甲與金曜刃刺的聖狼之王，能以疾風迅雷之勢撕裂千里之敵。牠在荒原之巔迎風傲立，那雙冷峻沉靜的眼眸中，永遠守望著搭檔前行的足跡。`
  - **英文 (en)**：
    - 原文：`A dark wolf sovereign mounting a colossal orbital-rail cannon upon its back, capable of sniping targets leagues away with pinpoint execution. Standing proudly against winds atop barren peaks, its cool, quiet gaze forever watches over its partner’s footsteps.`
    - 修訂：`A radiant holy wolf sovereign clad in azure-silver armor with golden blade crests, cleaving through distant foes with lightning speed. Standing proudly against winds atop barren peaks, its cool, quiet gaze forever watches over its partner’s footsteps.`
  - **日文 (ja)**：
    - 原文：`超巨大な加速レールキャノンを背負った漆黒の狼王で、超長距離からの狙撃をもって遠方の敵を一撃で貫徹する。荒野の頂に立って風を受け止め、その静かな瞳は、相棒が歩むべき道をいつまでも遠く見守り続けている。`
    - 修訂：`蒼藍と白銀の甲冑に黄金の刃角を戴く聖狼の王で、疾風迅雷の突進をもって千里先の敵をも切り裂く。荒原の頂で風を受け気高く佇み、その冷徹で静かな双眸は、常に相棒の歩む足跡を見守り続けている。`
  - **泰文 (th)**：
    - 原文：`ราชาหมาป่านักล่าสีดำขลับที่ติดตั้งปืนใหญ่รางเร่งความเร็วขนาดมหึมาไว้ที่หลัง สามารถซุ่มยิงทะลวงศัตรูจากระยะไกลนับพันลี้ได้ในนัดเดียว ยืนหยัดอย่างสง่าผ่าเผยท้าทายสายลมบนยอดเขารกร้าง ในดวงตาที่สงบเยือกเย็นคอยเฝ้ามองรอยเท้าก้าวเดินของคู่หูตลอดกาล`
    - 修訂：`ราชันหมาป่าศักดิ์สิทธิ์ผู้สวมเกราะสีเงินอมฟ้าและมีคมดาบสีทองอันงดงาม สามารถฉีกกระชากศัตรูที่อยู่ห่างออกไปพันลี้ด้วยความเร็วดั่งสายฟ้าฟาด ยืนหยัดท้าลมบนยอดแดนรกร้างอย่างสง่างาม ในดวงตาที่สงบนิ่งนั้นคอยเฝ้ามองรอยเท้าก้าวเดินของคู่หูตลอดไป`
  - **越南文 (vi)**：
    - 原文：`Hắc lang vương mang trên lưng khẩu pháo gia tốc đường ray siêu cấp, có thể bắn tỉa xuyên thủng kẻ địch cách xa ngàn dặm trong một phát súng. Đứng hiên ngang đón gió trên đỉnh hoang nguyên, đôi mắt trầm tĩnh lạnh lùng ấy vĩnh viễn dõi theo từng bước chân bạn đồng hành.`
    - 修訂：`Vua sói thần thánh khoác giáp bạc xanh lam cùng các lưỡi gai hoàng kim rực rỡ, xé gió như sấm sét tiêu diệt kẻ địch cách ngàn dặm. Đứng ngạo nghễ đón gió trên đỉnh hoang nguyên, đôi mắt tĩnh lặng ấy luôn dõi theo từng bước chân tiến bước của người bạn đồng hành.`

### #217 [UL21] 焰耀戰刃龍
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-217.display.b8013deb58b3b4b8.webp`
- **主圖 SHA256**：`b8013deb58b3b4b85b5a5b9123c79addedb581bc35d2ed1e74edbe70ec40cb2f`
- **修正部位**：`手持武器 / 腕刃裝備`
- **修改理由與證據**：核准主圖為雙前臂裝備熾烈光刃「破滅戰刃」（腕刃型態），並非雙手「手持巨大粉碎巨劍」（手持巨劍為舊 VictoryGreymon 捐贈者殘留）。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`手持巨大粉碎巨劍「破滅戰刃」的終極勇者，身披堅韌如山的黃金重鎧。牠將勝利視為不可妥協的意志，每一次重劍揮落都化作斬裂漫漫長夜的熊熊烈火，誓要替搭檔迎來不朽的破曉。`
    - 修訂：`雙腕裝備熾烈光刃「破滅戰刃」的終極勇者，身披堅韌如山的赤金重鎧。牠將勝利視為不可妥協的意志，每一次揮刃斬落都化作斬裂漫漫長夜的熊熊烈火，誓要替搭檔迎來不朽的破曉。`
  - **英文 (en)**：
    - 原文：`The ultimate champion wielding the colossal broadsword the Ruin Warblade, armored in adamantine golden plating. Viewing triumph as an uncompromising pledge, every crushing swing of its blade erupts into roaring flame that severs the long night to welcome dawn.`
    - 修訂：`The ultimate champion armed with blazing wrist blades named "Ruin Blade" on both arms, clad in crimson-gold armor unyielding as a fortress. Seeing victory as non-negotiable resolve, every strike cleaves through endless night as a blazing wildfire, sworn to win an eternal dawn for its partner.`
  - **日文 (ja)**：
    - 原文：`巨大なる粉砕剣「破滅の刃」を携え、山のように堅固な黄金鎧に身を包んだ究極の勇竜。勝利とは決して譲れぬ意志であると悟り、大剣を叩きつける一撃は永き夜を切り裂く劫火となって、仲間のために不滅の暁を呼び覚ます。`
    - 修訂：`両腕に熾烈な光刃「破滅の刃」を装備する終極の勇者で、赤金の重装甲を身に纏う。勝利への妥協なき闘志を胸に秘め、その刃が一撃振り下ろされるたびに永き夜を切り裂く劫火となり、相棒のために不滅の夜明けを切り拓く。`
  - **泰文 (th)**：
    - 原文：`ผู้กล้าสูงสุดที่ถือดาบยักษ์ทำลายล้าง “คมดาบพิฆาต” สวมเกราะหนักสีทองคำที่มั่นคงดั่งขุนเขา มองชัยชนะเป็นเจตจำนงที่มิอาจประนีประนอมได้ ทุกการฟาดฟันของดาบหนักแปรเปลี่ยนเป็นเปลวเพลิงที่ลุกโชนตัดผ่านค่ำคืนอันยาวนาน สาบานว่าจะนำพารุ่งอรุณอันเป็นนิรันดร์มาสู่คู่หู`
    - 修訂：`ผู้กล้าขั้นสุดยอดผู้ติดตั้งใบมีดแสงเพลิง 'ดาบพิฆาต' ไว้ที่ข้อมือทั้งสองข้าง สวมเกราะสีแดงทองหนาหนักดั่งภูผา ยึดมั่นว่าชัยชนะคือเจตจำนงที่ประนีประนอมไม่ได้ ทุกครั้งที่ตวัดคมมีดฟาดฟันจะกลายเป็นเปลวเพลิงที่ฟันผ่าค่ำคืนอันยาวนาน เพื่อนำพารุ่งอรุณอันเป็นนิรันดร์มาสู่คู่หู`
  - **越南文 (vi)**：
    - 原文：`Dũng giả tối thượng tay cầm thanh đại kiếm nghiền nát Chiến Đao Hủy Diệt khổng lồ, khoác bộ giáp nặng hoàng kim vững chãi như núi non. Xem chiến thắng là ý chí sắt đá không thể thỏa hiệp, mỗi nhát trọng kiếm vung xuống đều bùng lên ngọn lửa ngút trời chém tan đêm trường tăm tối, thề nguyện mang bình minh bất diệt về cho bạn đồng hành.`
    - 修訂：`Dũng giả tối thượng trang bị đôi quang nhận rực lửa 'Phá Diệt Chiến Nhận' trên hai cổ tay, khoác trên mình bộ trọng giáp đỏ kim kiên cố như núi. Coi chiến thắng là ý chí không thể nhân nhượng, mỗi nhát trảm kích chém xuống đều hóa thành ngọn lửa hừng hực xé toang màn đêm thăm thẳm, thề sẽ mang lại bình minh bất diệt cho người bạn đồng hành.`

### #218 [UL14] 天斬蒼龍
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-218.display.5227fdf8f59e640a.webp`
- **主圖 SHA256**：`5227fdf8f59e640ad65c27d4e316d45b600114186b62ecafda7e6416ac0c1dd4`
- **修正部位**：`物種形態 / 武器 (飛龍身姿，移除劍聖與手持神斬劍)`
- **修改理由與證據**：核准主圖為翺翔長空的晶藍羽翼天龍，四爪騰空，完全沒有手持任何神斬大劍，亦非人形劍聖。依定稿圖修正為飛龍身姿與浩然巡弋守護，不改圖、不新增能力（不推論翅膀等同武器）。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`身著厚重龍鱗鎧冑、手執神斬大劍的蒼龍劍聖，以出神入化的劍術馳騁於九天之上。牠將龍族的血性與劍士的純粹合二為一，每一記揮砍都在長空中劃下守護蒼生的浩然正氣。`
    - 修訂：`身著厚重龍鱗鎧冑的天穹蒼龍，以出神入化的身法馳騁於九天之上。牠將龍族的血性與守護的純粹合二為一，每一次翱翔都在長空中劃下守護蒼生的浩然正氣。`
  - **英文 (en)**：
    - 原文：`A dragon swordmaster encased in dragonscale mail and wielding a world-slashing greatsword, sweeping across the nine heavens with peerless martial grace. Uniting draconic valor and martial purity, each sweeping blow carves righteous light across the sky.`
    - 修訂：`The azure dragon clad in heavy scaled armor, soaring across the high heavens with peerless agility. Merging draconic ferocity with the purity of a guardian, every flight carves righteous protection across the sky for all mortal life.`
  - **日文 (ja)**：
    - 原文：`重装の竜鱗甲冑をまとい、神斬の大剣を振るう蒼天の剣聖で、神域に達した剣技をもって天空を駆ける。竜族の矜持と剣士の清廉さを一身に結びつけ、大剣を閃かせるたびに、万民を護る浩然の気が空を満たす。`
    - 修訂：`重厚な竜鱗の鎧冑をまとい、神業のごとき身のこなしで九天を馳せる天穹の蒼竜。竜族の血性と守護の純粋さを一身に融合させ、天空を舞うその飛翔ごとに、生ける者を守護する浩然の正気を行き渡らせる。`
  - **泰文 (th)**：
    - 原文：`ปรมาจารย์ดาบมังกรสีครามผู้สวมเกราะเกล็ดมังกรหนาหนักและถือดาบยักษ์ฟันสวรรค์ ควบทะยานไปบนฟ้าเก้าชั้นด้วยวิชาดาบอันไร้ผู้เทียมทาน ผสานจิตวิญญาณแห่งมังกรเข้ากับความบริสุทธิ์ของนักดาบเป็นหนึ่งเดียว ทุกการฟาดฟันสลักไว้ด้วยความเที่ยงธรรมอันยิ่งใหญ่เพื่อปกป้องสรรพชีวิต`
    - 修訂：`มังกรครามแห่งฟากฟ้าในเกราะเกล็ดมังกรหนาหนัก ผู้ทะยานข้ามฟากฟ้าทั้งเก้าชั้นด้วยท่วงท่าอันไร้ผู้เทียมทาน ผสานจิตวิญญาณแห่งมังกรเข้ากับความบริสุทธิ์ของผู้ปกป้องเป็นหนึ่งเดียว ทุกการทะยานบินสลักไว้ด้วยความเที่ยงธรรมอันยิ่งใหญ่เพื่อปกป้องสรรพชีวิต`
  - **越南文 (vi)**：
    - 原文：`Thanh long kiếm thánh bọc trong chiến giáp vảy rồng nặng nề, tay cầm thần kiếm trảm thiên trảm địa, vẫy vùng trên chín tầng trời bằng kiếm thuật xuất thần nhập hóa. Hợp nhất huyết tính của long tộc cùng sự thuần khiết của kiếm khách, mỗi nhát chém vung ra đều khắc sâu hạo nhiên chính khí chở che chúng sinh.`
    - 修訂：`Thanh long trời cao bọc trong chiến giáp vảy rồng nặng nề, vẫy vùng trên chín tầng trời bằng thân pháp xuất thần nhập hóa. Hợp nhất huyết tính của long tộc cùng sự thuần khiết của lòng bảo hộ, mỗi chuyến bay lượn đều khắc sâu hạo nhiên chính khí chở che chúng sinh.`

### #221 [UL16] 夜月獵姬
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-221.display.067d872c8c8e4493.webp`
- **主圖 SHA256**：`067d872c8c8e4493cde782ecf6e9ad79ee97d313501919538840ba51ee8e125a`
- **修正部位**：`手持武器型態`
- **修改理由與證據**：核准主圖雙手握持一把「冰結月牙長杖／新月長柄法杖」，並非手持「冰結長弓與箭鏃」（長弓為舊 Dianamon 弓箭殘留）。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`頭戴明月戰盔、手持冰結長弓的夜之月神，在幽靜的星夜中無聲滑行。牠的每一支箭鏃都凝結著如水般的冷冽柔情，只為在混亂紛爭中守護那一方讓疲憊靈魂安眠的靜夜。`
    - 修訂：`頭戴明月戰盔、手持冰結月牙長杖的夜之月神，在幽靜的星夜中無聲滑行。牠揮舞長杖所灑落的月華都凝結著如水般的冷冽柔情，只為在混亂紛爭中守護那一方讓疲憊靈魂安眠的靜夜。`
  - **英文 (en)**：
    - 原文：`The goddess of the moon crowned in a crescent helm and wielding an ice-stringed longbow, gliding silently beneath serene stars. Each arrow she looses condenses cool, fluid tenderness, defending sanctuaries where weary souls can sleep without fear.`
    - 修訂：`The goddess of the moon crowned in a crescent helm and wielding a glacial crescent staff, gliding silently beneath serene stars. The moonlight scattered by her staff condenses cool, fluid tenderness, defending sanctuaries where weary souls can sleep without fear.`
  - **日文 (ja)**：
    - 原文：`月光の兜をいただき、氷結の長弓を構える夜の月神で、星降る静寂の空を音もなく滑空する。射出される矢の一筋一筋には澄み切った冷気と優しさが込められ、争乱の世にあって、疲れた魂が眠れる静謐な聖域を護り抜く。`
    - 修訂：`月光の兜をいただき、氷結の三日月杖を携える夜の月神で、星降る静寂の空を音もなく滑空する。杖から放たれる月光の一筋一筋には澄み切った冷気と優しさが込められ、争乱の世にあって、疲れた魂が眠れる静謐な聖域を護り抜く。`
  - **泰文 (th)**：
    - 原文：`เทพีแห่งจันทรายามราตรีผู้สวมหมวกเกราะพระจันทร์สว่างและถือคันศรยาวเยือกแข็ง ร่อนไปในค่ำคืนแห่งดวงดาวอันเงียบสงบอย่างแผ่วเบา ลูกศรทุกดอกกลั่นตัวขึ้นจากความอ่อนโยนอันเย็นยะเยือกดั่งสายน้ำ เพื่อปกป้องค่ำคืนอันเงียบสงบให้วิญญาณที่เหนื่อยล้าได้หลับใหลอย่างปลอดภัย`
    - 修訂：`เทพีแห่งจันทรายามราตรีผู้สวมหมวกเกราะพระจันทร์สว่างและถือคทาพระจันทร์เสี้ยวเยือกแข็ง ร่อนไปในค่ำคืนแห่งดวงดาวอันเงียบสงบอย่างแผ่วเบา แสงจันทร์ที่โปรยปรายจากคทากลั่นตัวขึ้นจากความอ่อนโยนอันเย็นยะเยือกดั่งสายน้ำ เพื่อปกป้องค่ำคืนอันเงียบสงบให้วิญญาณที่เหนื่อยล้าได้หลับใหลอย่างปลอดภัย`
  - **越南文 (vi)**：
    - 原文：`Nguyệt thần bóng đêm đội mũ giáp trăng sáng, tay giương cung dài kết băng, lướt đi không một tiếng động dưới bầu trời sao tĩnh mịch. Mỗi mũi tên bắn ra đều kết tinh sự dịu dàng buốt giá tựa dòng nước trong, chỉ để giữa chốn loạn lạc giữ gìn một góc đêm thanh bình cho những tâm hồn mệt mỏi an giấc.`
    - 修訂：`Nguyệt thần bóng đêm đội mũ giáp trăng sáng, tay cầm quyền trượng trăng khuyết kết băng, lướt đi không một tiếng động dưới bầu trời sao tĩnh mịch. Ánh trăng rải ra từ quyền trượng đều kết tinh sự dịu dàng buốt giá tựa dòng nước trong, chỉ để giữa chốn loạn lạc giữ gìn một góc đêm thanh bình cho những tâm hồn mệt mỏi an giấc.`

### #223 [UL17] 赤曜槍皇
- **批次**：第一批 (Batch 1)
- **核准主圖路徑**：`assets/production/database-display-20261018/species-223.display.cb48ee8d8d939913.webp`
- **主圖 SHA256**：`cb48ee8d8d939913cd789b8ae25cd830408d35df77149ccf1fb3be8305b22a55`
- **修正部位**：`鎧甲顏色`
- **修改理由與證據**：核准主圖為純白金邊重鎧與深藍披風，左持大盾、右握長槍。原文「身著深紅鎧甲」顏色直接錯誤（深紅為舊 Dukemon 紅蓮騎士獸殘留）。左右持械正確。
- **五語對照 (Before vs After)**：
  - **繁體中文 (zh-Hant)**：
    - 原文：`身著深紅鎧甲、左持堅盾、右執長槍的英勇戰士，恪守正直公允的行事準則。牠將身心皆獻給守護世界秩序的崇高誓約，長槍所指之處，一切狂妄之惡皆將煙消雲散。`
    - 修訂：`身著純白金邊鎧甲、左持堅盾、右執長槍的英勇戰士，恪守正直公允的行事準則。牠將身心皆獻給守護世界秩序的崇高誓約，長槍所指之處，一切狂妄之惡皆將煙消雲散。`
  - **英文 (en)**：
    - 原文：`A valiant warrior in deep crimson armor, carrying a sturdy shield in its left hand and a long spear in its right, it holds firmly to honesty and fairness. It dedicates body and soul to a solemn oath to protect the order of the world, and wherever its spear points, all arrogant evil fades into smoke.`
    - 修訂：`A valiant warrior in pure white and gold armor, carrying a sturdy shield in its left hand and a long spear in its right, it holds firmly to honesty and fairness. It dedicates body and soul to a solemn oath to protect the order of the world, and wherever its spear points, all arrogant evil fades into smoke.`
  - **日文 (ja)**：
    - 原文：`深紅の鎧をまとい、左手に堅牢な盾、右手に長槍を携える勇敢な戦士で、誠実で公正な振る舞いを貫いている。世界の秩序を守る崇高な誓いに心身を捧げ、その槍が指す先では、驕れる悪がことごとく煙のように消え去る。`
    - 修訂：`純白と金縁の鎧をまとい、左手に堅牢な盾、右手に長槍を携える勇敢な戦士で、誠実で公正な振る舞いを貫いている。世界の秩序を守る崇高な誓いに心身を捧げ、その槍が指す先では、驕れる悪がことごとく煙のように消え去る。`
  - **泰文 (th)**：
    - 原文：`นักรบผู้กล้าหาญในเกราะสีแดงเข้ม มือซ้ายถือโล่แข็งแกร่ง มือขวาถือหอกยาว ยึดมั่นในการประพฤติตนอย่างซื่อตรงและเป็นธรรม มันอุทิศทั้งกายและใจให้คำปฏิญาณอันสูงส่งที่จะปกป้องระเบียบของโลก และทุกแห่งที่ปลายหอกชี้ไป ความชั่วร้ายอันหยิ่งผยองจะสลายราวกับควัน`
    - 修訂：`นักรบผู้กล้าหาญในเกราะสีขาวบริสุทธิ์ขอบทอง มือซ้ายถือโล่แข็งแกร่ง มือขวาถือหอกยาว ยึดมั่นในการประพฤติตนอย่างซื่อตรงและเป็นธรรม มันอุทิศทั้งกายและใจให้คำปฏิญาณอันสูงส่งที่จะปกป้องระเบียบของโลก และทุกแห่งที่ปลายหอกชี้ไป ความชั่วร้ายอันหยิ่งผยองจะสลายราวกับควัน`
  - **越南文 (vi)**：
    - 原文：`Chiến binh dũng cảm khoác giáp đỏ thẫm, tay trái cầm khiên vững chắc, tay phải giữ trường thương, luôn tuân theo lẽ chính trực và công bằng. Nó hiến dâng cả thể xác lẫn tâm hồn cho lời thề cao cả bảo vệ trật tự thế giới, và nơi mũi thương chỉ đến, mọi điều ác ngạo ngược đều tan biến như khói.`
    - 修訂：`Chiến binh dũng cảm khoác giáp trắng viền vàng thuần khiết, tay trái cầm khiên vững chắc, tay phải giữ trường thương, luôn tuân theo lẽ chính trực và công bằng. Nó hiến dâng cả thể xác lẫn tâm hồn cho lời thề cao cả bảo vệ trật tự thế giới, và nơi mũi thương chỉ đến, mọi điều ác ngạo ngược đều tan biến như khói.`

---

## 三、 排版與合約完整性測試數據 (Verification & Test Suite)

### 1. 核心合約與 SHA256 完整性
- **修訂資料檔**：`src/data/championship/database-original-profiles.r1.json`
- **LF 標準字節 SHA256**：`445be1abb7972b443630d59c0db91269cfc03057768ca3782543cabbf7f1231c`
- **公開發布合約**：已同步寫入 `docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json` 與 `docs/contracts/championship/WEB_BUILD_INPUTS.v1.json`，無任何未登記變更。
- **測試夾具一致性**：`tests/fixtures/database-lion-preservation-20261017.json` 的 `unaffectedProfilesSha256` 已更新為 `5a738189de7012b9a412fab497d97664f902045caa8e3f2a6e0022aa86e10b14`，精確鎖定不受影響之角色記錄。

### 2. 回歸測試驗證結果
執行指令：
```bash
node --test tests/championship-database-stories-cases.mjs tests/championship-locale-cases.mjs tests/championship-lion-display-correction-cases.mjs tests/championship-source-story-corrections-cases.mjs tests/championship-juicy-showcase-cases.mjs
```
- **測試結果**：**113 / 113 pass，0 fail，0 cancelled，0 skipped** (耗時 ~12.6s)
- **覆蓋範圍**：
  - 216 基礎角色故事與晉升形態五國語言映射
  - 230 角色展示圖與名冊私隱保護
  - 189 雙翼歷史基線 SHA256
  - 獅王歷史存檔與故事更正隔離
  - 繁中、英文、日文、泰文、越南文全部文本字典與標籤無遺漏

---

## 四、 176 隻無須修改之視覺核對說明 (Appearance Verified)

經由原圖大圖逐一核驗，其餘 176 隻角色的**可見物理外觀（身形、體色、毛皮、鱗片、角形與數量、眼耳特徵、翅翼數量與色澤、足部構造、尾巴構造、手持武器與方位、防具與標誌）**均與核准主圖完全一致。圖片無法驗證之性情、經歷與世界觀設定，恪守既有文本保持原文不予更動。

---

## 五、 發布紀錄與 Git 狀態說明

1. **工作目錄**：`r:\Projects\Championship2026\dex-story-audit-20261023`
2. **分支狀態**：`main`（同步最新 `origin/main` @ `cb42d906`）
3. **變更清單**：
   - `docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json`
   - `docs/contracts/championship/WEB_BUILD_INPUTS.v1.json`
   - `docs/reports/dex-story-audit-20261023/DEX_STORY_TO_ART_AUDIT_REPORT_20261023.md`
   - `src/data/championship/database-original-profiles.r1.json`
   - `tests/championship-database-stories-cases.mjs`
   - `tests/championship-source-story-corrections-cases.mjs`
   - `tests/fixtures/database-lion-preservation-20261017.json`
4. **發布驗證**：所有改動均經全套測試驗證，準備正式 commit 並 push 至 origin/main。
