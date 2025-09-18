export function topologicalSort (nodes, edges) {
  const out = []
  const visited = new Set()

  const visit = node => {
    if (visited.has(node.id)) return
    visited.add(node.id)

    edges
      .filter(e => e.target === node.id)
      .forEach(e => {
        const src = nodes.find(n => n.id === e.source)
        if (src) visit(src)
      })

    out.unshift(node)            
  }


  nodes
    .filter(n => n.type === 'output')
    .forEach(visit)

  return out
}
