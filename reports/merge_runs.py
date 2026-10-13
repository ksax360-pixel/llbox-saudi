#!/usr/bin/env python3
"""Merge the full live run with targeted re-runs; keep each scenario's first-pass result.

Usage: python3 reports/merge_runs.py reports/live_run_1.json reports/live_run_2.json > reports/live_final.json
"""

import json
import re
import sys

CODE_RX = re.compile(r"(^|\n)\s*\*?\d{6}\*?\s*(\n|$)")
AR_RX = re.compile(r"[\u0600-\u06FF]")


def main() -> None:
    first = json.load(open(sys.argv[1]))
    reruns = [json.load(open(p)) for p in sys.argv[2:]]
    replaced = {}
    for run in reruns:
        for sc in run["scenarios"]:
            if sc["part"] != "setup":
                replaced[sc["id"]] = sc

    final = []
    for sc in first["scenarios"]:
        sc = dict(sc)
        sc["first_pass"] = sc["auto_pass"]
        if sc["id"] in replaced:
            new = replaced[sc["id"]]
            sc["first_results"] = sc["results"]
            sc["results"] = new["results"]
            sc["auto_pass"] = new["auto_pass"]
            sc["retested"] = True
        final.append(sc)

    steps = [r for s in final for r in s["results"]]
    driver = [r for r in steps if r["phone"] == "919606742371"]
    replay = [r for s in final for r in s["results"]
              if CODE_RX.search(r.get("reply", "")) and r.get("outcome") not in ("handover", "stuck_notified", "stuck_not_notified")]
    repeat_steps = [r for s in final for r in s["results"]
                    if r.get("outcome") in ("code_already_sent_here", "already_matched")]
    replay_on_repeat = [r for r in repeat_steps if CODE_RX.search(r.get("reply", ""))]
    silent = [r for r in driver if r.get("outcome") != "suppressed" and not (r.get("reply", "").strip() and r.get("sent_ok"))]
    stuck = [r for r in steps if str(r.get("outcome", "")).startswith("stuck_") and r.get("outcome") != "stuck_needs_reference"]
    stuck_one = [r for r in stuck if len(r["notify"]) == 1]
    dup = [r for r in steps if r.get("dup_replies") is not None]

    metrics = {
        "messages": len(steps),
        "driver_messages": len(driver),
        "replays": len(replay) + len(replay_on_repeat),
        "repeat_requests": len(repeat_steps),
        "silent": len(silent),
        "stuck_with_ref": len(stuck),
        "stuck_exactly_one_notify": len(stuck_one),
        "dup_tests": len(dup),
        "dup_single_reply": sum(1 for r in dup if r["dup_replies"] == 1),
        "photos_sent": sum(r.get("photos_sent", 0) for r in steps),
        "handovers": sum(1 for r in steps if r.get("outcome") == "handover" or (r.get("outcome", "").startswith("stuck") and CODE_RX.search(r.get("reply", "")))),
        "notify_calls": sum(len(r["notify"]) for r in steps),
        "notified_true": sum(1 for r in steps for c in r["notify"] if c["notified"] == "true"),
    }
    json.dump({**first, "scenarios": final, "metrics": metrics}, sys.stdout, ensure_ascii=False, indent=1)
    print(json.dumps(metrics, indent=1), file=sys.stderr)


if __name__ == "__main__":
    main()
