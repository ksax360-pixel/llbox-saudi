# LLBox AI Communication Platform – Backend

Production-ready **Node.js + Express + MongoDB** business-logic layer for the LLBox AI Voice Agent Platform.

```
Twilio → ElevenLabs AI Agent → Node.js Backend → MongoDB
                                      ↓
                                 LLBox APIs
```

The AI agent **never** talks to MongoDB or LLBox directly. All tool calls go through this backend.

> **Phase 1:** Dummy LLBox / Twilio / ElevenLabs responses (`LLBOX_DUMMY_MODE=true`).  
> **Phase 2:** Set real API keys and flip `LLBOX_DUMMY_MODE=false`.

---

## Stack

| Concern | Package |
|---|---|
| Runtime | Node.js (plain JavaScript, CommonJS) |
| HTTP | Express 5 |
| Database | MongoDB + Mongoose |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| Validation | `express-validator` |
| Security | `helmet`, `cors` |
| Logging | `morgan` + `winston` |
| HTTP client | `axios` |
| Uploads (ready) | `multer` |
| Config | `dotenv` |

**No TypeScript. No NestJS. No Prisma.**

---

## Folder Structure

```
backend/
├── server.js                 # Entry point
├── app.js                    # Express app + middleware + routes
├── package.json
├── .env / .env.example
├── config/
│   ├── database.js
│   └── logger.js
├── routes/
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── tool.routes.js
│   ├── conversation.routes.js
│   ├── knowledge.routes.js
│   ├── prompt.routes.js
│   └── settings.routes.js
├── controllers/
├── services/
│   ├── llbox.service.js      # Phase 1 dummy / Phase 2 real LLBox client
│   ├── elevenlabs.service.js
│   ├── twilio.service.js
│   ├── conversation.service.js
│   └── knowledge.service.js
├── models/
│   ├── User.js
│   ├── Conversation.js
│   ├── CallLog.js
│   ├── Knowledge.js
│   ├── Prompt.js
│   └── Setting.js
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   ├── validation.js
│   └── validators.js
├── utils/
│   ├── response.js
│   └── constants.js
├── scripts/
│   └── seed.js
└── postman/
    └── LLBox_AI_Backend.postman_collection.json
```

---

## Setup

### 1. Prerequisites

- Node.js **≥ 18**
- MongoDB running locally (or Atlas URI)

### 2. Install

```bash
cd backend
npm install
```

### 3. Environment

```bash
cp .env.example .env
```

Edit `.env` as needed. Defaults work for local Phase 1:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/llbox_ai
JWT_SECRET=llbox_ai_dev_secret_change_in_production_9f3a2b
LLBOX_DUMMY_MODE=true
```

### 4. Seed sample data

```bash
npm run seed
```

Demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@llbox.ai` | `Admin@123` |
| Operator | `operator@llbox.ai` | `Operator@123` |
| Viewer | `viewer@llbox.ai` | `Viewer@123` |

### 5. Run

```bash
# development (auto-restart)
npm run dev

# production
npm start
```

