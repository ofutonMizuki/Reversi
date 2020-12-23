importScripts('board.js');
importScripts('evaluate.js');
importScripts('search.js');

self.addEventListener('message', async (message) => {
    init_board_js();
    initWeight();
    let board = message.data.board;
    let result = search(new Board({
        black: new BitBoard(board.black.board),
        white: new BitBoard(board.white.board),
        color: board.color,
        posBoard: new BitBoard(board.posBoard.board)
    }), message.data.maxDepth);

    console.log(message.data);
    self.postMessage(result);
});