importScripts('board.js');
importScripts('evaluate.js');
importScripts('search.js');

// NN版評価器を使用
let e = new NNEval({ hiddenSizes: [64, 32] });
let __nnLoaded = false;

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

self.addEventListener('message', async (message) => {
    await ensureModelLoaded();
    let board = message.data.board;
    let result = search(
        new Board(
            {
                black: new BitBoard(board.black.board),
                white: new BitBoard(board.white.board),
                color: board.color,
                posBoard: new BitBoard(board.posBoard.board)
            }
        ), message.data.maxDepth, e
    );

    console.log(message.data);
    self.postMessage(result);
});