// Small result-panel DOM contract fixture. No browser/layout/accessibility claim.
const camel=value=>value.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
function matches(node,selector){
  if(selector.startsWith('.'))return node.classList.contains(selector.slice(1));
  const attr=selector.match(/^\[([^=]+)="([^"]+)"\]$/);
  if(attr)return node.getAttribute(attr[1])===attr[2];
  return node.tagName===selector.toUpperCase();
}
class Node{
  constructor(tag,document){
    this.tagName=tag.toUpperCase();this.ownerDocument=document;this.parentNode=null;
    this.children=[];this.dataset={};this.attributes=new Map();this.listeners=new Map();
    this.className='';this.hidden=false;this.disabled=false;this._text='';this.replaceCount=0;
    this.style={setProperty(k,v){this[k]=String(v);}};
    this.classList={contains:name=>this.className.split(/\s+/).includes(name),
      add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},
      remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>!names.includes(name)).join(' ');}};
  }
  get parentElement(){return this.parentNode;}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(text){this.replaceChildren();this._text=String(text);}
  append(...nodes){for(const node of nodes){node.parentNode?.children.splice(node.parentNode.children.indexOf(node),1);node.parentNode=this;this.children.push(node);}}
  appendChild(node){this.append(node);return node;}
  replaceChildren(...nodes){this.replaceCount++;for(const node of this.children)node.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
  remove(){if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}}
  setAttribute(name,value){if(name.startsWith('data-'))this.dataset[camel(name.slice(5))]=String(value);else this.attributes.set(name,String(value));}
  getAttribute(name){return name.startsWith('data-')?this.dataset[camel(name.slice(5))]??null:this.attributes.get(name)??null;}
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);}
  click(){if(!this.disabled)for(const listener of this.listeners.get('click')??[])listener({type:'click',target:this});}
  focus(){this.ownerDocument.activeElement=this;}
  querySelectorAll(selector){const found=[];for(const child of this.children){if(matches(child,selector))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}
export function createControlledDocument(){
  const document={activeElement:null,createElement(tag){return new Node(tag,this);}};
  document.documentElement=document.createElement('html');document.documentElement.lang='zh-Hant';
  document.body=document.createElement('body');document.documentElement.append(document.body);document.activeElement=document.body;
  return document;
}
