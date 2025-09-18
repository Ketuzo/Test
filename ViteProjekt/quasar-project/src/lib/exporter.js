// General DAG exporter with named labels, multi-output, enable=, sendcmd, and global flags.
// Template support: node.type==='template' with data.mode 'graph' (chain) or 'cli' (block)
// + per-node Go Template injection (append/replace) for filters and flags

function asArray(x){ return Array.isArray(x) ? x : [] }
function normalizeVal(v){ if (v==null) return ''; if (Array.isArray(v)) return v.map(normalizeVal).join(':'); if (typeof v==='object'){ if('value'in v) return String(v.value); if('name'in v) return String(v.name); if('label'in v) return String(v.label); if('option'in v) return String(v.option); try{ return JSON.stringify(v) }catch{ return String(v) } } return String(v) }
function shellEscape(s){ const x = normalizeVal(s); return /[\s"'\\$`]/.test(x) ? `"${x.replace(/(["\\$`])/g,'\\$1')}"` : x }
function escEnable(expr){ if(!expr) return ''; const raw=String(expr); if(/^['"].*['"]$/.test(raw)) return raw; return `'${raw.replace(/'/g,"\\'").replace(/,/g,'\\,')}'` }
function escSendcmd(text){ if(!text) return ''; const body=String(text).replace(/'/g,"\\'").replace(/\r?\n/g,';'); return `'${body}'` }

// tiny preview renderer for a handful of tags
function renderTplLite(tpl, ctx){
  try{
    let out = String(tpl)
    const frames = Number(ctx?.Frames ?? 0)
    out = out.replace(/\{\{\s*sub\s+\.Frames\s+(\d+)\s*\}\}/g, (_,n)=> String(frames-Number(n||0)))
             .replace(/\{\{\s*\.Frames\s*\}\}/g, String(frames))
             .replace(/\{\{\s*\.Vars\.([a-zA-Z0-9_]+)\s*\}\}/g, (_,k)=> normalizeVal(ctx?.Vars?.[k] ?? ''))
    return out
  }catch{ return String(tpl) }
}

const isInput      = n => n?.type==='input-custom'||n?.type==='input'
const isOutput     = n => n?.type==='output-custom'||n?.type==='output'
const isFilter     = n => n?.type==='filter'
const isGlobal     = n => n?.type==='global'||n?.type==='other'||(n?.data?.cat==='global')
const isTemplate   = n => n?.type==='template'
const isChainTpl   = n => isTemplate(n) && n?.data?.mode==='graph'
const isBlockTpl   = n => isTemplate(n) && n?.data?.mode==='cli'

function edgeKind(e){ if(e?.data?.type) return e.data.type; const m=String(e?.sourceHandle||'').match(/(?:out_)?([vag])/i); return m?m[1].toLowerCase():null }
function edgeIndex(e){ const m=String(e?.targetHandle||'').match(/(?:^|_)([vag])(\d+)/i); return m?Number(m[2]):0 }

function isStreamFilter(n, type){
  if(!n) return false
  if (isFilter(n)){
    const cat = n.data?.cat
    return (type==='v' && cat==='video-filter') || (type==='a' && cat==='audio-filter')
  }
  if (isChainTpl(n)){
    return (type==='v' && n.data.stream==='v') || (type==='a' && n.data.stream==='a')
  }
  return false
}

function topo(filters, edges, type){
  const id2n=new Map(filters.map(n=>[n.id,n]))
  const inDeg=new Map(), adj=new Map()
  filters.forEach(n=>{ inDeg.set(n.id,0); adj.set(n.id,[]) })
  edges.filter(e=>edgeKind(e)===type).forEach(e=>{
    const s=e.source,t=e.target
    if(id2n.has(s)&&id2n.has(t)){ inDeg.set(t,inDeg.get(t)+1); adj.get(s).push(t) }
  })
  const q=[]; inDeg.forEach((d,id)=>{ if(d===0) q.push(id) })
  const out=[]
  while(q.length){ const id=q.shift(); out.push(id); for(const v of adj.get(id)){ inDeg.set(v,inDeg.get(v)-1); if(inDeg.get(v)===0) q.push(v) } }
  return out.map(id=>id2n.get(id))
}

function buildFilterGraph({nodes, edges, tplCtx}, type){
  const filters = nodes.filter(n=>isStreamFilter(n,type))
  const order = topo(filters, edges, type)

  const inputs = nodes.filter(isInput).slice().sort((a,b)=>(a.data?.index??0)-(b.data?.index??0))
  const seed=new Map(); inputs.forEach((n,k)=> seed.set(n.id,{v:`[${k}:v]`,a:`[${k}:a]`}) )

  const labelOfEdge=new Map(); const exprs=[]

  function incomingLabels(node){
    const inc = edges.filter(e=>edgeKind(e)===type && e.target===node.id).sort((e1,e2)=>edgeIndex(e1)-edgeIndex(e2))
    return inc.map(e=>{
      const src = nodes.find(n=>n.id===e.source)
      if(isInput(src)) return seed.get(src.id)?.[type] || (type==='v'?'[0:v]':'[0:a]')
      return labelOfEdge.get(e.id) || `[${src.id}_${type}0]`
    })
  }
  function setOutgoingLabels(node,outLabels){
    const outs = edges.filter(e=>edgeKind(e)===type && e.source===node.id).sort((a,b)=>{
      const i1=/out_[vag](\d+)/i.exec(a.sourceHandle||'')?.[1]??0
      const i2=/out_[vag](\d+)/i.exec(b.sourceHandle||'')?.[1]??0
      return Number(i1)-Number(i2)
    })
    outs.forEach((e,i)=> labelOfEdge.set(e.id, outLabels[i] || outLabels[0]))
  }

  order.forEach(node=>{
    const { expr, outLabels } = filterExprFromNode(node, type, incomingLabels(node), tplCtx)
    exprs.push(expr)
    setOutgoingLabels(node, outLabels)
  })

  const outNode = nodes.find(isOutput)
  let mapLabel=null
  if(outNode){
    if(outNode.data?.mapLabel && String(outNode.data.mapLabel).trim()){
      mapLabel = String(outNode.data.mapLabel).trim(); if(!mapLabel.startsWith('[')) mapLabel=`[${mapLabel}]`
    }else{
      const inc = edges.filter(e=>edgeKind(e)===type && e.target===outNode.id).sort((a,b)=>edgeIndex(a)-edgeIndex(b))
      const chosen = inc[inc.length-1]; if(chosen) mapLabel = labelOfEdge.get(chosen.id)
    }
  }
  return { exprs, mapLabel }
}

function filterExprFromNode(n, type, inLabels, tplCtx){
  // Template-Chain Node (eigener Node-Typ)
  if (isChainTpl(n)){
    const inStr = asArray(inLabels).map(s=> s.startsWith('[')? s : `[${s}]`).join('')
    const outCnt = Number(n?.data?.outputs ?? 1)
    const userOut= asArray(n?.data?.outLabels)
    const outLabels = Array.from({length: outCnt}, (_,i)=>{
      const lab = userOut[i] && String(userOut[i]).trim() ? String(userOut[i]).trim() : `${n.id}_${type}${i}`
      return `[${lab}]`
    })
    const body = String(n.data.template || '')
    const rendered = renderTplLite(body, tplCtx)
    const expr = `${inStr}${rendered}${outLabels.join('')}`
    return { expr, outLabels }
  }

  // normaler Filter-Node
  const baseName = n?.data?.group || n?.data?.key || n?.data?.option || 'null'
  const instance = (n?.data?.instance && String(n.data.instance).trim()) ? `@${String(n.data.instance).trim()}` : ''
  const name = `${baseName}${instance}`

  const p = Array.isArray(n?.data?.params) ? n.data.params : []
  const params = p
    .filter(({ v }) => v != null && String(v).trim() !== '')
    .map(({ k, v }) => `${k}=${String(v).trim()}`)
    .join(':')

  const enableExpr = n?.data?.enable
  let paramStr = enableExpr ? (params ? `${params}:enable=${escEnable(enableExpr)}` : `enable=${escEnable(enableExpr)}`) : params

  const inStr = asArray(inLabels).map(s=> s.startsWith('[')? s : `[${s}]`).join('')
  const send = n?.data?.sendcmd
  const sendcmdPart = send ? `sendcmd=c=${escSendcmd(send)},` : ''

  const outCnt = Number(n?.data?.outputs ?? 1)
  const userOut= asArray(n?.data?.outLabels)
  const outLabels = Array.from({length: outCnt}, (_,i)=>{
    const lab = userOut[i] && String(userOut[i]).trim() ? String(userOut[i]).trim() : `${n.id}_${type}${i}`
    return `[${lab}]`
  })

  // Per-Node Template Injection
  const tplMode = (n?.data?.tplMode || 'off').toLowerCase()
  const tplText = String(n?.data?.tplText || '').trim()

  if (tplMode === 'append' && tplText){
    const t = renderTplLite(tplText, tplCtx).trim()
    if (t) paramStr = paramStr ? `${paramStr}:${t}` : t
  }
  if (tplMode === 'replace' && tplText){
    const rendered = renderTplLite(tplText, tplCtx)
    const expr = `${inStr}${rendered}${outLabels.join('')}`
    return { expr, outLabels }
  }

  const expr = `${inStr}${sendcmdPart}${name}${paramStr ? `=${paramStr}` : ''}${outLabels.join('')}`
  return { expr, outLabels }
}

function collectTemplateBlocks(nodes, tplCtx){
  return nodes.filter(isBlockTpl).map(n=>{
    const body = String(n.data?.template || '')
    return renderTplLite(body, tplCtx)
  }).filter(Boolean)
}

function collectGlobalFlags({nodes, edges}, tplCtx){
  const outNode = nodes.find(isOutput); if(!outNode) return []
  const byId=new Map(nodes.map(n=>[n.id,n])); const seen=new Set(); const flags=[]
  function edgeKindG(e){ const m=String(e?.sourceHandle||'').match(/(?:out_)?([vag])/i); return m?m[1].toLowerCase():null }
  function incomingG(id){ return edges.filter(e=> edgeKindG(e)==='g' && e.target===id) }
  ;(function dfs(id){
    if(!id||seen.has(id)) return; seen.add(id)
    incomingG(id).forEach(e=>dfs(e.source))
    const n=byId.get(id)
    if(isGlobal(n)){
      const tplMode = (n.data?.tplMode || 'off').toLowerCase()
      const tplText = String(n.data?.tplText || '').trim()

      if (tplMode === 'replace' && tplText){
        flags.push(renderTplLite(tplText, tplCtx))
        return
      }

      if(Array.isArray(n.data?.flags) && n.data.flags.length){
        n.data.flags.forEach(it=>{
          const opt=it?.option||it?.key; if(!opt) return
          const val=normalizeVal(it?.value)
          flags.push(val ? `${opt} ${shellEscape(val)}` : `${opt}`)
        })
      }else{
        const opt=n.data?.option||n.data?.key
        if(opt){
          const val=normalizeVal(n.data?.value)
          flags.push(val ? `${opt} ${shellEscape(val)}` : `${opt}`)
        }
      }

      if (tplMode === 'append' && tplText){
        flags.push(renderTplLite(tplText, tplCtx))
      }
    }
  })(outNode.id)
  return flags
}

export function buildFFmpegCommand(state, opts={}){
  const nodes = asArray(state?.nodes)
  const edges = asArray(state?.edges)
  if(!nodes.length) return { cmd:'echo "no graph"', parts:[], warnings:['no graph'] }

  const warnings=[]; const parts=['ffmpeg']

  const tplCtx = opts.templateCtx || { Vars: state?.vars || {}, Frames: state?.frames || 0 }

  parts.push(...collectGlobalFlags({nodes, edges}, tplCtx))

  const inputs = nodes.filter(isInput).sort((a,b)=>(a.data?.index??0)-(b.data?.index??0))
  if(!inputs.length) warnings.push('no input node found; using ./input.mp4')
  const files = inputs.length ? inputs.map(n=> n.data?.path || './input.mp4') : ['./input.mp4']
  files.forEach(p=> parts.push('-i', shellEscape(p)))

  const V = buildFilterGraph({nodes, edges, tplCtx}, 'v')
  const A = buildFilterGraph({nodes, edges, tplCtx}, 'a')

  const exprs = [...V.exprs, ...A.exprs, ...collectTemplateBlocks(nodes, tplCtx)]
  if(exprs.length) parts.push('-filter_complex', `"${exprs.join(';')}"`)

  if (V.mapLabel) parts.push('-map', V.mapLabel)
  if (A.mapLabel) parts.push('-map', A.mapLabel)
  if (!V.mapLabel) { parts.push('-map', '0:v?', '-c:v', 'copy') }
  if (!A.mapLabel) { parts.push('-map', '0:a?', '-c:a', 'copy') }

  const out = nodes.find(isOutput)
  parts.push(shellEscape(out?.data?.path || './output.mp4'))

  return { cmd: parts.join(' '), parts, warnings }
}

export const buildCommand = (state, opts = {}) => buildFFmpegCommand(state, opts)
export default buildFFmpegCommand
