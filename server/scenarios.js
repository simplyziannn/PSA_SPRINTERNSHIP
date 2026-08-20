export const solutions = {
  isolate_crane_and_shift_vessel: {
    label: 'Isolate QC-04 and shift PSA-101 to B4',
    metrics: { throughput: '19,110', utilisation: '69%', delay: '0.8', energy: '65', emissions: '18.7' },
  },
  reroute_yard_traffic: {
    label: 'Open alternate yard corridor and rebalance RTGs',
    metrics: { throughput: '18,960', utilisation: '71%', delay: '1.1', energy: '67', emissions: '19.0' },
  },
  transfer_reefer_power: {
    label: 'Transfer reefer bank to redundant feeder',
    metrics: { throughput: '18,840', utilisation: '70%', delay: '1.0', energy: '66', emissions: '18.8' },
  },
  switch_gate_to_manual_validation: {
    label: 'Switch affected lanes to assisted validation',
    metrics: { throughput: '18,720', utilisation: '73%', delay: '1.4', energy: '65', emissions: '19.1' },
  },
  resequence_berth_window: {
    label: 'Resequence berth window and tug allocation',
    metrics: { throughput: '18,900', utilisation: '70%', delay: '1.2', energy: '66', emissions: '18.9' },
  },
}

export const scenarios = [
  {
    id: 'equipment-alpha',
    label: 'Equipment anomaly · Quay B3',
    summary: 'Intermittent crane slowdown with conflicting mechanical readings.',
    incident: 'QC-04 performance degradation',
    diagnosis: 'QC-04 hydraulic pressure loss in the hoist circuit',
    correctSolution: 'isolate_crane_and_shift_vessel',
    signals: [
      { id: 'qc04-cycle', label: 'QC-04 cycle time', preview: '+38% above baseline', detail: 'Cycle time rose from 96s to 133s over 14 minutes; trolley travel remains normal.' },
      { id: 'qc04-pressure', label: 'Hoist hydraulic pressure', preview: 'Falling intermittently', detail: 'Pressure drops from 245 bar to 171 bar under lifting load, then partially recovers at idle.' },
      { id: 'qc04-current', label: 'Hoist motor current', preview: 'Within normal band', detail: 'Motor current remains 182–196A, making an electrical motor fault unlikely.' },
      { id: 'wind-b3', label: 'Wind at berth B3', preview: '11 knots', detail: 'Wind is stable at 11 knots, below the 25-knot crane slowdown threshold.' },
    ],
    dependencies: {
      'QC-04': 'Serving PSA-101 at B3; outage removes 50% of assigned crane capacity.',
      'PSA-101': 'Import-heavy call with 620 remaining moves and a rail connection cutoff in 5.5 hours.',
      'Yard A': 'Receives 61% of PSA-101 discharge; utilisation trending from 72% to 80%.',
    },
  },
  {
    id: 'yard-bravo',
    label: 'Flow degradation · Yard A',
    summary: 'Truck dwell and yard occupancy are rising despite normal gate arrivals.',
    incident: 'Yard A flow degradation',
    diagnosis: 'Blocked transfer corridor causing RTG and truck queue propagation',
    correctSolution: 'reroute_yard_traffic',
    signals: [
      { id: 'yard-a-dwell', label: 'Internal truck dwell', preview: '+19 minutes', detail: 'Median dwell increased from 12 to 31 minutes, concentrated between blocks A4 and A7.' },
      { id: 'gate-arrivals', label: 'Gate arrival volume', preview: 'Normal', detail: 'External arrivals are within 2% of forecast; the queue originates inside the terminal.' },
      { id: 'corridor-a6', label: 'Corridor A6 telemetry', preview: 'No movement', detail: 'Three location beacons report stationary vehicles for 11 minutes; adjacent corridors are flowing.' },
      { id: 'rtg-a', label: 'RTG availability', preview: '92%', detail: 'Eleven of twelve RTGs are available, ruling out a broad equipment shortage.' },
    ],
    dependencies: {
      'Yard A': 'Blocks A4–A7 feed two quay berths and the rail interchange.',
      'Gate 2': 'Outbound appointment adherence will fall below 75% within one hour.',
      'PSA-205': 'Export containers risk missing the vessel cutoff if the corridor remains blocked.',
    },
  },
  {
    id: 'reefer-charlie',
    label: 'Energy anomaly · Reefer bank C',
    summary: 'Temperature excursions appear alongside unstable feeder telemetry.',
    incident: 'Reefer bank C temperature risk',
    diagnosis: 'Reefer feeder breaker degradation causing intermittent power loss',
    correctSolution: 'transfer_reefer_power',
    signals: [
      { id: 'reefer-temp', label: 'Reefer temperature', preview: '+1.8°C drift', detail: 'Seventeen units show synchronized temperature drift, indicating a shared infrastructure issue.' },
      { id: 'feeder-c', label: 'Feeder C breaker', preview: '4 transient trips', detail: 'Protection relay recorded four sub-second trips in 22 minutes with rising contact resistance.' },
      { id: 'unit-alarms', label: 'Individual unit alarms', preview: 'No compressor faults', detail: 'Container controllers report no compressor or refrigerant alarms.' },
      { id: 'ambient-temp', label: 'Ambient temperature', preview: 'Stable at 31°C', detail: 'Ambient conditions are stable and cannot explain synchronized excursions.' },
    ],
    dependencies: {
      'Reefer bank C': 'Powers 146 active units, including 38 pharmaceutical containers.',
      'Feeder C': 'Has a redundant feeder with 41% spare capacity.',
      'Yard C': 'Access must remain restricted during electrical isolation.'
    },
  },
  {
    id: 'gate-delta',
    label: 'Access anomaly · Gate 2',
    summary: 'Manual checks and lane queues rise while physical barriers remain healthy.',
    incident: 'Gate 2 processing degradation',
    diagnosis: 'OCR camera alignment drift reducing container and plate recognition',
    correctSolution: 'switch_gate_to_manual_validation',
    signals: [
      { id: 'ocr-confidence', label: 'OCR confidence', preview: '41% average', detail: 'Confidence fell from 96% to 41% after maintenance; failures affect both plates and container IDs.' },
      { id: 'barrier-cycles', label: 'Barrier mechanism', preview: 'Normal', detail: 'Open/close cycles and safety loops are healthy across all four lanes.' },
      { id: 'manual-checks', label: 'Manual exception rate', preview: '63%', detail: 'Manual validation rose from 4% to 63%, adding 76 seconds per truck.' },
      { id: 'network-gate2', label: 'Gate network latency', preview: '18 ms', detail: 'Network latency and packet loss are normal, ruling out a connectivity issue.' },
    ],
    dependencies: {
      'Gate 2': 'Processes 34% of current appointment volume.',
      'Yard A': 'Inbound queue will obstruct the Yard A interchange in 28 minutes.',
      'Haulier slots': 'Appointment SLA penalties begin when dwell exceeds 45 minutes.',
    },
  },
  {
    id: 'marine-echo',
    label: 'Marine conflict · Berth B5',
    summary: 'Two vessel movements are converging on the same berth window.',
    incident: 'Berth B5 schedule conflict',
    diagnosis: 'Inbound ETA compression conflicting with delayed outbound vessel departure',
    correctSolution: 'resequence_berth_window',
    signals: [
      { id: 'inbound-eta', label: 'Inbound vessel ETA', preview: '52 minutes early', detail: 'PSA-411 increased speed after clearing congestion and will arrive 52 minutes ahead of plan.' },
      { id: 'outbound-progress', label: 'Outbound crane progress', preview: '84% complete', detail: 'PSA-205 has 174 moves remaining and is trending 47 minutes behind departure plan.' },
      { id: 'tug-window', label: 'Tug allocation', preview: 'Single shared window', detail: 'The same tug pair is allocated to outbound B5 and inbound B5 movements 35 minutes apart.' },
      { id: 'tidal-window', label: 'Tidal constraint', preview: 'Normal', detail: 'Both vessels remain within under-keel clearance limits for the next six hours.' },
    ],
    dependencies: {
      'Berth B5': 'Cannot accept the inbound vessel until outbound lines are clear.',
      'Tug pair T7/T9': 'Required for both movements; next available pair is 96 minutes later.',
      'PSA-411': 'Carries transshipment cargo with two onward connection cutoffs.',
    },
  },
]

export const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))

export function publicScenario(scenario) {
  return {
    id: scenario.id,
    label: scenario.label,
    summary: scenario.summary,
    incident: scenario.incident,
    signals: scenario.signals.map(({ id, label, preview }) => ({ id, label, preview })),
  }
}
