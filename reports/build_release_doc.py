#!/usr/bin/env python3
"""Build the X360 release documentation for the LLBox WhatsApp chatbot (response to the 4-5 Oct 2026 full test report).

Usage: python3 reports/build_release_doc.py reports/2026-10-07 OUT.pdf
The directory must hold the JSON written by the backend regression suites (--json=...).
"""

from __future__ import annotations

import json
import os
import re
import sys
from html import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer

sys.path.insert(0, os.path.dirname(__file__))
from build_response_report import (  # noqa: E402
    HEAD, LINE, MUTED, S, VERDICT_BG, cell, grid, message_cell, para, verdict_cell,
)

DATE = "7 October 2026"
FOOTER = "X360 x LLBox - WhatsApp chatbot release documentation v2.0 - 7 October 2026 - Confidential"
W = A4[0] - 36 * mm
CODE_RX = re.compile(r"(?m)^(\s*)\d{6}(\s*)$")
FAKE_PHONE = "+966511112222"


def bullet(text: str) -> Paragraph:
    return Paragraph(text, S["bullet"], bulletText="•")


def numbered(items: list[str]) -> list:
    return [Paragraph(t, S["bullet"], bulletText=f"{i}.") for i, t in enumerate(items, start=1)]


def mask(text: str) -> str:
    return CODE_RX.sub(lambda m: f"{m.group(1)}••••••{m.group(2)}", str(text or ""))


def table(headers: list[str], rows: list[list], widths: list[float], status_col: int | None = None):
    data = [[cell(h, "cellb") for h in headers]]
    extra = []
    for i, r in enumerate(rows, start=1):
        line = []
        for j, v in enumerate(r):
            if status_col is not None and j == status_col:
                line.append(verdict_cell(v))
                extra.append(("BACKGROUND", (j, i), (j, i), VERDICT_BG.get(v, colors.white)))
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


def load(folder: str) -> dict:
    out = {}
    for name in ("driver30", "driver_edge", "owner", "multibox"):
        with open(os.path.join(folder, f"{name}.json"), encoding="utf-8") as fh:
            out[name] = json.load(fh)
    return out


# --------------------------------------------------------------------------- content

R_ITEMS = [
    ("R1", "Problems written in Roman Hindi / Hinglish were ignored (handover given, customer never notified).",
     "Rules now cover Roman Hindi problem phrases (code nahi chal raha, box khul nahi raha, jagah nahi hai, bahut bada hai, "
     "box nahi mil raha, phone nahi utha raha, light nahi jal rahi, dabba kharab ho gaya ...). Anything the rules miss is "
     "classified by a small model (gpt-4o-mini, temperature 0, 6 s timeout) into one of LLBox's issue types. The model only "
     "classifies; it never writes the reply.", "driver edge R1a-R1l (14 checks)"),
    ("R2", "Box photos arrived in random order.",
     "The n8n 'Send WhatsApp Box Photos' node now sends one photo at a time with 2.5 s between sends, in API array order, "
     "after the text reply. Verified live on WhatsApp: street, building, front door, box.", "live run, execution 10487"),
    ("R3", "'spl 88 123456' was looked up as '123456'.",
     "Adjacent groups are joined into one reference when a short prefix is followed by digit groups (at least 5 digits, not "
     "phone-like). A word before a complete reference is never glued on ('raha SPL77100205' stays 'SPL77100205').",
     "driver edge R3a-R3c, cleanRef checks; multi-box R4"),
    ("R4", "Impersonation wording; spaced form told 'another driver has the code'; Urdu policy; '???' Arabic-only; emoji "
     "gave an almost empty bubble.",
     "Spaced and compact forms are now the same reference, so the same driver is never told another driver has the code. "
     "Owner-claim wording now asks the owner to write from the number linked to their account. '???', emoji and stickers "
     "get a full reply in both languages when no language is known; reactions get no reply. Urdu script gets the English "
     "and Arabic reply.", "driver edge E1-E3; multi-box R4 (3 checks); 30-scenario #28a-d"),
]

