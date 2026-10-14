// Deliberately small controlled-DOM fixture, not a browser or a layout engine.
// Keyboard activation is explicitly simulated by this fixture. It proves the
// button click contract only, not native browser keyboard/accessibility behavior.
const kebab = value => value.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
const camel = value => value.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export class ControlledEvent {
  constructor(type, init = {}) { Object.assign(this, {type, bubbles:true, defaultPrevented:false, propagationStopped:false}, init); }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
}

function matchesSimple(node, selector) {
  if (node.nodeType !== 1) return false;
  const attrs = [...selector.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g)];
  const plain = selector.replace(/\[[^\]]+\]/g, '');
  const tag = plain.match(/^[\w*-]+/)?.[0];
  if (tag && tag !== '*' && node.tagName !== tag.toUpperCase()) return false;
  for (const [, name] of plain.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(name)) return false;
  const id = plain.match(/#([\w-]+)/)?.[1];
  if (id && node.id !== id) return false;
  return attrs.every(([, name, value]) => value === undefined ? node.hasAttribute(name) : node.getAttribute(name) === value);
}
function matches(node, selector) {
  return selector.split(',').some(part => {
    const steps = part.trim().split(/\s+/); let current = node;
    if (!matchesSimple(current, steps.pop())) return false;
    while (steps.length) { const step = steps.pop(); current = current.parentNode; while (current && !matchesSimple(current, step)) current = current.parentNode; if (!current) return false; }
    return true;
  });
}

export class ControlledNode {
  constructor(tag, ownerDocument) {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.ownerDocument = ownerDocument;
    this.parentNode = null; this.childNodes = []; this.attributes = new Map();
    this.dataset = {}; this.style = {setProperty(k,v){this[k]=String(v);},removeProperty(k){delete this[k];}};
    this.className = ''; this.hidden = false; this.disabled = false; this.value = ''; this.type = '';
    this.scrollTop = 0; this.tabIndex = 0; this.listeners = new Map(); this.replaceCount = 0;
    this.classList = {contains:name => this.className.split(/\s+/).includes(name),
      add:(...names) => {this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},
      remove:(...names) => {this.className=this.className.split(/\s+/).filter(n=>!names.includes(n)).join(' ');},
      toggle:(name, force) => {const on=force??!this.classList.contains(name);this.classList[on?'add':'remove'](name);return on;}};
  }
  get children() { return this.childNodes.filter(n=>n.nodeType===1); }
  get childElementCount() { return this.children.length; }
  get firstChild() { return this.childNodes[0]??null; }
  get parentElement() { return this.parentNode?.nodeType===1?this.parentNode:null; }
  get id() { return this.attributes.get('id')??''; }
  set id(value) { this.attributes.set('id',String(value)); }
  get textContent() { return this.childNodes.map(n=>n.textContent).join(''); }
  set textContent(value) { this.replaceChildren(); if(value!==null&&String(value)!=='')this.append(String(value)); }
  get isConnected() { return this===this.ownerDocument.documentElement || !!this.parentNode?.isConnected; }
  append(...nodes) { for(let node of nodes) { if(typeof node!=='object')node=this.ownerDocument.createTextNode(String(node)); node.remove?.();node.parentNode=this;this.childNodes.push(node); } }
  prepend(...nodes) { const old=[...this.childNodes];this.replaceChildren(...nodes,...old); }
  appendChild(node) { this.append(node);return node; }
  replaceChildren(...nodes) { this.replaceCount++;for(const child of this.childNodes)child.parentNode=null;this.childNodes=[];this.append(...nodes); }
  remove() { if(!this.parentNode)return;const siblings=this.parentNode.childNodes;siblings.splice(siblings.indexOf(this),1);this.parentNode=null; }
  contains(node) { return node===this || this.childNodes.some(child=>child.contains?.(node)); }
  setAttribute(name,value) { value=String(value);if(name==='class')this.className=value;else if(name.startsWith('data-'))this.dataset[camel(name.slice(5))]=value;else this.attributes.set(name,value); }
  getAttribute(name) { if(name==='class')return this.className;if(name.startsWith('data-'))return this.dataset[camel(name.slice(5))]??null;return this.attributes.get(name)??null; }
  hasAttribute(name) { return this.getAttribute(name)!==null; }
  removeAttribute(name) { if(name.startsWith('data-'))delete this.dataset[camel(name.slice(5))];else if(name==='class')this.className='';else this.attributes.delete(name);if(name==='src')delete this.src; }
  toggleAttribute(name,force) { const on=force??!this.hasAttribute(name);if(on)this.setAttribute(name,'');else this.removeAttribute(name);return on; }
  addEventListener(type,fn) { if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn); }
  removeEventListener(type,fn) { this.listeners.get(type)?.delete(fn); }
  dispatchEvent(event) { if(!event.target)event.target=this;event.currentTarget=this;for(const fn of [...(this.listeners.get(event.type)??[])])fn.call(this,event);if(event.bubbles&&!event.propagationStopped)this.parentNode?.dispatchEvent?.(event);return !event.defaultPrevented; }
  click() { if(!this.disabled)this.dispatchEvent(new ControlledEvent('click')); }
  focus() { if(this.isConnected&&!this.disabled)this.ownerDocument.activeElement=this; }
  scrollIntoView(options) { this.lastScrollOptions=options; }
  querySelectorAll(selector) { const result=[];const visit=node=>{for(const child of node.children){if(matches(child,selector))result.push(child);visit(child);}};visit(this);return result; }
  querySelector(selector) { return this.querySelectorAll(selector)[0]??null; }
  closest(selector) { let node=this;while(node){if(matches(node,selector))return node;node=node.parentElement;}return null; }
}

export function createControlledDocument(locale='zh-Hant') {
  const document = {activeElement:null,createElement(tag){return new ControlledNode(tag,this);},createTextNode(data){return {nodeType:3,data,parentNode:null,get textContent(){return this.data;},set textContent(value){this.data=String(value);},remove(){if(this.parentNode){const list=this.parentNode.childNodes;list.splice(list.indexOf(this),1);this.parentNode=null;}}};}};
  document.documentElement=document.createElement('html');document.documentElement.lang=locale;
  document.body=document.createElement('body');document.documentElement.append(document.body);document.activeElement=document.body;
  document.querySelectorAll=selector=>document.documentElement.querySelectorAll(selector);
  document.querySelector=selector=>document.documentElement.querySelector(selector);
  document.getElementById=id=>document.querySelector(`#${id}`);
  return document;
}

export function simulateButtonKeyActivation(button,key) {
  if(button.tagName!=='BUTTON')throw new Error('FIXTURE_REQUIRES_BUTTON');
  button.focus();
  const down=new ControlledEvent('keydown',{key});button.dispatchEvent(down);
  if(key==='Enter'&&!down.defaultPrevented)button.click();
  const up=new ControlledEvent('keyup',{key});button.dispatchEvent(up);
  if(key===' '&&!down.defaultPrevented&&!up.defaultPrevented)button.click();
}

export function serializeControlledNode(node) {
  if(node.nodeType===3)return node.textContent;
  const attrs=Object.fromEntries([...node.attributes,...Object.entries(node.dataset).map(([k,v])=>[`data-${kebab(k)}`,v])]);
  return {tag:node.tagName,className:node.className,hidden:node.hidden,disabled:node.disabled,attrs,children:node.childNodes.map(serializeControlledNode)};
}
