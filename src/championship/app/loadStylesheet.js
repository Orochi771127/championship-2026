// One pending request per document/URL. Failed requests are removed so retry is real.
const documents = new WeakMap();
export function loadStylesheet(href, {document: doc = globalThis.document, timeoutMs = 15000} = {}) {
  const url = new URL(href, doc.baseURI).href;
  let requests = documents.get(doc);
  if (!requests) { requests = new Map(); documents.set(doc, requests); }
  if (requests.has(url)) return requests.get(url);
  const promise = new Promise((resolve, reject) => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet'; link.href = url;
    let timer, finished = false;
    const finish = error => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      link.removeEventListener('load', loaded); link.removeEventListener('error', failed);
      if (error) { link.remove(); reject(error); } else resolve(link);
    };
    const loaded = () => finish();
    const failed = () => finish(new Error('STYLESHEET_LOAD_FAILED'));
    link.addEventListener('load', loaded); link.addEventListener('error', failed);
    timer = setTimeout(() => finish(new Error('STYLESHEET_LOAD_TIMEOUT')), timeoutMs);
    doc.head.appendChild(link);
  });
  requests.set(url, promise);
  void promise.catch(() => { if (requests.get(url) === promise) requests.delete(url); });
  return promise;
}
