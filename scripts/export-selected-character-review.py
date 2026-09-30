"""Thin selected-concept adapter around the existing review bundle exporter."""
import argparse
import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result


def build(job, candidate, visual_dir, folder, allow_pending_local_qa=False):
    S=load('selected_export_source','selected-character-sheet.py')
    E=load('selected_existing_exporter','export-character-batch-review.py')
    config=S.P.read(job/'job.json');entity=config['entityId']
    S.P.require(entity=='m001_zurumon' or (entity in E.CONFIG and int(entity[1:4])<=12),'SELECTED_EXPORT_ENTITY_NOT_REVIEWED')
    S.P.require(job.resolve().parent== (S.PACK/'selected-concept-jobs'/entity).resolve(),'JOB_OUTSIDE_SELECTED_ROOT')
    bank=job/candidate/'bank.json';visual=S.P.read(job/visual_dir/'visual-validation.json')
    S.P.require(visual['sourceBankSha256']==S.sha(bank),'VISUAL_REVIEW_BANK_DRIFT')
    S.P.require(visual['selectedConceptSha256']==config['selectedConcept']['sha256'],'VISUAL_CONCEPT_DRIFT')
    if entity!='m001_zurumon':
        request_folder=E.CONFIG[entity]['folder']
        E.J.JOBS=S.PACK/'selected-concept-jobs'
        E.CONFIG[entity]={'candidate':job.name+'/'+candidate,'review':job.name+'/'+visual_dir,'folder':folder}
        E.build(entity,allow_pending_local_qa=allow_pending_local_qa)
        path=ROOT/'assets/production/internal-character-review'/folder/'hud-r01/manifest.json'
        hud=S.P.read(path)
        for row in [hud['portrait'],*hud['battle']['cells']]:
            row['src']=row['src'].replace(folder+'/',request_folder+'/')
        hud['localServerAdapter']={'requestPrefix':request_folder,'servedBundle':folder,'productFilesOverwritten':False}
        S.write_json(path,hud)
        return
    # The existing m001 HUD gate needs proof of this particular native mapping.
    archive=ROOT.parent/'YDIJ_PRIVATE_ROM_ART_PACK';db='m001_zurumon_db_sub'
    dc=S.P.read(archive/'08_FULL_FAMILY_CONVERSION/db_digimon'/db/'cells.json')
    seq=S.P.read(archive/'08_FULL_FAMILY_CONVERSION/db_digimon'/db/'animations.json')['sequences'][0]
    db_image,_=S.P.SOURCE.render_native(dc['cells'][seq['frames'][0]['cellId']],S.P.SOURCE.native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/db_digimon',db,dc))
    mc=S.P.read(archive/'08_FULL_FAMILY_CONVERSION/digimon/m001_zurumon_main/cells.json')
    main,_=S.P.SOURCE.render_native(mc['cells'][0],S.P.SOURCE.native_bank(archive/'07_RAW_NITRO_ART_BY_ROM_DIRECTORY/digimon','m001_zurumon_main',mc))
    d=db_image.crop(db_image.getbbox());m=main.crop(main.getbbox())
    S.P.require(d.size==m.size and d.tobytes()==m.tobytes(),'HUD_DONOR_NOT_MAIN000')
    E.J.JOBS=S.PACK/'selected-concept-jobs'
    E.CONFIG[entity]={'candidate':job.name+'/'+candidate,'review':job.name+'/'+visual_dir,'folder':folder}
    E.SPECIES[entity]='species-008';E.build(entity)
    path=ROOT/'assets/production/internal-character-review'/folder/'hud-r01/manifest.json'
    hud=S.P.read(path)
    hud['portrait'].update(derivation='SOURCE_DB_SUB_FIRST_CELL_EXACTLY_EQUALS_MAIN000_VISIBLE_RGBA',sourceBank=db,sourceVisibleRgbaSha256=S.P.sha(d.tobytes()))
    for row in [hud['portrait'],*hud['battle']['cells']]:
        row['src']=row['src'].replace(folder+'/','m001-r05-anchored/')
    hud['localServerAdapter']={'onlyPort':8766,'requestPrefix':'m001-r05-anchored','servedBundle':folder,'productFilesOverwritten':False}
    S.write_json(path,hud)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--job',type=Path,required=True);p.add_argument('--candidate',required=True)
    p.add_argument('--visual-dir',required=True);p.add_argument('--folder',required=True)
    p.add_argument('--pending-local-qa',action='store_true',help='Export structurally verified unaccepted art to an immutable loopback-only review bundle.')
    a=p.parse_args();build(a.job,a.candidate,a.visual_dir,a.folder,a.pending_local_qa)
