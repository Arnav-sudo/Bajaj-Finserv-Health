/* ── Config ──────────────────────────────────────────────────── */
const API_URL = '/bfhl';

const EXAMPLES = {
  basic:   ['A->B', 'A->C', 'B->D', 'C->E', 'E->F'],
  cycle:   ['A->B', 'B->C', 'X->Y', 'Y->Z', 'Z->X'],
  complex: ['A->B', 'A->C', 'B->D', 'C->D', 'X->Y', 'Y->Z', 'M->N', 'M->N', 'hello', '1->2'],
  invalid: ['A->A', 'AB->C', 'a->b', 'hello', '1->2', 'A->', 'A->B', 'A->B'],
};

/* ── DOM refs ────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const edgeInput    = $('edge-input');
const submitBtn    = $('submit-btn');
const clearBtn     = $('clear-btn');
const errorBanner  = $('error-banner');
const errorMsg     = $('error-msg');
const loader       = $('loader');
const resultsEl    = $('results-section');
const hierGrid     = $('hierarchies-grid');
const jsonViewer   = $('json-viewer');
const copyBtn      = $('copy-json');

/* ── Examples ────────────────────────────────────────────────── */
document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.example;
    edgeInput.value = EXAMPLES[key].join('\n');
    edgeInput.focus();
  });
});

clearBtn.addEventListener('click', () => {
  edgeInput.value = '';
  resultsEl.classList.add('hidden');
  errorBanner.classList.add('hidden');
});

/* ── Submit ──────────────────────────────────────────────────── */
submitBtn.addEventListener('click', submit);
edgeInput.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') submit();
});

async function submit() {
  errorBanner.classList.add('hidden');
  resultsEl.classList.add('hidden');

  const raw  = edgeInput.value.trim();
  if (!raw) { showError('Please enter at least one edge.'); return; }

  // Parse: split on newlines or commas
  const data = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  loader.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    const res  = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const json = await res.json();
    renderResults(json);
  } catch (err) {
    showError(`API Error: ${err.message}. Is the backend running?`);
  } finally {
    loader.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

/* ── Render ──────────────────────────────────────────────────── */
function renderResults(data) {
  const s = data.summary || {};

  // Stats
  $('stat-trees').textContent   = s.total_trees   ?? 0;
  $('stat-cycles').textContent  = s.total_cycles  ?? 0;
  $('stat-largest').textContent = s.largest_tree_root ?? '—';
  $('stat-invalid').textContent = (data.invalid_entries || []).length;
  $('stat-dupes').textContent   = (data.duplicate_edges || []).length;

  // Hierarchies
  hierGrid.innerHTML = '';
  const hierarchies = data.hierarchies || [];
  if (hierarchies.length === 0) {
    hierGrid.innerHTML = '<p style="color:var(--muted);font-size:.88rem">No hierarchies found.</p>';
  } else {
    hierarchies.forEach(h => hierGrid.appendChild(buildHierCard(h)));
  }

  // Invalid
  const invalids = data.invalid_entries || [];
  $('invalid-count').textContent = invalids.length;
  const invalidList = $('invalid-list');
  if (invalids.length === 0) {
    invalidList.innerHTML = '<span class="empty-msg">None 🎉</span>';
  } else {
    invalidList.innerHTML = invalids.map(e =>
      `<span class="entry-chip invalid-chip">${escHtml(String(e) || '(empty)')}</span>`
    ).join('');
  }

  // Duplicates
  const dupes = data.duplicate_edges || [];
  $('dupes-count').textContent = dupes.length;
  const dupeList = $('dupes-list');
  if (dupes.length === 0) {
    dupeList.innerHTML = '<span class="empty-msg">None 🎉</span>';
  } else {
    dupeList.innerHTML = dupes.map(e =>
      `<span class="entry-chip dupe-chip">${escHtml(e)}</span>`
    ).join('');
  }

  // JSON
  jsonViewer.textContent = JSON.stringify(data, null, 2);

  resultsEl.classList.remove('hidden');
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Hierarchy Card ──────────────────────────────────────────── */
function buildHierCard(h) {
  const card = document.createElement('div');
  card.className = `hier-card ${h.has_cycle ? 'is-cycle' : 'is-tree'}`;

  const typeLabel = h.has_cycle ? 'Cycle' : 'Tree';
  const depthBadge = (!h.has_cycle && h.depth != null)
    ? `<span class="badge depth">Depth ${h.depth}</span>` : '';

  card.innerHTML = `
    <div class="hier-header">
      <div class="hier-root">
        <div class="root-circle">${escHtml(h.root)}</div>
        <span>Root: <strong>${escHtml(h.root)}</strong></span>
      </div>
      <div class="hier-badges">
        ${depthBadge}
        <span class="badge ${h.has_cycle ? 'cycle' : 'tree'}">${typeLabel}</span>
      </div>
    </div>
    <div class="hier-body">
      ${h.has_cycle
        ? `<div class="cycle-msg">🔄 Cycle detected — no tree structure available</div>`
        : `<div class="tree-viz">${renderTreeNode(h.root, h.tree[h.root] || {}, true)}</div>`
      }
    </div>
  `;
  return card;
}

function renderTreeNode(label, children, isRoot = false) {
  const childKeys = Object.keys(children).sort();
  const hasChildren = childKeys.length > 0;
  const toggleHtml = hasChildren ? `<span class="node-toggle open">▶</span>` : '';
  const nodeId = `node-${Math.random().toString(36).slice(2)}`;

  const childrenHtml = hasChildren
    ? `<div class="tree-children" id="${nodeId}">${childKeys.map(k => renderTreeNode(k, children[k])).join('')}</div>`
    : '';

  return `
    <div class="tree-node">
      <div class="node-row" onclick="toggleNode('${nodeId}', this)" role="button">
        <div class="node-dot">${escHtml(label)}</div>
        <span class="node-label">${escHtml(label)}</span>
        ${toggleHtml}
      </div>
      ${childrenHtml}
    </div>
  `;
}

/* ── Toggle node ─────────────────────────────────────────────── */
window.toggleNode = function(id, row) {
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  const toggle = row.querySelector('.node-toggle');
  if (el.style.display === 'none') {
    el.style.display = '';
    if (toggle) toggle.classList.add('open');
  } else {
    el.style.display = 'none';
    if (toggle) toggle.classList.remove('open');
  }
};

/* ── Copy JSON ───────────────────────────────────────────────── */
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(jsonViewer.textContent).then(() => {
    copyBtn.textContent = 'Copied ✓';
    copyBtn.classList.add('copied');
    setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
  });
});

/* ── Helpers ─────────────────────────────────────────────────── */
function showError(msg) {
  errorMsg.textContent = msg;
  errorBanner.classList.remove('hidden');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
