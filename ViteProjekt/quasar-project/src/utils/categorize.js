export function categorizeOption (o) {
  // Haupt-Kategorie
  let cat = 'misc'
  if      (o.filter_io?.startsWith('V')) cat = 'video-filter'
  else if (o.filter_io?.startsWith('A')) cat = 'audio-filter'
  else if (o.group?.toLowerCase().includes('global')) cat = 'global'

  // Filter gruppenname
  const group = (o.group || '')
    .replace(/\s*AVOptions$/i, '')   
    .trim() || 'misc'

  return { cat, group }
}