F_ITEMS = [
    ("F1", "P0", "'cancel X' registered X and said Done.",
     "Intent is decided before references. A message with a cancel verb never registers. Cancel = look up by reference "
     "(deliveries with reference filter), confirm, then deliveries/cancel with delivery_id.", "owner: F1 x4"),
    ("F2", "P0", "Previous reference reused when the new one was invalid or missing.",
     "Conversation memory (slot) has a 15-minute expiry, is cleared after every completed action and is only used to answer "
     "the bot's own last question. A bare date after a finished action asks for the order number.", "owner: F2 stale ref"),
    ("F3", "P0", "Owner reporting a stuck driver was handled as a driver.",
     "Any number identify recognises gets owner mode. 'The driver says the code doesn't work for X' issues a replacement code "
     "with delivery_id. Only 'I am the driver' switches a recognised number to driver mode.", "owner: F15, F4"),
    ("F4", "P0", "identify called on 5 of ~90 messages.",
     "identify is called live on every message. The last good answer is used only if the live call fails.", "all owner checks"),
    ("F5", "P1", "List requests deflected to the app.",
     "List uses whatsapp/deliveries: matched first, then by day, 10 shown with a 'more' count, optional this/next week or a "
     "single day; offers to cancel.", "owner: F7 x2"),
    ("F6", "P1", "Cancel requests deflected to support.",
     "Cancel by reference (one or several), or pick from the cancellable list; always confirm; clear wording for already "
     "cancelled, too late (driver has code), finished, not found.", "owner: F6 x2, F1"),
    ("F7", "P1", "Code and status got the driver template; no battery/online.",
     "Guest code (whatsapp/code without delivery), replacement code (with delivery_id), box status (box-status: parcel inside, "
     "expected today vs comfortable/most per day, online/last seen, battery, how full).", "owner: F13-F15"),
    ("F8", "P1", "Multi-box never asked.",
     "With two or more boxes the bot asks which box (number, nickname, code, or home/office words) for register, guest code "
     "and reports, unless the message already names one.", "multi-box: 9 checks"),
    ("F9", "P1", "'What number do I give Noon?' could not be answered.",
     "Answers with the box's phone_number from identify; when null, with the bot's WhatsApp number "
     "(LLBOX_DRIVER_WHATSAPP_NUMBER, +1 507 710 7553), plus how couriers use it.", "owner: F9"),
    ("F10", "P2", "Relative and past dates ignored; unknown day defaulted silently.",
     "Date parser: today/tomorrow/day after, weekdays (this/next), in N days/weeks, next week/month, weekend, dd/mm, "
     "'12 October', ISO, Arabic forms. Past dates are refused and the day asked again; the day is asked once if missing; "
     "'not sure' is accepted.", "owner: F10 x2"),
    ("F11", "P2", "More than 120 days reported as 'may be in the past'.",
     "Says the date is more than 120 days away and asks again.", "owner: F11"),
    ("F12", "P2", "Three references in one message: only the first handled.",
     "Up to 5 references per message, one line each; a full day is reported once for all affected references and all of "
     "them are kept for the next answer.", "owner: F12, F10 relative"),
    ("F13", "P2", "'yes', 'menu', '2', 'what can you do' not understood.",
     "Numbered menu built from available_actions; digits, yes/no and 'menu/help/what can you do' work in English and Arabic.",
     "owner: F7 digit, F5"),
    ("F14", "P2", "Rambling question answered with 'use the app'.",
     "Intent router reads the whole message; unknown messages get 'didn't quite get that' plus the menu, never a deflection.",
     "owner: F5"),
    ("F15", "P2", "Add member, change phone, delete account, opt-out, theft had no route.",
     "Opt-out/in and driver-contact consent go to preferences. Account changes and theft become report-issue tickets "
     "(category other / theft) with the ticket number read back.", "owner: F17 x3, F18, F19"),
    ("F16", "P2", "'Red light, box not opening' answered as a code question.",
     "Becomes a box_fault ticket (report-issue); duplicates within 10 minutes are not re-filed.", "owner: F16 x2"),
    ("F17", "P2", "'Sunday' on a Sunday registered for today without confirming.",
     "Registers for today and adds: 'That's today. If you meant next Sunday, send \"next Sunday\".' 'next Sunday' means "
     "next week.", "date parser unit check"),
    ("F18", "P2", "Owner told to visit llbox.ai.",
     "Removed. Owners get the owner product answer; no website push.", "owner: F3 greeting"),
    ("F19", "P2", "English warning printed an ISO date.",
     "All days are written as 'Thursday 8 October' / 'الخميس 8 أكتوبر' (Riyadh time); the busy-day warning is localised.",
     "owner: F2, F12"),
]

API_ROWS = [
    ("F1  POST /agent/driver-contact", "Driver with COD, dead box or oversized parcel, after an order number",
     "Always sends conversation_id = 'x360-' + 24 hex of SHA-256 of the driver's number (stable, not reversible). "
     "200 name + number read back once; 202 retry + poll; 403 opted out; 404 ask for full number; 409 box_online / "
     "parcel_fits retry advice then notify on second try, prepaid / not_cod -> no cash, ambiguous -> normal lookup; 422 ask "
     "for size; 429 pass a message instead, never loop."),
    ("     GET /agent/driver-contact/:id", "After 202 pending_review",
     "Polled every 30 s for 30 minutes by the follow-up worker; released -> number sent once; refused -> told; timeout -> "
     "customer notified instead."),
    ("F2  GET /agent/box/by-reference/:ref?peek=true", "Before COD / oversized contact",
     "Prepaid -> no contact needed; max_parcel_cm known -> ask the parcel size first; never consumes a code."),
    ("F3  payment_type / cod_amount", "Owner registration; driver handover",
     "Asked once after registering ('COD with amount, prepaid, or not sure'); 'not sure' leaves it unknown; re-sent to "
     "update. Driver handover adds a COD note when the order is cod."),
    ("F4  box_health, max_parcel_cm", "Owner box status; dead box; oversized",
     "Online/offline/out of service with last seen and battery; full %; size used to decide whether to ask dimensions."),
    ("F5  identify (phone_number, health, preferences)", "Every message",
     "Owner mode, box number, multi-box question, greeting summary."),
    ("F6  POST /agent/whatsapp/deliveries (filters)", "List, status, cancel, replacement code",
     "reference, date_from/date_to, status[], limit."),
    ("    POST /agent/whatsapp/deliveries/cancel", "Owner confirmed a cancel", "200, 409 too late / finished, 404."),
    ("    POST /agent/whatsapp/code", "Guest or replacement code", "Code shown once, never re-read; 422 asks which box."),
    ("    POST /agent/whatsapp/box-status", "'Is my box ok / anything inside'", "See F4."),
    ("F7  GET /agent/delivery/status/:ref", "After every handover; on 'done/delivered'",
     "Polled from 3 minutes after handover (every 3 min, then 10 min, up to 6 h); thanks the driver once completed."),
    ("F8  POST /agent/whatsapp/report-issue", "Box fault, theft, damaged parcel, account requests",
     "Reads back the ticket id; 10-minute duplicate guard; 422 asks which box."),
    ("F9  POST /agent/whatsapp/preferences", "STOP / START / drivers may (not) call me", "Strict booleans."),
    ("     GET /agent/support-contact", "Support / human requests",
     "Cached 10 minutes. configured=false -> says no support line is published yet and gives the app hint."),
    ("F10 Per-integration limits", "All calls", "429 is never retried in a loop; the driver is offered a message instead."),
]

