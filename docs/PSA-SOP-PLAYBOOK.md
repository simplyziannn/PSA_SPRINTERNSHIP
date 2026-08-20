# PSA Terminal Incident Response Playbook

This simulator playbook defines the minimum immediate containment actions for common Tuas Terminal alerts. Follow-up work must not be added to the immediate tool plan unless the alert explicitly requires it.

## SOP-01 On-deck container stack collapse

Triggers: toppled containers, deck cargo lean, twist-lock release, displaced vessel containers, personnel inside the crane envelope.

Immediate actions:

1. Invoke `tool_01_stop_lifts` to suspend adjacent crane lifts.
2. Invoke `tool_04_exclusion_zone` to clear personnel and lock the hazardous quay area.

Do not dispatch maintenance or yard-container inspection as part of immediate containment. Resume work only after cargo securing and safety clearance.

## SOP-02 Structurally damaged yard container

Triggers: container sidewall deformation, asymmetric spreader load, regulated cargo, leakage risk.

Immediate actions:

1. Invoke `tool_01_stop_lifts`.
2. Invoke `tool_04_exclusion_zone`.
3. Invoke `tool_10_inspection` for controlled cargo inspection.

## SOP-03 Crane hydraulic degradation

Triggers: hydraulic pressure drop under load, slow hoist cycle, normal motor current, normal wind.

Immediate actions:

1. Invoke `tool_02_isolate_asset` to remove the crane from the active work plan.
2. Invoke `tool_03_dispatch_maintenance` with hydraulic diagnostic context.

## SOP-04 Crane electrical bus instability

Triggers: crane bus undervoltage, repeated protection relay trips, stable hydraulic pressure.

Immediate actions:

1. Invoke `tool_02_isolate_asset`.
2. Invoke `tool_05_transfer_power` to the redundant electrical supply.

## SOP-05 Vessel arrival and tug-window conflict

Triggers: AIS ETA slippage, berth overlap, unavailable assigned tugs, normal weather route.

Immediate actions:

1. Invoke `tool_06_resequence_berth`.
2. Invoke `tool_07_update_tugs` against the revised arrival window.

## SOP-06 Unplanned container volume

Triggers: late load-list additions, yard block above 90 percent, rising rehandles, spare compatible capacity nearby.

Immediate actions:

1. Invoke `tool_08_open_overflow`.
2. Invoke `tool_09_rebalance_resources` across crane, RTG, and internal truck queues.

## SOP-07 Shared reefer feeder degradation

Triggers: synchronized reefer temperature drift, healthy compressors, stable ambient conditions, feeder breaker transients.

Immediate actions:

1. Invoke `tool_05_transfer_power` to the redundant feeder.
2. Invoke `tool_11_monitor_reefer` for enhanced temperature verification.

## SOP-08 Gate OCR alignment failure

Triggers: low OCR confidence after camera maintenance, elevated manual exceptions, healthy barrier and network.

Immediate actions:

1. Invoke `tool_12_manual_gate` to enable assisted validation.
2. Invoke `tool_03_dispatch_maintenance` with camera calibration context.
