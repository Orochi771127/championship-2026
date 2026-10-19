#!/bin/bash
# One cage through the refine pipeline (local review 2026-10-19).
# usage: cage_refine_one.sh <fieldId> <source master.blend> <pad raster px> <repo>
set -e
FID=$1; SRC=$2; PAD=$3; REPO=$4
C=R:/Projects/Championship2026/map-polish-20261018/cage
B="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
mkdir -p $C/refine/$FID $C/ids-refine
M=$C/refine/$FID/master-refine.blend
"$B" -b --factory-startup --python $C/tools/refine_cage.py -- "$SRC" "$M" 2>&1 | grep -E "CAGE_REFINE|Traceback" || true
"$B" --background --factory-startup --python $C/tools/polish_cage.py -- "$M" "$C/polish/batch/$FID-00.png" --pad $PAD --segments "$C/edges/$FID-segments.json" 2>&1 | grep -E "Traceback" || true
cp $C/polish/batch/$FID-00.png $C/edges/$FID-full.png
"$B" --background --factory-startup --python $C/tools/polish_cage.py -- "$M" "$C/edges/$FID-nojoint.png" --pad $PAD --hide "^flush-porcelain-joint|-foundation$|^shallow-blue-fascia|^continuous-rim-light" 2>&1 | grep -E "Traceback" || true
echo "{\"$FID\": \"$M\"}" > $C/refine/$FID/masters.json
for t in build_ids build_amb_ids; do "$B" --background --factory-startup --python $C/tools/$t.py -- "$C/ids-refine" $C/refine/$FID/masters.json $FID 2>&1 | grep -E "DONE|Traceback" || true; done
echo "REFINE_ONE_DONE $FID"
