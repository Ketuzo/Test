let ready = null;

function loadScript(src){
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function loadWasm(url, go){
  try {
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(buf, go.importObject);
    return instance;
  } catch {
    const { instance } = await WebAssembly.instantiateStreaming(fetch(url), go.importObject);
    return instance;
  }
}

export async function initGoTpl() {
  if (ready !== null) return ready;
  try {
    await loadScript('/wasm/wasm_exec.js');
    // @ts-ignore
    const go = new window.Go();
    const inst = await loadWasm('/wasm/gotpl.wasm', go);
    go.run(inst);
    ready = true;
  } catch (e) {
    console.warn('[gotpl] WASM nicht verfügbar, Lite-Fallback aktiv.', e);
    ready = false;
  }
  return ready;
}

export async function renderGoTemplate(tpl, ctx) {
  if (ready === null) await initGoTpl();

  if (ready && typeof window.gotplRender === 'function') {
    const res = window.gotplRender(String(tpl || ''), JSON.stringify(ctx || {}));
    if (res?.error) throw new Error(res.error);
    return res?.out || '';
  }
  return renderTplLite(tpl, ctx);
}

// sehr kleiner Fallback (nur Basics)
function renderTplLite(tpl, ctx){
  try{
    let out = String(tpl || '');
    const frames = Number(ctx?.Frames ?? 0);
    out = out
      .replace(/\{\{\s*\.Frames\s*\}\}/g, String(frames))
      .replace(/\{\{\s*\.Vars\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => String(ctx?.Vars?.[k] ?? ''));
    return out;
  }catch{
    return String(tpl || '');
  }
}
