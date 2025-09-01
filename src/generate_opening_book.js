// Opening book generator for Reversi/Othello
// - Explores early plies using alpha-beta search and current NNEval model
// - Canonicalizes positions by 90-degree rotations and stores best move per position
// - Outputs a JSON file mapping position key -> { move, score, ply, depth }

const fs = require('fs');
const path = require('path');
const { Board } = require('./board.js');
const { NNEval } = require('./evaluate.js');
const { search } = require('./search.js');
const { Worker } = require('worker_threads');

function parseArgs() {
  const args = process.argv.slice(2);
  const opt = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--maxPlies') { opt.maxPlies = Number(next); i++; }
    else if (a === '--searchDepth') { opt.searchDepth = Number(next); i++; }
    else if (a === '--beamWidth') { opt.beamWidth = Number(next); i++; }
    else if (a === '--maxPositions') { opt.maxPositions = Number(next); i++; }
    else if (a === '--model') { opt.model = next; i++; }
    else if (a === '--output') { opt.output = next; i++; }
    else if (a === '--no-symmetry') { opt.symmetry = false; }
  else if (a === '--threads') { opt.threads = Number(next); i++; }
  else if (a === '--useAspiration') { opt.useAspiration = true; }
  else if (a === '--no-aspiration') { opt.useAspiration = false; }
  else if (a === '--useTT') { opt.useTT = true; }
  else if (a === '--no-tt') { opt.useTT = false; }
  else if (a === '--aspDelta' || a === '--aspirationDelta') { opt.aspirationDelta = Number(next); i++; }
  }
  return Object.assign({
    maxPlies: 8,
    searchDepth: 5,
    beamWidth: 5,
    maxPositions: 20000,
    model: path.join(process.cwd(), 'model.nn.json'),
    output: path.join(process.cwd(), 'opening_book.json'),
    symmetry: true,
    threads: Math.max(1, require('os').cpus().length - 1),
  useAspiration: true,
  useTT: true,
  aspirationDelta: 0.5,
  }, opt);
}

// Helpers
function padHex64(n) {
  const s = n.toString(16);
  return s.padStart(16, '0');
}

function boardKeyRaw(b) {
  return `${padHex64(b.black.board)}_${padHex64(b.white.board)}_${b.color}`;
}

// Rotate coordinate 90 degrees clockwise k times (k in 0..3)
function rotateCoord({ x, y }, k) {
  let nx = x, ny = y;
  for (let i = 0; i < k; i++) {
    const rx = ny;
    const ry = 7 - nx;
    nx = rx; ny = ry;
  }
  return { x: nx, y: ny };
}

// Return canonical key and the rotation index used (0..3)
function canonicalKeyAndRot(b) {
  if (!canonicalKeyAndRot._tmp) canonicalKeyAndRot._tmp = [null, null, null, null];
  const boards = canonicalKeyAndRot._tmp;
  boards[0] = new Board(b);
  boards[1] = boards[0].rotate();
  boards[2] = boards[1].rotate();
  boards[3] = boards[2].rotate();
  let best = null; let bestIdx = 0;
  for (let i = 0; i < 4; i++) {
    const k = boardKeyRaw(boards[i]);
    if (best === null || k < best) { best = k; bestIdx = i; }
  }
  return { key: best, rot: bestIdx };
}

function applyMove(board, pos) {
  const nb = board.clone();
  nb.reverse(pos);
  return nb;
}

function handlePass(board) {
  const nb = board.clone();
  nb.changeColor();
  return nb;
}

