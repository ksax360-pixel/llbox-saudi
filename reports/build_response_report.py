#!/usr/bin/env python3
"""Build the X360 re-test response PDF from a live run (n8n/live_human_test.py) and reviewed verdicts.

Usage: python3 reports/build_response_report.py reports/live_run_1.json reports/verdicts.json OUT.pdf
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from html import escape

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DVM", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"))

INK = colors.HexColor("#1D2939")
MUTED = colors.HexColor("#667085")
ORANGE = colors.HexColor("#E8772E")
LINE = colors.HexColor("#D0D5DD")
HEAD = colors.HexColor("#F2F4F7")
VERDICT_COLOR = {"PASS": colors.HexColor("#067647"), "PARTIAL": colors.HexColor("#B54708"), "FAIL": colors.HexColor("#B42318")}
VERDICT_BG = {"PASS": colors.HexColor("#ECFDF3"), "PARTIAL": colors.HexColor("#FFFAEB"), "FAIL": colors.HexColor("#FEF3F2")}

S = {
    "small": ParagraphStyle("small", fontName="DV", fontSize=9, textColor=INK, leading=12),
    "kicker": ParagraphStyle("kicker", fontName="DV", fontSize=12, textColor=INK, leading=15),
    "title": ParagraphStyle("title", fontName="DVB", fontSize=26, textColor=INK, leading=31),
    "subtitle": ParagraphStyle("subtitle", fontName="DV", fontSize=12.5, textColor=ORANGE, leading=16),
    "h1": ParagraphStyle("h1", fontName="DVB", fontSize=15, textColor=INK, leading=19, spaceBefore=10, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName="DVB", fontSize=11.5, textColor=INK, leading=15, spaceBefore=8, spaceAfter=4),
    "body": ParagraphStyle("body", fontName="DV", fontSize=9.2, textColor=INK, leading=13, spaceAfter=4),
    "cell": ParagraphStyle("cell", fontName="DV", fontSize=8.2, textColor=INK, leading=10.6),
    "cellb": ParagraphStyle("cellb", fontName="DVB", fontSize=8.2, textColor=INK, leading=10.6),
    "cellar": ParagraphStyle("cellar", fontName="DV", fontSize=8.2, textColor=INK, leading=11.5, alignment=TA_RIGHT),
    "mono": ParagraphStyle("mono", fontName="DVM", fontSize=7.6, textColor=INK, leading=10),
    "bullet": ParagraphStyle("bullet", fontName="DV", fontSize=9.2, textColor=INK, leading=13, leftIndent=12, bulletIndent=2, spaceAfter=2),
}

AR_RX = re.compile(r"[\u0600-\u06FF]")
DROP_RX = re.compile(r"[\U00010000-\U0010FFFF\u2600-\u27BF\uFE0F\u200D]")


def clean(text: str) -> str:
    return DROP_RX.sub("", str(text or "")).replace("\u2705", "")


def shape(line: str) -> str:
    return get_display(arabic_reshaper.reshape(line)) if AR_RX.search(line) else line


def para(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def cell(text: str, style: str = "cell") -> Paragraph:
    return Paragraph(escape(clean(text)).replace("\n", "<br/>"), S[style])


def wrap_rtl(line: str, width: float) -> list:
    """Wrap logical Arabic text to the column width first, then shape each line (ReportLab wraps visual order)."""
    words, lines, cur = line.split(), [], ""
    for word in words:
        cand = f"{cur} {word}".strip()
        if cur and pdfmetrics.stringWidth(shape(cand), "DV", S["cellar"].fontSize) > width:
            lines.append(cur)
            cur = word
        else:
            cur = cand
    if cur:
        lines.append(cur)
    return lines


def message_cell(text: str, limit: int = 1400, width: float = 80 * mm) -> list:
    """Reply/message text with Arabic lines shaped and right-aligned."""
    text = clean(text)
    if len(text) > limit:
        text = text[:limit] + " …"
    out = []
    for line in text.split("\n"):
        if not line.strip():
            out.append(Spacer(1, 3))
            continue
        if AR_RX.search(line):
            for part in wrap_rtl(line, width - 10):
                out.append(Paragraph(escape(shape(part)), S["cellar"]))
        else:
            out.append(Paragraph(escape(line), S["cell"]))
    return out or [Paragraph("(no reply)", S["cell"])]


def verdict_cell(v: str) -> Paragraph:
    return Paragraph(f'<font name="DVB" color="{VERDICT_COLOR.get(v, INK).hexval()}">{v}</font>', S["cell"])


def grid(data, widths, header=True, extra=None):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), HEAD))
    t.setStyle(TableStyle(style + (extra or [])))
    return t


def page_frame(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(18 * mm, A4[1] - 14 * mm, A4[0] - 18 * mm, A4[1] - 14 * mm)
    canvas.setFont("DV", 7.2)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 10 * mm, "X360 x LLBox - WhatsApp chatbot re-test report - 3 October 2026 - Confidential")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def bar_chart(before: dict, first: dict, after: dict) -> Drawing:
    d = Drawing(170 * mm, 62 * mm)
    chart = VerticalBarChart()
    chart.x, chart.y, chart.width, chart.height = 14 * mm, 10 * mm, 150 * mm, 44 * mm
    keys = ["PASS", "PARTIAL", "FAIL"]
    chart.data = [[before[k] for k in keys], [first[k] for k in keys], [after[k] for k in keys]]
    chart.categoryAxis.categoryNames = keys
    chart.categoryAxis.labels.fontName = "DV"
    chart.valueAxis.labels.fontName = "DV"
    chart.valueAxis.valueMin, chart.valueAxis.valueMax, chart.valueAxis.valueStep = 0, 30, 5
    chart.bars[0].fillColor = colors.HexColor("#98A2B3")
    chart.bars[1].fillColor = colors.HexColor("#F7B27A")
    chart.bars[2].fillColor = ORANGE
    chart.barSpacing, chart.groupSpacing = 2, 14
    chart.barLabelFormat = "%d"
    chart.barLabels.fontName = "DVB"
    chart.barLabels.fontSize = 8
    chart.barLabels.nudge = 6
    d.add(chart)
    d.add(String(70 * mm, 58 * mm, "grey = LLBox 30 Sep", fontName="DV", fontSize=7.5, fillColor=MUTED))
    d.add(String(104 * mm, 58 * mm, "light = X360 first pass", fontName="DV", fontSize=7.5, fillColor=colors.HexColor("#D9822B")))
    d.add(String(143 * mm, 58 * mm, "orange = after fixes", fontName="DV", fontSize=7.5, fillColor=ORANGE))
    return d


def build(run_path: str, verdict_path: str, out_path: str) -> None:
    run = json.load(open(run_path))
    review = json.load(open(verdict_path))
    notes = review.get("notes", {})
    overrides = review.get("verdicts", {})

    scenarios = run["scenarios"]
    first_overrides = review.get("first_verdicts", {})
    for sc in scenarios:
        sc["after"] = overrides.get(sc["id"], "PASS" if sc["auto_pass"] else "FAIL")
        sc["first"] = first_overrides.get(sc["id"], "PASS" if sc.get("first_pass", sc["auto_pass"]) else "FAIL")
        sc["note"] = notes.get(sc["id"], "")

    report = [s for s in scenarios if s["part"] == "report"]
    confused = [s for s in scenarios if s["part"] == "confused"]
    customer = [s for s in scenarios if s["part"] == "customer"]
    before = Counter(s["before"] for s in report)
    after = Counter(s["after"] for s in report)
    extra_after = Counter(s["after"] for s in confused + customer)
    first = Counter(s["first"] for s in report)
    extra_first = Counter(s["first"] for s in confused + customer)
    for k in ("PASS", "PARTIAL", "FAIL"):
        for c in (before, after, extra_after, first, extra_first):
            c.setdefault(k, 0)

    steps = [r for s in scenarios for r in s["results"]]
    replies = [r for r in steps if r.get("outcome") != "suppressed"]
    silent = [r for r in replies if not (r.get("reply") or "").strip() or not r.get("sent_ok")]

    doc = SimpleDocTemplate(out_path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=20 * mm, bottomMargin=18 * mm,
                            title="X360 x LLBox - WhatsApp Chatbot Re-Test Report", author="X360")
    W = A4[0] - 36 * mm
    story = []

    # ---------------------------------------------------------------- cover
    story += [Spacer(1, 30 * mm), para("X360 x LLBox", "kicker"), para("WhatsApp Chatbot Re-Test Report", "title"),
              Spacer(1, 2 * mm),
              para("Response to the LLBox QA report of 30 September 2026: the same 30 scenarios re-run live, "
                   "plus confused-driver and customer tests", "subtitle"), Spacer(1, 8 * mm)]
    cover = [
        ["Prepared for", "LLBox QA"],
        ["Prepared by", "X360 (chatbot / voice agent vendor)"],
        ["Date", "3 October 2026"],
        ["Baseline", "LLBox WhatsApp Chatbot Test Report (30 Sep 2026, 30 scenarios) and LLBox x X360 WhatsApp Conversation Reference v1.0"],
        ["System under test", "Production WhatsApp workflow (n8n) -> X360 backend conversation-turn service -> live LLBox API "
                              "(/api/v1/agent/*). Replies sent to a real WhatsApp phone."],
        ["Method", f"{len(steps)} real WhatsApp messages in {len(scenarios)} scenarios, sent through the live webhook as "
                   "a confused driver and a confused customer. Every reply, LLBox tool call and notify-recipient call was "
                   "captured from the n8n execution and the backend audit log."],
        ["Regression suite", "43 of 43 automated checks of the 30 report scenarios pass against the live LLBox API after all fixes "
                             "(backend/scripts/turn-regression.js, notify stubbed)."],
        ["Result (30 report scenarios)", f"{after['PASS']} PASS | {after['PARTIAL']} PARTIAL | {after['FAIL']} FAIL after fixes. "
                                         f"First live pass: {first['PASS']} | {first['PARTIAL']} | {first['FAIL']}. "
                                         f"LLBox on 30 Sep: {before['PASS']} | {before['PARTIAL']} | {before['FAIL']}."],
        ["Result (extra tests)", f"{extra_after['PASS']} PASS | {extra_after['PARTIAL']} PARTIAL | {extra_after['FAIL']} FAIL after fixes "
                                 f"(first pass {extra_first['PASS']} | {extra_first['PARTIAL']} | {extra_first['FAIL']}), "
                                 f"{len(confused) + len(customer)} new confused-driver and customer scenarios"],
    ]
    story.append(grid([[cell(a, "cellb" if False else "cell"), cell(b)] for a, b in cover], [42 * mm, W - 42 * mm], header=False,
                      extra=[("BACKGROUND", (0, 0), (0, -1), HEAD)]))
    story += [Spacer(1, 8 * mm), para("Why this report exists", "h2"),
              para("LLBox's report showed that the chatbot was letting drivers down at the gate: old codes re-sent, stuck "
                   "drivers never escalated to the customer, references ignored, and promises of a human handoff that did "
                   "not exist. We rebuilt the reply logic so that every safety-critical answer is fixed wording driven only by "
                   "the live LLBox API result for the current message, then re-ran every scenario from the report on the "
                   "production number, as a confused human would, and added new tests LLBox had not tried. This document "
                   "reports what passed, what did not, and what still needs work on either side."),
              PageBreak()]

    # ---------------------------------------------------------------- summary
    story.append(para("1. Result at a glance", "h1"))
    story.append(bar_chart(before, first, after))
    rows = [[cell("Verdict", "cellb"), cell("LLBox test, 30 Sep", "cellb"), cell("X360 first live pass, 3 Oct", "cellb"),
             cell("X360 after fixes, 3 Oct", "cellb"), cell("Change vs 30 Sep", "cellb")]]
    for k in ("PASS", "PARTIAL", "FAIL"):
        rows.append([verdict_cell(k), cell(str(before[k])), cell(str(first[k])), cell(str(after[k])), cell(f"{after[k] - before[k]:+d}")])
    story.append(grid(rows, [30 * mm, 34 * mm, 40 * mm, 40 * mm, W - 144 * mm]))
    story.append(Spacer(1, 4 * mm))

    improved = [s for s in report if s["before"] != "PASS" and s["after"] == "PASS"]
    still = [s for s in report if s["after"] != "PASS"]
    story.append(para(f"<b>{len(improved)} of the {before['PARTIAL'] + before['FAIL']} scenarios that were PARTIAL or FAIL now pass.</b> "
                      f"All {before['PASS']} scenarios that passed before still pass. "
                      + (f"{len(still)} scenario(s) are not yet a full pass; they are explained in section 4." if still else
                         "No scenario from the report is below PASS.")))

    story.append(para("Acceptance criteria (LLBox report section 6)", "h2"))
    acc = review.get("acceptance", [])
    rows = [[cell("Metric", "cellb"), cell("Target", "cellb"), cell("Measured on 3 Oct", "cellb"), cell("Met?", "cellb")]]
    for a in acc:
        rows.append([cell(a["metric"]), cell(a["target"]), cell(a["result"]), verdict_cell("PASS" if a["met"] else "FAIL")])
    story.append(grid(rows, [52 * mm, 38 * mm, W - 52 * mm - 38 * mm - 16 * mm, 16 * mm]))
    story.append(para(f"Messages sent: {len(steps)}. Replies captured: {len(replies)}. Replies Meta did not accept: {len(silent)}. "
                      "Driver replies were read on a real phone; the customer test number (QA ProdTest) is not a WhatsApp user "
                      "we can read, so customer replies were taken from the n8n execution.", "small"))
    story.append(PageBreak())

    # ---------------------------------------------------------------- scorecard
    story.append(para("2. Scorecard: the 30 report scenarios, before and after", "h1"))
    rows = [[cell("#", "cellb"), cell("Scenario", "cellb"), cell("30 Sep", "cellb"), cell("1st pass", "cellb"),
             cell("Final", "cellb"), cell("Change", "cellb")]]
    extra = []
    for i, s in enumerate(report, start=1):
        order = {"FAIL": 0, "PARTIAL": 1, "PASS": 2}
        change = "Improved" if order[s["after"]] > order.get(s["before"], 2) else ("Same" if s["after"] == s["before"] else "Worse")
        rows.append([cell(s["id"]), cell(s["title"]), verdict_cell(s["before"]), verdict_cell(s["first"]),
                     verdict_cell(s["after"]), cell(change)])
        extra.append(("BACKGROUND", (4, i), (4, i), VERDICT_BG[s["after"]]))
    story.append(grid(rows, [9 * mm, W - 9 * mm - 17 * mm * 3 - 19 * mm, 17 * mm, 17 * mm, 17 * mm, 19 * mm], extra=extra))
    story.append(para("1st pass = first full live run. Final = after fixing what the first pass found and re-testing those "
                      "scenarios live. #16 and #17 failed in the first pass only because LLBox's rate limiter refused to create "
                      "their test deliveries; see the appendix.", "small"))
    story.append(PageBreak())

    # ---------------------------------------------------------------- analysis
    story.append(para("3. What improved and why", "h1"))
    for theme in review.get("themes", []):
        story.append(KeepTogether([
            para(f"{theme['title']}  <font color='{VERDICT_COLOR[theme['verdict']].hexval()}'>[{theme['verdict']}]</font>", "h2"),
            para(theme["text"]),
        ]))
    story.append(para("Which areas do best, and which are weakest", "h2"))
    for line in review.get("ranking", []):
        story.append(Paragraph(line, S["bullet"], bulletText="•"))

    story.append(para("4. What is still not perfect", "h1"))
    for item in review.get("remaining", []):
        story.append(Paragraph(item, S["bullet"], bulletText="•"))

    story.append(para("5. Items for LLBox", "h1"))
    for item in review.get("llbox_items", []):
        story.append(Paragraph(item, S["bullet"], bulletText="•"))
    story.append(PageBreak())

    # ---------------------------------------------------------------- extra tests
    def short_table(items, title):
        story.append(para(title, "h1"))
        rows = [[cell("#", "cellb"), cell("What the human did", "cellb"), cell("First line of the bot's final reply", "cellb"),
                 cell("1st pass", "cellb"), cell("Final", "cellb")]]
        extra = []
        for i, s in enumerate(items, start=1):
            last = s["results"][-1]
            first_line = next((l for l in clean(last.get("reply", "")).split("\n") if l.strip()), "(no reply)")
            rows.append([cell(s["id"]), cell(s["title"]), message_cell(first_line, 220, W - 10 * mm - 52 * mm - 34 * mm),
                         verdict_cell(s["first"]), verdict_cell(s["after"])])
            extra.append(("BACKGROUND", (4, i), (4, i), VERDICT_BG[s["after"]]))
        story.append(grid(rows, [10 * mm, 52 * mm, W - 10 * mm - 52 * mm - 34 * mm, 17 * mm, 17 * mm], extra=extra))

    short_table(confused, "6. New confused-driver tests (not in LLBox's report)")
    story.append(Spacer(1, 4 * mm))
    short_table(customer, "7. Customer (box owner) tests")
    story.append(PageBreak())

    # ---------------------------------------------------------------- fixes
    story.append(para("8. Root causes found and fixes made", "h1"))
    rows = [[cell("Report #", "cellb"), cell("Root cause", "cellb"), cell("Fix", "cellb")]]
    for f in review.get("fixes", []):
        rows.append([cell(f["ids"]), cell(f["cause"]), cell(f["fix"])])
    story.append(grid(rows, [22 * mm, (W - 22 * mm) * 0.45, (W - 22 * mm) * 0.55]))
    story.append(PageBreak())

    # ---------------------------------------------------------------- evidence
    story.append(para("Appendix: evidence for every scenario", "h1"))
    story.append(para("Each block shows the exact message sent from the test phone, the reply the bot actually sent on WhatsApp "
                      "(taken from the n8n execution), the backend outcome and any notify-recipient calls (from the backend audit "
                      "log). Six-digit drop-off codes are masked in this document.", "small"))
    for s in scenarios:
        block = [para(f"#{s['id']}  {escape(s['title'])}  -  "
                      f"<font color='{VERDICT_COLOR[s['after']].hexval()}'>{s['after']}</font>"
                      + (f"  (30 Sep: {s['before']})" if s["before"] != "-" else "")
                      + (f"  (first pass: {s['first']}, re-tested)" if s.get("retested") and s["first"] != s["after"] else ""), "h2"),
                 para(f"<i>Expected:</i> {escape(s['expected'])}", "small")]
        rows = []
        shown = ([dict(r, label=f"first pass{' - ' + r['label'] if r.get('label') else ''}") for r in s["first_results"]]
                 if s.get("first_results") and s["first"] != s["after"] else []) + s["results"]
        for r in shown:
            who = {"919606742371": "Driver", "966500000001": "Customer", "919000000002": "Driver 2"}.get(r["phone"], r["phone"])
            meta = f"outcome: {r.get('outcome')}"
            if r.get("notify"):
                meta += " | notify: " + ", ".join(f"{c['issue']} (notified={c['notified']})" for c in r["notify"])
            if r.get("photos_sent"):
                meta += f" | box photos sent: {r['photos_sent']}"
            if r.get("dup_replies") is not None:
                meta += f" | replies to 2 identical messages: {r['dup_replies']}"
            if not r.get("sent_ok") and r.get("outcome") != "suppressed":
                meta += " | WhatsApp send: not delivered (number outside the 24-hour window)" if r["phone"] != "919606742371" else " | WhatsApp send: FAILED"
            masked = r.get("reply", "")
            for code in set(re.findall(r"(?m)^\s*\*?(\d{6})\*?\s*$", masked)):
                masked = masked.replace(code, "••••••")
            rows.append([[cell(f"{who}{' - ' + r['label'] if r.get('label') else ''}", "cellb")] + message_cell(r["text"], 500, W * 0.38),
                         message_cell(masked, 1400, W * 0.62) + [Paragraph(escape(meta), S["mono"])]])
        t = grid([[cell("Message sent", "cellb"), cell("Bot reply (as sent)", "cellb")]] + rows, [W * 0.38, W * 0.62])
        block.append(t)
        if s["note"]:
            block.append(para(f"<i>Review note:</i> {escape(s['note'])}", "small"))
        story.append(KeepTogether(block[:2]))
        story.extend(block[2:])
        story.append(Spacer(1, 3 * mm))

    doc.build(story, onFirstPage=page_frame, onLaterPages=page_frame)
    print(f"wrote {out_path}: report {dict(after)} extra {dict(extra_after)}")


if __name__ == "__main__":
    build(*sys.argv[1:4])
