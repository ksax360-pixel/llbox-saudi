#!/usr/bin/env python3
"""Production checks for WhatsApp image/OCR pipeline."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from patch_conversation_fix import PARSE_VALIDATE, patch_node_code
from patch_media_support import apply_media_patch

BACKUP = Path(__file__).parent / "backup_dtwKJPnyo5g3dFcJ_deployed.json"

SAMPLE_OCR = """
order_reference: OD328457497404281100
invoice_number: F17JUR60232402120021
carrier: Amazon
summary: Tax invoice for Wings Phantom earbuds
"""

CAPTION_CASE = "imcusomer please read ths and save this\n" + SAMPLE_OCR


def extract_order_js(value: str) -> str:
    m = re.search(
        r"const extractOrder = \(value\) => \{([\s\S]*?)\n\};\n",
        PARSE_VALIDATE,
    )
    if not m:
        raise RuntimeError("extractOrder not found in PARSE_VALIDATE")
    # Minimal JS runtime via node if available, else regex simulation
    body = m.group(1)
    script = f"""
const value = {json.dumps(value)};
let result = '';
{body.replace('return ref;', 'result = ref; return;').replace('return fromLabel;', 'result = fromLabel; return;').replace('return \'\';', '')}
console.log(result || '');
"""
    import subprocess

    proc = subprocess.run(
        ["node", "-e", f"const extractOrder = (value) => {{{body}\n}};\nconsole.log(extractOrder({json.dumps(value)}));"],
        capture_output=True,
        text=True,
        check=True,
    )
    return proc.stdout.strip()


def check_wiring(wf: dict) -> list[str]:
    errors = []
    conns = wf.get("connections", {})
    node_map = {n["name"]: n for n in wf.get("nodes", [])}
    if node_map.get("Media Type Router", {}).get("type") != "n8n-nodes-base.if":
        errors.append("Media Type Router must be IF node")
    if node_map.get("Media Process Router", {}).get("type") != "n8n-nodes-base.if":
        errors.append("Media Process Router must be IF node")
    if "Document or Image Router" not in node_map:
        errors.append("Document or Image Router node missing")
    if "Document or Image Router" not in conns:
        errors.append("Document or Image Router connections missing")
    vision = conns.get("Analyze Image (Vision)", {}).get("main", [[]])[0]
    if not vision or vision[0].get("node") != "Normalize Media Context":
        errors.append("Analyze Image (Vision) must connect to Normalize Media Context")
    doc = conns.get("Analyze Document", {}).get("main", [[]])[0]
    if not doc or doc[0].get("node") != "Normalize Media Context":
        errors.append("Analyze Document must connect to Normalize Media Context")
    norm = conns.get("Normalize Media Context", {}).get("main", [[]])[0]
    if not norm or norm[0].get("node") != "Lookup Contact in Backend":
        errors.append("Normalize Media Context must connect to Lookup Contact in Backend")
    dl = next((n for n in wf["nodes"] if n["name"] == "Download Media"), None)
    if dl and not dl.get("parameters", {}).get("sendHeaders"):
        errors.append("Download Media missing Authorization header")
    return errors


def simulate_media_intent(wf: dict) -> dict:
    code = next(n["parameters"]["jsCode"] for n in wf["nodes"] if n["name"] == "Parse & Validate AI Output")
    # Sanity: media branches present and ordered before isNoDelivery
    idx_media = code.find("isMediaUpload && hasMediaData && orderRef")
    idx_no_delivery = code.find("} else if (isNoDelivery)")
    if idx_media < 0 or idx_no_delivery < 0 or idx_media > idx_no_delivery:
        raise RuntimeError("Media intent block not prioritized before isNoDelivery")
    return {"media_before_no_delivery": True}


def main() -> None:
    print("=== Order extraction ===")
    for label, sample in [
        ("Amazon OD invoice OCR", SAMPLE_OCR),
        ("Caption + OCR", CAPTION_CASE),
        ("Numeric Amazon ID", "order_reference: 0053805892579304327021"),
    ]:
        order = extract_order_js(sample)
        print(f"  {label}: {order or '(none)'}")
        if not order:
            sys.exit(f"FAIL: expected order from {label}")

    print("\n=== Workflow wiring (local backup if present) ===")
    wf_path = BACKUP if BACKUP.exists() else Path(__file__).parent / "LLBox_Complete_AI_Production.json"
    with open(wf_path) as f:
        wf = json.load(f)
    patch_node_code(wf, "Parse & Validate AI Output", PARSE_VALIDATE)
    apply_media_patch(wf)
    wiring_errors = check_wiring(wf)
    if wiring_errors:
        for e in wiring_errors:
            print("  FAIL:", e)
        sys.exit(1)
    simulate_media_intent(wf)
    print("  Vision -> Normalize -> Lookup: OK")
    print("  Download Media auth: OK")
    print("  Media intent priority: OK")
    print("\nAll media pipeline checks passed.")


if __name__ == "__main__":
    main()