Health check: [http://localhost:5000/health](http://localhost:5000/health)

Import Postman collection from `postman/LLBox_AI_Backend.postman_collection.json`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` / `production` |
| `PORT` | Server port (default `5000`) |
| `CORS_ORIGIN` | Allowed frontend origin |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret (**required**) |
| `JWT_EXPIRES_IN` | Token TTL (default `7d`) |
| `LLBOX_BASE_URL` | LLBox API base URL |
| `LLBOX_API_KEY` | `X-Agent-API-Key` for LLBox |
| `LLBOX_DUMMY_MODE` | `true` = Phase 1 dummy responses |
| `TWILIO_ACCOUNT_SID` | Twilio SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio number |
| `ELEVENLABS_API_KEY` | ElevenLabs key |
| `ELEVENLABS_AGENT_ID` | Conversational agent id |
| `GOOGLE_MAPS_API_KEY` | Maps key (also in Settings) |
| `OPENAI_API_KEY` | OpenAI key (also in Settings) |

---

## Response Format

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Error Message",
  "errors": []
}
```

All authenticated routes require:

```http
Authorization: Bearer <token>
```

---

## Roles

| Role | Access |
|---|---|
| `admin` | Full access (users, settings, deletes) |
| `operator` | Tools, conversations, knowledge, prompts |
| `viewer` | Read-only |

---

## API Documentation

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Service health |

---

### Auth — `/api/auth`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/login` | No | `{ email, password }` | Returns JWT + user |
| POST | `/logout` | Yes | — | Client-side token discard |
| GET | `/me` | Yes | — | Current user profile |
| POST | `/register` | Admin | `{ name, email, password, role? }` | Create user |

**Login example**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@llbox.ai","password":"Operator@123"}'
```

---

### Tools — `/api/tools` (Operator+)

These mirror the LLBox X360 bridge journeys from the integration guide. Phase 1 returns fixed sample JSON.

| Method | Path | Body | Sample `data` |
|---|---|---|---|
| POST | `/resolve-delivery` | `{ "orderReference": "ABC123" }` | `{ success, otp, address, googleMaps, deliverySessionId }` |
| POST | `/confirm-delivery` | `{ deliverySessionId, boxId, ... }` | `{ success, message: "Delivery Confirmed" }` |
| POST | `/register-delivery` | `{ whatsappPhone, orderReference, boxId? }` | `{ success, message: "Delivery Registered" }` |
| POST | `/find-customer` | `{ whatsappPhone }` or `{ phone }` | `{ name, phone, locker }` |

**Resolve delivery**

```bash
curl -X POST http://localhost:5000/api/tools/resolve-delivery \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderReference":"ABC123"}'
```

Phase 2 wiring (already scaffolded in `services/llbox.service.js`):

| Tool | Real LLBox endpoint |
|---|---|
| resolve-delivery | `GET /agent/box/by-reference/:orderReference` |
| confirm-delivery | `POST /agent/delivery/confirm` |
| register-delivery | `POST /agent/expected-deliveries` |
| find-customer | `POST /agent/expected-deliveries/lookup-user` |

---

### Conversations — `/api/conversations`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Viewer+ | List conversations (paginated) |
| GET | `/:id` | Viewer+ | Get one |
| POST | `/` | Operator+ | Create (transcript, intent, toolCalls, …) |
| DELETE | `/:id` | Admin/Operator | Delete |

**Stored fields:** callerNumber, transcript, duration, language, intent, toolCalls, response, timestamp, status.

---

### Call Logs — `/api/conversations/call-logs`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/call-logs` | Viewer+ | List call logs |
| GET | `/call-logs/:id` | Viewer+ | Get one |
| POST | `/call-logs` | Operator+ | Create |
| PATCH | `/call-logs/:id` | Operator+ | Update |

**Stored fields:** incomingNumber, twilioCallSid, elevenLabsConversationId, status, duration, recordingUrl, startedAt, endedAt.

---

### Knowledge — `/api/knowledge`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Viewer+ | List articles |
| GET | `/search?q=` | Viewer+ | Full-text search |
| GET | `/:id` | Viewer+ | Get article |
| POST | `/` | Operator+ | Create |
| PATCH | `/:id` | Operator+ | Update |
| DELETE | `/:id` | Admin | Delete |

---

### Prompts — `/api/prompts`

Types: `system` | `greeting` | `fallback` | `language`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Viewer+ | List |
| GET | `/:id` | Viewer+ | Get |
| POST | `/` | Admin/Operator | Create |
| PATCH | `/:id` | Admin/Operator | Update (bumps version) |
| DELETE | `/:id` | Admin | Delete |

---

### Settings — `/api/settings` (Admin only)

Categories: `twilio` | `elevenlabs` | `llbox` | `google_maps` | `openai` | `general`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List (secrets masked) |
| GET | `/key/:key` | Get by key |
| GET | `/:id` | Get by id |
| POST | `/` | Create |
| PATCH | `/:id` | Update |
| DELETE | `/:id` | Delete |

---

### Users — `/api/users` (Admin only)

| Method | Path | Description |
|---|---|---|
| GET | `/` | List users |
| GET | `/:id` | Get user |
| PATCH | `/:id` | Update name/role/isActive |
| DELETE | `/:id` | Delete user |

---

## Architecture Notes

1. **Controllers** handle HTTP only.
2. **Services** own business logic and external API clients.
3. **Models** define Mongoose schemas + indexes + timestamps.
4. **Middleware** centralizes auth, validation, and errors.
5. **`llbox.service.js`** is the single gateway to LLBox (matches X360 integration guide patterns: retry once on 500, treat `ALREADY_CONFIRMED` as success, never treat OTP validate status as truth).

---

## Scripts

```bash
npm run dev     # node --watch server.js
npm start       # node server.js
npm run seed    # load demo users, knowledge, prompts, settings, sample call
```

---

## License

UNLICENSED – internal LLBox / X360 project.
