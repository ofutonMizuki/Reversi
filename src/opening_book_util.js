const fs = require('fs');
const path = require('path');
const { Board } = require('./board.js');

function padHex64(n) {
  const s = n.toString(16);
  return s.padStart(16, '0');
}

function boardKeyRaw(b) {
  return `${padHex64(b.black.board)}_${padHex64(b.white.board)}_${b.color}`;
}

function rotateCoord({ x, y }, k) {
  let nx = x, ny = y;
  for (let i = 0; i < k; i++) {
    const rx = ny;
    const ry = 7 - nx;
    nx = rx; ny = ry;
  }
  return { x: nx, y: ny };
}

function canonicalKeyAndRot(b) {
  const boards = [new Board(b), null, null, null];
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

function loadBook(bookPath) {
  const p = path.isAbsolute(bookPath) ? bookPath : path.join(process.cwd(), bookPath);
  const text = fs.readFileSync(p, 'utf8');
  const obj = JSON.parse(text);
  if (!obj || obj.__type !== 'OpeningBook' || !obj.entries) throw new Error('invalid book JSON');
  return obj;
}

function lookupMove(board, book) {
  const { key, rot } = canonicalKeyAndRot(board);
  const ent = book.entries[key];
  if (!ent) return null;
  // ent.move は正規化（rot方向）で格納。元の向きに戻すには逆回転（4-rot）
  const invRot = (4 - rot) & 3;
  const mv = rotateCoord(ent.move, invRot);
  return { move: mv, meta: { score: ent.score, ply: ent.ply, depth: ent.depth } };
}

module.exports = { loadBook, lookupMove };
