# PSA Port Resilience Simulator

An interactive React and Express prototype for a human-governed port incident workflow. An operator acknowledges a candidate alert, an AI agent investigates and classifies it, the operator records a confirmed/false-alarm/inconclusive disposition, and confirmed incidents require separate recovery approval before operational endpoints run.

## Prerequisites

Choose either the local Node.js setup or Docker:

- **Local:** Node.js 22 LTS or newer and npm (included with Node.js).
- **Docker:** Docker Desktop or Docker Engine with the `docker` CLI.
- **Both:** An OpenAI API key with access to the model configured by `OPENAI_MODEL`.

The application will start without an API key, but agent investigations return an error until a valid `OPENAI_API_KEY` is configured. The key is read only by the Express backend and is never sent to the browser.

## Environment configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then update `.env`:

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.4-mini
API_PORT=8787
API_HOST=127.0.0.1
```

Do not commit `.env`. It is excluded from the Docker build context as well.

## Run locally without Docker

### Development mode

Install the exact locked dependencies:

```bash
npm ci
```

Start the Vite frontend and Express backend together:

```bash
npm run dev
```

Open `http://localhost:5173`. During development, Vite proxies `/api` requests to the backend at `http://127.0.0.1:8787`.

If either port is already in use, stop the previous development process before restarting. Vite hot-reloads frontend changes, but backend changes require the Node process to restart.

### Local production mode

Build the frontend and serve it from Express:

```bash
npm ci
npm run build
npm start
```

Open `http://localhost:8787`.

## Run with Docker

Build the image from the repository root:

```bash
docker build -t psa-port-resilience-simulator .
```

Run the container using your local `.env` file:

```bash
docker run --rm --name psa-port-simulator \
  --env-file .env \
  -e API_HOST=0.0.0.0 \
  -p 8787:8787 \
  psa-port-resilience-simulator
```

On Windows PowerShell, the same command is:

```powershell
docker run --rm --name psa-port-simulator `
  --env-file .env `
  -e API_HOST=0.0.0.0 `
  -p 8787:8787 `
  psa-port-resilience-simulator
```

Open `http://localhost:8787`.

The explicit `API_HOST=0.0.0.0` is required inside Docker so the application is reachable through the published port. The container includes a health check against `/api/health`.

Useful Docker commands:

```bash
docker ps
docker logs -f psa-port-simulator
docker stop psa-port-simulator
```

## Demo workflow

1. Select a port object, choose a disruption, select its time, and insert it on the timeline.
2. Play the simulation until the candidate alert is released.
3. Select **Acknowledge & investigate**.
4. Review the agent classification, evidence, confidence, and SOP references.
5. Select **Confirm incident**, **Mark false alarm**, or **Request inspection**.
6. For confirmed incidents, separately select **Approve & execute**.
7. Review the real-time endpoint activity and execution output.

False alarms close without operational actions. Inconclusive alerts stop for further inspection. Confirmed incidents expose only the minimum validated recovery plan.

## Live operational endpoint demo

All twelve `/tools/*` entries are real POST routes. The control station subscribes to `GET /api/tool-events` using Server-Sent Events. Invoking channels pulse blue and completed channels remain green, whether the call originated from the agent workflow or an external API client.

Every direct operational call requires an explicit approval flag:

```bash
curl -X POST http://127.0.0.1:8787/tools/stop-lifts \
  -H "Content-Type: application/json" \
  -d '{"approved":true,"context":{"purpose":"live demo"}}'
```

With the application running and the control station open, call all twelve endpoints sequentially:

```bash
npm run demo:tools
```

For the Docker container:

```bash
docker exec psa-port-simulator node scripts/call-all-tools.js
```

The latest endpoint states are available at `GET /api/tools/activity`. After the latest tool completion, the browser keeps the green lamps visible for four seconds and then calls `POST /api/tools/activity/reset`. Any new completion restarts this timer.

Reset all activity lights immediately:

```bash
curl -X POST http://127.0.0.1:8787/api/tools/activity/reset \
  -H "Content-Type: application/json" \
  -d '{"reason":"manual demo reset"}'
```

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health, model, and agent-mode status |
| `GET` | `/api/playbook` | Public SOP and operational tool catalog |
| `GET` | `/api/playbook/status` | Local RAG playbook status |
| `GET` | `/api/tool-events` | Live Server-Sent Events stream |
| `GET` | `/api/tools/activity` | Latest activity for all invoked tools |
| `POST` | `/api/tools/activity/reset` | Clear all activity lamps and broadcast the reset |
| `POST` | `/api/agent/investigate` | Investigate and classify candidate alerts |
| `POST` | `/api/agent/disposition` | Record the human alert disposition |
| `POST` | `/api/agent/execute` | Execute an approved confirmed recovery |
| `POST` | `/tools/*` | Invoke an explicitly approved operational tool |

## Architecture

- `src/App.jsx` renders the terminal simulator, alert workflow, activity board, human gates, and audit timeline.
- `server/index.js` exposes the API, operational routes, SSE activity stream, and production frontend.
- `server/agent.js` runs the OpenAI Responses API investigation and tool-selection loop.
- `server/events.js` defines incident signals, expected classifications, and minimum-safe tool sets.
- `server/tool-runtime.js` validates recovery plans and emits real-time operational activity.
- `server/sop-playbook.js` provides the local lexical RAG index.
- `docs/PSA-SOP-PLAYBOOK.md` is the versioned operational playbook source.
- `Dockerfile` builds the Vite frontend and creates the production Node.js image.

## Troubleshooting

- **Blank or outdated UI after code changes:** stop all old `npm run dev` processes, restart the command, and refresh the browser.
- **Agent investigation fails:** verify `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env`.
- **Docker page is unreachable:** confirm port `8787` is published and `API_HOST` is `0.0.0.0` inside the container.
- **Port already in use:** stop the previous local process/container or choose another host mapping, such as `-p 8790:8787`.
- **Endpoint stream reconnecting:** confirm the backend is running and `/api/tool-events` is reachable through the same application origin.
