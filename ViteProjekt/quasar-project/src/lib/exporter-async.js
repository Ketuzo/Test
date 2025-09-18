import { renderGoTemplate, initGoTpl } from './gotpl_wasm.js'; // ← richtiger Pfad/Name

// --------- kleine Safe-Wrapper, falls WASM fehlt ----------
let __goReady = false;
async function ensureGoTpl() {
  if (__goReady) return true;
  try {
    await initGoTpl();
    __goReady = true;
  } catch (err) {
    console.warn('[exporter] GoTpl WASM not available, falling back to plain text.', err);
    __goReady = false;
  }
  return __goReady;
}
async function tpl(str, ctx) {
  try {
    // wenn GoTpl verfügbar ist, richtig rendern – sonst Plaintext
    return __goReady ? await renderGoTemplate(str, ctx) : String(str || '');
  } catch {
    return String(str || '');
  }
}

// utils
const A = x => Array.isArray(x) ? x : [];
const norm = v => {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(norm).join(':');
  if (typeof v === 'object') {
    if ('value' in v)  return String(v.value);
    if ('name'  in v)  return String(v.name);
    if ('label' in v)  return String(v.label);
    if ('option'in v)  return String(v.option);
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v);
};
const sh = s => {
  const x = norm(s);
  return /[\s"'\\$`]/.test(x) ? `"${x.replace(/(["\\$`])/g,'\\$1')}"` : x;
};

const isInput    = n => n?.type==='input-custom'||n?.type==='input';
const isOutput   = n => n?.type==='output-custom'||n?.type==='output';
const isGlobal   = n => n?.type==='global'||n?.type==='other'||(n?.data?.cat==='global');
const typeOfEdge = e => {
  if(e?.data?.type) return e.data.type;
  const m=String(e?.sourceHandle||'').match(/(?:out_)?([vag])/i);
  return m?m[1].toLowerCase():null;
};
const tIndex = e => {
  const m=String(e?.targetHandle||'').match(/(?:^|_)([vag])(\d+)/i);
  return m?Number(m[2]):0;
};

function topo(nodes, edges, ch){
  const id2=new Map(nodes.map(n=>[n.id,n]));
  const indeg=new Map(), adj=new Map();
  nodes.forEach(n=>{ indeg.set(n.id,0); adj.set(n.id,[]) });
  edges.filter(e=>typeOfEdge(e)===ch).forEach(e=>{
    const s=e.source,t=e.target;
    if(id2.has(s)&&id2.has(t)){ indeg.set(t,indeg.get(t)+1); adj.get(s).push(t); }
  });
  const q=[]; indeg.forEach((d,id)=>{ if(d===0) q.push(id) });
  const out=[];
  while(q.length){
    const id=q.shift(); out.push(id);
    for(const v of adj.get(id)){ indeg.set(v,indeg.get(v)-1); if(indeg.get(v)===0) q.push(v); }
  }
  return out.map(id=>id2.get(id));
}

function edgeLabelsForInputs({nodes, edges, ch, node, seed, labelOfEdge}){
  const inc = edges
    .filter(e=>typeOfEdge(e)===ch && e.target===node.id)
    .sort((a,b)=>tIndex(a)-tIndex(b));
  return inc.map(e=>{
    const src = nodes.find(n=>n.id===e.source);
    if(isInput(src)) return seed.get(src.id)?.[ch] || (ch==='v'?'[0:v]':'[0:a]');
    return labelOfEdge.get(e.id) || `[${src.id}_${ch}0]`;
  });
}

function setOutLabels({edges, ch, node, outLabels, labelOfEdge}){
  const outs = edges
    .filter(e=>typeOfEdge(e)===ch && e.source===node.id)
    .sort((a,b)=>{
      const i1=/out_[vag](\d+)/i.exec(a.sourceHandle||'')?.[1]??0;
      const i2=/out_[vag](\d+)/i.exec(b.sourceHandle||'')?.[1]??0;
      return Number(i1)-Number(i2);
    });
  outs.forEach((e,i)=> labelOfEdge.set(e.id, outLabels[i] || outLabels[0]));
}

async function buildFilterExprFromNode(node, ch, inLabels, tplCtx){
  // Template-Override (ganzer Node)
  const override = String(node?.data?.templateOverride||'').trim();
  if (override){
    const rendered = await tpl(override, tplCtx);
    const expr = `${A(inLabels).join('')}${rendered}`;
    const outCnt = Number(node?.data?.outputs ?? 1);
    const user   = A(node?.data?.outLabels);
    const outLabels = Array.from({length: outCnt}, (_,i)=>{
      const lab = user[i] && String(user[i]).trim() ? String(user[i]).trim() : `${node.id}_${ch}${i}`;
      return `[${lab}]`;
    });
    return { expr, outLabels };
  }

  // normaler Filter
  const baseName = node?.data?.group || node?.data?.key || node?.data?.option || 'filter';
  const instance = (node?.data?.instance && String(node.data.instance).trim()) ? `@${String(node.data.instance).trim()}` : '';
  const name = `${baseName}${instance}`;

  const p = Array.isArray(node?.data?.params) ? node.data.params : [];
  let params = p.length ? p.map(({k,v})=>`${k}=${String(v??'')}`).join(':') : '';

  // enable=
  const enableExpr = node?.data?.enable;
  if (enableExpr){
    const esc = (raw)=> {
      if(!raw) return '';
      const txt = String(raw);
      if(/^['"].*['"]$/.test(txt)) return txt;
      return `'${txt.replace(/'/g,"\\'").replace(/,/g,'\\,')}'`;
    };
    params = params ? `${params}:enable=${esc(enableExpr)}` : `enable=${esc(enableExpr)}`;
  }

  // sendcmd c=
  const send = node?.data?.sendcmd;
  const sendPart = send ? `sendcmd=c='${String(send).replace(/'/g,"\\'").replace(/\r?\n/g,';')}',` : '';

  // tplMode/tplText → Append/Replace
  const mode = String(node?.data?.tplMode || 'off');
  const tplText  = String(node?.data?.tplText || '');
  if (mode !== 'off' && tplText.trim()){
    const rendered = await tpl(tplText, tplCtx);
    if (mode === 'append'){
      params = params ? `${params}:${rendered}` : String(rendered || '');
    } else if (mode === 'replace'){
      params = String(rendered || '');
    }
  }

  const inStr = A(inLabels).map(s=> s.startsWith('[')? s : `[${s}]`).join('');

  const outCnt = Number(node?.data?.outputs ?? 1);
  const user   = A(node?.data?.outLabels);
  const outLabels = Array.from({length: outCnt}, (_,i)=>{
    const lab = user[i] && String(user[i]).trim() ? String(user[i]).trim() : `${node.id}_${ch}${i}`;
    return `[${lab}]`;
  });

  const body = params ? `${name}=${params}` : `${name}`;
  const expr = `${inStr}${sendPart}${body}${outLabels.join('')}`;
  return { expr, outLabels };
}

async function buildFilterGraph({nodes, edges, ch, tplCtx}){
  const filters = nodes.filter(n => n?.type==='filter' && (
    (ch==='v' && n?.data?.cat==='video-filter') || (ch==='a' && n?.data?.cat==='audio-filter')
  ));
  const order = topo(filters, edges, ch);

  const inputs = nodes.filter(isInput).slice().sort((a,b)=>(a.data?.index??0)-(b.data?.index??0));
  const seed=new Map(); inputs.forEach((n,k)=> seed.set(n.id,{v:`[${k}:v]`,a:`[${k}:a]`}) );

  const labelOfEdge=new Map(); const exprs=[];

  for (const node of order){
    const inLabels = edgeLabelsForInputs({nodes, edges, ch, node, seed, labelOfEdge});
    const { expr, outLabels } = await buildFilterExprFromNode(node, ch, inLabels, tplCtx);
    exprs.push(expr);
    setOutLabels({edges, ch, node, outLabels, labelOfEdge});
  }

  // choose output label
  const outNode = nodes.find(isOutput);
  let mapLabel=null;
  if(outNode){
    if(outNode.data?.mapLabel && String(outNode.data.mapLabel).trim()){
      mapLabel = String(outNode.data.mapLabel).trim();
      if(!mapLabel.startsWith('[')) mapLabel=`[${mapLabel}]`;
    }else{
      const inc = edges.filter(e=>typeOfEdge(e)===ch && e.target===outNode.id).sort((a,b)=>tIndex(a)-tIndex(b));
      const chosen = inc[inc.length-1]; if(chosen) mapLabel = labelOfEdge.get(chosen.id);
    }
  }
  return { exprs, mapLabel };
}

function collectGlobalFlags({nodes, edges}){
  const outNode = nodes.find(isOutput); if(!outNode) return [];
  const byId=new Map(nodes.map(n=>[n.id,n])); const seen=new Set(); const flags=[];
  const edgeKindG = e => {
    const m=String(e?.sourceHandle||'').match(/(?:out_)?([vag])/i);
    return m?m[1].toLowerCase():null;
  };
  const incomingG = id => edges.filter(e=> edgeKindG(e)==='g' && e.target===id);

  (function dfs(id){
    if(!id||seen.has(id)) return; seen.add(id);
    incomingG(id).forEach(e=>dfs(e.source));
    const n=byId.get(id);
    if(isGlobal(n)){
      const mode = String(n?.data?.tplMode || 'off');
      const txt  = String(n?.data?.tplText || '');
      if (mode === 'replace' && txt.trim()){
        flags.push('__TPL_REPLACE__::' + txt);
        return;
      }
      if(Array.isArray(n.data?.flags) && n.data.flags.length){
        n.data.flags.forEach(it=>{
          const opt=it?.option||it?.key; if(!opt) return;
          const val=norm(it?.value);
          flags.push(val ? `${opt} ${val}` : `${opt}`);
        });
      }else{
        const opt=n.data?.option||n.data?.key;
        if(opt){
          const val=norm(n.data?.value);
          flags.push(val ? `${opt} ${val}` : `${opt}`);
        }
      }
      if (mode === 'append' && txt.trim()){
        flags.push('__TPL_APPEND__::' + txt);
      }
    }
  })(outNode.id);

  return flags;
}

export async function buildFFmpegCommandAsync(state, opts={}){
  await ensureGoTpl(); // WASM einmal versuchen

  const nodes = A(state?.nodes);
  const edges = A(state?.edges);
  if(!nodes.length) return { cmd:'echo "no graph"', parts:[], warnings:['no graph'] };

  const warnings=[]; const parts=['ffmpeg'];

  // 1) globale Flags (mit späterem Template-Render)
  const gFlags = collectGlobalFlags({nodes, edges});

  // 2) Inputs
  const inputs = nodes.filter(isInput).sort((a,b)=>(a.data?.index??0)-(b.data?.index??0));
  if(!inputs.length) warnings.push('no input node found; using ./input.mp4');
  const files = inputs.length ? inputs.map(n=> n.data?.path || './input.mp4') : ['./input.mp4'];
  files.forEach(p=> parts.push('-i', sh(p)));

  // 3) Template-Context
  const tplCtx = opts.templateCtx || { Vars: state?.vars || {}, Frames: state?.frames || 0 };

  // 4) Filtergraphs
  const V = await buildFilterGraph({nodes, edges, ch:'v', tplCtx});
  const A_ = await buildFilterGraph({nodes, edges, ch:'a', tplCtx});
  const exprs = [...V.exprs, ...A_.exprs];

  if(exprs.length) parts.push('-filter_complex', `"${exprs.join(';')}"`);
  if (V.mapLabel) parts.push('-map', V.mapLabel); else { parts.push('-map','0:v?','-c:v','copy'); }
  if (A_.mapLabel) parts.push('-map', A_.mapLabel); else { parts.push('-map','0:a?','-c:a','copy'); }

  // 5) globale Flags + tpl rendern
  for (const f of gFlags){
    if (f.startsWith('__TPL_REPLACE__::')){
      const rendered = await tpl(f.replace('__TPL_REPLACE__::',''), tplCtx);
      rendered.split(/\s+/).filter(Boolean).forEach(tok => parts.push(tok));
      continue;
    }
    if (f.startsWith('__TPL_APPEND__::')){
      const rendered = await tpl(f.replace('__TPL_APPEND__::',''), tplCtx);
      rendered.split(/\s+/).filter(Boolean).forEach(tok => parts.push(tok));
      continue;
    }
    const toks = f.split(/\s+/).filter(Boolean);
    parts.push(...toks);
  }

  // 6) Output
  const out = nodes.find(isOutput);
  parts.push(sh(out?.data?.path || './output.mp4'));

  return { cmd: parts.join(' '), parts, warnings };
}

export default buildFFmpegCommandAsync;
