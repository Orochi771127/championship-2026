# 全圖鑑 230 角色故事與核准主圖外觀核對報告 (Story-to-Art Appearance Audit)

> **基準分支與 Commit**：`feat/dex-story-appearance-audit-20261023` @ `945a95a0470c8b430f28182e4305a17a68b4ae7e` (同步自 `origin/main`)
> **發布狀態**：**未 push、未 merge main、未發布**，保留完整變更紀錄與差異清單，交由 dot 或整合負責人進行後續合流。
> **審查真理依據**：以最新版核准主圖（Approved Master Hero Portraits）為外觀唯一真理依據。
> **審查範圍**：全圖鑑 230 隻非蛋角色（#8–#223、#229–#242），100% 逐隻視覺比對完成。

---

## 一、 審查與核對分類摘要 (Audit Summary)

| 審查分類 | 數量 | 佔比 | 範圍與處理原則 |
| :--- | :---: | :---: | :--- |
| **已修正 (Directly Fixed)** | **13** 隻 | 5.65% | 故事文本存在明確且無可爭議之**外觀矛盾**（手持武器錯誤、肢體左右顛倒、顏色衝突、舊捐贈者文字殘留）。**只修外型矛盾，不新增能力、改變位階或重寫故事**（包含 B202 依定稿圖修正為單一火焰小角、#218 依定稿圖修正為飛龍身姿並移除手持神斬劍，#162 完整保留「最高階神聖法官」既有位階），全數完成五國語言同步。 |
| **待確認 (Pending Owner Decision)** | **0** 隻 | 0.00% | B202 與 #218 均已依指示依目前定稿主圖直接修正文句，全案無遺留待決項目。 |
| **無須修改 (Appearance Verified)** | **217** 隻 | 94.35% | 經由主圖原尺寸核對，文本中所提及之**可見物理外觀（身形、頭角、眼耳、翅翼、尾巴、肢體、武器裝備、顏色）**與最新核准主圖均有具體視覺證據支持相符；圖片無法驗證之習性、經歷與歷史則尊重既有設定保持原文。 |
| **總計 (Total Roster)** | **230** 隻 | **100.0%** | **全數完成逐隻外觀核對** |

---

## 二、 13 隻修正項目外觀核對、理由與五語對照

> **修訂準則**：只修外型矛盾，不改圖、不新增能力、不改變位階或重寫故事。

### #21 [B202] 焰角丸
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

### #65 [GR37] 月紗兔
- **核准主圖路徑**：`assets/production/database-display-20261018/species-065.display.7224213ad58e0a35.webp`
- **主圖 SHA256**：`7224213ad58e0a35fc40df1fc08c4e09f6ba50567fcb345b5c9071c841bb45b0`
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

### #86 [MA18] 神焰九尾
- **核准主圖路徑**：`assets/production/database-display-20261018/species-086.display.d32e92c57a942079.webp`
- **主圖 SHA256**：`d32e92c57a94207936a7ea392ee0212f4c3983287c8848a609d0cb4f8d55a535`
- **修正部位**：`火焰顏色`
- **修改理由與證據**：核准主圖之神焰九尾狐燃燒的是極為耀眼的「赤紅金黃神焰」，與原文「青藍神焰」顏色直接衝突。
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

### #100 [MA40] 聖刃女武
- **核准主圖路徑**：`assets/production/database-display-20261018/species-100.display.8546b5a374665a3c.webp`
- **主圖 SHA256**：`8546b5a374665a3cb5593c6f85e4348600d86780c102b363404c0ec5f88424ef`
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

### #136 [AW01] 煌角皇甲
- **核准主圖路徑**：`assets/production/database-display-20261018/species-136.display.69c6e392da9ba206.webp`
- **主圖 SHA256**：`69c6e392da9ba206124ce7f918eb4ebdaeb022f6e9ebc9ec1968853b52d0fa55`
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

### #140 [AW06] 曜紗天姬
- **核准主圖路徑**：`assets/production/database-display-20261018/species-140.display.d8e7c992c4749f78.webp`
- **主圖 SHA256**：`d8e7c992c4749f78fbbfe4ec1469eb9ba696515f4fe4a4e837d9fa82faae2538`
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

### #162 [AW33] 耀裁天使
- **核准主圖路徑**：`assets/production/database-display-20261018/species-162.display.7570220c3fb7e671.webp`
- **主圖 SHA256**：`7570220c3fb7e67198bb6c632832822a1883bfd598642289c02506259021e847`
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

