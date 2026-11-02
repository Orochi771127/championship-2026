import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cageUiImage, shopCageUiImage, cageUiThumbnail, cageUiName, cageUiSummary, cageEditorArtCells} from '../src/championship/presentation/cageUiArt.js';
import threeUi from '../assets/production/public-runtime/cage-ui-three.v1.json' with {type:'json'};
import uiMap from '../assets/production/public-runtime/cage-ui.map.v1.json' with {type:'json'};
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {createCageEditRuntime} from '../src/championship/cage/cageEditRuntime.js';

test('all 36 editor facilities resolve to existing production art; shop joins by record identity',()=>{
  for(const d of listCageDefinitions()) {
    const src=cageUiImage(d.moduleId);
    assert.ok(src?.startsWith('assets/production/cage/'));
    assert.ok(fs.existsSync(src));
    // Owner 2026-11-02: the shop card is the 256x192 render of the same 3D cage.
    if(d.shopRecordIndex!==null) assert.equal(shopCageUiImage(d.shopRecordIndex),cageUiThumbnail(d.moduleId));
  }
  assert.equal(shopCageUiImage(0),null);
  assert.equal(cageUiImage(null),null);
  assert.equal(cageUiName('championship:2026:cage:0'),'空地');
  assert.equal(cageUiName('championship:2026:cage:waiting-room'),'等候室');
  assert.equal(cageUiSummary('championship:2026:cage:1'),'生命值上升 · 建議 6 隻');
});

test('native multi-cell editor thumbnails share one image origin and retain its aspect without mutating slots',()=>{
  const editor=createCageEditRuntime({initializeOriginal:true});
  const frame=editor.getFrame(listCageDefinitions().filter(d=>[0,1,15].includes(d.cageDefinitionIndex)).map(d=>d.shopRecordIndex),0);
  const before=JSON.stringify(frame.slots);
  const cells=cageEditorArtCells(frame.slots);
  assert.equal(cells.length,20);
  assert.equal(cells[1].x-cells[0].x,24);
  assert.equal(cells[1].y-cells[0].y,44);
  for(const d of listCageDefinitions()) {
    const peers=frame.slots.filter(s=>s.moduleId===d.moduleId).map(s=>cells[s.slotIndex]);
    if(!peers.length) continue;
    const row=threeUi.fields.find(f=>f.frame.src===peers[0].image);
    const source=row&&uiMap.fields.find(f=>f.fieldId===row.fieldId);
    assert.ok(source,d.moduleId);
    for(const p of peers) {
      assert.ok(Math.abs(p.imageWidth/p.imageHeight-(source.worldWidthPx+((source.visualPaddingNative?.left??0)+(source.visualPaddingNative?.right??0))*(source.nativePixelWorldScale??4))/(source.worldHeightPx+((source.visualPaddingNative?.top??0)+(source.visualPaddingNative?.bottom??0))*(source.nativePixelWorldScale??4)))<1e-9);
      assert.equal(p.x+p.imageX,peers[0].x+peers[0].imageX);
      assert.equal(p.y+p.imageY,peers[0].y+peers[0].imageY);
    }
  }
  assert.equal(JSON.stringify(frame.slots),before);
});
