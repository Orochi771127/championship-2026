"""Record generated-file facts and preserve failed candidates without promotion."""
import hashlib
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
PACK=ROOT/'docs/art/production/characters/appearance-refresh-v1'
files=[]
for filename in ['main-000-candidate-v1.png','main-000-alpha-attempt-v2.png','main-000-pose-attempt-v3.png']:
    path=PACK/'m201-a'/filename
    with Image.open(path) as im:
        alpha=im.getchannel('A').getextrema() if 'A' in im.getbands() else None
        files.append({'path':filename,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
          'width':im.width,'height':im.height,'mode':im.mode,'alphaExtrema':alpha,
          'transparentBackgroundPassed':alpha is not None and alpha[0]==0,
          'role':'REPAIR_CANDIDATE_NOT_ANIMATION_MASTER','runtimeEligible':False})
record={'schemaVersion':1,'entityId':'m201_agumon','selectedConcept':'A',
 'generationTool':'builtin image_gen.imagegen','generationCount':3,
 'inputPose':'source-correct main/cell-000.png','sourceCanvas':[464,368],
 'qa':{'identity':'A_RECOGNIZABLE_STYLE_SPEC_RECORDED','pose':'REPAIR_REQUIRED',
       'alpha':'FAIL_RGB_CHECKERBOARD','animationMasterAcceptedCount':0,'normalGameReplacement':False},
 'nextAction':'RESOLVE_CONTROLLED_POSE_AND_TRUE_ALPHA_OUTPUT_BEFORE_FULL_MASTER_GENERATION',
 'sameMethodTransparentRetriesStopped':True,
 'note':'Three actual files remain RGB despite transparent requests. Do not infer alpha from checkerboard appearance or mass-produce this failure.',
 'files':files}
(PACK/'m201-a/generation-receipt.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'attempts':len(files),'acceptedTransparentMasters':0,'runtimePromotions':0}))
