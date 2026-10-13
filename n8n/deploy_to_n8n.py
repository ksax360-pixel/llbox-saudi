#!/usr/bin/env python3
"""Deploy patched LLBox workflow to live n8n (Docker + Postgres)."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

WORKFLOW_ID = "dtwKJPnyo5g3dFcJ"
N8N_CONTAINER = "n8n"
DB_CONTAINER = "n8n-db"

sys.path.insert(0, str(Path(__file__).parent))
from patch_conversation_fix import (  # noqa: E402
    BUILD_FINAL_REPLY,
    PARSE_VALIDATE,
    patch_gate_denied,
    patch_greeting,
    patch_meta_signature,
    patch_node_code,
    patch_session_extract,
    patch_session_first_contact,
    patch_system_prompt,
)
from patch_media_support import apply_media_patch  # noqa: E402


def run(cmd: list[str], input_text: str | None = None) -> subprocess.CompletedProcess:
    print("$", " ".join(cmd))
    return subprocess.run(cmd, check=True, capture_output=True, text=True, input=input_text)


def export_live_workflow(dest: Path) -> dict:
    inner = f"/tmp/export_{WORKFLOW_ID}.json"
    run(["docker", "exec", N8N_CONTAINER, "n8n", "export:workflow", f"--id={WORKFLOW_ID}", f"--output={inner}"])
    run(["docker", "cp", f"{N8N_CONTAINER}:{inner}", str(dest)])
    with open(dest) as f:
        data = json.load(f)
    return data[0] if isinstance(data, list) else data


def validate_js_nodes(wf: dict) -> list[str]:
    import re
    errors = []
    for n in wf.get("nodes", []):
        if n.get("type") != "n8n-nodes-base.code":
            continue
        code = n.get("parameters", {}).get("jsCode", "")
        if re.search(r"'[^'\n]*I'll[^'\n]*'", code) or re.search(r"'[^'\n]*I'm[^'\n]*'", code):
            errors.append(f"{n['name']}: apostrophe inside single-quoted string")
        if code.count("{") != code.count("}"):
            errors.append(f"{n['name']}: mismatched braces")
    return errors


def apply_patches(wf: dict) -> dict:
    patch_node_code(wf, "Parse & Validate AI Output", PARSE_VALIDATE)
    patch_node_code(wf, "Build Final Reply", BUILD_FINAL_REPLY)
    patch_system_prompt(wf)
    patch_gate_denied(wf)
    patch_greeting(wf)
    patch_session_extract(wf)
    patch_session_first_contact(wf)
    patch_meta_signature(wf)
    apply_media_patch(wf)
    return wf


def push_to_database(wf: dict) -> None:
    nodes = json.dumps(wf["nodes"], ensure_ascii=False)
    connections = json.dumps(wf["connections"], ensure_ascii=False)
    settings = json.dumps(wf.get("settings") or {"executionOrder": "v1"}, ensure_ascii=False)
    name = (wf.get("name") or "LLBox Complete AI Production System").replace("'", "''")

    sql = f"""
BEGIN;
UPDATE workflow_entity
SET nodes = $nodes${nodes}$nodes$::json,
    connections = $conns${connections}$conns$::json,
    settings = $settings${settings}$settings$::json,
    name = '{name}',
    "updatedAt" = NOW(),
    "versionCounter" = "versionCounter" + 1
WHERE id = '{WORKFLOW_ID}';
COMMIT;
SELECT id, name, active, "versionCounter", "updatedAt" FROM workflow_entity WHERE id = '{WORKFLOW_ID}';
"""

    result = run(["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "n8n", "-d", "n8n"], input_text=sql)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)


def restart_n8n() -> None:
    run(["docker", "restart", N8N_CONTAINER])
    print("n8n restarted.")


def main() -> None:
    export_path = Path("/tmp/live_llbox_export.json")
    print(f"Exporting live workflow {WORKFLOW_ID}...")
    wf = export_live_workflow(export_path)
    print(f"Exported: {wf.get('name')} ({len(wf.get('nodes', []))} nodes), active={wf.get('active')}")

    print("Applying conversation fixes (keeping live credentials)...")
    wf = apply_patches(wf)
    issues = validate_js_nodes(wf)
    if issues:
        print("Validation failed:", issues, file=sys.stderr)
        sys.exit(1)
    print("JS validation: OK")

    backup = Path(__file__).parent / f"backup_{WORKFLOW_ID}_deployed.json"
    backup.write_text(json.dumps(wf, indent=2), encoding="utf-8")
    print(f"Backup: {backup}")

    print("Updating n8n database...")
    push_to_database(wf)

    restart_n8n()
    print(f"Deployed: https://n8n.x-360.ai/workflow/{WORKFLOW_ID}")


if __name__ == "__main__":
    main()
