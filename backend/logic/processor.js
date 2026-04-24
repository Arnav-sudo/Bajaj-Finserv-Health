'use strict';

// ─── USER CONFIG ─────────────────────────────────────────────────────────────
const USER_CONFIG = {
  user_id: 'arnav_24042026',
  email_id: 'arnav@example.com',
  college_roll_number: 'ROLL001',
};

// ─── VALIDATION ───────────────────────────────────────────────────────────────
function isValidEdge(str) {
  if (typeof str !== 'string') return false;
  const t = str.trim();
  if (!/^[A-Z]->[A-Z]$/.test(t)) return false;
  const [from, to] = t.split('->');
  if (from === to) return false; // self-loop
  return true;
}

// ─── MAIN PROCESSOR ───────────────────────────────────────────────────────────
function processData(data) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const keptEdges = [];
  const seenEdges = new Set();
  const duplicateSet = new Set();

  // STEP 1 & 2: Validate + Deduplicate
  for (const entry of data) {
    const raw = typeof entry === 'string' ? entry : String(entry);
    const trimmed = raw.trim();

    if (!isValidEdge(trimmed)) {
      invalidEntries.push(raw);
      continue;
    }
    if (seenEdges.has(trimmed)) {
      if (!duplicateSet.has(trimmed)) {
        duplicateEdges.push(trimmed);
        duplicateSet.add(trimmed);
      }
      continue;
    }
    seenEdges.add(trimmed);
    keptEdges.push(trimmed);
  }

  // STEP 3: Build graph with multi-parent resolution
  const childToParent = {};
  const parentToChildren = {};
  const allNodes = new Set();

  for (const edge of keptEdges) {
    const [from, to] = edge.split('->');
    allNodes.add(from);
    allNodes.add(to);
    if (!parentToChildren[from]) parentToChildren[from] = [];
    if (!parentToChildren[to])   parentToChildren[to]   = [];
    if (childToParent[to] !== undefined) continue; // multi-parent: first wins
    childToParent[to] = from;
    parentToChildren[from].push(to);
  }

  // STEP 4: Connected components (undirected BFS)
  const visitedNodes = new Set();
  const components   = [];

  function getNeighbors(node) {
    const s = new Set(parentToChildren[node] || []);
    if (childToParent[node] !== undefined) s.add(childToParent[node]);
    return s;
  }

  for (const node of allNodes) {
    if (visitedNodes.has(node)) continue;
    const comp  = new Set();
    const queue = [node];
    comp.add(node);
    visitedNodes.add(node);
    while (queue.length) {
      const curr = queue.shift();
      for (const nb of getNeighbors(curr)) {
        if (!comp.has(nb)) { comp.add(nb); visitedNodes.add(nb); queue.push(nb); }
      }
    }
    components.push(comp);
  }

  // STEP 5 & 6: Per-component — cycle detection + tree build
  const hierarchies = [];

  for (const comp of components) {
    const nodes    = [...comp].sort();
    const roots    = nodes.filter(n => childToParent[n] === undefined);
    const rootNode = roots.length > 0 ? roots[0] : nodes[0];

    // DFS cycle detection
    const color = {};
    for (const n of nodes) color[n] = 0;
    let hasCycle = false;

    function dfsCycle(node) {
      if (hasCycle) return;
      color[node] = 1;
      for (const child of (parentToChildren[node] || [])) {
        if (!comp.has(child)) continue;
        if (color[child] === 1) { hasCycle = true; return; }
        if (color[child] === 0)  dfsCycle(child);
      }
      color[node] = 2;
    }
    dfsCycle(rootNode);
    for (const n of nodes) { if (color[n] === 0) dfsCycle(n); }

    if (hasCycle) {
      hierarchies.push({ root: rootNode, tree: {}, has_cycle: true });
      continue;
    }

    // Build nested tree JSON
    function buildTree(node) {
      const children = (parentToChildren[node] || []).slice().sort();
      const obj = {};
      for (const c of children) obj[c] = buildTree(c);
      return obj;
    }

    function getDepth(node) {
      const ch = parentToChildren[node] || [];
      if (!ch.length) return 1;
      return 1 + Math.max(...ch.map(getDepth));
    }

    const tree = { [rootNode]: buildTree(rootNode) };
    hierarchies.push({ root: rootNode, tree, depth: getDepth(rootNode), has_cycle: false });
  }

  // Summary
  const treesOnly    = hierarchies.filter(h => !h.has_cycle);
  const totalTrees   = treesOnly.length;
  const totalCycles  = hierarchies.length - totalTrees;
  let largestRoot    = null;
  let largestDepth   = -1;
  for (const h of treesOnly) {
    if (h.depth > largestDepth || (h.depth === largestDepth && h.root < largestRoot)) {
      largestDepth = h.depth;
      largestRoot  = h.root;
    }
  }

  return {
    ...USER_CONFIG,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: { total_trees: totalTrees, total_cycles: totalCycles, largest_tree_root: largestRoot },
  };
}

module.exports = { processData };
