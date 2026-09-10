"""Build an internal design gallery from actual settings and hash-locked reviews."""
import argparse
import html
import importlib.util
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
PACK=ROOT/'docs/art/production/characters/appearance-refresh-v1'
BASE=PACK/'pixel-v2'
spec=importlib.util.spec_from_file_location('setting_review',ROOT/'scripts/review-character-pixel-settings.py')
review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
queue_spec=importlib.util.spec_from_file_location('setting_queue',ROOT/'scripts/build-character-pixel-production-queue.py')
queue_tools=importlib.util.module_from_spec(queue_spec);queue_spec.loader.exec_module(queue_tools)

def validate_roster(queue, catalog):
    expected=[e['entityId'] for e in catalog['entities']]; actual=[e['entityId'] for e in queue['records']]
    if len(expected)!=224 or len(set(expected))!=224 or len(actual)!=224 or len(set(actual))!=224 or set(actual)!=set(expected):
        raise ValueError('Gallery requires the complete verified 224-entity source roster')
    if actual[:8]!=queue_tools.PRIORITY:
        raise ValueError('Representative eight membership/order differs from production contract')

def review_directory(folder):
    pointer=folder/'current-review.json'
    name=review.read(pointer)['directory'] if pointer.exists() else 'review'
    if not isinstance(name,str) or not re.fullmatch(r'review(?:-r\d+)?',name):
        raise ValueError('Review directory must be a local versioned snapshot')
    return name

