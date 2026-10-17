"""Restore exact selected bytes from local Git or the existing public Pages site.

No publishing, source-worktree reads, runtime URL changes or hash approvals.
"""
import argparse,concurrent.futures,hashlib,json,os,subprocess,threading,time,urllib.request,urllib.error
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def main():
 p=argparse.ArgumentParser();p.add_argument('--manifest',type=Path,required=True);p.add_argument('--report',type=Path,required=True)
 p.add_argument('--group',choices=['ranch-local','other-runtime-local','existing-pages'],required=True);a=p.parse_args()
 rows=read(a.manifest)['files'];allow={x['path']:x['sha256'] for x in read(ROOT/'docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json')['files']}
 if a.group=='ranch-local':rows=[x for x in rows if x['knownGeneratedRanch'] and x['gitObjectLocal']]
 elif a.group=='other-runtime-local':rows=[x for x in rows if x['gitObjectLocal'] and not x['knownGeneratedRanch'] and x['jsonSchemaDeclared'] is not False]
 else:rows=[x for x in rows if not x['gitObjectLocal']]
 for row in rows:
  name=row['path'];target=(ROOT/name).resolve()
  if not target.is_relative_to(ROOT) or not name.startswith('assets/production/') or allow.get(name)!=row['sha256'] or 'ART_PRODUCTION_INDEX' in name or target.suffix.lower() not in ['.json','.png','.webp','.jpg','.jpeg','.svg','.mp4','.mp3','.m4a','.ogg','.wav','.glb']:raise ValueError('UNAPPROVED_INPUT:'+name)
  if a.group=='existing-pages' and not row['sameHashInPublishedAdcReceipt']:raise ValueError('NO_EXISTING_PUBLISHED_HASH:'+name)
 results=[];lock=threading.Lock()
 def publish(row,data):
  if len(data)!=row['expectedBytes'] or sha(data)!=row['sha256']:raise ValueError('RESTORE_HASH_OR_SIZE:'+row['path'])
  target=ROOT/row['path'];target.parent.mkdir(parents=True,exist_ok=True)
  if not target.parent.resolve().is_relative_to(ROOT):raise ValueError('TARGET_LINK')
  if target.exists():
   if sha(target.read_bytes())!=row['sha256']:raise ValueError('EXISTING_FILE_CONFLICT:'+row['path'])
   return 'ALREADY_VERIFIED'
  temporary=target.with_name(target.name+'.pending-input');temporary.write_bytes(data)
  if target.exists():temporary.unlink();raise ValueError('TARGET_CHANGED')
  temporary.replace(target);return 'RESTORED'
 def record(row,status,error=None,attempts=0):
  result={k:row[k] for k in ['path','sha256','expectedBytes']};result.update(status=status,attempts=attempts)
  if error:result['error']=error
  with lock:
   results.append(result)
   if len(results)%250==0:print(json.dumps({'group':a.group,'completed':len(results),'total':len(rows),'failed':sum(x['status']=='FAILED' for x in results)}),flush=True)
 if a.group!='existing-pages':
  proc=subprocess.Popen(['git','cat-file','--batch'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,env={**os.environ,'GIT_NO_LAZY_FETCH':'1'})
  def send():
   for row in rows:proc.stdin.write((row['gitBlob']+'\n').encode())
   proc.stdin.close()
  writer=threading.Thread(target=send);writer.start()
  for row in rows:
   header=proc.stdout.readline().decode().strip().split();data=b''
   if len(header)!=3 or header[0]!=row['gitBlob'] or header[1]!='blob':raise ValueError('LOCAL_GIT_BLOB_REQUIRED:'+row['path'])
   size=int(header[2]);remaining=size;parts=[]
   while remaining:
    part=proc.stdout.read(min(1024*1024,remaining))
    if not part:raise ValueError('GIT_STREAM_TRUNCATED')
    parts.append(part);remaining-=len(part)
   if proc.stdout.read(1)!=b'\n':raise ValueError('GIT_STREAM_BOUNDARY')
   try:record(row,publish(row,b''.join(parts)))
   except Exception as error:record(row,'FAILED',str(error))
  writer.join();assert proc.wait()==0
 else:
  def download(row):
   # This is intake from the already-authorized site, not a runtime CDN change.
   url='https://orochi771127.github.io/championship-2026/'+row['path']
   for attempt in range(1,3):
    try:
     request=urllib.request.Request(url,headers={'User-Agent':'Championship-approved-input-recovery/1'})
     with urllib.request.urlopen(request,timeout=30) as response:data=response.read(row['expectedBytes']+1)
     record(row,publish(row,data),attempts=attempt);return
    except Exception as error:
     retry=isinstance(error,urllib.error.URLError) and (not isinstance(error,urllib.error.HTTPError) or error.code in [408,429,500,502,503,504])
     if attempt==2 or not retry:record(row,'FAILED',type(error).__name__+': '+str(error),attempts=attempt);return
     time.sleep(1)
  # Fail once at the environment level instead of repeating a DNS/connection
  # failure for thousands of unrelated files.
  if rows:download(rows[0])
  blocked=bool(results and results[0]['status']=='FAILED' and any(word in results[0].get('error','').lower() for word in ['getaddrinfo','name or service not known','network is unreachable','http error 403']))
  if blocked:
   for row in rows[1:]:record(row,'NOT_ATTEMPTED_NETWORK_BLOCKED')
  else:
   with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(download,rows[1:]))
 report={'group':a.group,'selected':len(rows),'verified':sum(x['status'] in ['RESTORED','ALREADY_VERIFIED'] for x in results),'restored':sum(x['status']=='RESTORED' for x in results),'failed':sum(x['status']=='FAILED' for x in results),'notAttempted':sum(x['status'].startswith('NOT_ATTEMPTED') for x in results),'verifiedBytes':sum(x['expectedBytes'] for x in results if x['status'] in ['RESTORED','ALREADY_VERIFIED']),'source':'EXISTING_PAGES_HASH_RECEIPT' if a.group=='existing-pages' else 'LOCAL_GIT_NO_LAZY_FETCH','runtimeOriginsChanged':False,'approvalsChanged':False,'files':sorted(results,key=lambda x:x['path'])}
 a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k!='files'}),flush=True)
 if report['failed']:raise SystemExit(1)
if __name__=='__main__':main()
