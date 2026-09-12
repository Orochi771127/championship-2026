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
  button('乙').click();button('決定').click();assert.deepEqual(entered,[[0,['b']]]);
});

function showPrize(root, receipt) {
  const view = createBattleResultView({ root, outcome, receipt, matchTitle: "MATCH 00" });
  descendants(root).find((node) => node.textContent === "下一頁").click();
  return view;
}

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
  assert.deepEqual(cubeAvailable, [], "fixing entry economics does not enable untraced modes");
});
