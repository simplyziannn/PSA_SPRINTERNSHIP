import React, { useEffect, useState } from 'react'
import { makeLog } from './simulator.js'

const iconPaths = {
  overview: '<path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z"/><path d="M9 21v-7h6v7"/>',
  incident: '<path d="M10.3 2.8 1.9 18a2 2 0 0 0 1.8 3h16.6a2 2 0 0 0 1.8-3L13.7 2.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  simulation: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
  audit: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/>',
  chat: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.6A2.5 2.5 0 0 1 4 12.5z"/><path d="M8 8h8M8 11h5"/>',
  playbook: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v18a3 3 0 0 1 3-3h.5a2.5 2.5 0 0 1 2.5 2.5z"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 16.5h.01"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8.1 8 9 4.6-.9 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
}

const actionsByType = {
  crane: [
    { id: 'crane_hydraulic_fault', label: 'Hydraulic pressure anomaly', detail: 'Simulate pressure loss under hoist load', severity: 'warning' },
    { id: 'crane_power_fault', label: 'Crane protection trips', detail: 'Simulate bus undervoltage and interruptions', severity: 'critical' },
    { id: 'crane_sensor_false_alarm', label: 'Hydraulic sensor disagreement', detail: 'Simulate a nuisance alert from one drifting sensor', severity: 'warning' },
  ],
  vessel: [
    { id: 'vessel_late_arrival', label: 'Vessel ETA deviation', detail: 'Simulate a late arrival and berth conflict', severity: 'warning' },
    { id: 'vessel_cargo_topple', label: 'Containers toppled on deck', detail: 'Simulate a probable cargo safety incident', severity: 'critical' },
    { id: 'vessel_add_containers', label: 'Unplanned load-list change', detail: 'Add 120 containers after planning cutoff', severity: 'advisory' },
  ],
  container: [
    { id: 'container_add_volume', label: 'Yard stack capacity alert', detail: 'Push the selected block near capacity', severity: 'warning' },
    { id: 'container_damage', label: 'Container damage alert', detail: 'Simulate deformation and lifting risk', severity: 'critical' },
    { id: 'container_damage_inconclusive', label: 'Unconfirmed container damage', detail: 'Simulate insufficient evidence requiring inspection', severity: 'warning' },
    { id: 'container_reefer_alarm', label: 'Reefer temperature drift', detail: 'Simulate synchronized temperature alarms', severity: 'warning' },
  ],
  gate: [{ id: 'gate_ocr_fault', label: 'Gate recognition failure', detail: 'Simulate OCR confidence degradation', severity: 'warning' }],
}

const stages = [
  ['alert', 'Detect'], ['analyzing', 'Investigate'], ['assessment', 'Classify'], ['disposition', 'Disposition'], ['proposal', 'Approve'], ['executing', 'Execute'],
]

const DAY_START = 6 * 60
const DAY_END = 22 * 60
const PLAYBACK_STEP = 15
const PLAYBACK_INTERVAL_MS = 2000
const PLAYBACK_RATES = [0.5, 1, 2, 4]
const TOOL_RESET_DELAY_MS = 4000

function formatSimTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function parseSimTime(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function createAlertBatch(events) {
  const ordered = events.toSorted((a, b) => a.minute - b.minute)
  const severity = ordered.some((event) => event.severity === 'critical') ? 'critical' : ordered.some((event) => event.severity === 'warning') ? 'warning' : 'advisory'
  return {
    id: `batch-${ordered.map((event) => event.id).join('-')}`,
    eventIds: ordered.map((event) => event.id),
    events: ordered,
    object: ordered.length === 1 ? ordered[0].object : { type: 'batch', id: 'incident-batch', label: `${ordered.length} affected assets` },
    action: ordered.length === 1 ? ordered[0].action : 'incident_batch',
    label: ordered.length === 1 ? ordered[0].label : `${ordered.length} simultaneous port alerts`,
    severity,
    time: ordered[0].time,
    minute: ordered[0].minute,
  }
}

function Icon({ name, size = 21 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: iconPaths[name] }} />
}

function Sidebar({ activeView, setActiveView, alertCount }) {
  const nav = [['overview', 'Control station'], ['chat', 'Agent chat'], ['playbook', 'SOP playbook'], ['audit', 'Audit timeline']]
  return <aside className="sidebar">
    <div className="brand"><span className="brand-orbit">◉</span><span>PSA</span></div>
    <nav aria-label="Main navigation">{nav.map(([id, label]) => <button key={id} aria-label={label} className={activeView === id ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView(id)}><Icon name={id}/><span>{label}</span>{id === 'incident' && alertCount > 0 ? <b>{alertCount}</b> : null}</button>)}</nav>
    <div className="system-status"><span>Control room</span><p><i/> Sensor fabric online</p><small>Tuas Terminal · B3–B6</small></div>
  </aside>
}

function Header({ phase, onOpenPanel, panelOpen, currentMinute, queuedAlerts }) {
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer) }, [])
  const live = phase === 'complete' ? 'Incident contained' : phase === 'false_alarm' ? 'False alarm closed' : phase === 'inspection_requested' ? 'Inspection requested' : phase === 'alert' ? 'Acknowledgement required' : phase === 'analyzing' ? 'Agent assessing alert' : phase === 'assessment' ? 'Disposition required' : phase === 'proposal' ? 'Recovery approval required' : phase === 'error' ? 'Response needs attention' : 'Monitoring live signals'
  return <header className="topbar"><div><h1>PSA PORT ALERT CONTROL</h1><p>Human-governed incident response across Tuas Terminal</p></div><div className="header-actions">{onOpenPanel ? <button className={`panel-toggle ${panelOpen ? 'active' : ''}`} onClick={onOpenPanel} aria-expanded={panelOpen} aria-controls="control-station-drawer"><span><Icon name="simulation" size={16}/><b>Simulation &amp; alerts</b></span><small>{formatSimTime(currentMinute)} · {queuedAlerts} queued</small><strong>{panelOpen ? 'Close' : 'Open'}</strong></button> : null}<div className="header-status"><span className={`live-status ${phase}`}><i/>{live}</span><time>{clock.toLocaleTimeString('en-SG', { hour12: false })}<small>SGT</small></time></div></div></header>
}

function AlertSystems({ phase, activeEvent, queuedAlerts }) {
  const activeIncidents = ['complete', 'false_alarm', 'inspection_requested'].includes(phase) ? [] : activeEvent?.events || (activeEvent ? [activeEvent] : [])
  const criticalCount = activeIncidents.filter((event) => event.severity === 'critical').length
  const warningCount = activeIncidents.filter((event) => event.severity === 'warning').length
  const criticalActive = criticalCount > 0
  const warningActive = warningCount > 0
  const cards = [
    { key: 'critical', label: 'Critical alerts', value: String(criticalCount), detail: criticalActive ? `${criticalCount} require human attention` : 'No unresolved hazards', icon: 'alert' },
    { key: 'warning', label: 'Warning alerts', value: warningActive ? String(warningCount) : '2', detail: warningActive ? `${warningCount} new operational ${warningCount === 1 ? 'anomaly' : 'anomalies'}` : '2 monitored deviations', icon: 'incident' },
    { key: 'advisory', label: 'Queued alerts', value: String(queuedAlerts), detail: queuedAlerts ? 'Released by simulation clock' : 'No waiting incidents', icon: 'overview' },
  ]
  return <section className="alert-systems" aria-label="Live port alert systems">{cards.map((card) => <article key={card.key} className={`alert-system ${card.key} ${(criticalActive && card.key === 'critical') || (warningActive && card.key === 'warning') ? 'active' : ''}`}><Icon name={card.icon}/><div><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></div></article>)}</section>
}