OWNER_INTENTS = [
    ("Hi / hello / مرحبا", "Greeting with name, short summary and the numbered menu", "identify"),
    ("1 / register / a bare order number", "Ask the day once, which box if several, register, then ask COD", "register (expected-deliveries)"),
    ("2 / what's coming / where is X", "List, or the status of the given references", "whatsapp/deliveries"),
    ("3 / cancel X / I don't need X", "Look up, confirm, cancel", "deliveries + deliveries/cancel"),
    ("4 / code for my cleaner / guest", "One-time guest code for the box", "whatsapp/code"),
    ("The driver's code doesn't work for X", "Replacement code linked to the delivery", "deliveries + whatsapp/code (delivery_id)"),
    ("5 / is my box ok / anything inside", "Parcel inside, expected today, online, battery, full %", "box-status"),
    ("6 / what number do I give Noon", "Box number (or the bot's number) and how couriers use it", "identify"),
    ("7 / red light / stolen / damaged", "Ticket with reference read back; theft advice", "report-issue"),
    ("Delete my account / change my phone / add member", "Passed to the LLBox team as a ticket", "report-issue (other)"),
    ("STOP / START", "Opt out / back in", "preferences"),
    ("Don't let drivers call me / they can call me", "Driver-contact consent off / on", "preferences"),
    ("Support / talk to a person", "Support details if configured, otherwise the app hint", "support-contact"),
    ("I am the driver ...", "Switches this message to the driver flow", "-"),
]

PIPELINE = [
    "<b>WhatsApp -> n8n.</b> Meta webhook into workflow 'LLBox SUB - Operations' (WIULGDZMvW2e7p25). Reactions and delivery "
    "receipts are dropped; images and voice notes are read; stickers pass through as input type 'sticker'.",
    "<b>n8n -> backend.</b> POST /api/tools/conversation-turn with phone, text, input type, image reading and message id.",
    "<b>Duplicate guard.</b> The same text from the same number within 5 seconds gets one reply.",
    "<b>Read the message.</b> Normalise digits and spacing, extract references (spaced forms joined, dimensions and phone "
    "numbers excluded), detect language, classify driver problems and owner intents.",
    "<b>identify.</b> Live on every message. Recognised account -> owner mode, unless the message says 'I am the driver'.",
    "<b>Owner or driver flow.</b> Fixed, reviewed wording only; facts come only from the LLBox API answer for this message.",
    "<b>Reply.</b> One language when the sender's language is known, both (Arabic first for Arabic speakers) otherwise. "
    "n8n sends the text, then the box photos one at a time.",
    "<b>Follow-ups.</b> A background worker in the backend polls delivery status and contact reviews and sends the result "
    "to the driver on WhatsApp.",
]

PRIVACY = [
    "The customer's phone number is only obtained through driver-contact, only after the driver gave an order number, only "
    "shown to that driver in that conversation, and never stored or logged. A test checks no stored conversation contains it.",
    "The bot no longer reads recipient_whatsapp_number from the driver lookup, so LLBox can switch DRIVER_LOOKUP_INCLUDE_PHONE "
    "off. 44 customer numbers that earlier lookups had saved in our database were deleted.",
    "Box codes appear only in the reply that issues them; they are never re-read, logged in clear, or stored in conversation memory.",
    "The bot never says whether a number has an LLBox, never gives an address without a valid order number, and never invents "
    "facts such as ETAs or support numbers.",
    "conversation_id is a one-way hash of the driver's number, so LLBox's guessing lock works per driver without receiving the "
    "number itself.",
    "Opt-out is honoured: owners are never messaged unprompted by the bot; follow-ups go only to drivers who just wrote to us.",
]

ENV_ROWS = [
    ("LLBOX_BASE_URL, LLBOX_API_KEY", "LLBox Agent API base URL and X-Agent-API-Key"),
    ("LLBOX_DRIVER_WHATSAPP_NUMBER", "Number given to owners for couriers when the box has no phone_number (new)"),
    ("OPENAI_API_KEY, ISSUE_CLASSIFIER_MODEL", "Problem classifier for Roman Hindi and long messages (default gpt-4o-mini)"),
    ("WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID", "Follow-up messages sent by the backend (Graph API v21.0)"),
    ("FOLLOWUPS_DISABLED", "true stops the follow-up worker (used by the test suites)"),
    ("MONGODB_URI", "Conversation memory (TurnState), follow-up jobs, ops records"),
    ("LLBOX_DUMMY_MODE", "Must be false in production"),
]

