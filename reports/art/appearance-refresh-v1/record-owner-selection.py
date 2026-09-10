"""Transcribe explicit Owner choices and delegated low-error design decisions."""
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
PACK = ROOT/'docs/art/production/characters/appearance-refresh-v1'
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
choices={'M201':'A','M001':'B','M226':'B','E000':'A'}
designs=read(PACK/'batch-01/designs.json')
receipt={'schemaVersion':1,'date':'2026-09-06','source':'EXPLICIT_OWNER_CHAT',
 'verbatim':'M201 A、M001 B、M226 B、E000 A。',
 'scope':'APPEARANCE_OPTION_SELECTION_ONLY_NOT_FINAL_ANIMATION_QA',
 'selections':[]}
for entry in designs['entities']:
    choice=choices[entry['code']]
    entry.update(selectedConcept=choice,reviewState='OWNER_OPTION_SELECTED')
    receipt['selections'].append({'entityId':entry['entityId'],'code':entry['code'],'concept':choice,
       'board':entry['image'],'boardSha256':hashlib.sha256((PACK/'batch-01'/entry['image']).read_bytes()).hexdigest(),
       'settingQa':'PENDING','motionQa':'PENDING','fullArtQa':'PENDING','runtimeEligible':False})
designs['status']='OWNER_OPTIONS_SELECTED_M201_PRODUCTION_ACTIVE'
write(PACK/'batch-01/owner-selection.json',receipt)
write(PACK/'batch-01/designs.json',designs)
program=read(PACK/'program.json')
program.update(currentStage='M201_A_PRODUCTION_AUTONOMOUS_LOW_ERROR_DESIGN_POLICY',approvedDesignCount=4,
    approvedDesignCountMeaning='OWNER_SELECTED_APPEARANCE_OPTIONS_NOT_FINAL_SETTING_OR_ANIMATION_APPROVAL')
program['decisionDelegation']={
 'authority':'EXPLICIT_OWNER_CHAT_2026_09_06',
 'verbatim':'接下來的你,能幫我選擇嗎?就是選比較不容易出錯的,然後可以自動下去',
 'preserveFirstFourOwnerChoices':True,'remainingConceptSelector':'ART_DIRECTOR',
 'selectionObjective':'LOWEST_ANIMATION_AND_IDENTITY_ERROR_RISK',
 'routineProductionReview':'ART_DIRECTOR_AND_TECHNICAL_QA_AUTONOMOUS',
 'automaticContinue':True,'noRoutineOwnerSelectionWait':True,
 'technicalQaStillRequired':True,'gameplayChangesAuthorized':False,'publicReleaseAuthorized':False}
program['reviewGates']=['OWNER_OR_DELEGATED_DESIGN_SELECTION','GEOMETRY_AND_LANDMARK_LOCK','HIGH_RISK_POSES',
 'ALL_MAIN_SUB_ART','MOTION_COMPATIBILITY','TECHNICAL_PACKAGE','DELEGATED_VISUAL_REVIEW','NORMAL_PATH_QA']
write(PACK/'program.json',program)
qa=read(PACK/'batch-01/concept-qa.json')
qa['ownerSelection']='RECORDED_IN_OWNER_SELECTION_JSON'
write(PACK/'batch-01/concept-qa.json',qa)
write(PACK/'production-autonomy.json',{
 'schemaVersion':1,'authority':'EXPLICIT_OWNER_CHAT_2026_09_06','policy':'LOW_ERROR_FIRST',
 'alreadySelected':choices,'remainingChoiceOwner':'ART_DIRECTOR','autoContinue':True,
 'scoring':[
 {'criterion':'Preserves limb topology and critical endpoints','weight':30},
 {'criterion':'Stable identity under source extreme poses and occlusion','weight':25},
 {'criterion':'Few large color regions and simple fixed features','weight':20},
 {'criterion':'Low material noise, transparency and reflection risk','weight':15},
 {'criterion':'No independent ornaments and simple outline','weight':10}],
 'rules':['Score actual proposed designs, not A/B letters or species stereotypes.',
 'Prefer original main color family unless the delegated alternative has a clear practical advantage.',
 'Reject topology or motion changes rather than offsetting them with high visual scores.',
 'Record chosen option and concrete rationale for each entity.',
 'Repair failed poses automatically; do not promote failed or unreviewed art.',
 'Keep original sequences/ticks/modes and existing gameplay owners.',
 'Human or physical-device checks not executed stay pending; public release stays false.']})
print('Recorded firstfour Owner selections and delegated later low-error decisions.')
