importScripts('board.js');
importScripts('evaluate.js');
importScripts('search.js');

// NN版評価器を使用
let e = new NNEval({ hiddenSizes: [64, 32] });
let __nnLoaded = false;
let __bookLoaded = false;
let __book = null;

async function ensureModelLoaded() {
    if (__nnLoaded) return;
    // ルート（../model.nn.json）→ 同階層（model.nn.json）の順に試す
    const candidates = ['../model.nn.json', 'model.nn.json'];
    for (const url of candidates) {
        try {
            await e.init(url);
            __nnLoaded = true;
            break;
        } catch (_) { /* try next */ }
    }
    // どちらも失敗した場合は乱数初期化のまま動作（探索は可能）
}

function padHex64(n) {
    const s = n.toString(16);
    return s.padStart(16, '0');
}

function boardKeyRaw(b) {
    return `${padHex64(b.black.board)}_${padHex64(b.white.board)}_${b.color}`;
}

function rotateCoord(pos, k) {
    let nx = pos.x, ny = pos.y;
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

async function ensureBookLoaded() {
    if (__bookLoaded) return;
    const candidates = ['../opening_book.json', 'opening_book.json'];
    for (const url of candidates) {
        try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) continue;
            const text = await res.text();
            const obj = JSON.parse(text);
            if (obj && obj.__type === 'OpeningBook' && obj.entries) {
                __book = obj;
                __bookLoaded = true;
                break;
            }
        } catch (_) { /* try next */ }
    }
}

self.addEventListener('message', async (message) => {
    await ensureModelLoaded();
    await ensureBookLoaded();
    let board = message.data.board;
    const b = new Board(
        {
            black: new BitBoard(board.black.board),
            white: new BitBoard(board.white.board),
            color: board.color,
            posBoard: new BitBoard(board.posBoard.board)
        }
    );

    // Opening book lookup
    if (__bookLoaded && __book && __book.entries) {
        const { key, rot } = canonicalKeyAndRot(b);
        const ent = __book.entries[key];
        if (ent && ent.move) {
            const inv = (4 - rot) & 3;
            const mv = rotateCoord(ent.move, inv);
            // ensure legality
            b.getPosBoard();
            if (b.isPos(mv)) {
                self.postMessage({ position: mv, score: ent.score ?? 0, numberOfNode: 0 });
                return;
            }
        }
    }

    // Fallback to search
    let result = search(b, message.data.maxDepth, e, { useIterative: true });

    console.log(message.data);
    self.postMessage(result);
});