#!/bin/bash
# Sports-park pair: design -> padded renders -> edge renders -> IDs -> pack -> layers -> goal net -> edge patches.
set -e
C=R:/Projects/Championship2026/map-polish-20261018/cage; REPO=R:/Projects/Championship2026/.tmp/map-int
B="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
"$B" -b --factory-startup --python $C/tools/design_sports_park.py -- "R:/Projects/Championship2026/championship-2026/docs/art/production/original-character-cage-r1/cage-base3d-v1/opm-opus-r8/seam-v3/fields/field_cm02_01/master.blend" $C/park/cm02-park.blend cm02 2>&1 | grep -E "PARK_DONE|Traceback"
"$B" -b --factory-startup --python $C/tools/design_sports_park.py -- $C/cm30/master-basketball.blend $C/park/cm30-park.blend cm30 2>&1 | grep -E "PARK_DONE|Traceback"
for spec in field_cm02_01:cm02 field_cm30_01:cm30; do FID=${spec%%:*}; N=${spec##*:}; M=$C/park/$N-park.blend
  "$B" --background --factory-startup --python $C/tools/polish_cage.py -- "$M" "$C/polish/batch/$FID-00.png" --pad 32 --segments "$C/edges/$FID-segments.json" 2>&1 | grep Traceback || true
  cp $C/polish/batch/$FID-00.png $C/edges/$FID-full.png
  "$B" --background --factory-startup --python $C/tools/polish_cage.py -- "$M" "$C/edges/$FID-nojoint.png" --pad 32 --hide "^flush-porcelain-joint|-foundation$|^shallow-blue-fascia|^continuous-rim-light" 2>&1 | grep Traceback || true
  echo "{\"$FID\": \"$M\"}" > $C/park/$N-masters.json
  for t in build_ids build_amb_ids; do "$B" --background --factory-startup --python $C/tools/$t.py -- "$C/ids-refine" $C/park/$N-masters.json $FID 2>&1 | grep -E "DONE|Traceback" || true; done
  "$B" -b "$M" --python $C/cm30/prop_cells.py 2>/dev/null | grep PROP_CELLS | sed "s/^/$FID /"
done
echo PARK_PIPELINE_RENDERED
