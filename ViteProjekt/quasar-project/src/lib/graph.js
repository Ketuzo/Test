// Kleine Helfer für den Graph & Export

// "VV->V", "AA->A", "V A->VA" etc.  →  { ins:['v',...], outs:['a',...] }
export function parseIO(sig) {
  const [left = '', right = ''] = String(sig || '').split('->')
  const pick = s => [...s.toLowerCase()].filter(ch => ch === 'v' || ch === 'a' || ch === 'g')
  return { ins: pick(left), outs: pick(right) }
}

// a/v/g aus einer Handle-ID herausziehen (z.B. "out_v0", "a0", "g0")
export function edgeTypeFromHandleId(handleId) {
  const m = String(handleId || '').match(/[avg]/i)
  return m ? m[0].toLowerCase() : null
}

// erste Ziffernfolge als Index (für ...0, ...1)
export function indexFromHandleId(handleId) {
  const m = String(handleId || '').match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

// Label für Filter-Outputs wie [nodeId_v0]
export function labelFor(nodeId, t, idx) {
  return `[${nodeId}_${t}${idx}]`
}
