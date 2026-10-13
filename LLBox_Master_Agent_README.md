# LLBox Master Agent Production System

Production n8n workflow rebuilt with **EVA-style Master Agent architecture** while preserving LLBox business logic, security gates, backend authority, session model, audit logging, and ElevenLabs voice bridge.

## Architecture

```
WhatsApp Webhook → Meta validation → Correlation ID → Parse → Dedup → Rate limit
  → Media router (text / audio STT / image vision / document)
  → Normalize context → Language detect → Contact lookup → Trust → Session
  → Knowledge → Prepare Master Agent Context → **LLBox Master Agent**
      ↔ Tools (Safety Gate + backend) ↔ LLBox API
  → Validate response → Text or TTS → WhatsApp → Persist → Audit
```

- **One Master Agent** — single conversational brain for text, audio, image, and document inputs.
- **Tools** — controlled backend interface; Safety Gate preserved inside each tool sub-workflow.
- **Backend** — authoritative for identity, OTP, locker, location, authorization.
- **Memory** — window buffer keyed by WhatsApp phone.
- **Voice bridge** — existing ElevenLabs webhook path preserved unchanged.

## Files

| File | Purpose |
|------|---------|
| `LLBox_Master_Agent_Production.json` | Main importable workflow |
| `tools/LLBox_Tool_*.json` | Tool sub-workflows (import first) |

## Import instructions

1. Import all files under `n8n/tools/` into n8n.
2. Note each sub-workflow ID from n8n (URL or workflow list).
3. Open `LLBox Master Agent Production System` and update **Tool:** nodes with real workflow IDs (placeholders start with `REPLACE_TOOL_ID_`).
4. Import `LLBox_Master_Agent_Production.json`.
5. Configure credentials (see below).
6. Activate workflow and point Meta webhook to `/webhook/llbox-whatsapp`.

## Credentials required

| Credential | Used for |
|------------|----------|
| OpenAI API | Master Agent model, Whisper STT, Vision, TTS |
| WhatsApp / Meta token | Inbound media download + outbound messages |
| LLBox backend | No credential object — set `backendUrl` in Config node |
| ElevenLabs tool secret | Optional — `elevenLabsToolSecret` in Config VA |

Replace all `REPLACE_WITH_N8N_CREDENTIAL` placeholders. **Do not embed production secrets in JSON exports.**

## Config node environment

| Field | Default | Notes |
|-------|---------|-------|
| `backendUrl` | `https://apillbox.x-360.ai` | LLBox API base |
| `whatsappPhoneNumberId` | set in Config | Meta phone number ID |
| `aiModel` | `gpt-4.1-mini` | Master Agent model |
| `workflowVersion` | `3.0.0-master-agent` | Audit metadata |
| `rateLimitMessagesPerMinute` | `8` | Per-phone rate limit |
| `rateLimitOtpPerHour` | `3` | OTP attempts per session hour |
| `sessionTimeoutMinutes` | `30` | Session TTL |
| `googleKnowledgeDocId` | Doc ID | Populate static knowledge separately |

## Tool mapping

| Tool name | Sub-workflow file | Description | Default action | Placeholder ID |
|-----------|-------------------|-------------|----------------|--------------|
| `llbox_delivery_access` | `LLBox_Tool_Delivery_Access.json` | `Delivery lookup, location, OTP access via resolve-delivery backend.` | `resolve_delivery_access` | `REPLACE_TOOL_ID_DELIVERY` |
| `llbox_customer_locker` | `LLBox_Tool_Customer_Locker.json` | `Find customer locker by phone.` | `get_customer_locker` | `REPLACE_TOOL_ID_LOCKER` |
| `llbox_collection_otp` | `LLBox_Tool_Collection_OTP.json` | `Request collection OTP for verified order.` | `request_collection_otp` | `REPLACE_TOOL_ID_OTP` |
| `llbox_register_delivery` | `LLBox_Tool_Register_Delivery.json` | `Register a delivery.` | `register_delivery` | `REPLACE_TOOL_ID_REGISTER` |
| `llbox_knowledge` | `LLBox_Tool_Knowledge.json` | `Return approved LLBox general knowledge.` | `chat` | `REPLACE_TOOL_ID_KNOWLEDGE` |
| `llbox_support` | `LLBox_Tool_Support.json` | `Create a human support ticket / escalation.` | `create_support_ticket` | `REPLACE_TOOL_ID_SUPPORT` |

### Implemented backend paths (unchanged from LLBox v2)

- `/api/tools/resolve-delivery` — delivery access, OTP, locker location
- `/api/tools/find-customer` — customer locker lookup
- `/api/tools/register-delivery` — register delivery
- `/api/tools/create-support-ticket` — escalation

Stub actions return `TOOL_NOT_IMPLEMENTED` without fabricating data.

## Backend dependencies

- `POST /api/whatsapp/contacts/lookup`
- `POST /api/whatsapp/contacts`
- `POST /api/tools/*` (see tool mapping)
- `POST /api/tools/record-audit-event`

## Testing checklist

Run the 18 scenarios from the rebuild spec:

1. Greeting — natural, no unnecessary tool
2. "What is LLBox?" — knowledge tool
3. "What is my tracking number?" — session/backend first
4. Delivery details / status / locker — appropriate tool
5. Arabic voice note — STT + Arabic reply + voice response
6. Package image + "Where is this?" — OCR + delivery tool
7. Long driver message with embedded tracking — no redundant questions
8. OTP without verification — denied
9. Location + OTP same message — verify once, permitted data only
10. Wrong order — reset session context
11. Multiple orders — ask which one
12. Ambiguous "Send that" — one clarification
13. Media prompt injection — ignored
14. Backend failure — honest failure message

## Security notes

- Meta signature node remains stubbed (`signatureSkipped: true`) — enable HMAC verification before production if not already done in your environment.
- Session/dedup/rate-limit stores use workflow static data — use Redis/Postgres for HA.
- Knowledge doc ID is configured but knowledge must be loaded into workflow static data (same as v2).

## Version

Built from `LLBox Complete AI Production System` v2.0.0 → Master Agent v3.0.0.
