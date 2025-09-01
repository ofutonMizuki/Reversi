// Self-play data generator worker
// Receives: { games, depth, model, forceRandomPlies, endgameExtraDepth, endgameTrigger, epsilon, useIterative, useTT, useAspiration, aspirationDelta }
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

function gameSamples(board, depth, e, opts) {
    const forceRandomPlies = opts.forceRandomPlies ?? 20;
    const endgameExtraDepth = opts.endgameExtraDepth ?? 6;
    const endgameTrigger = opts.endgameTrigger ?? 10;
    const epsilon = opts.epsilon ?? 0.05;
    const useIterative = !!opts.useIterative;
    const useTT = !!opts.useTT;
    const useAspiration = !!opts.useAspiration;
    const aspirationDelta = opts.aspirationDelta ?? 0.5;
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
        const remain = 64 - stones;
        const extra = (remain <= endgameTrigger) ? endgameExtraDepth : 0;
        const isOpeningRandom = (plies < forceRandomPlies);
        const randomByEps = (!isOpeningRandom && Math.random() < epsilon);
        const shallow = (isOpeningRandom || randomByEps);
        const maxDepth = shallow ? Math.max(1, Math.min(2, depth)) : (depth + extra);

        const options = { useIterative, useTT, useAspiration, aspirationDelta };
        const result = search(
            new Board({
                black: new BitBoard(board.black.board),
                white: new BitBoard(board.white.board),
                color: board.color,
                posBoard: new BitBoard(board.posBoard.board)
            }),
            maxDepth,
            e,
            options
        );

        if (!(isOpeningRandom || randomByEps)) {
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
    const opts = {
        forceRandomPlies: msg.forceRandomPlies ?? 20,
        endgameExtraDepth: msg.endgameExtraDepth ?? 6,
        endgameTrigger: msg.endgameTrigger ?? 10,
        epsilon: msg.epsilon ?? 0.05,
        useIterative: !!msg.useIterative,
        useTT: !!msg.useTT,
        useAspiration: !!msg.useAspiration,
        aspirationDelta: msg.aspirationDelta ?? 0.5,
    };
    const e = createEvalFromSnapshot(msg.model || {});

    const all = [];
    for (let g = 0; g < games; g++) {
        const board = new Board();
        const { samples, result } = gameSamples(board, depth, e, opts);
        const outcome = (result.black - result.white);
        for (const s of samples) s.outcome = outcome;
        all.push(...samples);
    }
    parentPort.postMessage({ type: 'samples', samples: all });
});
