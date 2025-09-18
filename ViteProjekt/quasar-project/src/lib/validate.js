import { parseIO, edgeTypeFromHandleId } from './graph'

const isInputNode  = n => n?.type === 'input'  || n?.type === 'input-custom'
const isOutputNode = n => n?.type === 'output' || n?.type === 'output-custom'

export function validateGraph(nodes, edges) {
  const incoming = new Map()
  const outgoing = new Map()
  nodes.forEach((n) => {
    incoming.set(n.id, [])
    outgoing.set(n.id, [])
  })
  edges.forEach((e) => {
    outgoing.get(e.source)?.push(e)
    incoming.get(e.target)?.push(e)
  })

  const errors = []

  for (const n of nodes) {
    if (n.type !== 'filter' && n.type !== 'filter-node') continue
    const io = parseIO(n.data?.filter_io || '')

    const ins = (incoming.get(n.id) || []).filter((e) => e.targetHandle)
    const haveA = ins.filter((e) => edgeTypeFromHandleId(e.targetHandle) === 'a').length
    const haveV = ins.filter((e) => edgeTypeFromHandleId(e.targetHandle) === 'v').length
    const needA = io.ins.filter((x) => x === 'a').length
    const needV = io.ins.filter((x) => x === 'v').length

    if (haveA < needA) {
      errors.push({
        nodeId: n.id,
        message: `Input audio streams ${haveA}/${needA} verbunden`,
        port: { kind: 'in', idx: haveA, t: 'a' },
      })
    }
    if (haveV < needV) {
      errors.push({
        nodeId: n.id,
        message: `Input video streams ${haveV}/${needV} verbunden`,
        port: { kind: 'in', idx: haveV, t: 'v' },
      })
    }
  }

  if (!nodes.some(isOutputNode)) {
    errors.push({ nodeId: '', message: 'Kein Output-Node im Graph vorhanden' })
  }
  if (!nodes.some(isInputNode)) {
    errors.push({ nodeId: '', message: 'Kein Input-Node im Graph vorhanden' })
  }

  return errors
}
