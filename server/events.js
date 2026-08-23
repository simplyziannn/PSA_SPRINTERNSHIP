const recoveryMetrics = {
  crane_isolate_reassign: { throughput: '19,110', utilisation: '69%', delay: '0.8', energy: '65', emissions: '18.7' },
  crane_switch_power: { throughput: '18,980', utilisation: '70%', delay: '1.0', energy: '66', emissions: '18.9' },
  vessel_resequence_berth: { throughput: '18,900', utilisation: '70%', delay: '1.2', energy: '66', emissions: '18.9' },
  cargo_secure_exclusion_zone: { throughput: '18,420', utilisation: '74%', delay: '2.1', energy: '63', emissions: '19.2' },
  allocate_overflow_stack: { throughput: '18,760', utilisation: '76%', delay: '1.5', energy: '67', emissions: '19.4' },
  isolate_damaged_container: { throughput: '18,860', utilisation: '72%', delay: '1.1', energy: '64', emissions: '18.8' },
  transfer_reefer_power: { throughput: '18,840', utilisation: '70%', delay: '1.0', energy: '66', emissions: '18.8' },
  gate_manual_validation: { throughput: '18,720', utilisation: '73%', delay: '1.4', energy: '65', emissions: '19.1' },
}

const eventTemplates = {
  crane_hydraulic_fault: {
    sopId: 'SOP-03',
    label: 'Hydraulic pressure fault',
    diagnosis: 'Hydraulic pressure loss in the crane hoist circuit',
    solutionId: 'crane_isolate_reassign',
    solution: 'Isolate the affected crane and reassign the vessel to spare quay capacity',
    requiredToolIds: ['tool_02_isolate_asset', 'tool_03_dispatch_maintenance'],
    signals: [
      ['cycle_time', 'Cycle time', '+38% above baseline', 'Cycle time increased from 96s to 133s while trolley travel stayed normal.'],
      ['hydraulic_pressure', 'Hydraulic pressure', 'Intermittent drop', 'Pressure falls from 245 bar to 171 bar only under lifting load.'],
      ['motor_current', 'Hoist motor current', 'Normal', 'Motor current remains inside its normal 182–196A operating band.'],
      ['wind', 'Berth wind', '11 knots', 'Wind remains well below the automatic crane slowdown threshold.'],
    ],
  },
  crane_power_fault: {
    sopId: 'SOP-04',
    label: 'Electrical power fault',
    diagnosis: 'Crane bus undervoltage causing protection trips',
    solutionId: 'crane_switch_power',
    solution: 'Isolate the unstable bus and transfer the crane to the redundant supply',
    requiredToolIds: ['tool_02_isolate_asset', 'tool_05_transfer_power'],
    signals: [
      ['bus_voltage', 'Crane bus voltage', '-17% transient', 'Voltage sag events align exactly with each hoist interruption.'],
      ['breaker', 'Protection relay', '3 trips', 'Three undervoltage trips occurred within nine minutes.'],
      ['hydraulic_pressure', 'Hydraulic pressure', 'Normal', 'Hoist hydraulic pressure remains stable under load.'],
      ['peer_cranes', 'Adjacent cranes', 'Normal', 'QC peers on a separate bus show no interruption.'],
    ],
  },
  crane_sensor_false_alarm: {
    sopId: 'SOP-03',
    label: 'Hydraulic sensor disagreement',
    diagnosis: 'A drifting pressure transducer generated a nuisance alert while the redundant channel and crane performance remained healthy',
    solutionId: null,
    solution: 'Close the alert as a false alarm and raise a non-operational sensor calibration work order',
    expectedClassification: 'false_alarm',
    requiredToolIds: [],
    signals: [
      ['hydraulic_primary', 'Primary pressure sensor', '171 bar', 'The primary transducer reports 171 bar but its reading is fixed and does not change with hoist load.'],
      ['hydraulic_redundant', 'Redundant pressure sensor', '246 bar normal', 'The independent redundant channel remains stable between 242 and 249 bar under lifting load.'],
      ['cycle_time', 'Cycle time', 'Normal', 'Crane cycle time remains inside its 96â€“104 second operating band.'],
      ['motor_current', 'Hoist motor current', 'Normal', 'Motor current and thermal protection remain healthy across six lifts.'],
    ],
  },
  vessel_late_arrival: {
    sopId: 'SOP-05',
    label: 'Late vessel arrival',
    diagnosis: 'Inbound ETA slippage creating a berth and tug-window conflict',
    solutionId: 'vessel_resequence_berth',
    solution: 'Resequence the berth window and tug allocation',
    requiredToolIds: ['tool_06_resequence_berth', 'tool_07_update_tugs'],
    signals: [
      ['ais_eta', 'AIS ETA', '+4.8 hours', 'AIS position and speed indicate arrival 4.8 hours behind plan.'],
      ['berth_plan', 'Berth occupancy', 'Conflict forecast', 'The delayed arrival overlaps the following vessel by 76 minutes.'],
      ['tug_window', 'Tug allocation', 'Unavailable', 'Assigned tugs are committed to another movement after the original window.'],
      ['weather', 'Weather route', 'Normal', 'No current weather restriction explains further delay.'],
    ],
  },
  vessel_cargo_topple: {
    sopId: 'SOP-01',
    label: 'Containers toppled on vessel',
    diagnosis: 'On-deck container stack collapse creating a personnel and lifting hazard',
    solutionId: 'cargo_secure_exclusion_zone',
    solution: 'Stop adjacent lifts, establish an exclusion zone, and dispatch the cargo-securing team',
    requiredToolIds: ['tool_01_stop_lifts', 'tool_04_exclusion_zone'],
    signals: [
      ['twistlock', 'Twist-lock sensors', 'Multiple releases', 'Four adjacent positions report unexpected lock release.'],
      ['vision', 'Quay vision model', 'Stack lean detected', 'Camera geometry indicates a 14-degree stack lean and displaced boxes.'],
      ['wind', 'Local wind', '16 knots', 'Wind is elevated but below the terminal stop-work threshold.'],
      ['personnel', 'Exclusion-zone tracker', '2 personnel nearby', 'Two badges are inside the affected crane operating envelope.'],
    ],
  },
  vessel_add_containers: {
    sopId: 'SOP-06',
    label: 'Add unplanned containers',
    diagnosis: 'Unplanned vessel load increase exceeding the assigned yard and crane work plan',
    solutionId: 'allocate_overflow_stack',
    solution: 'Allocate an overflow stack and rebalance crane and yard resources',
    requiredToolIds: ['tool_08_open_overflow', 'tool_09_rebalance_resources'],
    signals: [
      ['load_list', 'Load-list variance', '+120 containers', 'The revised load list adds 120 export boxes after resource planning cutoff.'],
      ['yard_capacity', 'Assigned stack capacity', '94% committed', 'The planned export stack cannot absorb the additional volume.'],
      ['crane_moves', 'Crane work plan', '+2.1 hours', 'Current crane allocation would extend berth time by 2.1 hours.'],
      ['weight_plan', 'Weight distribution', 'Within limit', 'Vessel stability remains within allowable limits after the revision.'],
    ],
  },
  container_add_volume: {
    sopId: 'SOP-06',
    label: 'Add containers to stack',
    diagnosis: 'Yard block overload caused by unplanned container volume',
    solutionId: 'allocate_overflow_stack',
    solution: 'Open an overflow block and rebalance RTG work queues',
    requiredToolIds: ['tool_08_open_overflow', 'tool_09_rebalance_resources'],
    signals: [
      ['stack_density', 'Stack density', '96%', 'The selected block is at 96% physical slot utilisation.'],
      ['rehandles', 'Predicted rehandles', '+43%', 'Buried priority boxes will drive a sharp increase in rehandles.'],
      ['adjacent_block', 'Adjacent block', '38% spare', 'The nearest compatible block has 38% spare capacity.'],
      ['truck_queue', 'Internal truck queue', '+11 minutes', 'Queue time is rising at the selected block interface.'],
    ],
  },
  container_damage: {
    sopId: 'SOP-02',
    label: 'Damaged container detected',
    diagnosis: 'Structurally damaged container creating a lifting and leakage risk',
    solutionId: 'isolate_damaged_container',
    solution: 'Isolate the slot, suspend lifts, and dispatch dangerous-goods inspection',
    requiredToolIds: ['tool_01_stop_lifts', 'tool_04_exclusion_zone', 'tool_10_inspection'],
    signals: [
      ['vision_damage', 'Vision inspection', 'Sidewall deformation', 'Image inspection detects a 19cm sidewall deformation near the lower casting.'],
      ['weight_sensor', 'Lift weight', 'Asymmetric', 'Spreader load cells show a 12% left-right imbalance.'],
      ['manifest', 'Cargo manifest', 'Regulated cargo', 'Manifest flags the unit for controlled inspection if structural damage occurs.'],
      ['leak_sensor', 'Ground sensor', 'No leak detected', 'No liquid or vapour is currently detected beneath the slot.'],
    ],
  },
  container_damage_inconclusive: {
    sopId: 'SOP-02',
    label: 'Unconfirmed container damage',
    diagnosis: 'The vision alert cannot be confirmed or dismissed because the camera view is obstructed and lift telemetry is unavailable',
    solutionId: null,
    solution: 'Request an on-site inspection before classifying the alert or authorising operational recovery',
    expectedClassification: 'inconclusive',
    requiredToolIds: [],
    signals: [
      ['vision_damage', 'Vision inspection', 'Possible deformation', 'The model reports possible sidewall deformation, but 41% of the container is obscured by the spreader.'],
      ['camera_quality', 'Camera quality', 'Obstructed', 'Rain droplets and glare reduce image confidence below the confirmation threshold.'],
      ['weight_sensor', 'Lift weight', 'Unavailable', 'No usable spreader load-cell reading exists for this container movement.'],
      ['leak_sensor', 'Ground sensor', 'No leak detected', 'No liquid or vapour is detected, which does not rule out structural damage.'],
    ],
  },
  container_reefer_alarm: {
    sopId: 'SOP-07',
    label: 'Reefer temperature alarm',
    diagnosis: 'Shared reefer feeder degradation causing intermittent power loss',
    solutionId: 'transfer_reefer_power',
    solution: 'Transfer the affected reefer bank to the redundant feeder',
    requiredToolIds: ['tool_05_transfer_power', 'tool_11_monitor_reefer'],
    signals: [
      ['temperature', 'Container temperature', '+1.8°C drift', 'Seventeen units show synchronized temperature drift.'],
      ['breaker', 'Feeder breaker', '4 transient trips', 'Protection relay recorded four brief trips with rising contact resistance.'],
      ['compressors', 'Unit compressors', 'No faults', 'Individual controllers report no compressor or refrigerant fault.'],
      ['ambient', 'Ambient temperature', 'Stable', 'Ambient conditions cannot explain the synchronized excursions.'],
    ],
  },
  gate_ocr_fault: {
    sopId: 'SOP-08',
    label: 'Gate OCR failure',
    diagnosis: 'OCR camera alignment drift causing recognition failures',
    solutionId: 'gate_manual_validation',
    solution: 'Switch affected lanes to assisted validation and recalibrate the camera',
    requiredToolIds: ['tool_12_manual_gate', 'tool_03_dispatch_maintenance'],
    signals: [
      ['ocr_confidence', 'OCR confidence', '41%', 'Recognition confidence fell from 96% after camera maintenance.'],
      ['barrier', 'Barrier mechanism', 'Normal', 'Barrier cycles and safety loops are healthy.'],
      ['exceptions', 'Manual exception rate', '63%', 'Manual validation rose from 4% to 63%.'],
      ['network', 'Gate network latency', '18 ms', 'Network latency and packet loss remain normal.'],
    ],
  },
}

export function buildEvent(object, action) {
  const template = eventTemplates[action]
  if (!template) return null
  return {
    ...template,
    expectedClassification: template.expectedClassification || 'confirmed',
    object,
    signals: template.signals.map(([id, label, preview, detail]) => ({ id, label, preview, detail })),
    dependencies: {
      object: `${object.label} is the primary affected asset.`,
      quay: 'The event can propagate into berth, yard, gate, and connection schedules.',
      safety: action.includes('topple') || action.includes('damage') ? 'Personnel exclusion and controlled inspection are required.' : 'Normal operating safeguards remain active.',
    },
    outcomeMetrics: recoveryMetrics[template.solutionId],
  }
}

export const allowedSolutionIds = Object.keys(recoveryMetrics)
