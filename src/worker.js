importScripts('board.js');
importScripts('nn.js');
importScripts('evaluate.js');
importScripts('search.js');

let e = new Eval(); //evalは予約語なので使えません
let init = false;

self.addEventListener('message', async (message) => {
    if (init === false) {
        init = true;
        // 初期化処理
        await e.init("https://othello.ofuton.net/eval/");
    }
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