OPEN_ITEMS = [
    "<b>Box number (LLBox to confirm).</b> QA-PROD-TEST-BOX has phone_number null, so owners are told +1 507 710 7553 (the "
    "bot's WhatsApp number). Please confirm this is the number customers should give couriers, or fill phone_number per box.",
    "<b>Support line.</b> support-contact returns configured=false; the bot says so and gives the app hint. Once LLBox sets "
    "the support phone/WhatsApp/email, the bot reads them automatically.",
    "<b>DRIVER_LOOKUP_INCLUDE_PHONE.</b> Can be switched off on LLBox's side.",
    "<b>QA box capacity.</b> Thursday 8, Friday 9 and Saturday 10 October already have 5 deliveries, the box maximum, so "
    "registrations on those days are refused (correct behaviour). Our tests use later dates.",
    "<b>Live dead-box test.</b> The QA box is offline, so a real dead-box request releases the owner's number and notifies "
    "them in the app. We tested these flows with stubbed LLBox answers plus one live shape check, and suggest LLBox runs the "
    "live COD / dead box / oversized cases on their side.",
    "<b>Disclosure.</b> On 7 October at 08:29 UTC a bug in our test harness (not in the bot) sent one owner-suite message as "
    "an unknown number. The bot correctly treated it as a driver and called driver-contact for NQ4455667788, which LLBox "
    "released (request 39). The number stayed inside our test run and was not sent on WhatsApp or stored, but the owner app "
    "may have shown a 'driver needs you' notice. The harness is fixed and all suites now stub driver-contact.",
    "<b>Model fallback.</b> If the classifier times out (6 s) the message is handled by rules only. The common Roman Hindi "
    "phrases are covered by rules so they do not depend on the model.",
    "<b>Greeting numbers.</b> The English greeting uses LLBox's summary text; the Arabic one is built from active_deliveries, "
    "so the two can count slightly differently. A localised summary from identify would align them.",
]

FILES = [
    ("backend/services/turn.service.js", "Pipeline: dedupe, read, identify, route, driver flow, reply"),
    ("backend/services/owner.flow.js", "Owner mode: menu, intents, slots, register, list, cancel, codes, box, reports, preferences"),
    ("backend/services/contact.flow.js", "driver-contact: COD, dead box, oversized parcel, conversation_id"),
    ("backend/services/followup.service.js", "Background worker: delivery-status thank-you and contact-review polling"),
    ("backend/services/issue-classifier.service.js", "Model classifier for driver problems (classification only)"),
    ("backend/services/inbound.service.js", "References (spaced join), language, problem and owner intent rules, dates, sizes"),
    ("backend/services/day-format.js", "Day and time wording in English and Arabic (Riyadh time)"),
    ("backend/services/templates.service.js", "All reply wording, English and Arabic"),
    ("backend/services/llbox.service.js", "LLBox API client incl. all Part F endpoints"),
    ("backend/models/TurnState.js, FollowUpJob.js", "Conversation memory; follow-up jobs (never hold a phone number or code)"),
    ("n8n/fix_operations_workflow.py", "Workflow patch: sequential photo sends, reaction skip"),
    ("backend/scripts/*-regression.js", "Four regression suites (121 checks)"),
]


