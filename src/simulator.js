export const plans = [
  {
    id: 'A',
    title: 'Reassign QC-03',
    impact: '+1.2 h',
    berth: 'Tuas B3',
    eta: '+1.2h',
    outcome: { throughput: '18,420', utilisation: '76%', delay: '3.1', energy: '70', emissions: '20.1' },
  },
  {
    id: 'B',
    title: 'Shift vessel to B4',
    impact: '+0.3 h',
    berth: 'Tuas B4',
    eta: '+0.3h',
    recommended: true,
    outcome: { throughput: '19,110', utilisation: '69%', delay: '0.8', energy: '65', emissions: '18.7' },
  },
  {
    id: 'C',
    title: 'Hold and prioritise reefers',
    impact: '+2.0 h',
    berth: 'Tuas B3',
    eta: '+2.0h',
    outcome: { throughput: '17,980', utilisation: '74%', delay: '4.8', energy: '63', emissions: '18.9' },
  },
]

export const incidentMetrics = {
  throughput: '18,742',
  utilisation: '72%',
  delay: '4.2',
  energy: '68',
  emissions: '19.6',
}

export const normalMetrics = {
  throughput: '19,260',
  utilisation: '68%',
  delay: '0.4',
  energy: '64',
  emissions: '18.4',
}

export const noAgentMetrics = {
  throughput: '16,380',
  utilisation: '89%',
  delay: '7.4',
  energy: '74',
  emissions: '22.8',
}

export function nowTime() {
  return new Intl.DateTimeFormat('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

export function makeLog(message, tone = 'blue') {
  return { id: crypto.randomUUID(), time: nowTime(), message, tone }
}
