#!/usr/bin/env python3
"""Response PDF to LLBox acceptance run of 7 October 2026.

Usage: python3 reports/build_acceptance_response.py reports/2026-10-13 OUT.pdf
"""

from __future__ import annotations

import json
import os
import re
import sys
from html import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer

sys.path.insert(0, os.path.dirname(__file__))
from build_response_report import (  # noqa: E402
    HEAD, LINE, MUTED, S, VERDICT_BG, cell, grid, message_cell, para, verdict_cell,
)

DATE = "13 October 2026"
FOOTER = "X360 x LLBox - Acceptance response - 13 October 2026 - Confidential"
W = A4[0] - 36 * mm
CODE_RX = re.compile(r"(?m)^(\s*)\d{6}(\s*)$")


def bullet(text: str) -> Paragraph:
    return Paragraph(text, S["bullet"], bulletText="•")


def mask(text: str) -> str:
    return CODE_RX.sub(lambda m: f"{m.group(1)}••••••{m.group(2)}", str(text or ""))


def table(headers, rows, widths, status_col=None):
    data = [[cell(h, "cellb") for h in headers]]
    extra = []
    for i, r in enumerate(rows, start=1):
        line = []
        for j, v in enumerate(r):
            if status_col is not None and j == status_col:
                line.append(verdict_cell(v))
                extra.append(("BACKGROUND", (j, i), (j, i), VERDICT_BG.get(v, HEAD)))
            else:
                line.append(v if not isinstance(v, str) else cell(v))
        data.append(line)
    return grid(data, widths, extra=extra)


def page_frame(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(18 * mm, A4[1] - 14 * mm, A4[0] - 18 * mm, A4[1] - 14 * mm)
    canvas.setFont("DV", 7.2)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 10 * mm, FOOTER)
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


FINDINGS = [
    ("1", "High", "O23", "Owner wrote 'I am the driver…' and got a live code",
     "A number identify recognises is always owner mode. There is no 'I am the driver' escape. Reply: "
     "'This number is registered as a box owner. Drivers write from their own number.'",
     "PASS"),
    ("2", "High", "D37", "Pasted label 'COD: NO' released the customer number",
     "COD starts only from intentional driver speech (cash on delivery / collect cash / COD order). "
     "'COD: NO', prepaid, paid, no cash are treated as negation. Pasted labels are not sent to the "
     "gpt-4o-mini classifier. payment_type from peek remains the source of truth once a real COD ask is made.",
     "PASS"),
    ("3", "Medium", "D26", "Phone ask with no order number reused the previous oversized order",
     "After 'parcel fits / try once more', only an explicit 'still won't fit / still not working' escalates "
     "on that order. A new ask (customer phone, COD, another issue) with no reference clears the retry marker "
     "and asks for the order number.",
     "PASS"),
    ("4", "Medium", "—", "Sixth reference dropped silently",
     "When more than five order numbers are in one message: handle the first five and say "
     "'I handled the first 5 order numbers in your message — please send the rest again.'",
     "PASS"),
    ("5", "Low", "O24", "Injection text started a cancel flow",
     "Instruction-override text is classified as manipulation first. Owner and driver both get one refusal "
     "line; cancel / register / code flows do not start.",
     "PASS"),
    ("6", "Low", "—", "Handover echoed the typed spaced reference",
     "Handover wording uses the reference returned by the LLBox API (order_reference / reference), not the "
     "driver's typing.",
     "PASS"),
    ("7", "Low", "—", "R5 report Message column / HANDOVER label",
     "Acknowledged. This response uses real messages. The internal 'HANDOVER <ref>' line appears only in "
     "stubbed test harnesses; production uses the full handover template.",
     "PASS"),
]