function Vessel({ berth, name, status, selected, affected, recovered, action, onSelect }) {
  return <button className={`vessel-column port-object ${selected ? 'selected-object' : ''} ${affected ? 'affected-object' : ''} ${recovered ? 'recovered-object' : ''}`} onClick={() => onSelect({ type: 'vessel', id: name, label: `Vessel ${name}` })} aria-label={`Select vessel ${name}`}>
    <h3>{berth}</h3><strong>{name}</strong><span>{status}</span><div className={`ship ${action === 'vessel_cargo_topple' && affected ? 'cargo-alert' : ''}`}><i/><i/><i/><i/></div>
  </button>
}

function Crane({ id, selected, affected, recovered, onSelect }) {
  return <button className={`crane-unit port-object ${selected ? 'selected-object' : ''} ${affected ? 'offline affected-object' : ''} ${recovered ? 'recovered-object' : ''}`} onClick={() => onSelect({ type: 'crane', id, label: `Crane ${id}` })} aria-label={`Select crane ${id}`}><div className="crane-arm"/><div className="crane-leg"/><span>{id}{affected ? ' !' : recovered ? ' ✓' : ''}</span></button>
}

function Yard({ name, accent, selectedObject, affectedEvents, phase, onSelect }) {
  const incidentActive = !['complete', 'idle', 'false_alarm', 'inspection_requested'].includes(phase)
  const affectedEventFor = (id) => affectedEvents.find((event) => event.object.type === 'container' && event.object.id === id)
  const yardAffected = incidentActive && affectedEvents.some((event) => event.object.type === 'container' && event.object.id.startsWith(name))
  return <div className={`yard ${yardAffected ? 'congested' : ''}`}><h4>{name}</h4><div className="stacks">{Array.from({ length: 24 }, (_, index) => {
    const id = `${name}-C${index + 1}`
    const affectedEvent = affectedEventFor(id)
    const recovered = phase === 'complete' && Boolean(affectedEvent)
    return <button key={id} className={`container-block ${accent && index % 5 < 2 ? 'green' : index % 11 === 0 ? 'amber' : ''} ${selectedObject?.id === id ? 'selected-object' : ''} ${incidentActive && affectedEvent ? 'affected-object' : ''} ${recovered ? 'recovered-object' : ''}`} onClick={() => onSelect({ type: 'container', id, label: `Container ${id}` })} aria-label={`Select container ${id}`}/>
  })}</div></div>
}

function PortMap({ selectedObject, activeEvent, phase, onSelect }) {
  const affectedEvents = activeEvent?.events || (activeEvent ? [activeEvent] : [])
  const affectedEventFor = (type, id) => affectedEvents.find((event) => event.object?.type === type && event.object?.id === id)
  const isAffected = (type, id) => Boolean(affectedEventFor(type, id))
  const incidentActive = !['complete', 'idle', 'false_alarm', 'inspection_requested'].includes(phase)
  const vesselStatus = (name, fallback) => {
    const affectedEvent = affectedEventFor('vessel', name)
    if (!affectedEvent) return fallback
    if (phase === 'complete') {
      if (affectedEvent.action === 'vessel_cargo_topple') return 'Cargo secured'
      if (affectedEvent.action === 'vessel_late_arrival') return 'Resequenced'
      return 'Plan rebalanced'
    }
    if (affectedEvent.action === 'vessel_cargo_topple') return 'DECK ALERT'
    if (affectedEvent.action === 'vessel_late_arrival') return 'ETA +4.8h'
    return '+120 boxes'
  }
  return <section className="port-panel" aria-label="Interactive Tuas terminal simulator map">
    <div className="map-heading"><div><strong>Port map · Tuas Terminal</strong><span>Click an asset to schedule a disruption</span></div><span className={`map-live ${activeEvent ? 'map-focus' : ''}`}><i/> {activeEvent ? `FOCUS · ${activeEvent.object?.label || 'affected assets'}` : 'LIVE'}</span></div>
    <div className="legend"><span><i className="dot blue"/>Operational</span><span><i className="dot amber"/>Selected</span><span><i className="dot red"/>Alert</span></div>
    <div className="berths">
      {[
        ['Tuas B3', 'PSA-101', 'On time'], ['Tuas B4', 'PSA-108', 'On time'], ['Tuas B5', 'PSA-205', 'Berth idle'], ['Tuas B6', 'PSA-309', 'On time'],
      ].map(([berth, name, fallback]) => <Vessel key={name} berth={berth} name={name} status={vesselStatus(name, fallback)} selected={selectedObject?.id === name} affected={isAffected('vessel', name) && incidentActive} recovered={isAffected('vessel', name) && phase === 'complete'} action={affectedEventFor('vessel', name)?.action} onSelect={onSelect}/>) }
    </div>
    <div className="quay">{['QC-01','QC-02','QC-03','QC-04','QC-05','QC-06','QC-07','QC-08'].map((id) => <Crane key={id} id={id} selected={selectedObject?.id === id} affected={isAffected('crane', id) && incidentActive} recovered={isAffected('crane', id) && phase === 'complete'} onSelect={onSelect}/>)}</div>
    <div className="terminal-road top-road"/>
    <div className="yards"><Yard name="Yard A" selectedObject={selectedObject} affectedEvents={affectedEvents} phase={phase} onSelect={onSelect}/><Yard name="Yard B" accent selectedObject={selectedObject} affectedEvents={affectedEvents} phase={phase} onSelect={onSelect}/><Yard name="Yard C" selectedObject={selectedObject} affectedEvents={affectedEvents} phase={phase} onSelect={onSelect}/></div>
    <div className="terminal-road bottom-road"/><div className="truck one">▰</div><div className="truck two">▰</div><div className="truck three">▰</div>
    <button className={`gate port-object ${selectedObject?.type === 'gate' ? 'selected-object' : ''} ${isAffected('gate', 'Gate-2') && incidentActive ? 'affected-object' : ''} ${isAffected('gate', 'Gate-2') && phase === 'complete' ? 'recovered-object' : ''}`} onClick={() => onSelect({ type: 'gate', id: 'Gate-2', label: 'Gate 2' })}><strong>Gate 2</strong><span>↑</span><span>↓</span></button>
  </section>
}

function EventDrawer({ selectedObject, activeEvent, onSchedule }) {
  const [chosenAction, setChosenAction] = useState(null)
  const [scheduledTime, setScheduledTime] = useState('09:00')
  useEffect(() => { setChosenAction(null) }, [selectedObject?.id])
  if (!selectedObject) return null
  const actions = actionsByType[selectedObject.type] || []
  return <section className="event-drawer"><div><small>SCHEDULE DISRUPTION ON</small><strong>{selectedObject.label}</strong><label>Simulation time<input aria-label="Disruption time" type="time" min="06:00" max="22:00" step="900" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)}/></label><button className="schedule-button" disabled={!chosenAction} onClick={() => { onSchedule(chosenAction, scheduledTime); setChosenAction(null) }}>Insert on timeline</button></div><div className="event-options">{actions.map((action) => <button key={action.id} className={chosenAction?.id === action.id || activeEvent?.events?.some((event) => event.action === action.id) ? 'selected' : ''} onClick={() => setChosenAction(action)}><i className={action.severity}/><span><strong>{action.label}</strong><small>{action.detail}</small></span><b>{chosenAction?.id === action.id ? '✓' : '＋'}</b></button>)}</div></section>
}

