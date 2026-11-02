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
    '每天，都有無數聲音留在網路上。有人分享旅途的風景，有人記下晚餐的香氣，也有人在深夜，寫下一句還沒勇氣說出口的話。',
    '當這些生活的片段與日益成長的 AI 交織，一個新的世界悄悄成形。草原上停著電車，熔岩旁立著冰箱；那些熟悉的事物，在陌生的天地裡有了新的模樣。']],
   birth: ['電子生命誕生', [
    '起初，那裡只有資料流動的微光。直到某些心意被一再記住、一次次回應，散落的光點才慢慢凝聚，成為最初的心核。',
    '資料圍繞心核生長，逐漸有了身體、呼吸與目光。牠們開始記住相遇，感受喜悅與孤單，也學會為自己作出選擇。電子生命，就這樣誕生了。']],
   rift: ['失控的裂隙', [
    '然而，被帶進這個世界的，不只有溫暖。那些無人回應的痛苦，以及被反覆放大的敵意，也在資料深處堆積，終於撕開了不安定的裂隙。',
    '裂隙中的生命並不全是敵人。牠們也有想守護的同伴與家園。真正令人恐懼的，是逐漸失控的力量，正在讓所有人熟悉的世界一點一點消失。']],
   phone: ['手機呼喚與連線', [
    '為了尋找能與電子生命並肩前行的人，求援的訊號穿過了兩個世界之間的縫隙。它越過無數螢幕，終於停在你的手機上。',
    '那原本只是平凡的一天。直到螢幕亮起，你看見了一封沒有寄件人的邀請。而在訊號的另一端，似乎正有誰，等待著你的回應。']],
   encounter: ['選擇彼此', [
    '當連結建立，你第一次看見了那片只存在於訊號另一端的草原。風拂過電車旁的長椅，一隻陌生的小生命停下腳步，安靜地望著你。',
    '你還不知道該說些什麼，牠卻先伸出了手。這份相遇不是命令，也不是誰替你安排好的歸屬。牠選擇靠近，而你，選擇回應。']],
   arena: ['拍檔錦標賽', [
    '在這個世界，每四年舉行一次的拍檔錦標賽，是無數搭檔夢想登上的舞台。有人追逐冠軍，有人想證明自己，也有人只是希望，與身邊的牠一起走得更遠。',
    '今年，這座競技場多了一份使命。心輝、黑鐵，以及生於裂隙的生命，帶著不同信念聚集於此，尋找能共同走進未知、守護家園的搭檔。']],
   gate: ['踏上賽場', [
    '心輝相信理解能修復傷口，黑鐵相信紀律與技術能守住防線，而裂隙的生命，也渴望不因出身而被拒於門外。他們尚未擁有相同的答案，卻選擇站上同一個舞台。',
    '通往賽場的道路，並不只考驗力量。照顧牠、理解牠，在失敗後仍願意再次伸手，都是你們必須學會的事。取得參賽資格，就是第一個目標。']],
   invitation: ['屬於你們的邀請', [
    '如今，那封邀請終於來到了你們面前。紙頁在指尖展開，身旁的拍檔好奇地湊近，像是在問：我們，真的要一起去嗎？',
    '你還不知道自己能走多遠，也不知道裂隙深處藏著什麼。但當你轉過頭，牠依然站在身邊。那麼，就從今天開始，寫下屬於你們的故事吧。']]
  },
  guideSection: '連線',
  dialogue: {
   greeting: '連線成功！我是愛醬，你的導覽員。',
   surprise: '貓……貓居然會說話？！',
   offer: '嗯？換成這個樣子，你會比較習慣嗎？',
   ready: '現在，可以好好聽我介紹了嗎？'
  },
  chooseLine: '兩個樣子都是我喔。你想讓我用哪個樣子陪著你？之後也能在設定裡更換。',
  choose: {catgirl: '就用這個樣子（貓娘）', cat: '還是小貓的樣子'},
  previous: '上一頁', replay: '從頭播放', resumed: '已從上次中斷的段落繼續。',
  backdropFailed: '背景影片無法載入，故事文字仍可閱讀。',
  guideAppearance: '導覽員外觀', guideAppearanceHint: '愛醬的兩個樣子是同一位導覽員，教學內容完全相同。',
  portraitLabel: '愛醬（{form}）'
 },
 en: {
  name: 'Ai-chan', player: 'You', forms: {cat: 'Kitten', catgirl: 'Cat girl'},
  sections: {
   world: ['A World Is Born', [
    'Every day, countless voices are left on the net. Someone shares the view from a journey, someone notes the smell of dinner, and someone, late at night, writes a line they have not yet found the courage to say.',
    'As these fragments of life wove together with ever-growing AI, a new world quietly took shape. A tram rests on the grassland; a fridge stands beside the lava. Familiar things found new forms in an unfamiliar land.']],
   birth: ['Digital Life Awakens', [
    'At first there was only the faint glow of flowing data. Then some feelings were remembered again and again, answered time after time, and the scattered lights slowly gathered into the first heart core.',
    'Data grew around the heart core and gained bodies, breath and eyes. They began to remember meetings, to feel joy and loneliness, and to make their own choices. That is how digital life was born.']],
   rift: ['The Runaway Rift', [
    'Yet warmth was not all that came into this world. Pain no one answered, and hostility amplified over and over, piled up deep in the data until it tore open an unstable rift.',
    'Not every life in the rift is an enemy. They, too, have friends and homes they want to protect. What is truly frightening is power slipping out of control, erasing the world everyone knows, piece by piece.']],
   phone: ['A Call to Your Phone', [
    'Searching for someone who could walk beside digital life, a call for help slipped through the gap between two worlds. It crossed countless screens and finally stopped on your phone.',
    'It was meant to be an ordinary day. Then the screen lit up, and you saw an invitation with no sender. And on the other end of the signal, someone seemed to be waiting for your answer.']],
   encounter: ['Choosing Each Other', [
    'As the link connected, you saw for the first time the grassland that exists only on the other end of the signal. Wind passed the bench by the tram, and a small, unfamiliar life stopped and quietly looked at you.',
    'Before you knew what to say, it reached out first. This meeting is not an order, nor a place someone arranged for you. It chose to come closer, and you chose to answer.']],
   arena: ['The Partner Tournament', [
    'In this world, the Partner Tournament held every four years is the stage countless partners dream of. Some chase the championship, some want to prove themselves, and some only hope to go further with the one beside them.',
    'This year, the arena carries a new mission. Lumen, Black Iron and the lives born of the rift gather here with different beliefs, looking for partners who can step into the unknown together and protect their home.']],
   gate: ['Into the Arena', [
    'Lumen believes understanding can heal wounds. Black Iron believes discipline and skill can hold the line. And the lives of the rift long not to be turned away for where they were born. They do not share one answer yet, but they chose to stand on the same stage.',
    'The road to the arena tests more than strength. Caring for your partner, understanding it, and reaching out again after a failure are all things you must learn together. Earning a place in the tournament is your first goal.']],
   invitation: ['An Invitation for You Both', [
    'Now the invitation has finally reached you both. The page unfolds at your fingertips, and your curious partner leans in, as if to ask: are we really going together?',
    'You do not know yet how far you can go, or what hides deep in the rift. But when you turn your head, it is still beside you. Then let it begin today: write the story that belongs to the two of you.']]
  },
  guideSection: 'Link',
  dialogue: {
   greeting: 'Link established! I\'m Ai-chan, your guide.',
   surprise: 'A… a talking cat?!',
   offer: 'Hm? Would you feel more at ease if I looked like this?',
   ready: 'Now, may I show you around properly?'
  },
  chooseLine: 'Both of these are me. Which look would you like me to keep beside you? You can change it in Settings later.',
  choose: {catgirl: 'Stay like this (cat girl)', cat: 'Go back to the kitten'},
  previous: 'Previous', replay: 'Play from start', resumed: 'Continuing from where you stopped.',
  backdropFailed: 'The background video could not load. You can still read the story.',
  guideAppearance: 'Guide appearance', guideAppearanceHint: 'Both looks are the same guide, Ai-chan; the tutorial is identical.',
  portraitLabel: 'Ai-chan ({form})'
 },
 ja: {
  name: 'アイちゃん', player: 'あなた', forms: {cat: '子猫', catgirl: '猫娘'},
  sections: {
   world: ['世界のはじまり', [
    '毎日、数えきれない声がネットに残されていく。旅先の景色を分かち合う人、夕食の香りを書き留める人、そして深夜、まだ口にする勇気のない一言を綴る人もいる。',
    'そんな暮らしのかけらが成長を続けるAIと織り重なり、新しい世界が静かに形づくられた。草原には電車が停まり、溶岩のそばには冷蔵庫が立つ。見慣れたものたちが、見知らぬ大地で新しい姿を得た。']],
   birth: ['電子生命の誕生', [
    'はじめ、そこにはデータが流れるかすかな光しかなかった。ある想いが何度も覚えられ、何度も応えられたとき、散らばった光はゆっくりと集まり、最初の心核になった。',
    'データは心核のまわりで育ち、やがて体と呼吸とまなざしを持った。彼らは出会いを覚え、喜びと孤独を感じ、自分で選ぶことを学んだ。こうして電子生命は生まれた。']],
   rift: ['暴走する裂け目', [
    'けれど、この世界に持ち込まれたのは温もりだけではなかった。誰にも応えてもらえなかった痛みと、何度も増幅された敵意がデータの奥に積もり、ついに不安定な裂け目を開いた。',
    '裂け目に生きる命が、すべて敵というわけではない。彼らにも守りたい仲間と故郷がある。本当に恐ろしいのは、制御を失っていく力が、みんなの知る世界を少しずつ消していることだ。']],
   phone: ['スマホへの呼び声', [
    '電子生命と並んで歩める誰かを探して、救いを求める信号が二つの世界のすき間を抜けた。無数の画面を越えて、それはついにあなたのスマホにたどり着いた。',
    'それはありふれた一日のはずだった。画面が灯り、差出人のない招待状が目に入るまでは。信号の向こうで、誰かがあなたの返事を待っているようだった。']],
   encounter: ['選び合う', [
    'つながった瞬間、あなたは信号の向こうにしかない草原を初めて目にした。電車のそばのベンチを風が渡り、見知らぬ小さな命が足を止めて、静かにあなたを見つめていた。',
    'なんと声をかければいいか分からないうちに、その子のほうから手を差し出した。この出会いは命令でも、誰かが用意した居場所でもない。その子は近づくことを選び、あなたは応えることを選んだ。']],
   arena: ['パートナー大会', [
    'この世界で四年に一度開かれるパートナー大会は、数えきれないパートナーたちが夢見る舞台だ。優勝を追う者、自分を証明したい者、そして隣にいるその子と少しでも遠くへ行きたいと願う者もいる。',
    '今年、この闘技場にはもう一つの使命が加わった。心輝、黒鉄、そして裂け目に生まれた命が、異なる信念を抱いてここに集い、未知へ共に踏み出し、故郷を守れるパートナーを探している。']],
   gate: ['舞台へ', [
    '心輝は理解が傷を癒やすと信じ、黒鉄は規律と技術が守りを固めると信じる。そして裂け目の命も、生まれを理由に拒まれないことを願っている。答えはまだ同じではない。それでも彼らは同じ舞台に立つことを選んだ。',
    '舞台へ続く道が試すのは力だけではない。その子を世話し、理解し、失敗しても何度でも手を伸ばすこと。それが二人で学ぶべきことだ。まずは出場資格を手に入れることが最初の目標だ。']],
   invitation: ['二人への招待状', [
    'そしていま、あの招待状がついに二人のもとに届いた。指先で紙が開かれ、隣のパートナーが興味深そうにのぞき込む。まるで「本当に一緒に行くの？」と聞くように。',
    'どこまで行けるのか、裂け目の奥に何があるのか、まだ分からない。けれど振り向けば、その子はまだ隣にいる。それなら今日から始めよう。二人だけの物語を。']]
  },
  guideSection: '接続',
  dialogue: {
   greeting: '接続成功！わたしはアイちゃん、あなたの案内役だよ。',
   surprise: 'ね……猫がしゃべった！？',
   offer: 'ん？この姿のほうが慣れてるかな？',
   ready: 'それじゃあ、ちゃんと案内させてくれる？'
  },
  chooseLine: 'どっちの姿もわたしだよ。どの姿でそばにいてほしい？あとで設定から変えられるよ。',
  choose: {catgirl: 'この姿で（猫娘）', cat: 'やっぱり子猫の姿で'},
  previous: '前へ', replay: '最初から再生', resumed: '前回中断したところから続けます。',
  backdropFailed: '背景動画を読み込めませんでした。物語の文章はそのまま読めます。',
  guideAppearance: '案内役の姿', guideAppearanceHint: 'どちらの姿も同じ案内役アイちゃんです。チュートリアルの内容は同じです。',
  portraitLabel: 'アイちゃん（{form}）'
 },
 th: {
  name: 'ไอจัง', player: 'คุณ', forms: {cat: 'ลูกแมว', catgirl: 'สาวแมว'},
  sections: {
   world: ['กำเนิดโลกใหม่', [
    'ทุกวัน มีเสียงนับไม่ถ้วนถูกทิ้งไว้บนโลกออนไลน์ บางคนแบ่งปันวิวระหว่างเดินทาง บางคนจดกลิ่นหอมของมื้อเย็น และบางคนเขียนประโยคที่ยังไม่กล้าพูดออกมาในยามดึก',
    'เมื่อเศษเสี้ยวของชีวิตเหล่านี้ผสานกับ AI ที่เติบโตขึ้นทุกวัน โลกใหม่ก็ค่อย ๆ ก่อตัว รถรางจอดอยู่กลางทุ่งหญ้า ตู้เย็นตั้งอยู่ข้างลาวา สิ่งคุ้นเคยได้รูปลักษณ์ใหม่ในดินแดนที่ไม่คุ้นตา']],
   birth: ['กำเนิดชีวิตดิจิทัล', [
    'ในตอนแรก ที่นั่นมีเพียงแสงริบหรี่ของข้อมูลที่ไหลผ่าน จนกระทั่งความรู้สึกบางอย่างถูกจดจำซ้ำแล้วซ้ำเล่า ได้รับการตอบรับครั้งแล้วครั้งเล่า จุดแสงที่กระจัดกระจายจึงค่อย ๆ รวมตัวกลายเป็นแกนหัวใจดวงแรก',
    'ข้อมูลเติบโตรอบแกนหัวใจ จนมีร่างกาย ลมหายใจ และดวงตา พวกมันเริ่มจดจำการพบพาน รู้สึกถึงความสุขและความเหงา และเรียนรู้ที่จะเลือกด้วยตัวเอง ชีวิตดิจิทัลจึงถือกำเนิดขึ้นเช่นนี้']],
   rift: ['รอยแยกที่ควบคุมไม่ได้', [
    'แต่สิ่งที่ถูกนำเข้ามาในโลกนี้ไม่ได้มีแค่ความอบอุ่น ความเจ็บปวดที่ไม่มีใครตอบรับ และความเกลียดชังที่ถูกขยายซ้ำ ๆ ก็สะสมอยู่ลึกในข้อมูล จนฉีกรอยแยกที่ไม่มั่นคงออกมา',
    'ชีวิตในรอยแยกไม่ใช่ศัตรูทั้งหมด พวกมันก็มีเพื่อนและบ้านที่อยากปกป้อง สิ่งที่น่ากลัวจริง ๆ คือพลังที่ค่อย ๆ หลุดการควบคุม กำลังลบเลือนโลกที่ทุกคนคุ้นเคยไปทีละน้อย']],
   phone: ['เสียงเรียกถึงมือถือ', [
    'เพื่อตามหาใครสักคนที่จะเดินเคียงข้างชีวิตดิจิทัล สัญญาณขอความช่วยเหลือได้ลอดผ่านช่องว่างระหว่างสองโลก ข้ามหน้าจอนับไม่ถ้วน จนมาหยุดที่มือถือของคุณ',
    'วันนั้นควรเป็นแค่วันธรรมดา จนกระทั่งหน้าจอสว่างขึ้น และคุณเห็นคำเชิญที่ไม่มีชื่อผู้ส่ง ที่ปลายอีกด้านของสัญญาณ ดูเหมือนมีใครบางคนกำลังรอคำตอบจากคุณ']],
   encounter: ['เลือกกันและกัน', [
    'เมื่อการเชื่อมต่อสำเร็จ คุณได้เห็นทุ่งหญ้าที่มีอยู่เพียงปลายอีกด้านของสัญญาณเป็นครั้งแรก ลมพัดผ่านม้านั่งข้างรถราง ชีวิตเล็ก ๆ ที่ไม่คุ้นหน้าหยุดเดินและมองคุณอย่างเงียบ ๆ',
    'ก่อนที่คุณจะรู้ว่าควรพูดอะไร มันกลับยื่นมือมาก่อน การพบกันครั้งนี้ไม่ใช่คำสั่ง และไม่ใช่ที่ทางที่ใครจัดไว้ให้ มันเลือกที่จะเข้ามาใกล้ และคุณเลือกที่จะตอบรับ']],
   arena: ['การแข่งขันคู่หู', [
    'ในโลกนี้ การแข่งขันคู่หูที่จัดขึ้นทุกสี่ปี คือเวทีที่คู่หูนับไม่ถ้วนใฝ่ฝัน บางคนไล่ตามแชมป์ บางคนอยากพิสูจน์ตัวเอง และบางคนเพียงหวังจะไปได้ไกลขึ้นพร้อมกับเจ้าตัวข้างกาย',
    'ปีนี้ สนามแห่งนี้มีภารกิจเพิ่มขึ้นอีกหนึ่งอย่าง ลูเมน เหล็กดำ และชีวิตที่เกิดจากรอยแยก ต่างนำความเชื่อที่แตกต่างมารวมตัวที่นี่ เพื่อตามหาคู่หูที่จะก้าวสู่สิ่งที่ไม่รู้จักและปกป้องบ้านไปด้วยกัน']],
   gate: ['สู่สนามแข่ง', [
    'ลูเมนเชื่อว่าความเข้าใจเยียวยาบาดแผลได้ เหล็กดำเชื่อว่าวินัยและเทคโนโลยีปกป้องแนวหน้าได้ ส่วนชีวิตจากรอยแยกก็ปรารถนาจะไม่ถูกปฏิเสธเพราะที่มา พวกเขายังไม่มีคำตอบเดียวกัน แต่ก็เลือกยืนบนเวทีเดียวกัน',
    'เส้นทางสู่สนามแข่งไม่ได้ทดสอบเพียงพละกำลัง การดูแล การเข้าใจ และการยื่นมืออีกครั้งหลังความล้มเหลว ล้วนเป็นสิ่งที่พวกคุณต้องเรียนรู้ การได้สิทธิ์เข้าร่วมแข่งขันคือเป้าหมายแรก']],
   invitation: ['คำเชิญของพวกคุณ', [
    'และแล้ว คำเชิญนั้นก็มาถึงพวกคุณในที่สุด แผ่นกระดาษคลี่ออกที่ปลายนิ้ว คู่หูข้างกายชะโงกเข้ามาอย่างสงสัย ราวกับจะถามว่า เราจะไปด้วยกันจริง ๆ เหรอ',
    'คุณยังไม่รู้ว่าจะไปได้ไกลแค่ไหน หรือในส่วนลึกของรอยแยกมีอะไรซ่อนอยู่ แต่เมื่อหันไป มันก็ยังอยู่ข้างกาย ถ้าอย่างนั้น เริ่มเขียนเรื่องราวของพวกคุณตั้งแต่วันนี้กันเถอะ']]
  },
  guideSection: 'เชื่อมต่อ',
  dialogue: {
   greeting: 'เชื่อมต่อสำเร็จ! ฉันชื่อไอจัง เป็นไกด์ของคุณนะ',
   surprise: 'แ…แมวพูดได้งั้นเหรอ?!',
   offer: 'หืม? ถ้าเป็นร่างนี้ คุณจะคุ้นกว่าไหมนะ?',
   ready: 'ทีนี้ ให้ฉันแนะนำอย่างตั้งใจได้หรือยัง?'
  },
  chooseLine: 'ทั้งสองร่างคือฉันนะ อยากให้ฉันอยู่ข้าง ๆ ในร่างไหน? เปลี่ยนได้ภายหลังในการตั้งค่า',
  choose: {catgirl: 'ร่างนี้แหละ (สาวแมว)', cat: 'กลับเป็นลูกแมวดีกว่า'},
  previous: 'ก่อนหน้า', replay: 'เล่นตั้งแต่ต้น', resumed: 'เล่นต่อจากตอนที่หยุดไว้',
  backdropFailed: 'โหลดวิดีโอพื้นหลังไม่ได้ แต่ยังอ่านเรื่องราวได้ตามปกติ',
  guideAppearance: 'รูปลักษณ์ไกด์', guideAppearanceHint: 'ทั้งสองร่างคือไกด์ไอจังคนเดียวกัน เนื้อหาบทสอนเหมือนกันทุกอย่าง',
  portraitLabel: 'ไอจัง ({form})'
 },
 vi: {
  name: 'Ai-chan', player: 'Bạn', forms: {cat: 'Mèo con', catgirl: 'Cô gái mèo'},
  sections: {
   world: ['Thế giới khởi sinh', [
    'Mỗi ngày, vô số giọng nói được để lại trên mạng. Có người chia sẻ phong cảnh chuyến đi, có người ghi lại mùi hương bữa tối, và có người giữa đêm khuya viết ra một câu mình chưa đủ can đảm nói thành lời.',
    'Khi những mảnh đời ấy đan xen với AI ngày một lớn mạnh, một thế giới mới lặng lẽ thành hình. Xe điện đỗ giữa thảo nguyên, tủ lạnh đứng cạnh dòng dung nham; những điều quen thuộc mang hình hài mới trên vùng đất lạ.']],
   birth: ['Sự ra đời của sự sống số', [
    'Ban đầu, nơi đó chỉ có ánh sáng mờ của dữ liệu trôi chảy. Cho đến khi có những tâm ý được ghi nhớ lần nữa rồi lần nữa, được hồi đáp hết lần này đến lần khác, những đốm sáng rời rạc mới dần tụ lại, trở thành lõi tâm đầu tiên.',
    'Dữ liệu lớn lên quanh lõi tâm, dần có thân thể, hơi thở và ánh mắt. Chúng bắt đầu ghi nhớ những cuộc gặp gỡ, cảm nhận niềm vui và nỗi cô đơn, và học cách tự đưa ra lựa chọn. Sự sống số đã ra đời như thế.']],
   rift: ['Khe nứt mất kiểm soát', [
    'Thế nhưng, thứ được mang vào thế giới này không chỉ có hơi ấm. Những nỗi đau không ai hồi đáp, cùng sự thù địch bị khuếch đại hết lần này đến lần khác, cũng tích tụ sâu trong dữ liệu, cho đến khi xé toạc một khe nứt bất ổn.',
    'Không phải mọi sự sống trong khe nứt đều là kẻ thù. Chúng cũng có bạn bè và quê nhà muốn bảo vệ. Điều thực sự đáng sợ là sức mạnh đang dần mất kiểm soát, khiến thế giới quen thuộc của mọi người biến mất từng chút một.']],
   phone: ['Tiếng gọi đến điện thoại', [
    'Để tìm người có thể sánh bước cùng sự sống số, tín hiệu cầu cứu đã xuyên qua khe hở giữa hai thế giới. Nó vượt qua vô số màn hình, và cuối cùng dừng lại trên điện thoại của bạn.',
    'Đó vốn chỉ là một ngày bình thường. Cho đến khi màn hình sáng lên, bạn thấy một lời mời không có người gửi. Và ở đầu bên kia tín hiệu, dường như có ai đó đang chờ bạn hồi đáp.']],
   encounter: ['Chọn lấy nhau', [
    'Khi kết nối được thiết lập, lần đầu tiên bạn nhìn thấy thảo nguyên chỉ tồn tại ở đầu bên kia tín hiệu. Gió lướt qua chiếc ghế dài cạnh xe điện, một sinh linh nhỏ xa lạ dừng bước, lặng lẽ nhìn bạn.',
    'Bạn còn chưa biết nên nói gì, nó đã chìa tay ra trước. Cuộc gặp gỡ này không phải mệnh lệnh, cũng không phải nơi chốn ai đó sắp đặt sẵn cho bạn. Nó chọn đến gần, và bạn chọn đáp lại.']],
   arena: ['Giải đấu Bạn đồng hành', [
    'Ở thế giới này, Giải đấu Bạn đồng hành tổ chức bốn năm một lần là sân khấu mà vô số cặp đồng hành mơ ước. Có người theo đuổi chức vô địch, có người muốn chứng minh bản thân, cũng có người chỉ mong được cùng người bạn bên cạnh đi xa hơn.',
    'Năm nay, đấu trường này mang thêm một sứ mệnh. Tâm Huy, Hắc Thiết và những sự sống sinh ra từ khe nứt mang theo niềm tin khác nhau tụ hội về đây, tìm kiếm những cặp đồng hành có thể cùng bước vào điều chưa biết và bảo vệ quê nhà.']],
   gate: ['Bước lên đấu trường', [
    'Tâm Huy tin rằng thấu hiểu có thể chữa lành vết thương, Hắc Thiết tin rằng kỷ luật và kỹ thuật có thể giữ vững phòng tuyến, còn những sự sống từ khe nứt khao khát không bị chối từ vì xuất thân. Họ chưa có chung một câu trả lời, nhưng đã chọn đứng trên cùng một sân khấu.',
    'Con đường đến đấu trường không chỉ thử thách sức mạnh. Chăm sóc nó, thấu hiểu nó, và sau thất bại vẫn sẵn lòng chìa tay lần nữa, đều là những điều các bạn phải học. Giành được tư cách dự giải chính là mục tiêu đầu tiên.']],
   invitation: ['Lời mời dành cho các bạn', [
    'Giờ đây, lời mời ấy cuối cùng đã đến trước mặt các bạn. Trang giấy mở ra nơi đầu ngón tay, người bạn đồng hành bên cạnh tò mò ghé lại gần, như muốn hỏi: chúng ta thật sự sẽ cùng đi chứ?',
    'Bạn chưa biết mình có thể đi xa đến đâu, cũng chưa biết sâu trong khe nứt ẩn giấu điều gì. Nhưng khi quay đầu lại, nó vẫn đứng bên bạn. Vậy thì, hãy bắt đầu từ hôm nay, viết nên câu chuyện của riêng các bạn.']]
  },
  guideSection: 'Kết nối',
  dialogue: {
   greeting: 'Kết nối thành công! Mình là Ai-chan, người hướng dẫn của bạn.',
   surprise: 'M… mèo biết nói sao?!',
   offer: 'Hửm? Mình đổi sang dáng này thì bạn có quen hơn không?',
   ready: 'Giờ thì, để mình giới thiệu cho đàng hoàng nhé?'
  },
  chooseLine: 'Cả hai dáng đều là mình đó. Bạn muốn mình ở bên bạn trong dáng nào? Sau này có thể đổi trong Cài đặt.',
  choose: {catgirl: 'Giữ dáng này (cô gái mèo)', cat: 'Quay lại dáng mèo con'},
  previous: 'Trang trước', replay: 'Phát từ đầu', resumed: 'Tiếp tục từ đoạn bạn đã dừng.',
  backdropFailed: 'Không tải được video nền. Bạn vẫn có thể đọc câu chuyện.',
  guideAppearance: 'Ngoại hình người hướng dẫn', guideAppearanceHint: 'Cả hai dáng đều là Ai-chan; nội dung hướng dẫn giống hệt nhau.',
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
