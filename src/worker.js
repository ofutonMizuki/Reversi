importScripts('board.js');
importScripts('evaluate.js');
importScripts('search.js');

let initialized = false;
let e = new Eval();

self.addEventListener('message', async (message) => {
    if (initialized == false) {
        await e.read("https://othello.ofuton.net/eval/eval");
        init_board_js();
        initialized = true;
    }
    let board = message.data.board;
    let result = search(new Board({
        black: new BitBoard(board.black.board),
        white: new BitBoard(board.white.board),
        color: board.color,
        posBoard: new BitBoard(board.posBoard.board)
    }), message.data.maxDepth, e);

    console.log(message.data);
    self.postMessage(result);
});