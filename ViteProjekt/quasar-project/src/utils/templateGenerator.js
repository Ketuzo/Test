/**
 * Template-Generator (Stufe A)
 * - Unterstützt Node-Typen: tpl-snippet, tpl-filterchain, tpl-params, tpl-if, tpl-range, tpl-output
 * - Zusätzlich: normale "filter"-Nodes in Template-Zweigen (werden zu "name[=k=v:…]").
 */

/* ===== Helpers (Graph) ===== */
function mapById(nodes){ const m = new Map(); for (const n of (nodes||[])) m.set(n.id,n); return m }
function incoming(edges,id){ return (edges||[]).filter(e=>e.target===id) }
function outgoing(edges,id){ return (edges||[]).filter(e=>e.source===id) }
function indent(s){ return String(s||'').split('\n').map(l => (l ? '  '+l : l)).join('\n') }

/* ===== Helpers (Content) ===== */
function condToExpr(cond){
  if (!cond) return 'true'
  const op = cond.op || 'eq'
  const left = cond.left || 'ScanType'
  const right = String(cond.right ?? '')
  const lhs =
    left === 'AudioChannels' ? '.GetNumberOfAudioChannels'
      : left === 'Frames' ? '.Frames'
      : String(left).startsWith('$') || String(left).startsWith('.')
        ? String(left) : `.GetMIValue "video" "${left}" 0`
  switch (op){ case 'eq': return `eq ${lhs} "${right}"`
               case 'ne': return `ne ${lhs} "${right}"`
               case 'gt': return `gt ${lhs} ${right}`
               case 'lt': return `lt ${lhs} ${right}`
               default: return `eq ${lhs} "${right}"` }
}

function renderFilterChain(node){
  const chain = Array.isArray(node?.data?.chain) ? node.data.chain : []
  const parts = chain.map(item => {
    const name = item?.name || 'scale'
    const params = item?.params || {}
    const kv = Object.entries(params)
      .filter(([, v]) => String(v ?? '').trim() !== '')
      .map(([k, v]) => `${k}=${v}`)
      .join(':')
    return kv ? `${name}=${kv}` : name
  })
  return parts.join(',')
}
function renderParams(node){
  const rows = Array.isArray(node?.data?.items) ? node.data.items : []
  return rows
    .map(r => Array.isArray(r) ? r : [r?.k, r?.v])
    .filter(([k]) => String(k || '').trim() !== '')
    .map(([k, v]) => (v != null && String(v).trim() !== '' ? `${k} ${v}` : `${k}`))
    .join(' ')
}
/** Brücke: normales FilterNode → eine einfache Filter-Zeile */
function renderSingleFilter(node){
  const name = node?.data?.group || node?.data?.key || node?.data?.option || 'filter'
  const paramsArr = Array.isArray(node?.data?.params) ? node.data.params : []
  const params = paramsArr
    .map(p => `${p.k}=${String(p.v??'')}`)
    .filter(s => s && !/=$/.test(s))
    .join(':')
  if (!params) return name
  return `${name}=${params}`
}

/* ===== Core: rekursive Erzeugung ===== */
function genNode(nodesMap, edges, node, seen){
  if (!node) return ''
  const isLinear = ['tpl-filterchain','tpl-params','tpl-snippet','filter'].includes(node.type)
  if (isLinear){ if (seen.has(node.id)) return ''; seen.add(node.id) }

  // lineare Eltern zuerst
  const parents = incoming(edges, node.id)
  let before = ''
  for (const e of parents){
    const parent = nodesMap.get(e.source)
    if (parent && ['tpl-filterchain','tpl-params','tpl-snippet','filter'].includes(parent.type)){
      before += genNode(nodesMap, edges, parent, seen)
      if (!before.endsWith('\n')) before += '\n'
    }
  }

  switch (node.type) {
    case 'tpl-snippet': {
      const body = String(node.data?.body || '')
      return before + (body ? body + '\n' : '')
    }
    case 'tpl-filterchain': {
      const body = renderFilterChain(node)
      return before + (body ? body + '\n' : '')
    }
    case 'tpl-params': {
      const flags = renderParams(node)
      return before + (flags ? flags + '\n' : '')
    }
    case 'filter': {
      // einzelner Filter-Node als Zeile
      const line = renderSingleFilter(node)
      return before + (line ? line + '\n' : '')
    }
    case 'tpl-if': {
      const clauses = Array.isArray(node.data?.clauses) && node.data.clauses.length
        ? node.data.clauses
        : (node.data?.cond ? [node.data.cond] : [])
      if (!clauses.length) return before

      const outs = outgoing(edges, node.id)
      const toThen = outs.find(o => String(o.sourceHandle||'').startsWith('out_then') || o.sourceHandle === 'then')
      const toElse = outs.find(o => String(o.sourceHandle||'').startsWith('out_else') || o.sourceHandle === 'else')

      const thenNode = toThen ? nodesMap.get(toThen.target) : null
      const elseNode = toElse ? nodesMap.get(toElse.target) : null

      const thenStr = thenNode ? genNode(nodesMap, edges, thenNode, new Set()) : ''
      const elseStr = elseNode ? genNode(nodesMap, edges, elseNode, new Set()) : ''

      let out = before
      out += `{{ if ${condToExpr(clauses[0])} }}\n`
      if (thenStr) out += indent(thenStr)

      // elif-Klauseln: out_elif_0*, out_elif_1* …
      for (let i = 1; i < clauses.length; i++) {
        const e = outs.find(o => String(o.sourceHandle||'').startsWith(`out_elif_${i-1}`))
        const elifNode = e ? nodesMap.get(e.target) : null
        const body = elifNode ? genNode(nodesMap, edges, elifNode, new Set()) : ''
        out += `\n{{ else if ${condToExpr(clauses[i])} }}\n`
        if (body) out += indent(body)
      }

      if (toElse) {
        out += `\n{{ else }}\n`
        if (elseStr) out += indent(elseStr)
      }
      out += `\n{{ end }}\n`
      return out
    }
    case 'tpl-range': {
      const expr = String(node.data?.expr || 'until (int (.GetNumberOfAudioChannels))')
      const outs = outgoing(edges, node.id)
      const bodyEdge = outs.find(o => o.sourceHandle === 'body' || String(o.sourceHandle||'').startsWith('out'))
      const bodyNode = bodyEdge ? nodesMap.get(bodyEdge.target) : null
      const bodyStr = bodyNode ? genNode(nodesMap, edges, bodyNode, new Set()) : ''
      let out = before + `{{ range $i, $e := ${expr} }}\n`
      if (bodyStr) out += indent(bodyStr)
      out += `\n{{ end }}\n`
      return out
    }
    case 'tpl-output': {
      const incs = incoming(edges, node.id)
      let merged = ''
      for (const e of incs){
        const parent = nodesMap.get(e.source)
        if (parent){
          merged += genNode(nodesMap, edges, parent, new Set())
          if (!merged.endsWith('\n')) merged += '\n'
        }
      }
      return merged
    }
    default:
      return before
  }
}