async function main() {
  const opt = parseArgs();
  console.log('[book] options', opt);

  const evalr = new NNEval({ optimizer: 'adam' });
  // Try sync load; if model doesn't exist, keep random init
  try { evalr.load(opt.model); console.log('[book] model loaded:', opt.model); } catch (e) { console.log('[book] model load skipped:', e.message); }

  const root = new Board();
  const queue = [{ board: root, ply: 0 }];
  const seen = new Set();
  const book = Object.create(null);

  let visited = 0;

  // Worker pool for scoring children in parallel
  const workerPath = path.join(__dirname, 'book_worker.js');
  const pool = Array.from({ length: Math.max(1, opt.threads|0) }, () => new Worker(workerPath));
  const modelSnap = { hiddenSizes: evalr.hiddenSizes, W: evalr.W, b: evalr.b };
  const defaultOptions = { useIterative: true, useAspiration: !!opt.useAspiration, useTT: !!opt.useTT, aspirationDelta: opt.aspirationDelta };
  await Promise.all(pool.map(w => new Promise((res, rej) => {
    w.setMaxListeners(0);
    const onOk = (m) => { if (m && m.type === 'inited') { cleanup(); res(); } };
    const onErr = (e) => { cleanup(); rej(e); };
    function cleanup() { w.off('message', onOk); w.off('error', onErr); }
    w.on('message', onOk);
    w.on('error', onErr);
    w.postMessage({ type: 'init', model: modelSnap, options: defaultOptions });
  })));

  async function scoreChildrenParallel(jobs, depth) {
    // Split jobs roughly evenly across workers
    const per = Math.ceil(jobs.length / pool.length);
    const promises = pool.map((w, i) => new Promise((res, rej) => {
      const slice = jobs.slice(i * per, (i + 1) * per);
      if (slice.length === 0) return res([]);
      const onMsg = (m) => { if (m && m.type === 'scored') { cleanup(); res(m.results); } };
      const onErr = (e) => { cleanup(); rej(e); };
      function cleanup() { w.off('message', onMsg); w.off('error', onErr); }
      w.on('message', onMsg);
      w.on('error', onErr);
      w.postMessage({ type: 'scoreChildren', jobs: slice, depth, options: defaultOptions });
    }));
    const results = await Promise.all(promises);
    return results.flat();
  }

  while (queue.length > 0) {
    if (visited >= opt.maxPositions) break;
    const { board, ply } = queue.shift();
    const { key, rot } = opt.symmetry ? canonicalKeyAndRot(board) : { key: boardKeyRaw(board), rot: 0 };
    if (seen.has(key)) continue;
    seen.add(key);
    visited++;

    // Generate legal moves or handle pass
    const posList = board.getNextPositionList();
    if (posList.length === 0) {
      // double pass -> game end
      const p2 = handlePass(board);
      if (!p2.isPass()) {
        if (ply < opt.maxPlies) queue.push({ board: p2, ply: ply + 1 });
      }
      continue;
    }

  // Prepare parallel jobs for scoring children at depth-1
  const children = posList.map(it => ({ move: it.p, child: applyMove(board, it.p) }));
  const jobs = children.map((c, idx) => ({ idx, black: c.child.black.board.toString(), white: c.child.white.board.toString(), color: c.child.color }));
  const results = await scoreChildrenParallel(jobs, Math.max(1, opt.searchDepth - 1));
  const scored = results.map(r => ({ move: children[r.idx].move, score: -r.score, child: children[r.idx].child }));
    scored.sort((a, b) => b.score - a.score);

    // Best move at this node (rotate into canonical orientation for storage)
    const best = scored[0];
    let moveCanonical = best.move;
    if (opt.symmetry && rot) moveCanonical = rotateCoord(best.move, rot);
    book[key] = {
      move: moveCanonical,
      score: best.score,
      ply,
      depth: opt.searchDepth,
    };

    // Beam expand
    const bw = Math.max(1, opt.beamWidth);
    for (let i = 0; i < Math.min(bw, scored.length); i++) {
      if (ply + 1 <= opt.maxPlies) queue.push({ board: scored[i].child, ply: ply + 1 });
    }
  }

  // Save
  fs.writeFileSync(opt.output, JSON.stringify({
    __type: 'OpeningBook',
    version: 1,
    maxPlies: opt.maxPlies,
    searchDepth: opt.searchDepth,
    beamWidth: opt.beamWidth,
    symmetry: !!opt.symmetry,
    entries: book,
  }, null, 2));
  console.log(`[book] saved ${Object.keys(book).length} entries to ${opt.output}`);
  pool.forEach(w => w.terminate());
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { parseArgs };
