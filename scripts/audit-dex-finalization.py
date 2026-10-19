"""Reconcile current dedicated portraits with the existing local design audit."""
import collections
import csv
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/reports/dex-workspace-closeout-2026-10-19'
SOURCE=Path('C:/Users/User/Documents/Codex/2026-10-19/task-2/角色盤點_20261019/00_逐角色設計盤點.csv')
rows=list(csv.DictReader(SOURCE.read_text(encoding='utf-8-sig').splitlines()))
selected=json.loads((ROOT/'src/data/championship/database-hero-portraits.public.v1.json').read_text(encoding='utf8'))
heroes={r['speciesId']:r for r in selected['entries']}
new={142,143,145,149,151,155,156,158,183,237,238,239,240,241,242}
equipped={142,143,145,149,151,155,156,158,183}
result=[]
for row in rows:
    species=row['角色 ID'];number=int(species.split('-')[1]);hero=heroes.get(species)
    if number in new:status='本輪完整單張定稿已補入'
    elif number in [77,78]:status='舊空手主圖保留；依新規則待完整持裝定稿'
    elif hero:status='既有公開單張圖保留；本輪未重新核准其設計'
    elif 20<=number<=33 and number not in [28,29,33]:status='未定稿：仍缺完整非像素單張主圖'
    elif row['圖鑑姿勢核准狀態']=='握姿待修正':status='未定稿：持武器握姿返修中'
    elif '新核准 Library ID' in row['來源讀回結果']:status='新版已核准；指定單張原檔尚未落地'
    elif number==82:status='未定稿：最新畫風返修待確認'
    elif '本體設計核准' in row['核准適用範圍']:status='未定稿：本體參考不能代替完整圖鑑主圖'
    elif row['設計狀態']=='設計已核准':status='設計核准有紀錄；完整單張來源或最終版本待補證'
    else:status='未定稿或核准版本證據不足；不以像素／設計板代替'
    verified=False
    if hero:
        for asset in [hero,hero['thumbnail']]:
            assert hashlib.sha256((ROOT/asset['src']).read_bytes()).hexdigest()==asset['sha256']
        verified=True
    result.append({'speciesId':species,'name':row['名稱'],'displayCode':hero['displayCode'] if hero else row['現行代碼'],
        'finalization':status,'dedicatedPortraitPresent':bool(hero),'selectedBytesVerified':verified,
        'equippedPortraitApprovedThisTask':number in equipped,
        'portrait':hero['src'] if hero else None,'portraitSha256':hero['sha256'] if hero else None,
        'historicalDesignStatus':row['設計狀態'],
        'animationStatus':'圖鑑圖片不代表最新版動作動畫已完成'})
assert len(result)==230 and len(heroes)==155
summary={'scope':'230 non-egg encyclopedia identities; eight eggs separate. Display asset presence is not a blanket new design approval.',
    'ownerFinalizationRule':'One complete single image; if the original design has a detachable weapon, its complete equipped hero is required. Body-only approval and separate equipment files are not finalized portraits. Naturally unarmed designs remain valid.',
    'nonEggIdentities':len(result),'eggsSeparately':8,'dedicatedPortraits':len(heroes),
    'withoutDedicatedPortrait':sum(not r['dedicatedPortraitPresent']for r in result),
    'babyIIMissingSingleImage':[r['speciesId'] for r in result if r['finalization']=='未定稿：仍缺完整非像素單張主圖'],
    'existingEmptyHandReplacementPending':['species-077','species-078'],
    'counts':dict(collections.Counter(r['finalization']for r in result)),
    'records':result}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'character-finalization.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
with (OUT/'character-finalization.csv').open('w',encoding='utf-8-sig',newline='')as file:
    writer=csv.DictWriter(file,fieldnames=list(result[0]));writer.writeheader();writer.writerows(result)
print(json.dumps({k:summary[k]for k in ['nonEggIdentities','dedicatedPortraits','withoutDedicatedPortrait','babyIIMissingSingleImage']},ensure_ascii=True))