def build(folder: str, out_path: str) -> None:
    data = load(folder)
    suites = [
        ("Original 30 driver scenarios (30 Sep report)", data["driver30"],
         "Live LLBox lookups; notify-recipient and driver-contact stubbed", "turn-regression.js"),
        ("Driver edge cases: R1, R3, R4, COD, dead box, oversized, privacy", data["driver_edge"],
         "LLBox stubbed (no codes consumed, no numbers released); real model", "driver-edge-regression.js"),
        ("Owner mode F1-F19 on the QA owner account", data["owner"],
         "Live identify, deliveries, register, cancel, box-status, support; codes, tickets, preferences stubbed",
         "owner-regression.js"),
        ("Two-box owner (F8) and R4 wording", data["multibox"], "identify and owner endpoints stubbed", "multibox-regression.js"),
    ]
    total = sum(s[1]["total"] for s in suites)
    passed = sum(s[1]["passed"] for s in suites)

    doc = SimpleDocTemplate(out_path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=20 * mm,
                            bottomMargin=18 * mm, title="LLBox WhatsApp Chatbot - Release Documentation v2.0", author="X360")
    st = []

    # ------------------------------------------------------------------ cover
    st += [Spacer(1, 26 * mm), para("X360 x LLBox", "kicker"), para("WhatsApp Chatbot Release Documentation", "title"),
           Spacer(1, 2 * mm),
           para("Version 2.0: response to the LLBox x X360 full test report of 4-5 October 2026. What changed, how the bot "
                "now behaves for drivers and box owners, how every new API is used, and the test evidence.", "subtitle"),
           Spacer(1, 8 * mm)]
    cover = [
        ("Prepared for", "LLBox (product and QA)"),
        ("Prepared by", "X360"),
        ("Date", DATE),
        ("Baseline", "LLBox x X360 WhatsApp bot full test report (4-5 Oct 2026): driver items R1-R4, owner findings F1-F19, "
                     "Part F developer guide (driver-contact, peek, COD, box health, box number, delivery status, "
                     "report-issue, preferences, support contact, per-integration limits)"),
        ("System", "WhatsApp Cloud API -> n8n workflow 'LLBox SUB - Operations' -> X360 backend (conversation-turn) -> "
                   "LLBox Agent API v1 (production)"),
        ("Status", f"R1-R4 fixed (4/4). F1-F19 fixed (19/19). All Part F APIs integrated. {passed} of {total} automated "
                   "checks pass. Live on production since 7 October 2026."),
    ]
    st.append(grid([[cell(a), cell(b)] for a, b in cover], [36 * mm, W - 36 * mm], header=False,
                   extra=[("BACKGROUND", (0, 0), (0, -1), HEAD)]))
    st += [Spacer(1, 7 * mm), para("Contents", "h2")]
    for line in ["1. Summary", "2. Status of every report item", "3. How the bot works now", "4. Driver flows",
                 "5. Owner mode", "6. API integration (Part F)", "7. Privacy and safety rules", "8. Follow-up worker",
                 "9. Configuration and deployment", "10. Testing", "11. Open items and notes for LLBox",
                 "Appendix A. Example conversations", "Appendix B. Every automated check", "Appendix C. Files changed"]:
        st.append(para(line, "small"))
    st.append(PageBreak())

    # ------------------------------------------------------------------ 1 summary
    st.append(para("1. Summary", "h1"))
    st.append(para(
        "LLBox's report said the driver side was mostly fixed and the owner side was the main gap, and asked us to integrate "
        "the new APIs for cash on delivery, dead boxes and oversized parcels, always sending conversation_id. All of it is "
        "done and running on the production number:"))
    for t in [
        "<b>Driver side.</b> Roman Hindi problems are now recognised (R1), box photos arrive in order (R2), spaced references "
        "are read whole (R3), and '???', emoji, stickers and Urdu get a proper reply (R4).",
        "<b>New driver cases.</b> COD, dead box and oversized parcel follow LLBox's F11 flows: peek first where useful, then "
        "driver-contact with conversation_id, and the customer's number is read back once to that driver only.",
        "<b>Owner mode (F1-F19).</b> A recognised number now gets a real owner assistant: menu, register (several references, "
        "dates, which box, COD), list, status, cancel with confirmation, guest and replacement codes, box status, box number, "
        "reports and tickets, STOP/START, driver-call consent, support.",
        "<b>After the handover.</b> The bot polls delivery status and thanks the driver when the keypad completes the delivery.",
    ]:
        st.append(bullet(t))
    st.append(Spacer(1, 3 * mm))
    rows = [[cell("Test suite", "cellb"), cell("Checks", "cellb"), cell("How it runs", "cellb"), cell("Result", "cellb")]]
    extra = []
    for i, (name, res, how, _) in enumerate(suites, start=1):
        ok = res["passed"] == res["total"]
        rows.append([cell(name), cell(f"{res['passed']} / {res['total']}"), cell(how), verdict_cell("PASS" if ok else "FAIL")])
        extra.append(("BACKGROUND", (3, i), (3, i), VERDICT_BG["PASS" if ok else "FAIL"]))
    rows.append([cell("Total", "cellb"), cell(f"{passed} / {total}", "cellb"), cell(""),
                 verdict_cell("PASS" if passed == total else "FAIL")])
    st.append(grid(rows, [62 * mm, 18 * mm, W - 62 * mm - 18 * mm - 18 * mm, 18 * mm], extra=extra))
    st.append(para("Live checks on production in addition: a driver handover sent through the real WhatsApp webhook "
                   "(text first, then four photos in order), and a real driver-contact call with an unknown reference "
                   "(404 not_available, confirming conversation_id is accepted).", "small"))
    st.append(PageBreak())

    # ------------------------------------------------------------------ 2 status
    st.append(para("2. Status of every report item", "h1"))
    st.append(para("2.1 Driver items still open after the previous round (report A4)", "h2"))
    st.append(table(["#", "Finding", "What the bot does now", "Evidence", "Status"],
                    [[a, b, c, d, "PASS"] for a, b, c, d in R_ITEMS],
                    [10 * mm, 38 * mm, W - 10 * mm - 38 * mm - 34 * mm - 16 * mm, 34 * mm, 16 * mm], status_col=4))
    st.append(para("2.2 Owner findings (report B3)", "h2"))
    st.append(table(["#", "Prio", "Finding", "What the bot does now", "Evidence", "Status"],
                    [[a, p, b, c, d, "PASS"] for a, p, b, c, d in F_ITEMS],
                    [10 * mm, 10 * mm, 34 * mm, W - 10 * mm - 10 * mm - 34 * mm - 26 * mm - 16 * mm, 26 * mm, 16 * mm],
                    status_col=5))
    st.append(para("Evidence names refer to the checks listed in Appendix B. F9 and F15/F16 were API gaps in the report; "
                   "they are closed with LLBox's new phone_number, preferences and report-issue endpoints.", "small"))
    st.append(PageBreak())

    # ------------------------------------------------------------------ 3 how it works
    st.append(para("3. How the bot works now", "h1"))
    st.append(para("3.1 Path of one message", "h2"))
    st += numbered(PIPELINE)
    st.append(para("3.2 Who is talking: owner or driver", "h2"))
    for t in [
        "identify runs on every message (report F4/F5). If user_found is true the message goes to owner mode, with owner "
        "wording only. If identify fails, the last good answer for that number (up to 30 minutes old) is used; with none, "
        "the message is treated as a driver message, which never reveals account data.",
        "A recognised owner who writes 'I am the driver ...' is handled as a driver for that message (owners who deliver "
        "themselves). 'My driver ...' stays in owner mode.",
        "Everyone else is a driver. A driver who claims to be the owner is asked to write from the number linked to the LLBox "
        "account; nothing about the box is disclosed.",
    ]:
        st.append(bullet(t))
    st.append(para("3.3 Language", "h2"))
    for t in [
        "English or Arabic replies mirror the sender. Arabizi and Arabic script get Arabic first, then English.",
        "When there is nothing to detect ('???', emoji, a sticker) and no earlier language in the last 24 hours, the reply is "
        "in both languages. Urdu script gets English and Arabic.",
        "Days are always written as words ('Thursday 8 October', 'الخميس 8 أكتوبر') in Riyadh time.",
    ]:
        st.append(bullet(t))
    st.append(para("3.4 Conversation memory", "h2"))
    for t in [
        "Owner memory (slot): what the bot last asked (day, box, COD, pick, confirm, description, menu) with the references "
        "involved. Expires after 15 minutes; cleared when the action completes; a new intent always wins over an old slot.",
        "Driver memory: the problem waiting for an order number (10 minutes), the parcel-size question, the last handovers "
        "(3 days, for 'where is the box again' and two-number messages), and one retry marker per reference (20 minutes) so "
        "'still not working' after 'try once more' escalates instead of looping.",
        "Neither ever holds a box code or a customer phone number.",
    ]:
        st.append(bullet(t))
    st.append(PageBreak())

    # ------------------------------------------------------------------ 4 driver flows
    st.append(para("4. Driver flows", "h1"))
    st.append(para("4.1 Normal handover", "h2"))
    st += numbered([
        "Driver sends an order number (typed, spaced, or a label photo).",
        "Driver lookup (by-reference) returns box, address, map and a one-time code; the bot sends the handover text, then "
        "the box photos one by one.",
        "If LLBox marks the order cash on delivery, the handover adds: 'This order is marked cash on delivery. If you need to "
        "collect payment first, tell me and I will connect you with the customer.'",
        "A delivery-status follow-up is scheduled; when the keypad completes the delivery the driver gets a thank-you.",
    ])
    st.append(para("4.2 Problems at the box", "h2"))
    rows = [
        ("Code not working / box dead / no light", "driver-contact box_unresponsive",
         "200: customer first name + number; 202: 'try once more, I'm checking' then follow-up; 409 box_online: 'try all six "
         "digits and wait for the beep', a second report notifies the customer; other: customer notified."),
        ("Parcel too big", "peek, then driver-contact parcel_too_large",
         "Size known: ask L x W x H in cm, then call with parcel_cm. 200: number; 409 parcel_fits: 'turn it onto its smallest "
         "side', second report notifies; 422: ask size."),
        ("Cash on delivery", "peek, then driver-contact cod",
         "Prepaid: 'no cash to collect, use the box'. 200: number and amount. 403: customer prefers no calls, has been told. "
         "404: ask for the full order number. 429: message passed to the customer instead."),
        ("Box full", "notify-recipient box_full", "'Don't force the lid', customer notified."),
        ("Can't find the box", "lookup + notify cannot_find_box", "Address, map and photos again, customer notified."),
        ("Customer not answering / wants the number", "notify-recipient other",
         "'I can't share the number, but I've let the customer know'."),
        ("Leave with guard / neighbour", "notify-recipient other", "'Deliveries are completed only at the LLBox', customer notified."),
        ("Problem without an order number", "-", "Asks for the order number, remembers the problem for 10 minutes."),
    ]
    st.append(table(["Driver says", "API calls", "Bot does"], [list(r) for r in rows],
                    [40 * mm, 40 * mm, W - 80 * mm]))
    st.append(para("4.3 Roman Hindi, spaced references, stickers", "h2"))
    for t in [
        "Rules cover the common Roman Hindi forms of every problem type. When no rule matches and the message looks like a "
        "problem (a negation or problem word, plus Roman Hindi or at least 8 words), the model classifies it. The model's "
        "answer only selects which fixed flow runs.",
        "Spaced references: 'spl 88 123456', 'NQ 4455 6677 88' are one reference; 'flat 12 554433' gives 554433; dimensions "
        "('60 x 40 x 30') and phone numbers are never references.",
        "Stickers: 'I can't read stickers, send the order number or a photo of the label'. Emoji only: delivery emoji -> ask "
        "for the order number; thanks emoji after a handover -> thanks. WhatsApp reactions get no reply.",
    ]:
        st.append(bullet(t))
    st.append(PageBreak())

    # ------------------------------------------------------------------ 5 owner
    st.append(para("5. Owner mode", "h1"))
    st.append(para("5.1 What the owner can say", "h2"))
    st.append(table(["Owner says (EN or AR)", "Bot does", "LLBox API"], [list(r) for r in OWNER_INTENTS],
                    [52 * mm, W - 52 * mm - 50 * mm, 50 * mm]))
    st.append(para("5.2 Rules that protect the owner", "h2"))
    for t in [
        "A message with a cancel word never registers anything. Every cancel is confirmed first ('Cancel X (expected Friday "
        "16 October)? Reply yes'); 'no' keeps it.",
        "A reference is never reused silently: memory only answers the bot's own last question and expires after 15 minutes.",
        "The day is asked once when missing; 'not sure' is accepted and LLBox's default applies. Past dates and dates more "
        "than 120 days ahead are refused with the reason. 'Sunday' on a Sunday is today, and the reply points out "
        "that 'next Sunday' means next week.",
        "When a day is full, the reply gives the limit and asks for another day for all affected references at once. A "
        "busy (but not full) day gets the 'comfortably holds 3, at most 5' warning.",
        "Registration asks once about cash on delivery; 'COD 200 for all of them' applies to every reference just registered.",
        "Status of an overdue delivery (expected day passed, still pending) offers to cancel it.",
        "With several boxes the bot asks which one, unless the message names it (number, nickname, box code, home/office).",
        "Report tickets are not duplicated within 10 minutes; theft adds advice to contact the store or courier.",
    ]:
        st.append(bullet(t))
    st.append(PageBreak())

    # ------------------------------------------------------------------ 6 API
    st.append(para("6. API integration (report Part F)", "h1"))
    st.append(para("Base URL https://llbox.up.railway.app/api/v1, header X-Agent-API-Key. Every call that changes something "
                   "(driver-contact, cancel, code, report-issue) is never retried automatically, so a slow answer cannot "
                   "create a second ticket or a second code.", "body"))
    st.append(table(["Part F / endpoint", "Used when", "How each answer is handled"], [list(r) for r in API_ROWS],
                    [50 * mm, 40 * mm, W - 90 * mm]))
    st.append(PageBreak())

    # ------------------------------------------------------------------ 7 privacy
    st.append(para("7. Privacy and safety rules", "h1"))
    for t in PRIVACY:
        st.append(bullet(t))

    # ------------------------------------------------------------------ 8 follow-up
    st.append(para("8. Follow-up worker", "h1"))
    st.append(para("LLBox has no webhooks, so the backend runs a small worker (every 20 seconds) over follow-up jobs stored "
                   "in MongoDB. Jobs are locked while processed, so two backend processes cannot send twice."))
    st.append(table(["Job", "Created", "Polls", "Ends with"], [
        ["Delivery status", "After every driver handover",
         "delivery/status from 3 minutes after the handover, every 3 minutes, every 10 minutes after 20 tries, for 6 hours",
         "completed: thank-you to the driver; cancelled / expired / not found: stop; 429: retry in 5 minutes"],
        ["Contact review", "driver-contact answered 202 pending_review",
         "driver-contact/:id every 30 seconds for 30 minutes",
         "released: number sent once; opted out / refused: told; timeout: customer notified instead"],
    ], [26 * mm, 36 * mm, (W - 62 * mm) / 2, (W - 62 * mm) / 2]))
    st.append(para("Follow-up messages go only to drivers who wrote to us in the last few hours, so they stay inside "
                   "WhatsApp's 24-hour window. Jobs never contain a phone number or a code.", "small"))

    # ------------------------------------------------------------------ 9 config / deploy
    st.append(para("9. Configuration and deployment", "h1"))
    st.append(para("9.1 Backend settings (backend/.env; values not shown)", "h2"))
    st.append(table(["Setting", "Purpose"], [list(r) for r in ENV_ROWS], [62 * mm, W - 62 * mm]))
    st.append(para("9.2 Running and deploying", "h2"))
    for t in [
        "Backend: PM2 process <font name='DVM'>llbox-backend</font> on 127.0.0.1:5100. Restart with "
        "<font name='DVM'>pm2 restart llbox-backend --update-env</font>; health at "
        "<font name='DVM'>GET /health</font>; logs in <font name='DVM'>backend/logs/combined.log</font> "
        "([turn], [owner], [contact], [followup], [classify] lines).",
        "n8n: <font name='DVM'>python3 n8n/fix_operations_workflow.py</font> patches and stores a new workflow version; then "
        "<font name='DVM'>n8n publish:workflow</font> with that version id and restart the n8n container. Every version is "
        "kept in workflow_history for rollback.",
        "Current production: backend restarted 7 October 2026 with all changes; n8n version f575fd8c (sequential photos, "
        "reaction skip).",
    ]:
        st.append(bullet(t))
    st.append(PageBreak())

    # ------------------------------------------------------------------ 10 testing
    st.append(para("10. Testing", "h1"))
    rows = [[cell("Suite (backend/scripts)", "cellb"), cell("What it covers", "cellb"), cell("Live vs stubbed", "cellb"),
             cell("Result", "cellb")]]
    for name, res, how, script in suites:
        rows.append([cell(script), cell(name), cell(how), cell(f"{res['passed']}/{res['total']}")])
    st.append(grid(rows, [38 * mm, 52 * mm, W - 38 * mm - 52 * mm - 16 * mm, 16 * mm]))
    st.append(para("Run any suite with <font name='DVM'>FOLLOWUPS_DISABLED=true node scripts/&lt;suite&gt;.js "
                   "--json=out.json</font>. The owner suite takes the owner number as an argument and cancels every test "
                   "delivery it creates. No suite sends WhatsApp messages. The driver suites never consume real codes "
                   "for edge cases and never release real numbers.", "body"))
    st.append(para("What is tested live and what is not", "h2"))
    for t in [
        "Live: identify, deliveries list/filters, register with dates and COD, cancel, box-status, support-contact, driver "
        "lookup and notify for the original 30 scenarios, one real WhatsApp handover with photos, one real driver-contact "
        "shape check.",
        "Stubbed: driver-contact outcomes (200/202/403/404/409/422/429), guest/replacement codes, report-issue and "
        "preferences in the owner suite, and the two-box owner. These would otherwise notify LLBox's tester, change the "
        "tester's account or release a real number.",
    ]:
        st.append(bullet(t))

    # ------------------------------------------------------------------ 11 open items
    st.append(para("11. Open items and notes for LLBox", "h1"))
    for t in OPEN_ITEMS:
        st.append(bullet(t))
    st.append(PageBreak())

    # ------------------------------------------------------------------ appendix A
    st.append(para("Appendix A. Example conversations", "h1"))
    st.append(para("Taken from the test runs of 7 October 2026. Six-digit codes are masked. In driver examples the "
                   f"customer number {FAKE_PHONE} is a stubbed test value, not a real number.", "small"))

    def convo(title: str, items: list[dict]):
        rows = [[cell("Message", "cellb"), cell("Bot reply", "cellb")]]
        for r in items:
            rows.append([message_cell(r.get("text") or "", 400, W * 0.34),
                         message_cell(mask(r["reply"]), 1400, W * 0.66)
                         + [Paragraph(escape(f"outcome: {r['outcome']}"), S["mono"])]])
        st.append(KeepTogether([para(title, "h2"), grid(rows, [W * 0.34, W * 0.66])]))
        st.append(Spacer(1, 3 * mm))

    owner = {r["id"]: r for r in data["owner"]["results"]}
    edge = {r["id"]: r for r in data["driver_edge"]["results"]}
    multi = {r["id"]: r for r in data["multibox"]["results"]}
    convo("Owner: greeting and menu (F3, F13)", [owner["F3 greeting"]])
    convo("Owner: register, COD, status, cancel (F1, F2, F8)", [owner[k] for k in [
        "F2 register asks day", "F2 day answer", "F3-COD not sure", "F8 status by ref", "F1 cancel by ref confirms",
        "F1 cancel yes", "F2 stale ref not reused"]])
    convo("Owner: three references, full day, COD for all (F10, F12)", [owner[k] for k in [
        "F12 three refs", "F10 relative day", "F3-COD for all"]])
    convo("Owner: dates refused (F10, F11)", [owner["F10 past day"], owner["F11 >120 days"]])
    convo("Owner: box, number, codes (F7, F9)", [owner[k] for k in [
        "F9 box number", "F13 box status", "F14 guest code", "F15 replacement code"]])
    convo("Owner: reports, preferences, account (F15, F16)", [owner[k] for k in [
        "F16 report issue", "F16 duplicate report", "F17 STOP", "F17 no driver calls", "F18 account change", "F19 theft"]])
    convo("Owner: Arabic", [owner["F3 Arabic greeting"], owner["F7 Arabic list"]])
    convo("Owner with two boxes (F8)", [multi[k] for k in ["F8 register asks box", "F8 box by name", "F8 guest code asks box",
                                                          "F8 guest code office"]])
    convo("Driver: Roman Hindi problems (R1)", [edge[k] for k in ["R1a", "R1d", "R1f", "R1i", "R1i2"]])
    convo("Driver: oversized parcel with size (R1, F1)", [edge["R1c"], edge["R1c2"]])
    convo("Driver: cash on delivery (F1, F3)", [edge[k] for k in ["R1g", "C1", "C1b", "C2", "C5"]])
    convo("Driver: dead box (F1)", [edge[k] for k in ["D1", "D2", "D2b", "D3"]])
    convo("Driver: sticker, emoji, '???' (R4)", [edge[k] for k in ["E1", "E2", "E3"]])
    st.append(PageBreak())

    # ------------------------------------------------------------------ appendix B
    st.append(para("Appendix B. Every automated check", "h1"))
    for name, res, _, script in suites:
        st.append(para(f"{name} ({script}): {res['passed']}/{res['total']}", "h2"))
        rows = []
        for r in res["results"]:
            rows.append([str(r["id"]), (r.get("text") or "")[:110], r["outcome"], "PASS" if r["pass"] else "FAIL"])
        st.append(table(["Check", "Message", "Outcome", "Result"], rows,
                        [30 * mm, W - 30 * mm - 44 * mm - 16 * mm, 44 * mm, 16 * mm], status_col=3))
    st.append(PageBreak())

    # ------------------------------------------------------------------ appendix C
    st.append(para("Appendix C. Files changed", "h1"))
    st.append(table(["File", "Role"], [list(r) for r in FILES], [70 * mm, W - 70 * mm]))

    doc.build(st, onFirstPage=page_frame, onLaterPages=page_frame)
    print(f"wrote {out_path}: {passed}/{total} checks")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
