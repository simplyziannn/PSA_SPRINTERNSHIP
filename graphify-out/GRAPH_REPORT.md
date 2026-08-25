# Graph Report - PSA2026  (2026-08-24)

## Corpus Check
- Corpus is ~11,652 words - fits in a single context window. You may not need a graph.

## Summary
- 201 nodes · 258 edges · 14 communities (11 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Product Intent & UI
- UI Primitives & Scheduling
- Agent & Event Backend
- SOP Playbook Procedures
- Simulation Workflow State
- Build & Tooling
- Runtime Dependencies
- Human-Gated Response Flow
- Critical Safety Procedures
- Error Boundary
- Scenario Catalog
- Approval Gate
- Operational Channels

## God Nodes (most connected - your core abstractions)
1. `App()` - 15 edges
2. `PSA Port Resilience Simulator` - 13 edges
3. `makeLog()` - 11 edges
4. `PSA Terminal Incident Response Playbook` - 11 edges
5. `formatSimTime()` - 9 edges
6. `scripts` - 7 edges
7. `Human-governed alert control station` - 6 edges
8. `AI agent` - 6 edges
9. `executeInvestigationTool()` - 5 edges
10. `getPlaybookEntries()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `PSA Port Resilience Simulator` --semantically_similar_to--> `PSA Port Alert Control`  [INFERRED] [semantically similar]
  README.md → index.html
- `Interactive React prototype` --semantically_similar_to--> `PSA Port Alert Control`  [INFERRED] [semantically similar]
  README.md → index.html
- `Tool 01: POST /tools/stop-lifts` --semantically_similar_to--> `tool_01_stop_lifts`  [INFERRED] [semantically similar]
  README.md → docs/PSA-SOP-PLAYBOOK.md
- `Tool 04: POST /tools/establish-exclusion-zone` --semantically_similar_to--> `tool_04_exclusion_zone`  [INFERRED] [semantically similar]
  README.md → docs/PSA-SOP-PLAYBOOK.md
- `server/sop-playbook.js` --references--> `PSA Terminal Incident Response Playbook`  [EXTRACTED]
  README.md → docs/PSA-SOP-PLAYBOOK.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Human-governed alert recovery flow** — readme_candidate_alert, readme_ai_agent, readme_human_disposition, readme_recovery_approval_gate, readme_operational_endpoint [EXTRACTED 1.00]
- **SOP retrieval, approval, and execution pipeline** — readme_sop_rag_retrieval, docs_psa_sop_playbook_psa_terminal_incident_response_playbook, readme_human_approval, readme_approved_tool_plan, readme_operational_tool_execution [EXTRACTED 1.00]
- **SOP-01 minimum containment tool plan** — docs_psa_sop_playbook_sop_01_on_deck_container_stack_collapse, docs_psa_sop_playbook_tool_01_stop_lifts, docs_psa_sop_playbook_tool_04_exclusion_zone [EXTRACTED 1.00]

## Communities (14 total, 3 thin omitted)

### Community 0 - "Product Intent & UI"
Cohesion: 0.07
Nodes (37): PSA Port Alert Control, React root mount, src/main.jsx, Agent chat, AI agent, src/App.jsx, Candidate alert, Confirmed incident (+29 more)

### Community 1 - "UI Primitives & Scheduling"
Cohesion: 0.07
Nodes (7): actionsByType, Header(), iconPaths, parseSimTime(), PLAYBACK_RATES, SimulationTimeline(), stages

### Community 2 - "Agent & Event Backend"
Cohesion: 0.12
Nodes (23): executeInvestigationTool(), investigateAlert(), investigationTools, operationalToolIds, portStateFor(), allowedSolutionIds, buildEvent(), eventTemplates (+15 more)

### Community 3 - "SOP Playbook Procedures"
Cohesion: 0.10
Nodes (23): Minimum immediate containment actions, PSA Terminal Incident Response Playbook, SOP-03 Crane hydraulic degradation, SOP-03 trigger signals, SOP-04 Crane electrical bus instability, SOP-04 trigger signals, SOP-05 trigger signals, SOP-05 Vessel arrival and tug-window conflict (+15 more)

### Community 4 - "Simulation Workflow State"
Cohesion: 0.19
Nodes (17): App(), acknowledgeAndInvestigate(), approveRecovery(), openAlert(), rejectRecovery(), resetDay(), scheduleDisruption(), submitDisposition() (+9 more)

### Community 5 - "Build & Tooling"
Cohesion: 0.11
Nodes (18): concurrently, devDependencies, concurrently, vite, @vitejs/plugin-react, name, private, scripts (+10 more)

### Community 6 - "Runtime Dependencies"
Cohesion: 0.18
Nodes (11): dotenv, express, openai, dependencies, dotenv, express, openai, react (+3 more)

### Community 7 - "Human-Gated Response Flow"
Cohesion: 0.18
Nodes (11): Acknowledge & investigate, Agent activity board, Approved combined endpoint set, POST /api/agent/execute, Execution API, Explicit human approval, Incident batch, Live alert intake (+3 more)

### Community 8 - "Critical Safety Procedures"
Cohesion: 0.28
Nodes (9): SOP-01 On-deck container stack collapse, SOP-01 trigger signals, SOP-02 Structurally damaged yard container, SOP-02 trigger signals, tool_01_stop_lifts, tool_04_exclusion_zone, tool_10_inspection, Tool 01: POST /tools/stop-lifts (+1 more)

### Community 10 - "Scenario Catalog"
Cohesion: 0.40
Nodes (3): scenarioById, scenarios, solutions

## Knowledge Gaps
- **73 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+68 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PSA Terminal Incident Response Playbook` connect `SOP Playbook Procedures` to `Critical Safety Procedures`, `Product Intent & UI`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `server/sop-playbook.js` connect `Product Intent & UI` to `SOP Playbook Procedures`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _73 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Product Intent & UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06906906906906907 - nodes in this community are weakly interconnected._
- **Should `UI Primitives & Scheduling` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Agent & Event Backend` be split into smaller, more focused modules?**
  _Cohesion score 0.12169312169312169 - nodes in this community are weakly interconnected._
- **Should `SOP Playbook Procedures` be split into smaller, more focused modules?**
  _Cohesion score 0.09881422924901186 - nodes in this community are weakly interconnected._