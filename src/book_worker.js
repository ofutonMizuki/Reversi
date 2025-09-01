// Worker for opening book generation: score child boards in parallel
const { parentPort } = require('worker_threads');
const { Board, BitBoard } = require('./board.js');
const { search } = require('./search.js');
const { NNEval } = require('./evaluate.js');

let evalr = null;
let defaultOptions = { useIterative: true };

function createEvalFromSnapshot(snap) {
  const e = new NNEval({ hiddenSizes: snap.hiddenSizes || [64, 32] });
  if (snap.W && snap.b) {
    e.hiddenSizes = snap.hiddenSizes;
    e.W = snap.W;
    e.b = snap.b;
  }
  return e;
}

parentPort.on('message', (msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'init') {
    evalr = createEvalFromSnapshot(msg.model || {});
    defaultOptions = msg.options || defaultOptions;
    parentPort.postMessage({ type: 'inited' });
    return;
  }
  if (msg.type === 'scoreChildren') {
    if (!evalr) {
      evalr = new NNEval();
    }
    const depth = msg.depth || 1;
    const opts = msg.options || defaultOptions;
    const out = [];
    for (let i = 0; i < msg.jobs.length; i++) {
      const j = msg.jobs[i];
      const b = new Board({
        black: new BitBoard(BigInt(j.black)),
        white: new BitBoard(BigInt(j.white)),
        color: j.color,
        posBoard: new BitBoard()
      });
      // Ensure posBoard initialized for root
      b.getPosBoard();
      const r = search(b, Math.max(1, depth), evalr, opts);
      out.push({ idx: j.idx, score: r.score });
    }
    parentPort.postMessage({ type: 'scored', results: out });
  }
});