function SimulationTimeline({ currentMinute, playing, playbackRate, scheduledEvents, onToggle, onReset, onRateChange, onOpenAlert }) {
  const progress = ((currentMinute - DAY_START) / (DAY_END - DAY_START)) * 100
  const lanes = new Map()
  const stackedEvents = scheduledEvents.toSorted((a, b) => a.minute - b.minute).map((event) => {
    const stackIndex = lanes.get(event.minute) || 0
    lanes.set(event.minute, stackIndex + 1)
    return { ...event, stackIndex }
  })
  const maxStack = Math.max(1, ...lanes.values())
  const secondsPerStep = PLAYBACK_INTERVAL_MS / playbackRate / 1000
  return <section className="simulation-timeline" aria-label="Simulation day timeline"><div className="timeline-controls"><button className={`play-button ${playing ? 'playing' : ''}`} onClick={onToggle} aria-label={playing ? 'Pause simulation' : 'Play simulation'}>{playing ? 'Ⅱ' : '▶'}</button><div><span>SIMULATION DAY</span><strong>{formatSimTime(currentMinute)} <small>SGT</small></strong></div><button className="reset-button" onClick={onReset}>Reset day</button><div className="speed-control" role="group" aria-label="Simulation speed"><span>SPEED</span>{PLAYBACK_RATES.map((rate) => <button key={rate} className={playbackRate === rate ? 'active' : ''} aria-label={`Set simulation speed ${rate}x`} onClick={() => onRateChange(rate)}>{rate}×</button>)}</div><small>15 simulated minutes every {secondsPerStep}s · auto-pauses on alerts</small></div><div className="timeline-track" style={{ height: `${56 + (maxStack - 1) * 13}px` }}><div className="timeline-progress" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/><i className="time-cursor" style={{ left: `${Math.max(0, Math.min(100, progress))}%` }}/>{[6, 10, 14, 18, 22].map((hour) => <span key={hour} className="time-tick" style={{ left: `${((hour * 60 - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}>{String(hour).padStart(2, '0')}:00</span>)}{stackedEvents.map((event) => <button key={event.id} aria-label={`${event.label} at ${event.time}`} className={`timeline-event ${event.severity} ${event.status}`} style={{ left: `${((event.minute - DAY_START) / (DAY_END - DAY_START)) * 100}%`, top: `${29 + event.stackIndex * 13}px` }} onClick={() => event.status === 'detected' && onOpenAlert(event)}><i/><span>{event.time}<b>{event.label}</b>{lanes.get(event.minute) > 1 ? <em>{lanes.get(event.minute)} alerts at this time</em> : null}</span></button>)}</div><div className="timeline-queue">{scheduledEvents.length === 0 ? <span>No disruptions scheduled. Select a port object, choose an alert, and insert it at a time.</span> : stackedEvents.map((event) => <button key={event.id} className={event.status} onClick={() => event.status === 'detected' && onOpenAlert(event)}><time>{event.time}</time><span>{event.object.label}</span><strong>{event.label}</strong><b>{event.status === 'detected' ? 'Open alert' : event.status}</b></button>)}</div></section>
}

function ControlStationDrawer({ open, onClose, phase, activeEvent, queuedAlerts, currentMinute, playing, playbackRate, scheduledEvents, onToggle, onReset, onRateChange, onOpenAlert }) {
  if (!open) return null
  return <>
    <button className="drawer-scrim" onClick={onClose} aria-label="Close simulation and alerts panel" />
    <aside id="control-station-drawer" className="control-station-drawer" aria-label="Simulation and alert controls">
      <header className="drawer-header"><div><span>CONTROL ROOM UTILITIES</span><h2>Simulation &amp; alerts</h2><p>Open only when you need to change the day or inspect the alert queue.</p></div><button onClick={onClose} aria-label="Close simulation and alerts panel">×</button></header>
      <div className="drawer-body"><AlertSystems phase={phase} activeEvent={activeEvent} queuedAlerts={queuedAlerts}/><SimulationTimeline currentMinute={currentMinute} playing={playing} playbackRate={playbackRate} scheduledEvents={scheduledEvents} onToggle={onToggle} onReset={onReset} onRateChange={onRateChange} onOpenAlert={onOpenAlert}/></div>
    </aside>
  </>
}

function IncidentFocus({ phase, activeEvent, proposal }) {
  if (!activeEvent) return null
  const incidents = activeEvent.events || [activeEvent]
  const focusLabel = incidents.map((incident) => incident.object?.label).filter(Boolean).join(' · ')
  const state = phase === 'alert' ? 'Awaiting operator acknowledgement' : phase === 'analyzing' ? 'Agent assessing candidate alert' : phase === 'assessment' ? 'Human disposition required' : phase === 'proposal' ? 'Recovery approval required' : phase === 'executing' ? 'Approved recovery executing' : phase === 'complete' ? 'Incident contained' : phase === 'false_alarm' ? 'False alarm closed' : phase === 'inspection_requested' ? 'Further inspection requested' : phase === 'rejected' ? 'Recovery declined' : 'Response needs attention'
  return <section className={`incident-focus ${activeEvent.severity}`} aria-label="Current incident focus"><div className="incident-focus-main"><div className="incident-focus-meta"><span>CURRENT INCIDENT</span><b>{activeEvent.severity === 'critical' ? 'CRITICAL' : activeEvent.severity === 'warning' ? 'WARNING' : 'ADVISORY'}</b><time>{activeEvent.time}</time></div><h2>{activeEvent.label}</h2><p>{focusLabel || `${incidents.length} affected assets`} · {incidents.length} incident{incidents.length === 1 ? '' : 's'} in current response</p></div><div className="incident-focus-response"><span>RESPONSE STATUS</span><strong>{proposal?.recommendation || state}</strong>{proposal?.confidence ? <small>{Math.round(proposal.confidence * 100)}% agent confidence</small> : <small>Human-governed response workflow</small>}</div></section>
}

function AgentActivityBoard({ phase, activeEvent, proposal, playbook, toolActivity, toolStreamState, onOpenPlaybook }) {
  const [showTechnical, setShowTechnical] = useState(false)
  const trace = proposal?.trace || []
  const called = (type) => trace.some((item) => item.type === type)
  const processLights = [
    { key: 'alert', label: 'Alert intake', detail: activeEvent ? `${activeEvent.events?.length || 1} alert${activeEvent.events?.length === 1 ? '' : 's'}` : 'Waiting for alert', lit: Boolean(activeEvent) && phase !== 'complete', tone: 'red' },
    { key: 'signals', label: 'Telemetry', detail: called('inspection') ? `${trace.filter((item) => item.type === 'inspection').length} checks` : activeEvent ? 'Ready after acknowledgement' : 'Waiting', lit: called('inspection') && !['executing', 'complete'].includes(phase), tone: 'blue' },
    { key: 'state', label: 'Port state', detail: called('state') ? 'Loaded' : activeEvent ? 'Ready after acknowledgement' : 'Waiting', lit: called('state') && !['executing', 'complete'].includes(phase), tone: 'blue' },
    { key: 'rag', label: 'SOP guidance', detail: proposal?.ragUsed ? `${proposal.sopReferences?.length || 0} matches` : proposal ? 'Not referenced' : 'Waiting', lit: proposal?.ragUsed && !['executing', 'complete'].includes(phase), tone: 'blue' },
    { key: 'approval', label: 'Human disposition', detail: phase === 'assessment' ? 'Action required' : ['proposal', 'executing', 'complete'].includes(phase) ? 'Confirmed' : phase === 'false_alarm' ? 'Closed false' : phase === 'inspection_requested' ? 'Inspection queued' : 'Waiting', lit: ['assessment', 'proposal'].includes(phase), tone: 'amber' },
  ]
  const proposedIds = new Set(proposal?.proposedTools?.map((tool) => tool.id) || [])
  const latestToolActivity = Object.values(toolActivity).toSorted((left, right) => (left.invokedAt || left.startedAt).localeCompare(right.invokedAt || right.startedAt)).at(-1)
  useEffect(() => { if (latestToolActivity?.invocationId) setShowTechnical(true) }, [latestToolActivity?.invocationId])
  const activeSopIds = new Set(proposal?.sopReferences?.map((reference) => reference.id) || [])
  const tools = playbook.tools.length ? playbook.tools : Array.from({ length: 12 }, (_, index) => ({ id: `tool_${String(index + 1).padStart(2, '0')}`, number: String(index + 1).padStart(2, '0'), name: 'Operational channel' }))
  const matchedSops = playbook.entries.filter((entry) => activeSopIds.has(entry.id))
  const activityTitle = phase === 'idle' ? 'System ready' : phase === 'alert' ? 'Operator acknowledgement required' : phase === 'analyzing' ? 'Agent assessing candidate alert' : phase === 'assessment' ? 'Human disposition required' : phase === 'proposal' ? 'Recovery approval required' : phase === 'executing' ? 'Approved recovery executing' : phase === 'complete' ? 'Incident contained' : phase === 'false_alarm' ? 'False alarm closed' : phase === 'inspection_requested' ? 'Further inspection requested' : phase === 'rejected' ? 'Recovery declined' : 'Response needs attention'
  const activityDetail = activeEvent ? `${activeEvent.label} · ${activeEvent.object?.label || `${activeEvent.events?.length || 1} affected assets`}` : 'Monitoring telemetry and awaiting alerts.'
  return <section className={`annunciator-board ${showTechnical ? 'technical-open' : ''}`} aria-label="Agent activity board"><header><div><span>AGENT ACTIVITY</span><h3>{activeEvent ? 'Incident response activity' : 'System activity'}</h3></div><div className="board-header-actions"><span className={`endpoint-stream ${toolStreamState}`}><i/> Endpoint stream {toolStreamState}</span><div className="board-legend"><span><i className="blue"/>Normal</span><span><i className="amber"/>Attention</span><span><i className="green"/>Complete</span><span><i className="red"/>Incident</span></div><button className="technical-toggle" onClick={() => setShowTechnical((value) => !value)} aria-expanded={showTechnical}>{showTechnical ? 'Hide technical details' : 'View technical details'} <span>{showTechnical ? '⌃' : '⌄'}</span></button></div></header>{showTechnical ? <div className="board-surface"><div className="process-bank">{processLights.map((node) => <article key={node.key} className={`board-channel ${node.lit ? 'lit' : ''} ${node.tone}`}><div><strong>{node.label}</strong><small>{node.detail}</small></div><i className="board-lamp" aria-label={`${node.label}: ${node.lit ? 'active' : 'inactive'}`}/></article>)}</div><div className="tool-bank"><div className="bank-label"><span>OPERATIONAL TOOL CHANNELS</span><small>Blue = invoking · Green = completed for 4 seconds</small></div>{tools.map((tool) => {
    const linkedSops = matchedSops.filter((entry) => entry.toolIds.includes(tool.id))
    const liveActivity = toolActivity[tool.id]
    const invoked = liveActivity?.status === 'completed'
    const invoking = liveActivity?.status === 'invoking' || (phase === 'executing' && proposedIds.has(tool.id) && !invoked)
    const armed = ['assessment', 'proposal'].includes(phase) && proposedIds.has(tool.id) && !invoked && !invoking
    const status = invoked ? 'completed' : invoking ? 'invoking' : armed ? 'proposed' : 'inactive'
    const source = liveActivity?.source === 'external' ? 'External API' : liveActivity?.source === 'agent' ? 'Agent execution' : null
    return <article key={tool.id} className={`tool-channel ${invoked ? 'lit' : ''} ${invoking ? 'invoking' : ''} ${armed ? 'armed' : ''}`}><i className="board-lamp" aria-label={`Tool ${tool.number}: ${status}`}/><div><strong>TOOL {tool.number}</strong><span>{tool.name}</span><small>{source ? `${source} · ${status}` : linkedSops.length ? linkedSops.map((entry) => entry.id).join(' · ') : 'No active SOP link'}</small></div></article>
  })}</div><aside className="sop-match-readout"><span>CURRENT INCIDENT / SOP MATCH</span>{matchedSops.length ? matchedSops.map((entry) => {
    const selected = entry.toolIds.filter((id) => proposedIds.has(id))
    const matched = selected.length === entry.toolIds.length
    return <article key={entry.id} className={matched ? 'matched' : 'mismatch'}><div><b>{entry.id}</b><strong>{entry.title}</strong></div><p>Required: {entry.toolIds.map((id) => id.match(/tool_(\d+)/)?.[1]).join(', ')}</p><small>{matched ? '✓ Agent tool selection matches SOP' : `${selected.length}/${entry.toolIds.length} required tools selected`}</small></article>
  }) : <div className="readout-empty"><i/><p>No relevant SOP yet</p><small>Relevant SOPs will appear here once the incident is analysed.</small></div>}<button onClick={onOpenPlaybook}>Open full SOP playbook →</button></aside></div> : <div className="agent-summary"><div className={`agent-summary-focus ${activeEvent ? `focus-${phase}` : 'ready'}`}><i/><div><span>{activeEvent ? 'CURRENT RESPONSE' : 'SYSTEM READY'}</span><strong>{activityTitle}</strong><small>{activityDetail}</small></div></div><div className="agent-summary-grid">{processLights.map((node) => <article key={node.key} className={`${node.lit ? 'lit' : ''} ${node.tone}`}><i className="summary-dot"/><div><strong>{node.label}</strong><span>{node.detail}</span></div>{node.lit ? <b>Live</b> : null}</article>)}</div></div>}</section>
}

function StageStepper({ phase }) {
  const phaseIndex = { idle: -1, alert: 0, analyzing: 1, assessment: 2, false_alarm: 3, inspection_requested: 3, proposal: 4, executing: 5, complete: 6, rejected: 4, error: 1 }[phase] ?? -1
  const terminalDisposition = ['false_alarm', 'inspection_requested'].includes(phase)
  return <div className="stage-stepper" aria-label="Response workflow">{stages.map(([id, label], index) => { const completed = phase === 'complete' || index < phaseIndex || (terminalDisposition && index <= 3); const current = !terminalDisposition && index === phaseIndex; return <div key={id} className={`${completed ? 'completed' : ''} ${current ? 'current' : ''} ${!completed && !current ? 'future' : ''}`}><i>{completed ? '✓' : current ? '●' : index + 1}</i><span>{label}</span></div> })}</div>
}

function AlertIntake({ phase, activeEvent, onAcknowledge }) {
  if (!activeEvent) return <section className="workflow-section alert-intake empty"><div className="section-number">1</div><div><h3>Live alert intake</h3><p>System ready. Monitoring telemetry and awaiting alerts.</p></div></section>
  const acknowledged = phase !== 'alert'
  const incidents = activeEvent.events || [activeEvent]
  return <section className={`workflow-section alert-intake ${activeEvent.severity} ${phase === 'alert' ? 'current-step' : 'completed-step'}`}><div className="section-number">1</div><div className="alert-symbol"><Icon name="alert" size={28}/></div><div className="alert-copy"><h3>{activeEvent.label}</h3><strong>{acknowledged ? 'Acknowledged by operator' : `${incidents.length} candidate alert${incidents.length === 1 ? '' : 's'} awaiting acknowledgement`}</strong><div className="alert-batch-list">{incidents.map((incident) => <p key={incident.id}><b>{incident.label}</b><span>{incident.object.label} · {incident.time}</span></p>)}</div></div>{phase === 'alert' ? <button className="verify-button" onClick={onAcknowledge}>Acknowledge &amp; investigate</button> : <span className="verified-mark">✓ Sent</span>}</section>
}

function AgentChat({ phase, activeEvent, proposal, execution, messages, onBack }) {
  const incidents = activeEvent?.events || []
  return <section className="agent-chat-view" aria-label="Agent conversation"><header><div><span>HUMAN–AGENT TRANSCRIPT</span><h2>Port recovery agent chat</h2><p>Only clock-released, operator-acknowledged candidate alerts enter this conversation.</p></div><button onClick={onBack}>← Back to control station</button></header><div className="chat-layout"><div className="chat-thread" aria-live="polite">{messages.map((message) => <article key={message.id} className={`chat-message ${message.role}`}><div className="chat-avatar">{message.role === 'operator' ? 'OP' : message.role === 'agent' ? 'AI' : 'SYS'}</div><div><span>{message.role === 'operator' ? 'Control operator' : message.role === 'agent' ? 'Recovery agent' : 'System gateway'}<time>{message.time}</time></span><p>{message.body}</p>{message.tools?.length ? <div className="chat-tools">{message.tools.map((tool) => <code key={tool.id}>Tool {tool.number} · {tool.name}</code>)}</div> : null}</div></article>)}{phase === 'analyzing' ? <article className="chat-message agent typing"><div className="chat-avatar">AI</div><div><span>Recovery agent</span><p><i/><i/><i/> Investigating acknowledged candidate alerts and retrieving SOP guidance…</p></div></article> : null}</div><aside className="chat-context"><span>ACTIVE ALERT CONTEXT</span><strong>{incidents.length || 0} candidate alert{incidents.length === 1 ? '' : 's'} in current batch</strong>{incidents.map((incident) => <article key={incident.id}><i className={incident.severity}/><div><b>{incident.label}</b><small>{incident.object.label} · released {incident.time}</small></div></article>)}<div className="chat-gates"><p><span>Agent state</span><b>{phase === 'analyzing' ? 'Thinking' : proposal ? 'Responded' : 'Waiting'}</b></p><p><span>Classification</span><b>{proposal?.classification?.replace('_', ' ') || 'Pending'}</b></p><p><span>Tool gateway</span><b>{execution?.executions ? `${execution.executions.length} invoked` : 'Approval gated'}</b></p></div></aside></div></section>
}

function SopPlaybook({ playbook, proposal, execution, onBack }) {
  const [query, setQuery] = useState('')
  const toolById = new Map(playbook.tools.map((tool) => [tool.id, tool]))
  const activeSopIds = new Set(proposal?.sopReferences?.map((reference) => reference.id) || [])
  const selectedToolIds = new Set(proposal?.proposedTools?.map((tool) => tool.id) || [])
  const invokedToolIds = new Set(execution?.executions?.filter((tool) => tool.status === 'completed').map((tool) => tool.id) || [])
  const normalizedQuery = query.trim().toLowerCase()
  const entries = playbook.entries.filter((entry) => !normalizedQuery || `${entry.id} ${entry.title} ${entry.triggers.join(' ')} ${entry.toolIds.join(' ')}`.toLowerCase().includes(normalizedQuery))
  return <section className="playbook-view" aria-label="SOP playbook"><header><div><h2>SOP playbook</h2><p>Compare the agent’s selected endpoints against every approved immediate-containment procedure.</p></div><button onClick={onBack}>← Back to control station</button></header><div className="playbook-toolbar"><label>Search playbook<input aria-label="Search SOP playbook" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SOP, incident, trigger, or tool…"/></label><div><span><i className="matched"/>Matched</span><span><i className="active"/>Active / incomplete</span><span><i/>Not active</span></div><strong>{playbook.entries.length} procedures · {playbook.tools.length} tools</strong></div><div className="playbook-table" role="table" aria-label="SOP procedures"><div className="playbook-row playbook-head" role="row"><span>SOP</span><span>Incident and trigger signals</span><span>Mandatory immediate tools</span><span>Agent comparison</span></div>{entries.map((entry) => {
    const isActive = activeSopIds.has(entry.id)
    const selectedCount = entry.toolIds.filter((id) => selectedToolIds.has(id)).length
    const invokedCount = entry.toolIds.filter((id) => invokedToolIds.has(id)).length
    const matched = isActive && selectedCount === entry.toolIds.length
    const status = matched ? 'MATCHED' : isActive ? 'INCOMPLETE' : 'NOT ACTIVE'
    return <article className={`playbook-row ${matched ? 'matched' : isActive ? 'active' : ''}`} role="row" key={entry.id}><div><b>{entry.id}</b><small>RAG CHUNK</small></div><div><strong>{entry.title}</strong><p>{entry.triggers.join(' · ')}</p></div><div className="mandatory-tools">{entry.toolIds.map((id) => { const tool = toolById.get(id); const selected = isActive && selectedToolIds.has(id); const invoked = isActive && invokedToolIds.has(id); return <span key={id} className={invoked ? 'invoked' : selected ? 'selected' : ''}><i/>Tool {tool?.number || id.match(/tool_(\d+)/)?.[1]} · {tool?.name || id}</span> })}</div><div className="sop-status"><b>{status}</b>{isActive ? <small>{invokedCount ? `${invokedCount}/${entry.toolIds.length} endpoints invoked` : `${selectedCount}/${entry.toolIds.length} required tools selected`}</small> : <small>Not retrieved for current incident</small>}</div></article>
  })}{entries.length === 0 ? <div className="playbook-empty">No SOP matches “{query}”.</div> : null}</div></section>
}

function AgentAssessment({ phase, proposal, error, onRetry }) {
  const waiting = ['idle', 'alert'].includes(phase)
  const status = phase === 'analyzing' ? 'Analyzing port state…' : phase === 'error' ? 'Agent request failed' : proposal ? `${Math.round(proposal.confidence * 100)}% confidence` : 'Waiting'
  const classificationLabel = proposal?.classification === 'confirmed' ? 'Confirmed incident' : proposal?.classification === 'false_alarm' ? 'Likely false alarm' : 'Inconclusive'
  return <section className={`workflow-section agent-assessment ${phase === 'analyzing' ? 'current-step' : ''} ${proposal ? 'completed-step' : ''}`}><div className="section-number">2</div><div className="section-body"><div className="section-title"><h3>Agent assessment</h3><span>{status}</span></div>
    {waiting ? <p className="muted-copy">Waiting for operator acknowledgement.</p> : phase === 'analyzing' ? <div className="agent-loading"><i/><p>Analyzing telemetry, port state, and relevant SOP guidance.</p></div> : error ? <div className="agent-error-state"><p className="error-copy">{error}</p><button onClick={onRetry}>Retry agent investigation</button></div> : proposal ? <><div className={`classification-badge ${proposal.classification}`}><span>AGENT CLASSIFICATION</span><strong>{classificationLabel}</strong><b>{Math.round(proposal.confidence * 100)}% confidence</b></div><h4>{proposal.diagnosis}</h4><p>{proposal.recommendation}</p>{proposal.evidence?.length ? <ul className="assessment-evidence">{proposal.evidence.map((item) => <li key={item}>{item}</li>)}</ul> : null}{proposal.sopReferences?.length ? <div className="sop-references"><span>RAG SOURCES</span>{proposal.sopReferences.map((reference) => <b key={reference.id}>{reference.id} · {reference.title.replace(`${reference.id} `, '')}</b>)}</div> : null}<details><summary>Why the agent chose this classification</summary><p>{proposal.reasoning}</p></details></> : null}
  </div></section>
}

function DispositionPanel({ phase, proposal, onDisposition, error }) {
  const resolved = phase === 'false_alarm' ? 'Closed as false alarm' : phase === 'inspection_requested' ? 'Further inspection requested' : phase === 'proposal' || ['executing', 'complete', 'rejected'].includes(phase) ? 'Incident confirmed' : null
  return <section className={`workflow-section disposition-panel ${phase === 'assessment' ? 'current-step decision-required' : ''} ${resolved ? 'completed-step' : ''}`}><div className="section-number">3</div><div className="section-body"><div className="section-title"><h3>Human disposition</h3><span>{phase === 'assessment' ? 'Decision required' : resolved || 'Waiting'}</span></div><p className="muted-copy">{resolved || 'Review the agent evidence, then decide whether the alert is real, false, or needs more evidence.'}</p>{phase === 'assessment' && proposal ? <div className="disposition-actions"><button className="confirm-button" onClick={() => onDisposition('confirmed')}>Confirm incident</button><button className="false-alarm-button" onClick={() => onDisposition('false_alarm')}>Mark false alarm</button><button className="inspect-button" onClick={() => onDisposition('inconclusive')}>Request inspection</button></div> : null}{error && phase === 'assessment' ? <p className="error-copy">{error}</p> : null}</div></section>
}

function ApprovalPanel({ phase, proposal, onApprove, onReject }) {
  const approvalCopy = phase === 'complete'
    ? 'Recovery executed and recorded in the audit trail.'
    : phase === 'rejected'
      ? 'Recovery rejected; no operational endpoints invoked.'
      : phase === 'proposal'
        ? 'Review the agent’s proposed recovery before any endpoint is invoked.'
        : 'Waiting for the agent’s recommendation.'
  return <section className={`workflow-section approval-panel ${phase === 'proposal' ? 'current-step decision-required' : ''} ${phase === 'complete' ? 'completed-step' : ''}`}><div className="section-number">4</div><div className="section-body"><div className="section-title"><h3>Recovery approval</h3><span>{phase === 'proposal' ? 'Decision required' : phase === 'complete' ? 'Approved' : phase === 'rejected' ? 'Rejected' : 'Waiting'}</span></div>
    <p className="muted-copy">{approvalCopy}</p>
    {proposal ? <div className="decision-summary"><span>AGENT RECOMMENDS</span><strong>{proposal.recommendation}</strong>{proposal.sopReferences?.length ? <small>Based on {proposal.sopReferences.map((reference) => reference.id).join(' · ')}</small> : null}</div> : null}
    <div className="approval-actions"><button className="approve-button" disabled={phase !== 'proposal' || !proposal} onClick={onApprove}>✓ Approve &amp; execute</button><button className="reject-button" disabled={phase !== 'proposal'} onClick={onReject}>Reject recovery</button></div>
  </div></section>
}

function ToolExecution({ phase, proposal, execution }) {
  const tools = proposal?.proposedTools || []
  return <section className={`workflow-section tool-execution ${phase === 'executing' ? 'current-step' : ''} ${phase === 'complete' ? 'completed-step' : ''}`}><div className="section-number">5</div><div className="section-body"><div className="section-title"><h3>Operational tool execution</h3><span>{phase === 'executing' ? 'Invoking…' : phase === 'complete' ? 'Completed' : 'Approval gated'}</span></div>
    {tools.length === 0 ? <p className="muted-copy">{phase === 'proposal' ? 'Waiting for human approval.' : 'Waiting for approved recovery.'}</p> : <div className="tool-table" role="table" aria-label="Operational endpoints"><div className="tool-row tool-head" role="row"><span>Tool / endpoint</span><span>Status</span><span>Output</span></div>{tools.map((tool) => {
      const result = execution?.executions?.find((item) => item.id === tool.id)
      const status = result?.status === 'completed' ? 'Completed' : result?.status === 'rejected' ? 'Rejected' : phase === 'executing' ? 'Invoking' : 'Not invoked'
      return <div className="tool-row" role="row" key={tool.id}><div><b>Tool {tool.number} · {tool.name}</b><code>{tool.endpoint}</code></div><span className={`tool-status ${status.toLowerCase().replace(' ', '-')}`}><i/>{status}</span><p>{result?.output || (phase === 'proposal' ? 'Awaiting human approval' : '—')}</p></div>
    })}</div>}
  </div></section>
}

function AuditTimeline({ logs, standalone = false }) {
  return <section className={`audit-timeline ${standalone ? 'standalone' : ''}`}><div className="section-title"><h3>{standalone ? 'Event stream' : 'Audit timeline'}</h3><span>{logs.length} events</span></div><div>{logs.map((log) => <article key={log.id}><i className={log.tone}/><time>{log.time}</time><span>{log.message}</span></article>)}</div></section>
}

function AuditView({ logs }) {
  return <section className="audit-view" aria-label="Audit timeline view"><header><div><span>AUDIT TRAIL</span><h2>Audit timeline</h2><p>Operator actions, agent decisions, and endpoint activity recorded in sequence.</p></div><div className="audit-view-summary"><strong>{logs.length}</strong><span>recorded events</span></div></header><AuditTimeline logs={logs} standalone/></section>
}

function App() {
  const [activeView, setActiveView] = useState('overview')
  const [panelOpen, setPanelOpen] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [selectedObject, setSelectedObject] = useState(null)
  const [activeEvent, setActiveEvent] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [execution, setExecution] = useState(null)
  const [error, setError] = useState('')
  const [currentMinute, setCurrentMinute] = useState(DAY_START)
  const [playing, setPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [scheduledEvents, setScheduledEvents] = useState([])
  const [playbook, setPlaybook] = useState({ entries: [], tools: [] })
  const [toolActivity, setToolActivity] = useState({})
  const [toolStreamState, setToolStreamState] = useState('connecting')
  const [logs, setLogs] = useState(() => [makeLog('Live port alert monitoring started', 'green')])
  const [chatMessages, setChatMessages] = useState(() => [{ id: crypto.randomUUID(), role: 'system', time: formatSimTime(DAY_START), body: 'Agent gateway ready. No alert data has been sent.' }])
  const latestCompletedInvocationId = Object.values(toolActivity).filter((activity) => activity.status === 'completed').toSorted((left, right) => left.invokedAt.localeCompare(right.invokedAt)).at(-1)?.invocationId

  useEffect(() => {
    if (!playing) return undefined
    const timer = window.setInterval(() => setCurrentMinute((minute) => Math.min(DAY_END, minute + PLAYBACK_STEP)), PLAYBACK_INTERVAL_MS / playbackRate)
    return () => window.clearInterval(timer)
  }, [playing, playbackRate])

  useEffect(() => {
    let cancelled = false
    fetch('/api/playbook').then((response) => response.json()).then((payload) => {
      if (!cancelled && payload.ok) setPlaybook({ entries: payload.entries || [], tools: payload.tools || [] })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const stream = new EventSource('/api/tool-events')
    stream.onopen = () => setToolStreamState('live')
    stream.onerror = () => setToolStreamState('reconnecting')
    stream.addEventListener('snapshot', (event) => {
      const activities = JSON.parse(event.data)
      setToolActivity(Object.fromEntries(activities.map((activity) => [activity.id, activity])))
    })
    stream.addEventListener('tool-activity', (event) => {
      const activity = JSON.parse(event.data)
      setToolActivity((current) => ({ ...current, [activity.id]: activity }))
      setLogs((current) => [...current, makeLog(`Tool ${activity.number} ${activity.status} via ${activity.source === 'external' ? 'external API' : 'agent execution'}`, activity.status === 'completed' ? 'green' : 'blue')])
    })
    stream.addEventListener('tool-reset', (event) => {
      const reset = JSON.parse(event.data)
      setToolActivity({})
      setLogs((current) => [...current, makeLog(`Operational activity lights reset: ${reset.reason}`, 'blue')])
    })
    return () => stream.close()
  }, [])

  useEffect(() => {
    if (!latestCompletedInvocationId) return undefined
    const timer = window.setTimeout(() => {
      fetch('/api/tools/activity/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: `automatic reset ${TOOL_RESET_DELAY_MS / 1000}s after the latest completion` }),
      }).catch(() => {})
    }, TOOL_RESET_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [latestCompletedInvocationId])

  useEffect(() => { if (currentMinute >= DAY_END) setPlaying(false) }, [currentMinute])

  useEffect(() => {
    const due = scheduledEvents.filter((event) => event.status === 'scheduled' && event.minute <= currentMinute)
    if (due.length === 0) return
    const dueIds = new Set(due.map((event) => event.id))
    setScheduledEvents((current) => current.map((event) => dueIds.has(event.id) ? { ...event, status: 'detected' } : event))
    setLogs((current) => [...current, ...due.map((event) => makeLog(`${event.time} simulation alert released: ${event.label}`, event.severity === 'critical' ? 'red' : 'amber'))])
    setPlaying(false)
    if (!activeEvent || ['idle', 'complete', 'rejected', 'false_alarm', 'inspection_requested'].includes(phase)) {
      const batch = createAlertBatch(due.map((event) => ({ ...event, status: 'detected' })))
      setActiveEvent(batch); setSelectedObject(due[0].object); setProposal(null); setExecution(null); setError(''); setPhase('alert')
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'system', time: formatSimTime(currentMinute), body: `Simulation paused. ${due.length} candidate alert${due.length === 1 ? '' : 's'} released at ${due[0].time}; waiting for operator acknowledgement.` }])
    }
  }, [currentMinute, scheduledEvents, activeEvent, phase])

  function selectObject(object) { setSelectedObject(object); setActiveView('overview') }

  function updateScheduledStatus(id, status) {
    if (!id) return
    setScheduledEvents((current) => current.map((event) => event.id === id ? { ...event, status } : event))
  }

  function updateScheduledStatuses(ids, status) {
    const targets = new Set(ids || [])
    setScheduledEvents((current) => current.map((event) => targets.has(event.id) ? { ...event, status } : event))
  }

  function scheduleDisruption(action, time) {
    if (!selectedObject || !action) return
    const minute = parseSimTime(time)
    const scheduled = { id: window.crypto.randomUUID(), object: selectedObject, action: action.id, label: action.label, severity: action.severity, time, minute, status: 'scheduled' }
    setScheduledEvents((current) => [...current, scheduled])
    setLogs((current) => [...current, makeLog(`${time} disruption scheduled: ${action.label} on ${selectedObject.label}`, 'blue')])
  }

  function openAlert(event) {
    if (event.status !== 'detected') return
    const simultaneous = scheduledEvents.filter((candidate) => candidate.status === 'detected' && candidate.minute === event.minute)
    const batch = createAlertBatch(simultaneous.length ? simultaneous : [event])
    setActiveEvent(batch); setSelectedObject(event.object); setProposal(null); setExecution(null); setError(''); setPhase('alert')
    setLogs((current) => [...current, makeLog(`Operator opened ${batch.events.length} alert${batch.events.length === 1 ? '' : 's'} at ${event.time}`, 'amber')])
  }

  function resetDay() {
    setPlaying(false); setCurrentMinute(DAY_START); setActiveEvent(null); setProposal(null); setExecution(null); setError(''); setPhase('idle')
    setScheduledEvents((current) => current.map((event) => ({ ...event, status: 'scheduled' })))
    setLogs([makeLog('Simulation day reset to 06:00; scheduled disruptions retained', 'blue')])
    setChatMessages([{ id: crypto.randomUUID(), role: 'system', time: formatSimTime(DAY_START), body: 'Simulation reset. Agent gateway ready; scheduled disruptions remain private until their clock time.' }])
  }

  async function acknowledgeAndInvestigate() {
    if (!activeEvent) return
    const incidents = activeEvent.events || [activeEvent]
    setPhase('analyzing'); setError(''); updateScheduledStatuses(incidents.map((event) => event.id), 'analyzing')
    setLogs((current) => [...current, makeLog(`${incidents.length} candidate alert${incidents.length === 1 ? '' : 's'} acknowledged and sent for investigation`, 'green'), makeLog('Agent reading telemetry, port state, and SOP playbook')])
    setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'operator', time: formatSimTime(currentMinute), body: `Investigate ${incidents.length} candidate alert${incidents.length === 1 ? '' : 's'} together: ${incidents.map((event) => `${event.label} on ${event.object.label}`).join('; ')}. Classify the evidence before proposing any recovery.` }])
    try {
      const response = await fetch('/api/agent/investigate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ incidents: incidents.map((event) => ({ object: event.object, action: event.action })) }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Agent investigation failed')
      if (!['confirmed', 'false_alarm', 'inconclusive'].includes(payload.classification)) {
        throw new Error('The backend is running an older workflow version. Stop the current dev processes and restart npm run dev, then retry the investigation.')
      }
      setProposal(payload); setPhase('assessment'); updateScheduledStatuses(incidents.map((event) => event.id), 'assessment')
      setLogs((current) => [...current, ...payload.trace.map((item) => makeLog(item.label, item.type === 'proposal' || item.type === 'rag' ? 'green' : 'blue')), makeLog(`Agent classified alert as ${payload.classification.replace('_', ' ')}; awaiting human disposition`, 'amber')])
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'agent', time: formatSimTime(currentMinute), body: `Classification: ${payload.classification.replace('_', ' ')} (${Math.round(payload.confidence * 100)}% confidence)\n\n${payload.diagnosis}\n\nRecommendation: ${payload.recommendation}`, tools: payload.proposedTools }])
    } catch (requestError) {
      setError(requestError.message); setPhase('error'); updateScheduledStatuses(incidents.map((event) => event.id), 'error'); setLogs((current) => [...current, makeLog(`Agent error: ${requestError.message}`, 'red')])
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'system', time: formatSimTime(currentMinute), body: `Agent request failed: ${requestError.message}` }])
    }
  }

  async function submitDisposition(disposition) {
    if (!proposal?.proposalId || phase !== 'assessment') return
    setError('')
    try {
      const response = await fetch('/api/agent/disposition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId: proposal.proposalId, disposition }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Alert disposition failed')
      const nextPhase = disposition === 'false_alarm' ? 'false_alarm' : payload.recoveryReady ? 'proposal' : 'inspection_requested'
      setPhase(nextPhase); updateScheduledStatuses(activeEvent?.eventIds, nextPhase)
      const message = disposition === 'false_alarm' ? 'Operator marked the candidate alert as a false alarm; no operational endpoints invoked' : payload.recoveryReady ? 'Operator confirmed the incident; recovery proposal is now eligible for separate approval' : disposition === 'confirmed' ? 'Operator confirmed the alert, but recovery is held because the assessment has no executable plan; further investigation requested' : 'Operator requested further inspection; no operational endpoints invoked'
      setLogs((current) => [...current, makeLog(message, disposition === 'confirmed' && payload.recoveryReady ? 'green' : 'amber')])
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'operator', time: formatSimTime(currentMinute), body: disposition === 'false_alarm' ? 'Disposition: false alarm. Close the alert without operational action.' : payload.recoveryReady ? 'Disposition: confirmed incident. Present the recovery plan for approval.' : disposition === 'confirmed' ? 'Disposition override: treat as a possible incident, but hold recovery and request a new investigation.' : 'Disposition: inconclusive. Request further inspection and do not invoke operational tools.' }])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function approveRecovery() {
    if (!proposal?.proposalId) return
    setPhase('executing'); setError('')
    setLogs((current) => [...current, makeLog('Operator approved the proposed recovery', 'green'), makeLog('Agent invoking approved operational endpoints', 'amber')])
    setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'operator', time: formatSimTime(currentMinute), body: `Approved the combined recovery plan with ${proposal.proposedTools.length} operational endpoint${proposal.proposedTools.length === 1 ? '' : 's'}. Execute now.` }])
    try {
      const response = await fetch('/api/agent/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId: proposal.proposalId, approved: true }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Tool execution failed')
      setExecution(payload); setPhase(payload.resolved ? 'complete' : 'error'); updateScheduledStatuses(activeEvent?.eventIds, payload.resolved ? 'complete' : 'error')
      setLogs((current) => [...current, ...payload.executions.map((item) => makeLog(`Tool ${item.number} completed: ${item.name}`, item.status === 'completed' ? 'green' : 'red')), makeLog(payload.resolved ? 'Incident contained and port state updated' : 'Tool plan rejected by simulator', payload.resolved ? 'green' : 'red')])
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'agent', time: formatSimTime(currentMinute), body: payload.resolved ? `Recovery complete. All ${activeEvent?.events?.length || 1} incidents in this batch are contained.` : 'The simulator rejected the tool plan; no unsafe execution was allowed.', tools: payload.executions }])
    } catch (requestError) {
      setError(requestError.message); setPhase('error'); setLogs((current) => [...current, makeLog(`Execution error: ${requestError.message}`, 'red')])
      setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'system', time: formatSimTime(currentMinute), body: `Tool execution was not completed: ${requestError.message}` }])
    }
  }

  function rejectRecovery() {
    setPhase('rejected'); updateScheduledStatuses(activeEvent?.eventIds, 'rejected'); setLogs((current) => [...current, makeLog('Operator rejected the proposed recovery; no endpoints invoked', 'red')])
    setChatMessages((current) => [...current, { id: crypto.randomUUID(), role: 'operator', time: formatSimTime(currentMinute), body: 'Recovery proposal rejected. Do not invoke operational tools.' }])
  }

  const queuedAlerts = scheduledEvents.filter((event) => event.status === 'detected').length
  const activeAlertCount = ['complete', 'false_alarm', 'inspection_requested'].includes(phase) ? queuedAlerts : Math.max(queuedAlerts, activeEvent?.events?.length || (activeEvent ? 1 : 0))
  const togglePanel = () => setPanelOpen((value) => !value)
  const setView = (view) => { setActiveView(view); setPanelOpen(false) }
  return <div className="app-shell"><Sidebar activeView={activeView} setActiveView={setView} alertCount={activeAlertCount}/><main className="main-area"><Header phase={phase} onOpenPanel={activeView === 'overview' ? togglePanel : null} panelOpen={panelOpen} currentMinute={currentMinute} queuedAlerts={queuedAlerts}/>{activeView === 'chat' ? <AgentChat phase={phase} activeEvent={activeEvent} proposal={proposal} execution={execution} messages={chatMessages} onBack={() => setView('overview')}/> : activeView === 'playbook' ? <SopPlaybook playbook={playbook} proposal={proposal} execution={execution} onBack={() => setView('overview')}/> : activeView === 'audit' ? <AuditView logs={logs}/> : <><ControlStationDrawer open={panelOpen} onClose={() => setPanelOpen(false)} phase={phase} activeEvent={activeEvent} queuedAlerts={queuedAlerts} currentMinute={currentMinute} playing={playing} playbackRate={playbackRate} scheduledEvents={scheduledEvents} onToggle={() => setPlaying((value) => !value)} onReset={resetDay} onRateChange={setPlaybackRate} onOpenAlert={openAlert}/><IncidentFocus phase={phase} activeEvent={activeEvent} proposal={proposal}/><AgentActivityBoard phase={phase} activeEvent={activeEvent} proposal={proposal} playbook={playbook} toolActivity={toolActivity} toolStreamState={toolStreamState} onOpenPlaybook={() => setView('playbook')}/><div className="control-layout"><div className="map-column"><PortMap selectedObject={selectedObject} activeEvent={activeEvent} phase={phase} onSelect={selectObject}/><EventDrawer selectedObject={selectedObject} activeEvent={activeEvent} onSchedule={scheduleDisruption}/></div><div className="workflow-rail"><StageStepper phase={phase}/><AlertIntake phase={phase} activeEvent={activeEvent} onAcknowledge={acknowledgeAndInvestigate}/><AgentAssessment phase={phase} proposal={proposal} error={error} onRetry={acknowledgeAndInvestigate}/><DispositionPanel phase={phase} proposal={proposal} onDisposition={submitDisposition} error={error}/><ApprovalPanel phase={phase} proposal={proposal} onApprove={approveRecovery} onReject={rejectRecovery}/><ToolExecution phase={phase} proposal={proposal} execution={execution}/></div></div></>}</main></div>
}

export default App
