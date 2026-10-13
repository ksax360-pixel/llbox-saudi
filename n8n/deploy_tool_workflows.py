#!/usr/bin/env python3
"""Publish and activate n8n tool sub-workflows used by LLBox Operations."""

from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_CONTAINER = "n8n-db"

TOOL_WORKFLOWS = [
    ("3QeVRcMBVUG5Y2IO", ROOT / "tools" / "LLBox_Tool_Delivery_Access.json"),
    ("39nwg8w1FMJMkf8r", ROOT / "tools" / "LLBox_Tool_Support.json"),
]


def sync_workflow(workflow_id: str, source: Path) -> str:
    data = json.loads(source.read_text(encoding="utf-8"))
    workflow = data[0] if isinstance(data, list) else data
    version_id = str(uuid.uuid4())
    nodes_json = json.dumps(workflow["nodes"], ensure_ascii=False)
    connections_json = json.dumps(workflow["connections"], ensure_ascii=False)
    name = workflow["name"].replace("'", "''")
    settings_json = json.dumps(workflow.get("settings") or {"executionOrder": "v1"}, ensure_ascii=False)

    sql = f"""
BEGIN;
INSERT INTO workflow_history
  ("versionId", "workflowId", authors, "createdAt", "updatedAt", nodes,
   connections, name, autosaved, description)
VALUES
  ('{version_id}', '{workflow_id}', 'system', NOW(), NOW(),
   $n8n_nodes${nodes_json}$n8n_nodes$::json,
   $n8n_connections${connections_json}$n8n_connections$::json,
   '{name}', FALSE, '');
UPDATE workflow_entity
SET nodes = $n8n_nodes${nodes_json}$n8n_nodes$::json,
    connections = $n8n_connections${connections_json}$n8n_connections$::json,
    settings = $n8n_settings${settings_json}$n8n_settings$::json,
    "versionId" = '{version_id}',
    "activeVersionId" = '{version_id}',
    active = TRUE,
    "updatedAt" = NOW(),
    "versionCounter" = COALESCE("versionCounter", 0) + 1
WHERE id = '{workflow_id}';
COMMIT;
SELECT id, name, active, "activeVersionId" FROM workflow_entity WHERE id = '{workflow_id}';
"""
    out = subprocess.run(
        ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "n8n", "-d", "n8n"],
        input=sql,
        text=True,
        check=True,
        capture_output=True,
    )
    print(out.stdout.strip())
    return version_id


def main() -> None:
    for workflow_id, source in TOOL_WORKFLOWS:
        if not source.exists():
            raise FileNotFoundError(source)
        version_id = sync_workflow(workflow_id, source)
        subprocess.run(
            [
                "docker",
                "exec",
                "n8n",
                "n8n",
                "publish:workflow",
                f"--id={workflow_id}",
                f"--versionId={version_id}",
            ],
            check=False,
        )


if __name__ == "__main__":
    main()
