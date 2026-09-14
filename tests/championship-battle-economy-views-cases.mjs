import assert from "node:assert/strict";
import test from "node:test";
import { createBattleResultView, createBattleSelectView } from "../src/championship/app/vs5Screens.js";

// A small DOM boundary for financial display/intent tests. Real layout,
// accessibility geometry and canvas ownership are verified in the browser.
class Node {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
    this.className = "";
    this.classList = { add: (name) => { this.className += ` ${name}`; } };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  click() { if (!this.disabled) this.listeners.click?.(); }
}

function descendants(node) {
  return [node, ...node.children.flatMap(descendants)];
}

function findByClass(root, name) {
  return descendants(root).find((node) => node.className.split(" ").includes(name));
}

function textOf(root) {
  return descendants(root).map((node) => node.textContent).filter(Boolean).join(" ");
}

function useDocument(t) {
  const original = globalThis.document;
  globalThis.document = {
    createElement: (tag) => new Node(tag),
    createDocumentFragment: () => new Node("fragment")
  };
  t.after(() => {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  });
  return new Node("main");
}

const outcome = { ended: true, verdict: "TEAM_ZERO_AHEAD", reason: "TEAM_DOWN", winningTeam: 0 };

test('rank and title pages require actual newly committed winning progress',(t)=>{
  const root=useDocument(t),receipt={status:'SETTLED',won:true,credited:7000,walletAfter:7100};
  const progression={rankBefore:0,rankAfter:1,earnedTitles:[{id:4,name:'測試頭銜'}]};
  const view=createBattleResultView({root,outcome,receipt,progression});
  assert.deepEqual(view.inspect().panels,['RESULT','PRIZE','RANK','TITLE']);
  const next=()=>descendants(root).find(n=>n.textContent==='下一頁').click();next();next();
  assert.match(textOf(root),/階級 0 → 1/);next();assert.match(textOf(root),/測試頭銜/);
  for(const absent of [null,{...receipt,status:'ABANDONED'},{...receipt,won:false}])
    assert.deepEqual(createBattleResultView({root,outcome,receipt:absent,progression}).inspect().panels,['RESULT','PRIZE']);
  assert.deepEqual(createBattleResultView({root,outcome,receipt,progression:{rankBefore:1,rankAfter:1,earnedTitles:[]}}).inspect().panels,['RESULT','PRIZE']);
});

test('the battle box is disposed whether its lazily-imported mount lands before or after the screen closes', async (t) => {
  // The application injects an async wrapper around the Three.js mount, so the
  // presentation can arrive after the view is built and even after it is torn
  // down. Both orders must release it: a renderer, its textures and its pointer
  // listeners leak otherwise, once per visit to this screen.
  const menuCopy = {menu:'對戰',chooseMatch:'選擇對戰',availableMatches:'賽事',faceNotice:'模式'};
  const build = (mountCube) => createBattleSelectView({
    root: useDocument(t), matches: [{recordIndex:0,entryFee:150,payout:7000}],
    menuCopy, mountCube, onEnter: () => ({ok:true}), getPartySelection: () => ({limit:1,candidates:[]})
  });

  let disposals = 0;
  const presentation = { dispose() { disposals += 1; } };

  const settled = build(() => Promise.resolve(presentation));
  await Promise.resolve(); await Promise.resolve();
  settled.dispose();
  assert.equal(disposals, 1, 'a mount that lands first is disposed on close');

  disposals = 0;
  const racing = build(() => Promise.resolve(presentation));
  racing.dispose();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(disposals, 1, 'a mount that lands after close is disposed on arrival');

  // A synchronous injector keeps working exactly as before.
  disposals = 0;
  const direct = build(() => presentation);
  direct.dispose();
  assert.equal(disposals, 1, 'a synchronous mount is unchanged');
});

