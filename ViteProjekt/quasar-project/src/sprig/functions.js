export const SPRIG_FUNCTIONS = [
  { name:'default',  sig:'default <def> <val>',      desc:'Fallback, falls leer', category:'Defaults', snippet:'{{ default "mp4" .Vars.ext }}' },
  { name:'coalesce', sig:'coalesce v1 v2 …',        desc:'Erster nicht-leerer',  category:'Defaults', snippet:'{{ coalesce .Vars.a .Vars.b "x" }}' },
  { name:'ternary',  sig:'cond | ternary a b',      desc:'a bei true, sonst b',  category:'Flow',     snippet:'{{ eq .Vars.codec "h264" | ternary "libx264" "copy" }}' },
  { name:'toJson',   sig:'toJson <val>',            desc:'JSON serialisieren',    category:'JSON',     snippet:'{{ toJson .Vars.map }}' },
  { name:'fromJson', sig:'fromJson <str>',          desc:'JSON parsen',           category:'JSON',     snippet:'{{ (fromJson .Vars.jsonStr).key }}' },
  { name:'now|date', sig:'now | date "2006-01-02"', desc:'Zeit formatieren',      category:'Dates',    snippet:'{{ now | date "2006-01-02" }}' },
  { name:'base',     sig:'base <path>',             desc:'Dateiname',             category:'Path',     snippet:'{{ base .Vars.path }}' },
  { name:'uuidv4',   sig:'uuidv4',                  desc:'Random UUID',           category:'Advanced', snippet:'{{ uuidv4 }}' }
]

export const SPRIG_GROUPS = SPRIG_FUNCTIONS.reduce((a,fn)=>((a[fn.category]??=[]).push(fn),a),{})
