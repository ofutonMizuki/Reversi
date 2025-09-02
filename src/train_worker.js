// Self-play data generator worker
// Receives: { games, depth, model, forceRandomPlies, endgameExtraDepth }
// Sends: { samples: Array<{black:string,white:string,color:number,score:number}> }

const { parentPort } = require('worker_threads');
const { Board, BLACK, BitBoard } = require('./board.js');
const { search } = require('./search.js');
const { NNEval } = require('./evaluate.js');

function createEvalFromSnapshot(snap) {
    const e = new NNEval({ hiddenSizes: snap.hiddenSizes || [64, 32] });
    if (snap.W && snap.b) {
        e.hiddenSizes = snap.hiddenSizes;
        e.W = snap.W;
        e.b = snap.b;
    }
    return e;
}

function gameSamples(board, depth, e, forceRandomPlies = 20, endgameExtraDepth = 6) {
    const samples = [];
    // Ensure posBoard initialized
    board.getPosBoard();
    let move = { x: -1, y: -1 };
    while (true) {
        // Pass handling
        if (board.isPass()) {
            board.changeColor();
            if (board.isPass()) {
                // Game end
                return { samples, result: board.count() };
            }
        }
        const cnt = board.count();
        const stones = cnt.black + cnt.white;
        const plies = stones - 4;
        const forceRandom = plies < forceRandomPlies;
        const extra = (64 - stones) < endgameExtraDepth ? endgameExtraDepth : 0;
        const maxDepth = depth + extra;

        const result = search(
            new Board({
                black: new BitBoard(board.black.board),
                white: new BitBoard(board.white.board),
                color: board.color,
                posBoard: new BitBoard(board.posBoard.board)
            }),
            maxDepth,
            e
        );

        if (!forceRandom) {
            move.x = result.position.x;
            move.y = result.position.y;
        } else {
            // random legal move
            while (true) {
                move.x = Math.floor(Math.random() * 8);
                move.y = Math.floor(Math.random() * 8);
                if (board.isPos(move)) break;
            }
        }

        // record sample (use search score so parent can choose target)
        samples.push({
            black: board.black.board.toString(),
            white: board.white.board.toString(),
            color: board.color,
            score: result.score
        });

        board.reverse(move);
    }
}

parentPort.on('message', (msg) => {
    if (!msg || msg.type !== 'generate') return;
    const games = msg.games || 1;
    const depth = msg.depth || 2;
    const forceRandomPlies = msg.forceRandomPlies ?? 20;
    const endgameExtraDepth = msg.endgameExtraDepth ?? 6;
    const e = createEvalFromSnapshot(msg.model || {});

    const all = [];
    for (let g = 0; g < games; g++) {
        const board = new Board();
        const { samples, result } = gameSamples(board, depth, e, forceRandomPlies, endgameExtraDepth);
        const outcome = (result.black - result.white);
        for (const s of samples) s.outcome = outcome;
        all.push(...samples);
    }
    parentPort.postMessage({ type: 'samples', samples: all });
});