/** Haupteinstieg */
export function generateTemplateFromBuilder({ nodes = [], edges = [] } = {}) {
  const map = mapById(nodes)
  const outputs = nodes.filter(n => n.type === 'tpl-output')
  if (!outputs.length) return { text: '', target: 'cli' }
  const out = outputs[0]
  const text = genNode(map, edges, out, new Set()).trim() + '\n'
  const target = out.data?.target || 'cli'
  return { text, target }
}

/* ===== schlanke, lineare Variante ===== */
function nextNodesFrom(edges, nodeId, handlePrefix = 'out') {
  return edges
    .filter(e => e.source === nodeId && String(e.sourceHandle || '').startsWith(handlePrefix))
    .map(e => ({ edge: e, target: e.target }))
}
function normalizeLeft(left) {
  const t = String(left || '').trim()
  if (!t) return '$x'
  if (t.startsWith('$') || t.startsWith('.')) return t
  return '$' + t
}
function genIfAdvanced(node, nodes, edges, seen) {
  const clauses = Array.isArray(node.data?.clauses) ? node.data.clauses : []
  if (!clauses.length) return ''

  const thenEdge = nextNodesFrom(edges, node.id, 'out_then')[0]
  const thenBody = thenEdge ? generateRec(nodes, edges, thenEdge.target, seen) : ''

  const elifBodies = []
  clauses.slice(1).forEach((c, i) => {
    const e = nextNodesFrom(edges, node.id, `out_elif_${i}`)[0]
    const body = e ? generateRec(nodes, edges, e.target, seen) : ''
    elifBodies.push({ clause: c, body })
  })

  let elseBody = ''
  if (node.data?.hasElse) {
    const e = nextNodesFrom(edges, node.id, 'out_else')[0]
    elseBody = e ? generateRec(nodes, edges, e.target, seen) : ''
  }

  let out = ''
  const first = clauses[0]
  out += `{{ if ${first.op} ${normalizeLeft(first.left)} "${String(first.right || '')}" }}\n${thenBody}`
  for (const { clause, body } of elifBodies) {
    out += `\n{{ else if ${clause.op} ${normalizeLeft(clause.left)} "${String(clause.right || '')}" }}\n${body}`
  }
  if (node.data?.hasElse) out += `\n{{ else }}\n${elseBody}`
  out += `\n{{ end }}`
  return out
}
function textForNode(node) {
  if (node?.data?.template) return String(node.data.template)
  if (node?.type === 'filter') return renderSingleFilter(node)
  return ''
}
function generateRec(nodes, edges, startId, seen) {
  if (!startId || seen.has(startId)) return ''
  seen.add(startId)
  const id2node = mapById(nodes)
  const node = id2node.get(startId)
  if (!node) return ''

  if (node.type === 'tpl-if') return genIfAdvanced(node, nodes, edges, seen)

  let out = textForNode(node)
  const nexts = nextNodesFrom(edges, node.id, 'out')
  nexts.forEach(({ target }) => {
    const s = generateRec(nodes, edges, target, seen)
    if (s) out += (out ? '\n' : '') + s
  })
  return out
}
export function generateTemplateFromGraph(nodes = [], edges = []) {
  const hasIn = new Set((edges || []).map(e => e.target))
  const roots = (nodes || []).filter(n => !hasIn.has(n.id))
  const seen = new Set()
  const blocks = roots.map(r => generateRec(nodes, edges, r.id, seen)).filter(Boolean)
  return blocks.join('\n')
}

export class TemplateGenerator {
  constructor(nodes = [], edges = []) { this.nodes = nodes; this.edges = edges }
  build(){ return generateTemplateFromBuilder({ nodes:this.nodes, edges:this.edges }) }
  buildTextOnly(){ return generateTemplateFromGraph(this.nodes, this.edges) }
}
export default TemplateGenerator
