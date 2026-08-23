# PSA Port Resilience Simulator

An interactive React prototype for a PSA hackathon. The port map feeds a human-governed alert control station: an operator acknowledges a candidate alert, an AI agent investigates and classifies it, the operator records a true/false/inconclusive disposition, and confirmed incidents require a separate recovery approval before any operational endpoint can run.

## Run locally

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Add your OpenAI API key to `.env`:

   ```dotenv
   OPENAI_API_KEY=your_api_key_here
   OPENAI_MODEL=gpt-5.4-mini
   API_PORT=8787
   ```

3. Start the React app and API together:

   ```bash
   npm run dev
   ```

4. Open the local URL printed by Vite (normally `http://localhost:5173`).

The API key is read only by the Node backend and is never sent to the browser. The recovery workflow requires a configured key so that successful incidents always represent a real agent investigation rather than a prefilled expected answer.

## Demo flow

1. Click an object on the terminal map, choose a disruption, set its time, and select **Insert on timeline**. Add as many incidents as needed across the 06:00–22:00 simulation day.
2. Choose a simulation speed (**0.5×**, **1×**, **2×**, or **4×**) and select **Play simulation**. At 1× the clock advances by 15 simulated minutes every two seconds; every speed automatically pauses whenever alerts arrive, leaving unlimited real time for operator review and the LLM response.
3. Multiple disruptions can share the same timestamp. Their markers stack on the timeline and they are released as one visible incident batch, while retaining each affected asset and signal set.
4. Review the clock-released candidate alert batch in **Live alert intake**. No AI or operational endpoint is called yet.
5. Select **Acknowledge & investigate**. All simultaneous alerts are sent together. The agent inspects signals and current port state, retrieves relevant SOP guidance, then classifies the batch as **confirmed**, **false alarm**, or **inconclusive**.
6. Review the diagnosis, evidence, confidence, and cited SOP passages. Record a human disposition with **Confirm incident**, **Mark false alarm**, or **Request inspection**.
7. Confirmed incidents expose the recovery proposal behind a separate **Approve & execute** gate. False alarms close with no endpoints, while inconclusive alerts stop for further inspection.
8. Only the approved combined endpoint set is dispatched, and each result appears in **Operational tool execution**.

Open **Agent chat** in the left navigation to see the actual system release, operator request, LLM response, proposed tools, approval message, and recovery result. The side panel keeps the complete active incident batch visible throughout the conversation.

The **Agent activity board** is an industrial-style annunciator panel driven by recorded actions rather than an animation script. Alert intake, telemetry, port-state reads, SOP RAG retrieval, and human approval illuminate only while those stages are active. All twelve operational channels remain dark until proposed; proposed tools receive an amber ring, and only invoked endpoints illuminate green. The adjacent readout links the selected tools to the retrieved SOP and shows whether the plan matches.

The left navigation contains only **Control station**, **Agent chat**, and **SOP playbook**. The playbook tab exposes all eight RAG procedures, their trigger signals, mandatory immediate tools, and a live `MATCHED`, `INCOMPLETE`, or `NOT ACTIVE` comparison against the agent’s plan and executed endpoints.

For example, toppled containers on a vessel require exactly Tool 01 (`POST /tools/stop-lifts`) and Tool 04 (`POST /tools/establish-exclusion-zone`). The execution API rejects requests without explicit human approval and rejects over-broad or incomplete tool combinations.

## Architecture

- `src/App.jsx` renders the interactive terminal, timed simulation day, alert control station, activity lights, human gates, and audit log.
- `server/events.js` defines object-specific disruptions, emitted signals, hidden diagnoses, and the minimum safe tool sets used by the simulator validator.
- `docs/PSA-SOP-PLAYBOOK.md` is the versioned source document for eight incident-response procedures and their minimum immediate tool plans.
- `server/sop-playbook.js` chunks and retrieves relevant SOP sections with a self-contained lexical RAG index for this MVP.
- `server/agent.js` runs a diagnostic-only OpenAI Responses API function-calling loop, requires the SOP RAG call, and returns a grounded proposal for human approval.
- `server/tool-runtime.js` defines the simulated operational endpoints and executes only the approved, validated tool plan.
- `server/index.js` separates investigation (`POST /api/agent/investigate`), human disposition (`POST /api/agent/disposition`), and approved execution (`POST /api/agent/execute`) and exposes playbook status at `GET /api/playbook/status`.

The local retriever keeps the demo portable and auditable. It can later be replaced by a hosted vector store and file-search tool without changing the human approval or endpoint execution gates.

For a production build, run `npm run build`, then `npm start`.