def build():
    queue=review.read(BASE/'production-queue.json');records=[];artifacts=[];cards=[];overview=[]
    catalog=review.read(PACK/'generated/catalog.json');validate_roster(queue,catalog)
    identity_path=BASE/'identity-design-queue.json'
    identity_queue=review.read(identity_path) if identity_path.exists() else {'records':[]}
    briefs={e['entityId']:e for e in identity_queue['records']}
    if identity_path.exists() and (len(briefs)!=224 or set(briefs)!={e['entityId'] for e in queue['records']}):
        raise ValueError('Identity gallery requires the complete source roster')
    family_names={'FELINE':'貓化','CANINE':'犬化','BIG_EYE':'大眼化','DRAGONFOLK':'龍人化','BEASTFOLK':'獸人化','OTHER_WITH_REASON':'保留特殊體型／表面身份'}
    identity_overview=[]
    for entry in queue['records']:
        eid=entry['entityId'];folder=BASE/'settings'/eid
        brief=briefs.get(eid);identity_drawing=False
        record={'entityId':eid,'queueOrdinal':entry['queueOrdinal'],'packet':entry['packet'],
                'settingStatus':'NOT_AUTHORED','runtimeDefaultReplaced':False,'identityBriefReady':bool(brief)}
        if (folder/'setting.json').exists():
            rd=review_directory(folder)
            setting=review.read(folder/'setting.json');qa=review.read(folder/rd/'technical-qa.json')
            if qa.get('settingFileSha256')!=review.digest((folder/'setting.json').read_bytes()) or not review.verify_compiled_art(setting,folder/rd):
                raise ValueError(f'Actual drawing or compiler receipt is missing or stale: {eid}')
            visual=folder/'visual-review.json'
            artifact={'entityId':eid,'setting':folder/'setting.json','technicalQa':folder/rd/'technical-qa.json','visualQa':visual}
            if visual.exists():
                checked=review.stage_review([eid],[artifact]);status='PASS_SETTING_STAGE' if checked['mayAdvance'] else checked['pending'][0]['reason']
                artifacts.append(artifact)
            else:status='REVIEW_PENDING'
            identity_drawing=setting.get('identityDesign',{}).get('directionVersion')==review.IDENTITY_DIRECTION_VERSION
            record.update({'settingStatus':status,'setting':f'settings/{eid}/setting.json',
                           'designVersion':setting['designVersion'],'settingFileSha256':qa['settingFileSha256'],
                           'poses':len(setting['poses']),'technicalStatus':qa['technicalStatus'],
                           'newIdentityDrawn':identity_drawing,'poseSamplingStatus':qa['poseSamplingStatus']})
            imgs=''.join(f'<figure><img src="settings/{eid}/{rd}/{p["key"].replace("/","-")}.png" width="{len(p["pixels"][0])*4}" height="{len(p["pixels"])*4}" alt="{eid} {p["key"]}"><figcaption>{p["key"]}</figcaption></figure>' for p in setting['poses'])
            features='、'.join(str(f) for f in setting['features'])
            palette=''.join(f'<span class="swatch" style="background:{color}" title="{color}"></span>' for color in setting['palette'][1:])
            label=('新身份代表姿態通過' if status=='PASS_SETTING_STAGE' else '新身份畫稿，代表姿態待補齊或複審') if identity_drawing else '歷史像素稿：新身份方向待重審'
            content=f'<p class="status">{label}</p><details><summary>檢查狀態</summary>{html.escape(status)}</details><div class="poses">{imgs}</div><p>{html.escape(features)}</p><div class="palette">{palette}</div><p><a href="settings/{eid}/{rd}/source-comparison.png">原／新姿態比對</a> · <a href="settings/{eid}/setting.json">像素設定</a></p>'
            first=next((p for p in setting['poses'] if p['key']=='main/cell_000'),setting['poses'][0])
            picture=review.PIXEL.indexed_image(first['pixels'],review.PIXEL.parse_palette(setting['palette'])).convert('RGBA')
            overview.append((eid,setting['designVersion'],picture,status))
            if identity_drawing:identity_overview.append((eid,setting['designVersion'],picture,status))
        else:
            content='<p class="status">已排入全員製作，尚未畫出新外型</p>'
        brief_html=''
        if brief:
            family=family_names[brief['chosenFamily']]
            record.update({'identityFamily':brief['chosenFamily'],'designName':brief['designName']})
            source=BASE/'identity-source-survey'/f'{eid}.png'
            if review.digest(source.read_bytes())!=brief['sourceImageSha256']:raise ValueError(f'Stale identity witness: {eid}')
            with Image.open(source) as im:sw,sh=im.size
            brief_html=f'<h3>{html.escape(brief["designName"])}</h3><p class="family">{family} · 方向已制定</p><details><summary>原作參照與逐隻改造規則</summary><figure><img src="identity-source-survey/{eid}.png" width="{sw*2}" height="{sh*2}" alt="{eid} 原作參照"><figcaption>原作姿態參照，並非新畫稿</figcaption></figure><p>觀察：{html.escape(brief["observedBody"])}</p><p>識別特徵：{html.escape("、".join(brief["fixedTraits"]))}</p><p>改動：{html.escape("；".join(brief["changedRegions"]))}</p><p>保留：{html.escape("；".join(brief["preservedMotion"]))}</p><p>設計理由：{html.escape(brief["rationale"])}</p><p>風險：{html.escape(brief["risk"])}</p></details>'
        search_text=' '.join([eid,brief['designName'] if brief else '',family_names.get(brief['chosenFamily'],'') if brief else ''])
        cards.append(f'<article data-status="{record["settingStatus"]}" data-new="{str(identity_drawing).lower()}" data-search="{html.escape(search_text,quote=True)}" data-entity="{eid}"><h2>{eid}</h2><p>工作包 {entry["packet"]:02d} · 順序 {entry["queueOrdinal"]}</p>{brief_html}{content}</article>')
        records.append(record)
    representatives=[e['entityId'] for e in queue['records'][:8]]
    stage=review.stage_review(representatives,[a for a in artifacts if a['entityId'] in representatives])
    authored=sum(r['settingStatus']!='NOT_AUTHORED' for r in records);accepted=sum(r['settingStatus']=='PASS_SETTING_STAGE' for r in records)
    result={'schemaVersion':1,'sourceQueueSha256':review.digest((BASE/'production-queue.json').read_bytes()),
            'counts':{'required':len(records),'identityBriefs':len(briefs),'authoredSettings':authored,
                      'newIdentityDrawn':len(identity_overview),'legacySettingsAwaitingIdentityReview':authored-len(identity_overview),
                      'acceptedSettings':accepted,'defaultReplaced':0},
            'representativeStage':stage,'allRosterSettingStage':{'required':len(records),'accepted':accepted,'mayAdvanceToFullMotion':accepted==len(records)},
            'statusMeaning':'Setting-stage approval is not whole-motion, normal-game, human or device approval.','records':records}
    source_ordinals={e['entityId']:e['sourceOrdinal'] for e in catalog['entities']}
    lanes={i:[] for i in [1,2,3,0]}
    for record in sorted(records,key=lambda row:(row['settingStatus']!='NOT_AUTHORED',row['queueOrdinal'])):
        if record.get('newIdentityDrawn'):continue
        ordinal=source_ordinals[record['entityId']];lane=0 if ordinal<=8 else (ordinal-9)//72+1
        lanes[lane].append(record['entityId'])
    result['nextWork']={'scope':'CONTINUE_ALL_ROSTER_IDENTITY_DRAWINGS_WITHOUT_WAITING_FOR_M201',
      'nextParallelRepresentatives':[ids[0] for ids in lanes.values() if ids],
      'remainingIdentityDrawings':sum(len(ids) for ids in lanes.values()),
      'singlePoseFollowup':[row['entityId'] for row in records if row.get('newIdentityDrawn') and row.get('poseSamplingStatus')=='INCOMPLETE'],
      'meaning':'Deterministic next-work selection from actual progress, not a background scheduler or drawing-completion claim.'}
    content='''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>224 套像素角色設定</title>
<style>*{box-sizing:border-box}body{margin:0;background:#18242b;color:#e5eeed;font:16px/1.7 system-ui,sans-serif}main{max-width:1480px;margin:auto;padding:24px}h1{font-size:30px}h2{font-size:20px;overflow-wrap:anywhere}.intro{max-width:850px}.summary{padding:16px;border:1px solid #6f897b;border-radius:12px;background:#22363a}.controls{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}input,select{font:inherit;padding:10px;max-width:100%;background:#e9efe9;color:#14242a;border:0;border-radius:6px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:20px}article{min-width:0;padding:20px;background:#233139;border:1px solid #3b5159;border-radius:12px}a{color:#bcdfb1}.poses{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}figure{margin:0;max-width:100%;overflow-x:auto}img{image-rendering:pixelated;display:block;max-width:none}figcaption{font:12px ui-monospace,monospace;margin-top:8px}.status{color:#cae5a3;font-size:14px}.palette{display:flex;gap:5px;flex-wrap:wrap}.swatch{width:20px;height:20px;border:1px solid #87959b;border-radius:3px}[hidden]{display:none!important}footer{margin:30px 0;color:#aabdc0}@media(max-width:500px){main{padding:14px}article{padding:14px}h1{font-size:24px}}</style>
<main><h1>224 套角色外型重新設計</h1><p class="intro">全員並行規劃貓化、犬化、大眼化、龍人化或獸人化。逐隻依實際體型重設臉部、材質與局部輪廓，保留原本動作構造。先看新身份，再檢查代表姿態，最後展開完整動作。</p>
'''
    content+=f'<div class="summary"><strong>已看來源並制定方向 {len(briefs)} / 224 · 新身份已有畫稿 {len(identity_overview)} / 224 · 新身份代表姿態通過 {accepted} / 224</strong><br>保留歷史像素稿 {authored-len(identity_overview)} 套，待新方向重審 · 正常遊戲新預設置換：0<br>單體畫稿不等於完整動作。新稿採 4 倍整數放大；來源圖只放在清楚標示的參照區。</div>'
    content+='<div class="controls"><label>角色／方向 <input id="search" placeholder="搜尋 ID、貓化、犬化或新設計名稱"></label><label>顯示 <select id="filter"><option value="all">全部 224 套</option><option value="new">新身份已有畫稿</option><option value="authored">所有已有畫稿（含歷史）</option><option value="pending">新身份尚未繪製</option></select></label></div><p id="visible-count" aria-live="polite"></p><div class="grid">'+''.join(cards)+'</div><footer><a href="PLAN.md">工作方案</a> · <a href="identity-design-queue.json">全員逐隻設計方向</a> · <a href="setting-progress.json">審查與覆蓋紀錄</a> · <a href="review/index.html">M201 歷史原始序列工作台</a></footer></main>'
    content+='''<script>const search=document.querySelector('#search'),filter=document.querySelector('#filter'),cards=[...document.querySelectorAll('article')];function update(){let visible=0;for(const card of cards){const authored=card.dataset.status!=='NOT_AUTHORED',fresh=card.dataset.new==='true';const show=card.dataset.search.toLowerCase().includes(search.value.trim().toLowerCase())&&(filter.value==='all'||(filter.value==='authored'&&authored)||(filter.value==='new'&&fresh)||(filter.value==='pending'&&!fresh));card.hidden=!show;if(show)visible++;}document.querySelector('#visible-count').textContent=`目前顯示 ${visible} 套`;}search.addEventListener('input',update);filter.addEventListener('change',update);update();</script></html>'''
    files={'setting-progress.json':review.encoded(result),'settings.html':content.encode('utf-8')}
    if overview:
        row_height=max(260,max(item[2].height*4+110 for item in overview))
        sheet=Image.new('RGB',(1440,80+row_height*((len(overview)+3)//4)),'#eaece3');draw=ImageDraw.Draw(sheet)
        draw.text((22,18),f'PIXEL APPEARANCE SETTINGS | {authored} / 224 authored | {accepted} reviewed',fill='#26333b')
        draw.text((22,40),'Standard source poses at fixed 4x integer scale. Setting review only; full animation and runtime remain separate.',fill='#4c5c5e')
        for n,(eid,version,picture,status) in enumerate(overview):
            x=(n%4)*360;y=80+(n//4)*row_height
            draw.text((x+18,y+12),eid,fill='#26333b');draw.text((x+18,y+31),status,fill='#526849')
            scaled=picture.resize((picture.width*4,picture.height*4),Image.Resampling.NEAREST)
            sheet.paste(scaled,(x+18,y+64),scaled)
            draw.text((x+18,y+row_height-22),version,fill='#4c5c5e')
        files['setting-overview.png']=review.PIXEL.png_bytes(sheet)
    if identity_overview:
        row_height=max(260,max(item[2].height*4+100 for item in identity_overview))
        sheet=Image.new('RGB',(1440,80+row_height*((len(identity_overview)+3)//4)),'#eaece3');draw=ImageDraw.Draw(sheet)
        draw.text((22,18),f'NEW CREATURE IDENTITIES | {len(identity_overview)} drawn / 224 | {accepted} representative-pose reviews passed',fill='#26333b')
        draw.text((22,40),'New identity drawings only. Standard poses at fixed 4x pixel scale. Complete motions and runtime still pending.',fill='#4c5c5e')
        for n,(eid,version,picture,status) in enumerate(identity_overview):
            x=n%4*360;y=80+n//4*row_height
            draw.text((x+18,y+12),eid,fill='#26333b')
            scaled=picture.resize((picture.width*4,picture.height*4),Image.Resampling.NEAREST);sheet.paste(scaled,(x+18,y+50),scaled)
            draw.text((x+18,y+row_height-22),'POSE REVIEW PASS' if status=='PASS_SETTING_STAGE' else 'STANDARD DRAFT / POSE REVIEW PENDING',fill='#526849')
        files['identity-overview.png']=review.PIXEL.png_bytes(sheet)
    return files,result

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    files,result=build()
    for name,payload in files.items():
        p=BASE/name
        if args.check:
            if not p.exists() or p.read_bytes()!=payload:raise SystemExit(f'Gallery drift {name}')
        else:p.write_bytes(payload)
    print(json.dumps(result['counts']))

if __name__=='__main__':main()