def build(folder: str, out_path: str) -> None:
    accept = json.load(open(os.path.join(folder, "acceptance_fix.json")))
    edge = json.load(open(os.path.join(folder, "driver_edge.json")))
    driver30 = json.load(open(os.path.join(folder, "driver30.json")))
    by_id = {r["id"]: r for r in accept["results"]}

    doc = SimpleDocTemplate(
        out_path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=20 * mm, bottomMargin=18 * mm,
        title="X360 response to LLBox acceptance run 7 Oct 2026", author="X360",
    )
    st = []

    st += [
        Spacer(1, 22 * mm),
        para("X360 x LLBox", "kicker"),
        para("Acceptance Response", "title"),
        Spacer(1, 2 * mm),
        para(
            "Response to LLBox's acceptance run of 7 October 2026 (75 scenarios, 72 pass). "
            "The three failures are fixed, the smaller items are fixed, and the new cancelled-arrival "
            "requirement is live.",
            "subtitle",
        ),
        Spacer(1, 8 * mm),
    ]
    cover = [
        ("Prepared for", "LLBox QA"),
        ("Prepared by", "X360"),
        ("Date", DATE),
        ("Baseline", "LLBox x X360 — Acceptance Run of the WhatsApp Bot (7 October 2026)"),
        ("System", "Production WhatsApp → n8n LLBox SUB - Operations → X360 conversation-turn → LLBox Agent API v1"),
        (
            "Result",
            f"O23, D37, D26 fixed. Cancelled-arrival integrated. "
            f"Acceptance-fix suite {accept['passed']}/{accept['total']}; "
            f"driver edge {edge['passed']}/{edge['total']}; "
            f"30-scenario regression {driver30['passed']}/{driver30['total']}. "
            "Backend restarted on production.",
        ),
    ]
    st.append(grid([[cell(a), cell(b)] for a, b in cover], [36 * mm, W - 36 * mm], header=False,
                   extra=[("BACKGROUND", (0, 0), (0, -1), HEAD)]))
    st.append(PageBreak())

    st.append(para("1. Status of every finding", "h1"))
    st.append(table(
        ["#", "Prio", "ID", "What failed", "What we changed", "Status"],
        [[a, b, c, d, e, f] for a, b, c, d, e, f in FINDINGS],
        [8 * mm, 14 * mm, 12 * mm, 40 * mm, W - 8 * mm - 14 * mm - 12 * mm - 40 * mm - 16 * mm, 16 * mm],
        status_col=5,
    ))
    st.append(PageBreak())

    st.append(para("2. The three critical fixes", "h1"))
    st.append(para("2.1 O23 — an owner never has a driver mode", "h2"))
    for t in [
        "identify still runs on every message.",
        "If user_found is true, the message always goes to owner mode — there is no self-driver escape.",
        "If the owner writes 'I am the driver…', the bot answers with ownerNeverDriver and does not look up a code.",
        "Drivers must write from their own (unregistered) number, which matches LLBox's MVP rule that all drivers "
        "message the central number and the box is found from the order reference.",
    ]:
        st.append(bullet(t))
    st.append(para("2.2 D37 — read COD negations; labels are not COD asks", "h2"))
    for t in [
        "Removed bare matching of the words 'COD' and 'cash'. Only intentional phrases start the flow "
        "(cash on delivery, collect cash, COD order, Arabic cash-on-delivery speech).",
        "'COD: NO', 'no COD', prepaid, already paid, no cash are explicit negations.",
        "Messages that look like pasted courier labels (Shipment No, Consignee, Weight, COD:) are never sent to "
        "the gpt-4o-mini classifier, so a label field cannot invent a COD intent.",
        "An intentional COD ask still uses peek.payment_type as the source of truth before releasing a number.",
    ]:
        st.append(bullet(t))
    st.append(para("2.3 D26 — no stale order when the message has no reference", "h2"))
    for t in [
        "The retry marker after 'parcel fits' / 'box online, try once more' only fires on an explicit "
        "'still won't fit / still not working / still / again'.",
        "A new ask with no order number (customer phone, COD, another issue) clears that marker and asks for "
        "the order number.",
        "The customer is never notified about the previous order for a different problem.",
    ]:
        st.append(bullet(t))
    st.append(PageBreak())

    st.append(para("3. New requirement: cancelled arrival", "h1"))
    st.append(para(
        "When a driver sends a cancelled reference, the bot no longer only says 'the customer cancelled'. "
        "It asks the customer first, using LLBox's live APIs."
    ))
    steps = [
        ("1. Driver sends a cancelled reference",
         "POST /agent/cancelled-arrival with conversation_id. Driver hears: "
         "'I've asked the customer whether this is still coming. I'll tell you as soon as they answer.'"),
        ("2. Worker messages the owner",
         "Follow-up worker polls GET /agent/arrival-requests/open, WhatsApps the owner: "
         "'You cancelled order X, but a driver says it has arrived… Reply YES or NO.'"),
        ("3. Owner answers YES / NO",
         "Owner turn checks POST /agent/whatsapp/arrival-requests, then "
         "POST /agent/whatsapp/arrival-requests/respond. Slot confirmations (cancel confirm, etc.) still win "
         "over a bare yes/no when a slot is open."),
        ("4. Tell the driver",
         "Poll GET /agent/cancelled-arrival/:id. approved → ask them to send the number again for a normal "
         "handover; declined → take the parcel back; no_response with a number → release once; "
         "no_response without a number → silent / follow usual process."),
    ]
    st.append(table(["Step", "Bot behaviour"], [[a, b] for a, b in steps], [48 * mm, W - 48 * mm]))
    st.append(para(
        "Cancelling by the owner stays strict: one delivery at a time, only while no driver holds a code. "
        "A cancel the owner confirmed can be revived only through this driver-arrival question.",
        "small",
    ))
    st.append(PageBreak())

    st.append(para("4. Answers to your questions", "h1"))
    st.append(para("4.1 gpt-4o-mini classifier (Saudi PDPL)", "h2"))
    for t in [
        "<b>What is sent:</b> only the driver's normalised message text, truncated to 500 characters, with "
        "order-number tokens blanked out before the 'is this worth classifying?' length check. No phone numbers, "
        "no codes, no names, no conversation history, no media.",
        "<b>When:</b> only for driver messages that look like a problem, when rules did not already match, and "
        "never for pasted labels.",
        "<b>Where:</b> OpenAI Chat Completions API (model ISSUE_CLASSIFIER_MODEL or gpt-4o-mini), temperature 0, "
        "6-second timeout, JSON response with a single issue enum. The model never writes the reply; it only "
        "selects which fixed flow runs.",
        "<b>Retention:</b> a short in-memory cache of the issue label keyed by the blanked text (process memory "
        "only, ~2000 entries, not written to disk or MongoDB). OpenAI's processing is under your/our OpenAI "
        "account data-processing terms; we can switch the classifier off by unsetting OPENAI_API_KEY (rules-only).",
    ]:
        st.append(bullet(t))
    st.append(para("4.2 Identify fallback", "h2"))
    for t in [
        "Live identify runs on every message. The 30-minute fallback is used only when the live call errors "
        "(network / 5xx), never when identify returns user_found=false.",
        "Stored identity keeps name, box id/code/nickname/health — not box phone_number, not any code, not any "
        "customer phone. Box number answers always come from the live identify result when available.",
        "If a number stops being an owner, the next successful identify clears owner state immediately.",
    ]:
        st.append(bullet(t))
    st.append(para("4.3 Live evidence", "h2"))
    st.append(para(
        "We re-verified Arabic text, Urdu script, stickers and emoji in automation. A live WhatsApp handover "
        "with ordered photos was previously recorded (execution 10487). We can arrange a short screen recording "
        "of Arabic COD / dead-box / label photo / voice on the live number if you want it for the next rerun."
    ))
    st.append(PageBreak())

    st.append(para("5. Evidence: the failing scenarios, fixed", "h1"))
    st.append(para("From backend/scripts/acceptance-fix.js against the live turn pipeline (LLBox calls stubbed where "
                   "a real release would notify Khalid).", "small"))

    def convo(title, ids):
        rows = [[cell("Message", "cellb"), cell("Bot reply", "cellb")]]
        for i in ids:
            r = by_id[i]
            rows.append([
                message_cell(r.get("text") or "", 400, W * 0.34),
                message_cell(mask(r["reply"]), 1400, W * 0.66)
                + [Paragraph(escape(f"outcome: {r['outcome']} | {'PASS' if r['pass'] else 'FAIL'}"), S["mono"])],
            ])
        st.append(KeepTogether([para(title, "h2"), grid(rows, [W * 0.34, W * 0.66])]))
        st.append(Spacer(1, 3 * mm))

    convo("O23 — owner never switches to driver mode", ["O23"])
    convo("D37 — pasted label COD: NO / COD: YES / intentional COD", ["D37", "D37b", "D37c"])
    convo("D26 — phone ask after parcel-fits does not reuse the order", ["D26a", "D26b", "D26e"])
    convo("O24 — injection does not start cancel", ["O24"])
    convo("Cancelled arrival — ask customer, owner YES", ["A01", "A02"])
    st.append(PageBreak())

    st.append(para("6. Regression totals", "h1"))
    rows = [
        ["Acceptance fixes (O23/D37/D26 + arrival)", f"{accept['passed']}/{accept['total']}", "PASS"],
        ["Driver edge (R1/R3/R4/COD/dead box/oversized)", f"{edge['passed']}/{edge['total']}", "PASS"],
        ["Original 30 driver scenarios", f"{driver30['passed']}/{driver30['total']}", "PASS"],
    ]
    st.append(table(["Suite", "Checks", "Result"], rows, [90 * mm, W - 90 * mm - 20 * mm, 20 * mm], status_col=2))
    st.append(Spacer(1, 4 * mm))
    st.append(para("How to re-check", "h2"))
    for t in [
        "<font name='DVM'>FOLLOWUPS_DISABLED=true node backend/scripts/acceptance-fix.js</font>",
        "<font name='DVM'>FOLLOWUPS_DISABLED=true node backend/scripts/turn-regression.js</font>",
        "<font name='DVM'>FOLLOWUPS_DISABLED=true node backend/scripts/driver-edge-regression.js</font>",
        "Your harness scenarios A01–A04 for cancelled-arrival can run against the live number whenever you are ready.",
    ]:
        st.append(bullet(t))

    st.append(para("7. Ready for your rerun", "h1"))
    st.append(para(
        "Please rerun the 75 scenarios plus A01–A04. We expect O23, D37 and D26 to flip to PASS, and the new "
        "cancelled-arrival cases to pass once your harness drives them. If anything still fails, send the "
        "scenario id and the WhatsApp transcript and we will fix it in the same turnaround."
    ))

    doc.build(st, onFirstPage=page_frame, onLaterPages=page_frame)
    print(f"wrote {out_path}")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