### #168 [AW40] 赤鋼暴君
- **核准主圖路徑**：`assets/production/database-display-20261018/species-168.display.3bb67406a4b5d259.webp`
- **主圖 SHA256**：`3bb67406a4b5d259bb8a6ec1545fc938fe1a221f75d3c8c767e7161bce239920`
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

### #173 [AW45] 旭煌彈龍
- **核准主圖路徑**：`assets/production/database-display-20261018/species-173.display.4a234f99587fc6b7.webp`
- **主圖 SHA256**：`4a234f99587fc6b7ff65a0b77b8c7fc691764ebc3d7e8ee8d89a69a473fbeea2`
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

### #217 [UL22] 焰耀戰刃龍
- **核准主圖路徑**：`assets/production/database-display-20261018/species-217.display.b8013deb58b3b4b8.webp`
- **主圖 SHA256**：`b8013deb58b3b4b86bb320146e297836d5e752945d81d2f47690623d9b4b62e4`
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

### #218 [UL15] 天斬蒼龍
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

### #221 [UL17] 夜月獵姬
- **核准主圖路徑**：`assets/production/database-display-20261018/species-221.display.067d872c8c8e4493.webp`
- **主圖 SHA256**：`067d872c8c8e44931a7886475ea7f003009581faee8590c74f51e50f38b25916`
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

### #223 [UL18] 赤曜槍皇
- **核准主圖路徑**：`assets/production/database-display-20261018/species-223.display.cb48ee8d8d939913.webp`
- **主圖 SHA256**：`cb48ee8d8d939913220fcfb9db05419ee4ad216ec22bfad149cf6c4d7ecf3ca6`
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

## 三、 手機排版實測說明與測試數據 (Mobile Layout Testing)

> **重要測試範圍聲明**：
> 本項手機排版測試係使用 **Playwright Chromium 無頭瀏覽器在標準手機螢幕尺寸（390 × 844，deviceScaleFactor = 2）** 下進行的真實 DOM 渲染測量與多語抽查，檢驗實際卡片樣式（引用 `tokens.css`、`styles.css`、`vs2Styles.css`），**並非實體手機在 230 角色全部五種語言下的逐一真機驗證**。實體手機全量檢驗待後續 dot 合流時進行。

### 測量指標與結果
- **測試規格**：視窗寬度 390px、卡片文字容器 `clientWidth = 326px`。
- **橫向溢出檢驗**：所有 13 隻修訂角色繁中及代表性多語抽樣之 `scrollWidth` 嚴格等於 326px（`scrollWidth <= clientWidth`），**無水平溢出 (Overflow: NONE)**。
- **垂直排版與換行**：繁中文本高度穩定在 69px～92px 之間，多語文本高度在 92px～185px 之間，完全落於手機可視區域內，**無截斷、無遮擋、無重疊**。

---

## 四、 217 隻無須修改之視覺核對證據與身分修正說明

### 身分標示校正澄清
- **#86 神焰九尾 (成熟期 MA18)**：原報告文字提及之九尾狐特徵，明確歸屬於 `speciesIndex: 86` 神焰九尾（核准主圖具備 9 條長尾，修訂其青藍神焰為赤紅神焰）。
- **#19 海芽獸 (幼年期 II B206)**：`speciesIndex: 19` 為海芽獸（幼年期水生型拍檔，非九尾狐）。此處明確分離，避免與列號或編號混淆。

### 217 隻外觀核對範圍
經由大圖逐一查驗，其餘 217 隻角色的**可見物理外觀（體色、毛皮、甲冑顏色、足數如 #49 雷角甲 6 足、翼數、尾數、手持武器類型與方位）**均有具體圖片證據支持相符；圖片無法驗證之性情、經歷與世界觀，嚴格維持原文未動。

---

## 五、 交接包內容明細 (Handoff Bundle)

交接包已打包完成，包含以下內容：
1. **實際修改檔**：`modified-files/database-original-profiles.r1.json`（已完整替換 13 隻五語文本）
2. **完整五語差異**：`diff/dex-story-13-diff.json`
3. **測試輸出日誌**：`test-output.txt`（70/70 圖鑑測試 pass）
4. **截圖目錄**：`screenshots/`（含 Chromium 手機尺寸渲染之 13 隻繁中截圖、多語抽查截圖及原圖放大）
5. **完整報告文件**：`DEX_STORY_TO_ART_AUDIT_REPORT_20261023.md`
6. **ZIP 封存包**：`dex-story-audit-handoff-20261023.zip`
7. **Git 狀態**：分支 `feat/dex-story-appearance-audit-20261023`，基準 commit `945a95a0470c8b430f28182e4305a17a68b4ae7e`，**本地保留，未 push、未 merge**。
