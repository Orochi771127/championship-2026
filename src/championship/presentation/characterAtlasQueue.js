// Page preparation shares one bounded queue. It owns no ticker, save or actors.
const queue=[];
let active=0;
function pump(){
  while(active<2&&queue.length){
    const job=queue.shift();
    if(job.signal?.aborted){job.reject(job.signal.reason);continue;}
    active++;
    Promise.resolve().then(job.run).then(job.resolve,job.reject).finally(()=>{active--;pump();});
  }
}
export function prepareCharacterAtlasPage(run,signal=null){
  return new Promise((resolve,reject)=>{queue.push({run,signal,resolve,reject});pump();});
}
