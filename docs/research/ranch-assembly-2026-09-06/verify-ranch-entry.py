"""Bounded research receipt from the exact Owner ROM; no runtime asset output.

Recheck the old OVL15 address claim and inventory rank-board background inputs.
This does not infer a slot-to-world coordinate table from background geometry.
"""
import hashlib
import json
from pathlib import Path
import capstone
import ndspy.rom

SHA = "8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1"
rom_path = Path("R:/" + SHA + ".nds")
raw = rom_path.read_bytes()
assert hashlib.sha256(raw).hexdigest() == SHA
rom = ndspy.rom.NintendoDSRom(raw)
ovl = rom.loadArm9Overlays()[15]
data = bytes(ovl.data)
cs = capstone.Cs(capstone.CS_ARCH_ARM, capstone.CS_MODE_ARM)
start, end = 0x0210B300, 0x0210B440
instructions = [{"address": hex(ins.address), "mnemonic": ins.mnemonic, "operands": ins.op_str}
    for ins in cs.disasm(data[start-ovl.ramAddress:end-ovl.ramAddress], start)]
backgrounds = []
for suffix in ("", "14", "16", "18", "20"):
    for extension in ("ncgr", "nclr", "nscr"):
        name = f"training/cage_edit_bg_main{suffix}.{extension}"
        file_id = rom.filenames.idOf(name)
        payload = bytes(rom.files[file_id])
        backgrounds.append({"path": name, "fileId": file_id, "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest()})
result = {"schemaVersion": 1, "romSha256": SHA, "overlayId": 15,
    "overlayAddress": hex(ovl.ramAddress), "overlaySha256": hashlib.sha256(data).hexdigest(),
    "addressClaimUnderReview": "OVL15 0x0210B36C cover switch",
    "instructions": instructions, "rankBoardBackgroundInputs": backgrounds,
    "slotToBoardCoordinates": "UNKNOWN_REQUIRES_TRACE",
    "slotToWorldCoordinates": "UNKNOWN_REQUIRES_TRACE",
    "classification": "RESEARCH_ONLY_NO_RUNTIME_ASSETS"}
target = Path(__file__).with_name("rom-entry-receipt.json")
target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps({"romHashMatches": True, "backgroundInputs": len(backgrounds),
    "atClaimedAddress": [row for row in instructions if row["address"] == "0x210b36c"]}))
