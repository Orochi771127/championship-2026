"""Reader for the cartridge's UTF-16 text banks under nitrofs/ui/txt/.

THE FORMAT, AND THE TRAP IN IT
------------------------------
A bank opens with a short ASCII header:

    utf-16<>\\n
    <entry count><>\\n

after which every entry is UTF-16LE -- but each entry is terminated by the THREE
RAW single-byte characters 3C 3E 0A. The terminator is not itself UTF-16 and its
length is odd, so decoding the file in one pass loses alignment right after the
first entry and produces convincing-looking garbage. Entries must be split on the
raw byte sequence and decoded one at a time.

The header length is variable, because the entry count is written in decimal:
`utf-16<>\\n1568<>\\n` is 16 bytes but `utf-16<>\\n168<>\\n` is 15. Never hard-code it.

Inside an entry, 0x1B introduces exactly one following style code unit, and a line
break is written as the TWO literal characters backslash and n, not as 0x0A.

Verified against ui/txt/txt_list_txt.dat (1568 entries) and ui/txt/help_text_txt.dat
(168 entries): in both, the terminator count equals the declared count exactly.
"""

from __future__ import annotations

import re

ESCAPE = ""
TERMINATOR = b"\x3c\x3e\x0a"

# Spelled with chr(92) so the value cannot be silently turned into a real newline
# by an editor or a shell on its way into this file.
LITERAL_LINE_BREAK = chr(92) + "n"

_HEADER = re.compile(rb"^utf-16<>\n(\d+)<>\n")


class TextBankError(Exception):
    """The file is not a bank, or is not the bank the caller thinks it is."""


def parse_bank(raw: bytes) -> list[str]:
    """Split a bank into its entries, honouring the raw three-byte terminator."""
    match = _HEADER.match(raw)
    if not match:
        raise TextBankError("this file does not carry the utf-16 bank header")
    declared = int(match.group(1))
    body_start = match.end()

    offsets = [
        index
        for index in range(body_start, len(raw) - 2)
        if raw[index:index + 3] == TERMINATOR
    ]
    if len(offsets) != declared:
        raise TextBankError(
            f"the header declares {declared} entries but {len(offsets)} terminators were found"
        )

    entries: list[str] = []
    start = body_start
    for offset in offsets:
        chunk = raw[start:offset]
        if len(chunk) % 2:
            raise TextBankError(f"entry {len(entries)} is an odd number of bytes; alignment is wrong")
        entries.append(chunk.decode("utf-16-le"))
        start = offset + len(TERMINATOR)
    return entries


def plain(text: str) -> str:
    """Style escapes removed, the two-character line break turned into a real one."""
    out: list[str] = []
    index = 0
    while index < len(text):
        if text[index] == ESCAPE:
            index += 2          # the escape consumes exactly one following code unit
            continue
        if text.startswith(LITERAL_LINE_BREAK, index):
            out.append(chr(10))
            index += len(LITERAL_LINE_BREAK)
            continue
        out.append(text[index])
        index += 1
    return "".join(out)