test('party selection enforces eligibility and slot limit; cancel never enters or charges', async (t) => {
  const root = useDocument(t), entered = [];
  createBattleSelectView({root, matches:[{recordIndex:0,entryFee:150,payout:7000}],
    menuCopy:{menu:'對戰',chooseMatch:'選擇對戰',availableMatches:'賽事',faceNotice:'模式'},
    mountCube:()=>({dispose(){}}), onEnter:(...args)=>{entered.push(args);return {ok:true};},
    getPartySelection:()=>({limit:1,candidates:[
      {instanceId:'a',displayName:'甲',admission:{ok:true}},
      {instanceId:'b',displayName:'乙',admission:{ok:true}},
      {instanceId:'young',displayName:'幼年',admission:{ok:false,message:'尚未符合參賽資格'}}]})});
  const button = name => descendants(root).find(n=>n.tagName==='button'&&n.textContent===name);
  const match = findByClass(root,'cm-vs5-match__enter');
  // The party list is fetched now, so the panel arrives a microtask later.
  match.click();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(button('決定').disabled,true);
  assert.equal(findByClass(root,'cm-vs5-cube').hidden,true);
  button('幼年').click();assert.equal(button('決定').disabled,true);
  button('甲').click();assert.equal(button('乙').disabled,true);
  button('乙').click();assert.deepEqual(entered,[]);
  button('返回賽事選擇').click();assert.deepEqual(entered,[]);
  assert.equal(findByClass(root,'cm-vs5-cube').hidden,false);
  match.click(); await Promise.resolve(); await Promise.resolve();
  assert.equal(button('決定').disabled,true,'cancel discards the selection');
  button('甲').click();button('甲').click();assert.equal(button('決定').disabled,true);
  button('乙').click();button('決定').click();assert.deepEqual(entered,[[0,['b'],'TITLE_MATCH']]);
});

function showPrize(root, receipt) {
  const view = createBattleResultView({ root, outcome, receipt, matchTitle: "MATCH 00" });
  descendants(root).find((node) => node.textContent === "下一頁").click();
  return view;
}

test('Practice selection requires two distinct owned teams and passes the selected arena',async t=>{
  const root=useDocument(t),entered=[];let cube;
  const view=createBattleSelectView({root,matches:[],menuCopy:{menu:'對戰',chooseMatch:'選擇對戰',availableMatches:'賽事',faceNotice:'模式'},
    mountCube:options=>{cube=options;return {dispose(){}};},getModeMatches:()=>[],onEnter:(...args)=>{entered.push(args);return {ok:true};},
    arenaChoices:[{index:1,identifier:'BATTLE_GRASS'}],getPracticeSelection:()=>({candidates:[
      {instanceId:'a',displayName:'甲',admission:{ok:true}},{instanceId:'b',displayName:'乙',admission:{ok:true}}]})});
  cube.onSelect('PRACTICE_BATTLE');await Promise.resolve();await Promise.resolve();
  const find=name=>descendants(root).find(n=>n.attributes['aria-label']===name);
  const confirm=descendants(root).find(n=>n.textContent==='開始練習');assert.equal(confirm.disabled,true);
  find('甲 A 隊').click();assert.equal(find('甲 B 隊').disabled,true);assert.equal(confirm.disabled,true);
  find('乙 B 隊').click();assert.equal(confirm.disabled,false);find('對戰場地').value='1';confirm.click();
  assert.deepEqual(entered,[[-1,[['a'],['b']],'PRACTICE_BATTLE',1]]);assert.equal(confirm.disabled,true);
  await Promise.resolve();view.dispose();
});

test('Password selection requires two bounded passwords and passes no owned party or arena',async t=>{
  const root=useDocument(t),entered=[];let cube;
  const view=createBattleSelectView({root,matches:[],menuCopy:{menu:'對戰',chooseMatch:'選擇對戰',availableMatches:'賽事',faceNotice:'模式'},
    mountCube:options=>{cube=options;return {dispose(){}};},getModeMatches:()=>[],getPasswordSelection:()=>({maxLength:22}),
    onEnter:(...args)=>{entered.push(args);return {ok:true};}});
  assert.deepEqual([...cube.available],['TITLE_MATCH','FREE_BATTLE','PASSWORD_BATTLE']);
  cube.onSelect('PASSWORD_BATTLE');await Promise.resolve();await Promise.resolve();
  const input=label=>descendants(root).find(node=>node.attributes['aria-label']===label);
  const confirm=descendants(root).find(node=>node.textContent==='開始密碼對戰');assert.equal(confirm.disabled,true);
  input('A 隊密碼').value='密碼甲';input('A 隊密碼').listeners.input();assert.equal(confirm.disabled,true);
  input('B 隊密碼').value='密碼乙';input('B 隊密碼').listeners.input();assert.equal(confirm.disabled,false);
  confirm.click();assert.deepEqual(entered,[[-1,['密碼甲','密碼乙'],'PASSWORD_BATTLE']]);
  assert.equal(input('A 隊密碼').maxLength,22);assert.equal(confirm.disabled,true);
  await Promise.resolve();view.dispose();
});

