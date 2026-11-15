"""Blender step of a wide battle canvas: build the arena's props, save the scene, render them.

    blender -b --factory-startup --python scripts/battle-canvas/props_blender.py -- \
        --field field_bm02_01 --work <work dir> --blend <master-canvas.blend> [--samples 96]

Needs <work dir>/ground.png from make.py's ground step.  Writes the .blend and
<work dir>/props.png (props and their shadows on a transparent film).
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import canvaslib as C  # noqa: E402
from kit import Kit  # noqa: E402


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--field', required=True)
    parser.add_argument('--work', required=True)
    parser.add_argument('--blend', required=True)
    parser.add_argument('--samples', type=int, default=96)
    args = parser.parse_args(argv)
    work = Path(args.work)
    kit = Kit(work, args.samples)
    kit.ground(work / 'ground.png')
    C.arena_module(args.field).build(kit)
    kit.save(args.blend)
    print('CANVAS_SCENE_SAVED', args.blend, 'props', kit.count)
    kit.render(work / 'props.png')
    print('CANVAS_PROPS_RENDERED', work)


if __name__ == '__main__':
    main()
