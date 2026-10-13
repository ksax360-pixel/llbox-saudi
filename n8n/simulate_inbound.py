#!/usr/bin/env python3
"""Post Meta-format WhatsApp text webhooks to the live n8n workflow (replies go to the real number).

Usage: python3 n8n/simulate_inbound.py 919606742371 "Hi" "box is full" ...
       python3 n8n/simulate_inbound.py --twice 919606742371 "SAFE-IMG-1789792772"
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

WEBHOOK = "http://127.0.0.1:5678/webhook/llbox-whatsapp"
PHONE_NUMBER_ID = "1332077953313446"


def payload(phone: str, text: str) -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "1368422184385661",
            "changes": [{
                "field": "messages",
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {"display_phone_number": "15077107553", "phone_number_id": PHONE_NUMBER_ID},
                    "contacts": [{"profile": {"name": "X360 QA"}, "wa_id": phone}],
                    "messages": [{
                        "from": phone,
                        "id": f"wamid.SIM{uuid.uuid4().hex}",
                        "timestamp": str(int(time.time())),
                        "type": "text",
                        "text": {"body": text},
                    }],
                },
            }],
        }],
    }


def post(phone: str, text: str) -> int:
    req = urllib.request.Request(
        WEBHOOK,
        data=json.dumps(payload(phone, text)).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status


def main() -> None:
    args = sys.argv[1:]
    twice = args and args[0] == "--twice"
    if twice:
        args = args[1:]
    phone, texts = args[0], args[1:]
    for text in texts:
        if twice:
            with ThreadPoolExecutor(2) as pool:
                print(text, list(pool.map(lambda _: post(phone, text), range(2))))
        else:
            print(text, post(phone, text))
        time.sleep(9)


if __name__ == "__main__":
    main()