test('Link selection exposes host and guest code exchange before starting',async t=>{
  const root=useDocument(t),entered=[];let cube;
  const prepared={ok:true,replyCode:'CM26-LINK-REPLY',parties:[[{instanceId:'host'}],[{instanceId:'guest'}]],arenaIndex:7};
  const view=createBattleSelectView({root,matches:[],menuCopy:{menu:'對戰',chooseMatch:'選擇對戰',availableMatches:'賽事',faceNotice:'模式'},
    mountCube:options=>{cube=options;return {dispose(){}};},getModeMatches:()=>[],onEnter:(...args)=>{entered.push(args);return {ok:true};},
    getLinkSelection:()=>({candidates:[{instanceId:'guest',displayName:'乙',admission:{ok:true}}],
      createInvite:()=>({ok:true,inviteCode:'CM26-LINK-INVITE',arenaIndex:7}),prepareHost:()=>prepared,prepareGuest:()=>prepared})});
  cube.onSelect('LINK_BATTLE');await Promise.resolve();await Promise.resolve();
  const button=text=>descendants(root).find(node=>node.tagName==='button'&&node.textContent===text);
  button('加入邀請').click();const invite=descendants(root).find(node=>node.attributes['aria-label']==='對方邀請碼');
  invite.value='CM26-LINK-INVITE';invite.listeners.input();button('乙').click();button('產生回覆碼').click();
  await Promise.resolve();await Promise.resolve();
  const reply=descendants(root).find(node=>node.attributes['aria-label']==='回覆碼');assert.equal(reply.value,'CM26-LINK-REPLY');
  button('已分享回覆碼，開始對戰').click();await Promise.resolve();
  assert.deepEqual(entered,[[-1,prepared,'LINK_BATTLE']]);view.dispose();
});

test('mode switching keeps free opponents separate from scheduled titles and rejects stale asynchronous menus',async t=>{
  const root=useDocument(t),entered=[],pending=new Map();let cube;
  const view=createBattleSelectView({root,matches:[{recordIndex:0,entryFee:150,payout:7000}],
    menuCopy:{menu:'對戰',chooseMatch:'選擇對戰',availableMatches:'賽事',faceNotice:'模式'},
    mountCube:options=>{cube=options;return {dispose(){}};},onEnter:(...args)=>{entered.push(args);return {ok:true};},
    getModeMatches:mode=>new Promise((resolve,reject)=>pending.set(mode,{resolve,reject})),
    getPartySelection:()=>({limit:1,candidates:[{instanceId:'a',displayName:'甲',admission:{ok:true}}]})});
  assert.deepEqual([...cube.available],['TITLE_MATCH','FREE_BATTLE']);
  cube.onSelect('FREE_BATTLE');cube.onSelect('TITLE_MATCH');
  pending.get('TITLE_MATCH').resolve([{recordIndex:1,entryFee:100,payout:200}]);await Promise.resolve();await Promise.resolve();
  pending.get('FREE_BATTLE').resolve([{recordIndex:'single:0',title:'自由對手',entryFee:0,payout:25}]);await Promise.resolve();
  assert.equal(view.inspect().mode,'TITLE_MATCH');assert.equal(findByClass(root,'cm-vs5-match').dataset.recordIndex,'1');
  cube.onSelect('FREE_BATTLE');pending.get('FREE_BATTLE').reject(new Error('network'));await Promise.resolve();await Promise.resolve();
  assert.match(textOf(root),/清單載入失敗/);assert.equal(view.inspect().mode,'TITLE_MATCH');
  cube.onSelect('FREE_BATTLE');pending.get('FREE_BATTLE').resolve([{recordIndex:'single:0',title:'自由對手',entryFee:0,payout:25}]);await Promise.resolve();await Promise.resolve();
  view.render({matches:[{recordIndex:2}]});assert.equal(view.inspect().mode,'FREE_BATTLE');assert.equal(findByClass(root,'cm-vs5-match').dataset.recordIndex,'single:0');
  findByClass(root,'cm-vs5-match__enter').click();await Promise.resolve();await Promise.resolve();
  descendants(root).find(n=>n.textContent==='甲').click();descendants(root).find(n=>n.textContent==='決定').click();
  assert.deepEqual(entered,[['single:0',['a'],'FREE_BATTLE',null]]);
  await Promise.resolve();cube.onSelect('TITLE_MATCH');view.dispose();pending.get('TITLE_MATCH').resolve([]);await Promise.resolve();
  assert.deepEqual(root.children,[]);
});

