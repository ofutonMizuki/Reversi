// Opening book generator for Reversi/Othello
// - Explores early plies using alpha-beta search and current NNEval model
// - Canonicalizes positions by 90-degree rotations and stores best move per position
// - Outputs a JSON file mapping position key -> { move, score, ply, depth }

const fs = require('fs');
const path = require('path');
const { Board } = require('./board.js');
const { NNEval } = require('./evaluate.js');
const { search } = require('./search.js');

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
  }
  return Object.assign({
    maxPlies: 8,
    searchDepth: 5,
    beamWidth: 5,
    maxPositions: 20000,
    model: path.join(process.cwd(), 'model.nn.json'),
    output: path.join(process.cwd(), 'opening_book.json'),
    symmetry: true,
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

    // Score each child by deeper search; negate to parent perspective
    const scored = [];
    for (const it of posList) {
      const child = applyMove(board, it.p);
      const res = search(child, Math.max(1, opt.searchDepth - 1), evalr);
      const parentScore = -res.score;
      scored.push({ move: it.p, score: parentScore, child });
    }
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
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { parseArgs };
