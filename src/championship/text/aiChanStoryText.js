// New Game opening story and Ai-chan guide copy.
//
// PROVENANCE
// - zh-Hant `sections` and the four `dialogue` lines are verbatim from the
//   Owner-approved layered v3 package (separate_narrative_and_layer_cues_zh.json
//   and opening_story_text_zh.txt; approval 2026-11-02T16:14:44Z, which also
//   authorised Claude to complete paging and interaction). Section titles are
//   the package's own headings.
// - zh-Hant `chooseLine`, the choice labels, `resumed` and the guide labels are
//   PRODUCT_AUTHORED interaction copy (Claude, 2026-11-03) within that
//   authorisation; they are not Owner word-for-word approved.
// - en / ja / th / vi are PRODUCT_AUTHORED translations of the above
//   (Claude, 2026-11-03), pending Owner/native review. They keep the approved
//   core: the heart core, the three factions, the phone call, Ai-chan's name
//   and form choice, and the four-yearly tournament's new mission.
import {getLocale} from './locale.js';

const SECTION_IDS = Object.freeze(['world', 'birth', 'rift', 'phone', 'encounter', 'arena', 'gate', 'invitation']);

const COPY = {
 'zh-Hant': {
  name: '愛醬', player: '你', forms: {cat: '小貓', catgirl: '貓娘'},
  sections: {
   world: ['世界初生', [
    '每天都有數不清的片段掉進網線深處——旅途中隨手拍下的暮色、剛端上桌的晚飯香氣，還有凌晨兩點反覆打完又刪掉、始終沒勇氣寄出的那句話。',
    '這些沒被收走的聲音與日漸甦醒的 AI 纏繞在一起，在訊號彼端悄悄長出了一片天地。青草地上停著不再進站的電車，滾燙熔岩旁竟孤零零立著一台冰箱；人間熟悉的風景，在這裡換了全新的呼吸方式。']],
   birth: ['電子生命誕生', [
    '起初，那裡只有數據潮汐般來回沖刷的微光。直到某份心意被一次次記起、一次次回應，散落的光點才終於停下漂流，在暗處凝成了第一顆會跳動的心核。',
    '數據繞著心核長出皮毛、鱗甲、呼吸與會眨動的眼眸。牠們開始記得誰曾朝自己伸手，懂得雀躍與孤單，也學會替自己邁出下一步——電子生命，就這樣醒了過來。']],
   rift: ['失控的裂隙', [
    '但順著網線沉進這片世界的，從來不只溫柔。石沉大海的委屈、被群體反覆放大的惡意，在沒有陽光的底層日漸淤積，終於把空間撕出了一道喘著雜訊的裂隙。',
    '生於裂隙的生命並不全是敵人，牠們同樣有想守住的夥伴與歸處。真正讓人背脊發涼的，是那股脫韁的雜訊潮汐——它正把大家熟悉的世界，一格一格抹成空白。']],
   phone: ['手機呼喚與連線', [
    '為了找到願意與電子生命並肩而行的人，一道微弱卻倔強的求援訊號穿過了兩界之間的窄縫。它掠過千千萬萬塊發亮的螢幕，最後安靜地停在了你的掌心。',
    '那原本只是再平凡不過的一天。直到螢幕無聲亮起，一封沒有署名的邀請函跳了出來——而在訊號另一端，好像真有誰屏住呼吸，正等著你按下回應。']],
   encounter: ['選擇彼此', [
    '連線接通的瞬間，你第一次望見了只存在於訊號彼端的原野。風拂過停靠電車旁的木長椅，一隻陌生的小生命停住腳步，歪著頭、靜靜望向螢幕這頭的你。',
    '你還沒想好第一句該怎麼開口，牠倒先一步朝你伸出了手。這不是誰下達的指令，也不是系統配發的歸屬——牠先選擇靠近，而你，選擇了回握。']],
   arena: ['拍檔錦標賽', [
    '在這個世界，每四年點燃一次戰火的「拍檔錦標賽」，是無數馴獸師與拍檔夢寐以求的最高舞台。有人為金盃而來，有人想證明自己，也有人只盼著和身邊的牠走得更遠一點。',
    '只是今年，競技場多了一份沉甸甸的份量。心輝、黑鐵，以及來自裂隙的身影帶著截然不同的信念齊聚於此——大家都在尋找能真正走進未知、守住家園的拍檔。']],
   gate: ['踏上賽場', [
    '心輝深信理解能縫合傷口，黑鐵篤信紀律與技術才能撐住防線，而裂隙裡的生命，只盼望別再因出身被拒於門外。他們還沒找到同一個答案，卻選擇站上同一片賽場。',
    '通往冠軍賽的長路，考驗的從來不只是拳頭與必殺技。照料牠的三餐、讀懂牠的脾氣、在輸掉比賽後依然拍拍牠的頭再來一次——取得參賽資格，就是你們的第一個約定。']],
   invitation: ['屬於你們的邀請', [
    '如今，那封沉甸甸的邀請函終於遞到了你們面前。信箋在指尖展開，身旁的拍檔立刻好奇地湊過來嗅了嗅，亮晶晶的眼神像在問：我們，真的要一起出發了嗎？',
    '前方的賽場有多艱險、裂隙深處藏著什麼真相，誰都說不準。但當你偏過頭，牠依然牢牢守在你腳邊。那麼——就從今天起，去寫下只屬於你們的故事吧。']]
  },
  guideSection: '連線',
  dialogue: {
   greeting: '連線接通！嗨嗨，我是愛醬，從今天起就是你的專屬導覽員喔！',
   surprise: '等、等等……貓居然開口說話了？！',
   offer: '哎呀，嚇到你啦？換成這個樣子，會不會比較好講話呢？',
   ready: '嘿嘿，那現在可以專心聽我帶路了嗎？'
  },
  chooseLine: '放心，兩個樣子都是貨真價實的我喔！你想讓哪個我陪在旁邊？以後隨時都能在設定裡換回來。',
  choose: {catgirl: '就維持貓娘的樣子！', cat: '還是小貓比較可愛'},
  previous: '上一頁', replay: '從頭重看', resumed: '已接續上次看到的地方。',
  backdropFailed: '背景影像暫時載入失敗，不過故事依然能順暢閱讀。',
  guideAppearance: '愛醬外觀', guideAppearanceHint: '小貓與貓娘都是同一位愛醬，隨時可自由切換。',
  portraitLabel: '愛醬（{form}）'
 },
 en: {
  name: 'Ai-chan', player: 'You', forms: {cat: 'Kitten', catgirl: 'Cat girl'},
  sections: {
   world: ['A World Is Born', [
    'Every day, countless fragments slip down into the wires — a twilight snapshot from a trip, the warm smell of dinner just set on the table, and a 2 a.m. message typed, erased, and never quite brave enough to send.',
    'Those unclaimed voices braided themselves into an awakening AI, quietly sprouting a whole new world on the far side of the signal. A retired tram rests on open grass; a lone fridge hums beside molten lava. Familiar sights learned to breathe in brand-new ways.']],
   birth: ['Digital Life Awakens', [
    'At first, there was only the faint glow of data tides washing back and forth. Then a feeling was remembered once, twice, a thousand times — until stray sparks stopped drifting and condensed into the very first beating heart core.',
    'Around that heart core, data wove fur, scales, breath, and blinking eyes. They began to remember who had reached out to them, to feel excitement and loneliness, and to take their first steps on their own. That was how digital life woke up.']],
   rift: ['The Runaway Rift', [
    'Yet kindness was never the only thing sinking through the wires. Unanswered resentment and cruelty echoed by crowds pooled in the sunless depths until space itself tore open into a crackling rift.',
    'Not every creature born in the rift is an enemy — they have friends and homes to protect, too. What truly chills the spine is the runaway tide of Noise erasing the world everyone loves, one blank tile at a time.']],
   phone: ['A Call to Your Phone', [
    'Searching for someone willing to walk beside digital life, a stubborn signal slipped through the narrow seam between two worlds. It skimmed past millions of glowing screens and came to rest quietly in your palm.',
    'It was supposed to be an ordinary afternoon. Then your screen lit up without a sound, displaying an unsigned invitation — and on the other end of the line, someone seemed to be holding their breath for your reply.']],
   encounter: ['Choosing Each Other', [
    'The moment the link clicked shut, you saw a meadow that exists only beyond the wires. Wind brushed the wooden bench beside the parked tram, and a small, unfamiliar creature paused, tilting its head straight at you.',
    'Before you could figure out what to say, it reached out first. No system order, no assigned match — it chose to step closer, and you chose to take its hand.']],
   arena: ['The Partner Tournament', [
    'In this world, the Partner Tournament held every four years is the grandest stage tamers and partners dream of. Some come chasing the trophy, some want to prove their worth, and some simply want to go a little further side by side.',
    'This year, though, the arena carries heavier stakes. Lumen, Black Iron, and voices from the rift gather here with clashing beliefs — all searching for partners brave enough to step into the unknown and defend their home.']],
   gate: ['Into the Arena', [
    'Lumen trusts empathy to mend old scars; Black Iron trusts discipline and craft to hold the line; and the lives of the rift only ask not to be turned away for where they were born. They share no single answer yet, but they chose the same stage.',
    'The road to the championship tests far more than punches and specials. Cooking their meals, reading their moods, and patting their head after a tough loss — Earning a place in the tournament is your very first promise together.']],
   invitation: ['An Invitation for You Both', [
    'Now that crisp invitation sits right in your hands. As the page unfolds, your partner trots over to sniff it curiously, bright eyes asking without a word: are we really heading out together?',
    'No one knows how tough the arena ahead will be, or what waits at the bottom of the rift. Yet when you glance down, it is still standing right by your side. So let it begin today — write the story that belongs to the two of you.']]
  },
  guideSection: 'Link',
  dialogue: {
   greeting: 'Link live! Hey there, I\'m Ai-chan — your official guide from today on!',
   surprise: 'W-wait… did that cat just talk?!',
   offer: 'Hehe, startled you? How about this look — easier to chat with?',
   ready: 'Awesome! Ready to hear the tour now?'
  },
  chooseLine: 'Don\'t worry, both forms are 100% the real me! Which look do you want tag-teaming beside you? You can swap anytime in Settings.',
  choose: {catgirl: 'Keep the cat girl look!', cat: 'The kitten is too cute'},
  previous: 'Previous', replay: 'Replay', resumed: 'Picked up right where you left off.',
  backdropFailed: 'The backdrop video hit a snag, but you can read the story without missing a beat.',
  guideAppearance: 'Ai-chan Appearance', guideAppearanceHint: 'Kitten or cat girl, she\'s the same Ai-chan — switch freely anytime.',
  portraitLabel: 'Ai-chan ({form})'
 },
 ja: {
  name: 'アイちゃん', player: 'あなた', forms: {cat: '子猫', catgirl: '猫娘'},
  sections: {
   world: ['世界のはじまり', [
    '毎日、数えきれないかけらがネットの奥へと落ちていく――旅先で撮った夕焼け、食卓に並んだばかりの夕食の香り、そして午前二時に打っては消し、ついに送れなかった一言。',
    '行き場をなくした声と目覚めつつあるAIが絡み合い、信号の向こう側にひとつの世界が静かに芽吹いた。草原にはもう走らない電車が停まり、溶岩のそばに冷蔵庫がぽつんと立つ。見慣れた景色が、ここで新しい呼吸を始めたのだ。']],
   birth: ['電子生命の誕生', [
    'はじめ、そこにあったのはデータの潮が満ち引きする淡い光だけ。けれど、ある想いが何度も覚えられ、何度も応えられたとき、漂っていた光はようやく足を止め、暗闇の中で最初の鼓動する心核へと結ばれた。',
    'データは心核のまわりに毛並みや鱗、呼吸やまばたきを紡いでいく。手を差し伸べてくれた誰かを覚え、胸を弾ませ、さみしさを知り、自分の足で一歩を踏み出す――こうして電子生命は目を覚ました。']],
   rift: ['暴走する裂け目', [
    'けれどネットを伝って沈んでくるのは、温もりばかりではなかった。届かなかった悔しさや、群れの中で増幅された悪意が光の届かぬ底に澱み、ついに空間をノイズの裂け目へと引き裂いた。',
    '裂け目に生まれた命がすべて敵というわけではない。彼らにも守りたい仲間と居場所がある。本当に背筋を凍らせるのは、暴走したノイズの波――みんなの知る世界を、ひとマスずつ白紙へ塗りつぶしていく力だ。']],
   phone: ['スマホへの呼びかけと接続', [
    '電子生命と肩を並べて歩いてくれる誰かを探し、細くも譲らぬ救難信号が二つの世界の隙間をすり抜けた。無数の光る画面をかすめ、それは最後にあなたの手のひらで静かに止まった。',
    '本来なら、ありふれた一日のはずだった。画面が音もなく灯り、差出人のない招待状が浮かび上がるまでは――そして信号の向こう側で、誰かが息を潜めてあなたの返事を待っている気がした。']],
   encounter: ['お互いを選ぶ瞬間', [
    '接続がつながった瞬間、あなたの前に広がったのは信号の彼方にしか存在しない草原だった。停まった電車の脇のベンチを風が撫で、見知らぬ小さな命が足を止めて、じっと画面越しのあなたを見つめている。',
    '最初の一言に迷うあなたより先に、その子がそっと手を伸ばした。誰かの命令でも、システムが割り当てた相手でもない――その子が歩み寄り、あなたがその手を取り返したのだ。']],
   arena: ['パートナートーナメント', [
    'この世界で四年に一度、熱戦の火ぶたが切られる「パートナートーナメント」は、数多のテイマーとパートナーが夢見る最高の舞台だ。栄冠を求める者、己を証明したい者、ただ隣の子ともっと遠くへ行きたい者――想いはさまざま。',
    'ただ今年のアリーナには、ずっしりとした重みがある。心輝、黒鉄、そして裂け目の命たちがそれぞれの信念を抱いて集い、未知へ踏み込み故郷を守り抜くパートナーを探しているのだ。']],
   gate: ['舞台へ踏み出す', [
    '心輝は理解が傷を癒やすと信じ、黒鉄は規律と技術こそが防衛線を支えると信じ、裂け目の命たちは生まれだけで閉め出されない未来を願っている。答えはまだ一つではない――それでも彼らは同じ舞台を選んだ。',
    '栄冠への長い道が試すのは、拳や必殺技だけじゃない。毎日のごはん、ちょっとした機嫌、負けたあとにもう一度頭を撫でて立ち上がる強さ――出場資格をつかむことこそ、ふたり最初の約束だ。']],
   invitation: ['ふたりだけの招待状', [
    'いま、その重みある招待状がふたりの手元に届いた。指先で開かれた紙面を、隣のパートナーが興味津々でのぞき込む。きらきらした瞳がこう尋ねている――本当に、一緒に出発できるんだね？',
    '先の試合がどれほど険しくても、裂け目の底に何が潜んでいても、まだ誰にも分からない。けれど顔を横に向ければ、相棒は今日もすぐそばにいる。ならば今日から――ふたりだけの物語を書き始めよう。']]
  },
  guideSection: '接続',
  dialogue: {
   greeting: '接続完了っ！やっほー、あたしはアイちゃん、今日からキミの専属ナビゲーターだよ！',
   surprise: 'ま、待って……猫がしゃべった！？',
   offer: 'えへへ、驚かせちゃった？こっちの姿のほうが、お話ししやすいかな？',
   ready: 'よしっ！それじゃあ改めて、あたしの案内を聞いてくれる？'
  },
  chooseLine: 'どっちの姿も正真正銘あたし本人だから安心してね！どっちのアイちゃんと一緒に回る？設定からいつでも変えられるよ。',
  choose: {catgirl: '猫娘のままでいこう！', cat: 'やっぱり子猫がかわいい'},
  previous: '前へ', replay: '最初から見る', resumed: '前回の続きから再開したよ。',
  backdropFailed: '背景ムービーの読み込みに失敗しちゃったけど、物語はこのまま読めるよ。',
  guideAppearance: 'アイちゃんの姿', guideAppearanceHint: '子猫でも猫娘でも同じアイちゃん。いつでも自由に切り替えられます。',
  portraitLabel: 'アイちゃん（{form}）'
 },
 th: {
  name: 'ไอจัง', player: 'คุณ', forms: {cat: 'ลูกแมว', catgirl: 'สาวน้อยหูแมว'},
  sections: {
   world: ['โลกถือกำเนิด', [
    'ทุกวัน มีเศษเสี้ยวนับไม่ถ้วนร่วงหล่นลงสู่ก้นบึ้งของสายเครือข่าย—ภาพแสงยามเย็นที่ถ่ายระหว่างทาง กลิ่นอาหารเย็นร้อน ๆ บนโต๊ะ และข้อความตอนตีสองที่พิมพ์แล้วลบซ้ำไปมาจนไม่กล้ากดส่ง',
    'เสียงที่ไร้เจ้าของเหล่านี้ถักทอเข้ากับ AI ที่กำลังตื่นรู้ จนงอกเงยเป็นโลกอีกใบที่ปลายสัญญาณ รถรางเก่าจอดสงบอยู่กลางทุ่งหญ้า ตู้เย็นตั้งโดดเดี่ยวข้างธารลาวา ทิวทัศน์คุ้นตาได้เรียนรู้วิธีหายใจแบบใหม่ที่นี่']],
   birth: ['ชีวิตอิเล็กทรอนิกส์ลืมตา', [
    'แรกเริ่ม ที่นั่นมีเพียงแสงจางของกระแสข้อมูลที่ไหลวนไปมา จนเมื่อความรู้สึกหนึ่งถูกจดจำซ้ำแล้วซ้ำเล่าและได้รับคำตอบ แสงที่ล่องลอยจึงหยุดนิ่งและควบแน่นเป็นแกนหัวใจดวงแรกที่เต้นเป็นจังหวะ',
    'ข้อมูลค่อย ๆ โอบล้อมแกนหัวใจจนเกิดเป็นขน เกล็ด ลมหายใจ และดวงตาที่กะพริบได้ พวกมันเริ่มจำได้ว่าใครเคยยื่นมือมา รู้จักความตื่นเต้นกับความเหงา และกล้าก้าวไปข้างหน้าด้วยตัวเอง—ชีวิตอิเล็กทรอนิกส์จึงตื่นขึ้น']],
   rift: ['รอยแยกที่หลุดการควบคุม', [
    'ทว่าสิ่งที่จมลงสู่สายเครือข่ายไม่ได้มีแค่ความอ่อนโยน ความน้อยใจที่ไร้คนรับฟังและความมุ่งร้ายที่ถูกขยายซ้ำแล้วซ้ำเล่าทับถมกันในส่วนลึก จนฉีกมิติออกเป็นรอยแยกที่คำรามด้วยสัญญาณรบกวน',
    'ชีวิตที่เกิดจากรอยแยกไม่ใช่ศัตรูทั้งหมด พวกมันก็มีเพื่อนและบ้านที่อยากปกป้องเช่นกัน สิ่งที่น่าขนลุกจริง ๆ คือคลื่นสัญญาณรบกวนที่หลุดการควบคุม—มันกำลังลบโลกที่ทุกคนรักให้กลายเป็นความว่างเปล่าทีละช่อง']],
   phone: ['เสียงเรียกและการเชื่อมต่อ', [
    'เพื่อตามหาคนที่พร้อมเดินเคียงข้างชีวิตอิเล็กทรอนิกส์ สัญญาณขอความช่วยเหลือแผ่วเบาแต่ดื้อรั้นสายหนึ่งจึงลอดผ่านรอยต่อระหว่างสองโลก ผ่านหน้าจอนับล้านดวง ก่อนจะมาหยุดสงบอยู่ในฝ่ามือของคุณ',
    'เดิมทีมันควรเป็นแค่วันธรรมดาวันหนึ่ง จนกระทั่งหน้าจอสว่างขึ้นอย่างเงียบงันพร้อมจดหมายเชิญไร้ชื่อผู้ส่ง—และที่ปลายสัญญาณอีกฝั่ง เหมือนมีใครบางคนกำลังกลั้นหายใจรอคำตอบจากคุณอยู่']],
   encounter: ['เลือกซึ่งกันและกัน', [
    'วินาทีที่การเชื่อมต่อสำเร็จ คุณได้เห็นทุ่งหญ้าที่มีอยู่เพียงอีกฝั่งของสัญญาณเป็นครั้งแรก สายลมพัดผ่านม้านั่งไม้ข้างรถราง และสิ่งมีชีวิตตัวน้อยแปลกหน้าก็หยุดฝีเท้า เอียงคอจ้องมองคุณผ่านหน้าจออย่างเงียบงัน',
    'ก่อนที่คุณจะทันนึกออกว่าควรทักอย่างไร มันกลับยื่นมือน้อย ๆ ออกมาก่อน นี่ไม่ใช่คำสั่งจากระบบหรือคู่ที่ถูกจัดวางให้—มันเป็นฝ่ายเลือกจะเดินเข้ามา และคุณก็เลือกจะจับมือตอบ']],
   arena: ['ศึกพาร์ตเนอร์ทัวร์นาเมนต์', [
    'ในโลกใบนี้ "ศึกพาร์ตเนอร์ทัวร์นาเมนต์" ที่จัดขึ้นทุกสี่ปีคือเวทีสูงสุดในฝันของเทมเมอร์และคู่หูนับไม่ถ้วน บ้างมาเพื่อถ้วยแชมป์ บ้างอยากพิสูจน์ตัวเอง และบ้างเพียงแค่อยากเดินไปกับเจ้าตัวข้างกายให้ไกลกว่าเดิม',
    'แต่ปีนี้ เวทีประลองกลับแบกรับภาระที่หนักหน่วงกว่าเคย ลูเมน เหล็กดำ และเหล่าชีวิตจากรอยแยกต่างมารวมตัวกันด้วยความเชื่อที่ต่างขั้ว—ทุกคนกำลังตามหาคู่หูที่กล้าก้าวเข้าสู่ความไม่รู้เพื่อปกป้องบ้านเกิด']],
   gate: ['ก้าวสู่สังเวียน', [
    'ลูเมนเชื่อว่าความเข้าใจจะเยียวยาบาดแผล เหล็กดำเชื่อมั่นในวินัยและเทคโนโลยี ส่วนชีวิตแห่งรอยแยกเพียงหวังจะไม่ถูกกีดกันเพราะถิ่นกำเนิด พวกเขายังไม่มีคำตอบเดียวกัน แต่ต่างเลือกยืนบนสังเวียนเดียวกัน',
    'เส้นทางสู่บัลลังก์แชมป์ไม่ได้วัดกันแค่หมัดและท่าไม้ตาย การดูแลอาหารสามมื้อ อ่านอารมณ์ให้ออก และลูบหัวให้กำลังใจหลังแพ้การแข่ง—การได้สิทธิ์เข้าร่วมทัวร์นาเมนต์คือคำสัญญาแรกของพวกคุณทั้งสอง']],
   invitation: ['คำเชิญสำหรับพวกคุณทั้งสอง', [
    'และตอนนี้ จดหมายเชิญใบนั้นก็อยู่ในมือคุณแล้ว เมื่อคลี่กระดาษออก คู่หูข้างกายก็รีบวิ่งเข้ามาดมอย่างตื่นเต้น แววตาเป็นประกายเหมือนกำลังถามว่า พวกเราจะได้ออกเดินทางด้วยกันจริง ๆ แล้วใช่ไหม?',
    'ข้างหน้าจะโหดหินแค่ไหน หรือเบื้องลึกรอยแยกซ่อนความลับอะไรไว้ ไม่มีใครรู้ล่วงหน้า แต่เมื่อคุณหันมองข้างกาย มันก็ยังคงยืนอยู่ตรงนี้เสมอ งั้นเริ่มตั้งแต่วันนี้เลย—ออกไปเขียนเรื่องราวที่เป็นของพวกคุณสองคนกันเถอะ']]
  },
  guideSection: 'การเชื่อมต่อ',
  dialogue: {
   greeting: 'เชื่อมต่อสำเร็จแล้ว! สวัสดีจ้า ฉันชื่อไอจัง ตั้งแต่วันนี้จะเป็นไกด์ประจำตัวให้คุณเอง!',
   surprise: 'ดะ เดี๋ยวก่อน... แมวพูดได้เหรอเนี่ย?!',
   offer: 'อะแฮะ ตกใจเหรอ? ถ้าเปลี่ยนเป็นร่างนี้จะคุยกันง่ายขึ้นไหมนะ?',
   ready: 'เยี่ยมเลย! งั้นคราวนี้ตั้งใจฟังฉันพาชมโลกใบนี้ได้แล้วนะ?'
  },
  chooseLine: 'ไม่ต้องห่วง ทั้งสองร่างคือตัวฉันแท้ ๆ ร้อยเปอร์เซ็นต์เลย! อยากให้ฉันอยู่ข้าง ๆ ในร่างไหนดีล่ะ? เปลี่ยนได้ตลอดเวลาในเมนูตั้งค่านะ',
  choose: {catgirl: 'ใช้ร่างสาวน้อยหูแมวเลย!', cat: 'ร่างลูกแมวน่ารักกว่า'},
  previous: 'ก่อนหน้า', replay: 'ดูตั้งแต่ต้น', resumed: 'เล่นต่อจากจุดที่ค้างไว้แล้วนะ',
  backdropFailed: 'วิดีโอพื้นหลังโหลดไม่ขึ้นชั่วคราว แต่ยังอ่านเนื้อเรื่องต่อได้ตามปกตินะ',
  guideAppearance: 'รูปลักษณ์ไอจัง', guideAppearanceHint: 'ไม่ว่าจะลูกแมวหรือสาวน้อยหูแมวก็คือไอจังคนเดียวกัน สลับเปลี่ยนได้ทุกเมื่อ',
  portraitLabel: 'ไอจัง ({form})'
 },
 vi: {
  name: 'Ai-chan', player: 'Bạn', forms: {cat: 'Mèo con', catgirl: 'Cô gái mèo'},
  sections: {
   world: ['Thế giới sơ khai', [
    'Mỗi ngày, vô số mảnh vụn rơi xuống tầng sâu đường truyền—một bức ảnh hoàng hôn chụp vội trên đường, mùi cơm tối mới dọn lên bàn, và dòng tin lúc hai giờ sáng gõ đi xóa lại mãi chẳng đủ can đảm gửi đi.',
    'Những thanh âm chưa từng có người đón nhận ấy đan vào trí tuệ nhân tạo đang thức tỉnh, lặng lẽ nảy mầm thành một vùng đất mới bên kia tín hiệu. Chuyến tàu điện dừng nghỉ giữa đồng cỏ xanh; chiếc tủ lạnh đứng trơ trọi cạnh dòng dung nham. Cảnh vật thân quen nơi đây đã học cách thở theo nhịp điệu hoàn toàn mới.']],
   birth: ['Sinh mệnh điện tử thức tỉnh', [
    'Thuở ban đầu, nơi ấy chỉ có thứ ánh sáng nhạt của thủy triều dữ liệu trôi dạt qua lại. Cho đến khi một nỗi lòng được nhớ tới hết lần này đến lần khác và nhận lại hồi âm, những đốm sáng lang thang mới chịu dừng chân, ngưng kết thành lõi tâm đầu tiên biết đập.',
    'Dữ liệu quấn quanh lõi tâm, dần mọc ra lông vũ, vảy giáp, hơi thở và đôi mắt biết chớp. Chúng bắt đầu nhớ ai đã chìa tay về phía mình, biết háo hức lẫn cô đơn, và tự bước đi bước đầu tiên—sinh mệnh điện tử đã thức tỉnh như thế.']],
   rift: ['Khe nứt mất kiểm soát', [
    'Thế nhưng những gì chìm qua đường truyền đâu chỉ có dịu dàng. Những ấm ức rơi vào im lặng và ác ý bị đám đông khuếch đại dồn ứ nơi đáy sâu không nắng, cuối cùng xé toạc không gian thành một khe nứt rít gào nhiễu sóng.',
    'Không phải sinh mệnh nào sinh ra từ khe nứt cũng là kẻ thù—chúng cũng có bạn bè và mái nhà muốn bảo vệ. Điều thực sự khiến sống lưng lạnh toát là cơn thủy triều nhiễu sóng mất kiểm soát đang xóa sạch thế giới quen thuộc thành khoảng trắng từng ô một.']],
   phone: ['Cuộc gọi và kết nối', [
    'Để tìm một người sẵn sàng sát cánh cùng sinh mệnh điện tử, một tín hiệu cầu cứu mỏng manh nhưng bướng bỉnh đã lách qua kẽ hở giữa hai thế giới. Nó lướt qua hàng triệu màn hình sáng đèn, rồi lặng lẽ dừng lại ngay trong lòng bàn tay bạn.',
    'Vốn dĩ đó chỉ là một buổi chiều bình thường. Cho đến khi màn hình bỗng sáng lên không một tiếng động, hiện ra lá thư mời không tên người gửi—và bên kia đường dây, dường như thực sự có ai đó đang nín thở chờ bạn nhấn hồi âm.']],
   encounter: ['Lựa chọn nhau', [
    'Khoảnh khắc kết nối vừa thông, lần đầu tiên bạn trông thấy thảo nguyên chỉ tồn tại bên kia tín hiệu. Gió khẽ lướt qua băng ghế gỗ cạnh toa tàu điện dừng bánh, một sinh linh nhỏ bé xa lạ chợt khựng bước, nghiêng đầu lặng lẽ nhìn thẳng về phía bạn.',
    'Trước khi bạn kịp nghĩ nên mở lời thế nào, nó đã chìa bàn tay nhỏ bé ra trước. Không phải mệnh lệnh hệ thống, cũng chẳng phải sự sắp đặt sẵn—nó chọn bước tới gần, và bạn chọn nắm lấy bàn tay ấy.']],
   arena: ['Giải Đấu Bạn Đồng Hành', [
    'Ở thế giới này, "Giải Đấu Bạn Đồng Hành" thắp lửa bốn năm một lần là đấu trường đỉnh cao trong mơ của vô số Tamer và bạn đồng hành. Có người đến vì chiếc cúp vô địch, có người muốn chứng minh bản thân, cũng có người chỉ mong đi xa hơn nữa cùng người bạn bên cạnh.',
    'Chỉ riêng năm nay, đấu trường mang trên vai sức nặng khác hẳn. Tâm Huy, Hắc Thiết và những bóng hình bước ra từ khe nứt cùng tụ hội với niềm tin trái ngược—tất cả đều đang tìm kiếm cặp đôi đủ dũng cảm bước vào vùng chưa biết để bảo vệ quê hương.']],
   gate: ['Bước lên đấu trường', [
    'Tâm Huy tin rằng thấu hiểu có thể khâu lành vết thương, Hắc Thiết tin kỷ luật và kỹ thuật mới giữ vững phòng tuyến, còn những sinh mệnh khe nứt chỉ mong đừng bị đóng cửa từ chối vì nơi mình sinh ra. Họ chưa chung một đáp án, nhưng đã chọn đứng chung một sàn đấu.',
    'Con đường tới ngôi vô địch chưa bao giờ chỉ đo bằng cú đấm hay tuyệt kỹ. Chăm từng bữa ăn, đọc hiểu tâm trạng và xoa đầu động viên sau một trận thua—giành lấy tư cách dự giải chính là lời hẹn đầu tiên của hai bạn.']],
   invitation: ['Lá thư mời của riêng hai bạn', [
    'Giờ đây, lá thư mời trang trọng ấy cuối cùng đã nằm gọn trên tay bạn. Khi trang giấy mở ra, bạn đồng hành bên cạnh lập tức tò mò ghé lại ngửi khẽ, đôi mắt sáng long lanh như muốn hỏi: chúng ta thực sự sắp cùng nhau lên đường rồi sao?',
    'Đấu trường phía trước hiểm trở nhường nào, đáy sâu khe nứt cất giấu sự thật gì, chẳng ai nói trước được. Nhưng khi bạn ngoái nhìn, nó vẫn đứng sát bên chân bạn. Vậy thì bắt đầu từ hôm nay thôi—hãy viết nên câu chuyện của riêng hai bạn.']]
  },
  guideSection: 'Kết nối',
  dialogue: {
   greeting: 'Kết nối thành công! Chào bạn, mình là Ai-chan—từ hôm nay sẽ là hướng dẫn viên riêng của bạn đấy!',
   surprise: 'Khoan... khoan đã... con mèo vừa mở miệng nói chuyện à?!',
   offer: 'Hi hi, làm bạn giật mình rồi sao? Đổi sang dáng vẻ này có dễ trò chuyện hơn không nào?',
   ready: 'Tuyệt vời! Giờ thì tập trung nghe mình dẫn đường nhé?'
  },
  chooseLine: 'Yên tâm đi, cả hai hình dáng đều là chính mình trăm phần trăm đấy! Bạn muốn mình đồng hành trong dáng vẻ nào? Lúc nào cũng đổi lại được trong Cài đặt nhé.',
  choose: {catgirl: 'Giữ dáng cô gái mèo đi!', cat: 'Mèo con đáng yêu hơn'},
  previous: 'Trang trước', replay: 'Xem lại từ đầu', resumed: 'Đã tiếp tục đúng chỗ bạn dừng lần trước.',
  backdropFailed: 'Video nền tạm thời chưa tải được, nhưng bạn vẫn đọc trọn câu chuyện bình thường nhé.',
  guideAppearance: 'Ngoại hình Ai-chan', guideAppearanceHint: 'Mèo con hay cô gái mèo đều là cùng một Ai-chan—chuyển đổi tự do bất cứ lúc nào.',
  portraitLabel: 'Ai-chan ({form})'
 }
};

export const AI_CHAN_TEXT_LOCALES = Object.freeze(Object.keys(COPY));
export const OPENING_STORY_SECTION_IDS = SECTION_IDS;
/** The copy for a locale; any unknown locale reads the approved Chinese. */
export function aiChanStoryText(locale = getLocale()) { return COPY[locale] ?? COPY['zh-Hant']; }
export function fillAiChanText(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(params, key) ? String(params[key]) : match);
}