test("a missing receipt cannot display the advertised reward as money received", (t) => {
  const root = useDocument(t);
  const view = showPrize(root, null);
  assert.equal(findByClass(root, "cm-vs5-title").textContent, "—");
  assert.match(textOf(root), /獎金尚未入帳/);
  assert.equal(view.inspect().settlement, "NOT_CREDITED");
  assert.equal(view.inspect().credited, null);
});

test("the prize page displays the actual credit and resulting wallet when capped", (t) => {
  const root = useDocument(t);
  const view = showPrize(root, {
    status: "SETTLED", rewardBits: 7000, credited: 1, walletAfter: 9999999, clamped: true
  });
  assert.equal(findByClass(root, "cm-vs5-title").textContent, "1");
  assert.match(textOf(root), /持有 9999999 位元幣/);
  assert.match(textOf(root), /獎金 7000 位元幣；持有金額已達上限/);
  assert.equal(view.inspect().credited, 1);
});

test("a settled loss displays zero received, distinct from an unsettled reward", (t) => {
  const root = useDocument(t);
  showPrize(root, { status: "SETTLED", rewardBits: 0, credited: 0, walletAfter: 850, clamped: false });
  assert.equal(findByClass(root, "cm-vs5-title").textContent, "0");
  assert.match(textOf(root), /持有 850 位元幣/);
  assert.match(textOf(root), /本場沒有獲得獎金/);
  assert.doesNotMatch(textOf(root), /獎金尚未入帳/);
});

test("the menu distinguishes fee and prize, and explains insufficient funds", async (t) => {
  const root = useDocument(t);
  const entries = [];
  let cubeAvailable = null;
  createBattleSelectView({
    root,
    matches: [{ recordIndex: 0, title: "MATCH 00", entryFee: 150, payout: 7000 }],
    onEnter(recordIndex) {
      entries.push(recordIndex);
      return { ok: false, reason: "INSUFFICIENT_BITS", entryFee: 150, wallet: 149 };
    },
    mountCube({ available }) {
      cubeAvailable = [...available];
      return {};
    },
    menuCopy: {
      menu: "Battle", kicker: "Battle", chooseMatch: "Choose", availableMatches: "Matches",
      faceNotice: "Modes pending", noPayout: "No prize"
    }
  });
  assert.equal(findByClass(root, "cm-vs5-match__fee").textContent, "報名費 150 位元幣");
  assert.equal(findByClass(root, "cm-vs5-match__payout").textContent, "獎金 7000 位元幣");
  // Entering is async now: the battle runtime is fetched when the menu asks for
  // one rather than at startup, so the refusal arrives a microtask later.
  findByClass(root, "cm-vs5-match__enter").click();
  await Promise.resolve();
  assert.deepEqual(entries, [0]);
  const notice = findByClass(root, "cm-vs5-entry-notice");
  assert.equal(notice.hidden, false);
  assert.equal(notice.attributes.role, "status");
  assert.match(notice.textContent, /150 位元幣.*149 位元幣/);
  assert.deepEqual(cubeAvailable, ['TITLE_MATCH'], "only modes supplied by the application can be entered");
});
