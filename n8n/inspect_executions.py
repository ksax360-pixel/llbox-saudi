#!/usr/bin/env python3
"""Dump inbound text, reply and WhatsApp send result for LLBox operations executions.

Usage:
  python3 n8n/inspect_executions.py --since "2026-09-30 11:00" --until "2026-09-30 13:00"
  python3 n8n/inspect_executions.py --ids 8109 8116
"""

from __future__ import annotations

import argparse
import json
import subprocess

WORKFLOW_ID = "WIULGDZMvW2e7p25"
DB_CONTAINER = "n8n-db"


def psql(sql: str) -> str:
    return subprocess.check_output(
        ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "n8n", "-d", "n8n", "-At", "-c", sql],
        text=True,
    ).strip()


def load_run(execution_id: str) -> tuple[dict, str | None]:
    raw = psql(f'SELECT data FROM execution_data WHERE "executionId"={execution_id};')
    if not raw:
        return {}, None
    flat = json.loads(raw)

    def resolve_index(index: int, seen=()):
        value = flat[index]
        if index in seen:
            return None
        if isinstance(value, dict):
            return {k: resolve_ref(v, seen + (index,)) for k, v in value.items()}
        if isinstance(value, list):
            return [resolve_ref(v, seen + (index,)) for v in value]
        return value

    def resolve_ref(value, seen):
        if isinstance(value, str) and value.isdigit() and int(value) < len(flat):
            return resolve_index(int(value), seen)
        return value

    root = resolve_index(0)
    result = root.get("resultData", {})
    error = result.get("error")
    error_text = None
    if error:
        error_text = f"{error.get('message')} @ {error.get('node', {}).get('name') if isinstance(error.get('node'), dict) else error.get('node')}"
    return result.get("runData", {}), error_text


def first_json(run: dict, node: str) -> dict:
    try:
        items = (run[node][0].get("data") or {}).get("main") or [[]]
        return (items[0] or [{}])[0].get("json", {})
    except (KeyError, IndexError, TypeError):
        return {}


def node_error(run: dict, node: str) -> str | None:
    try:
        err = run[node][0].get("error")
    except (KeyError, IndexError):
        return None
    if not err:
        return None
    return err.get("message") if isinstance(err, dict) else str(err)


def describe(execution_id: str) -> dict | None:
    run, error_text = load_run(execution_id)
    if not run or "Parse WhatsApp Payload" not in run:
        return None
    parsed = first_json(run, "Parse WhatsApp Payload")
    if not parsed.get("isMessage"):
        return None
    parse_master = first_json(run, "Parse Master Output")
    final = first_json(run, "Build Final Reply")
    sent = first_json(run, "Send WhatsApp Reply")
    backend = parse_master.get("backendResult") or {}
    errors = {name: node_error(run, name) for name in run if node_error(run, name)}
    return {
        "id": execution_id,
        "phone": parsed.get("phone"),
        "type": parsed.get("inputType"),
        "text": parsed.get("messageText"),
        "ai_output": str(first_json(run, "🧠 LLBox MASTER AI AGENT").get("output", ""))[:300],
        "backend_outcome": (backend.get("data") or {}).get("outcome") if isinstance(backend, dict) else None,
        "reply": final.get("finalReply") or parse_master.get("reply"),
        "sent": sent.get("messages") or sent.get("error"),
        "last_node": list(run.keys())[-1],
        "workflow_error": error_text,
        "node_errors": errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--since")
    parser.add_argument("--until")
    parser.add_argument("--ids", nargs="*")
    args = parser.parse_args()

    if args.ids:
        ids = args.ids
    else:
        ids = psql(
            f"SELECT id FROM execution_entity WHERE \"workflowId\"='{WORKFLOW_ID}' "
            f"AND \"startedAt\" BETWEEN '{args.since}+00' AND '{args.until}+00' ORDER BY id;"
        ).split("\n")

    for execution_id in filter(None, ids):
        info = describe(execution_id)
        if not info:
            continue
        print(json.dumps(info, ensure_ascii=False))


if __name__ == "__main__":
    main()
