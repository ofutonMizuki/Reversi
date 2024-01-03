class Eval {
    constructor() {
        this.board1 = new Array();
        this.board2 = new Array();
        this.space = new Array();
        this.cb = new Array();
    }

    async init(path) {
        let response = await fetch(path);
        let text = await response.text()
        text = text.split('\n');
        for (let i = 0; i < 65; i++) {
            this.board1.push(new Array());
            this.board2.push(new Array());
            this.space.push(new Array());
            this.cb.push(new Array());
            for (let j = 0; j < 64; j++) {
                this.board1[i].push(
                    Number(text[i * 256 + j])
                );
            }
            for (let j = 0; j < 64; j++) {
                this.board2[i].push(
                    Number(text[i * 256 + j + 64])
                );
            }
            for (let j = 0; j < 64; j++) {
                this.space[i].push(
                    Number(text[i * 256 + j + 128])
                );
            }
            for (let j = 0; j < 64; j++) {
                this.cb[i].push(
                    Number(text[i * 256 + j + 192])
                );
            }
        }
    }

    _eval(_board1, _board2, _cb) {
        let r = 0;
        let n = _board1.count() + _board2.count();
        let board1 = _board1.board, board2 = _board2.board;
        let cb = _cb.board;
        for (let i = 0; i < 64; i++) {
            if (board1 & 0x01n) {
                r += this.board1[n][i];
            }
            else if (board2 & 0x01n) {
                r += this.board2[n][i];
            }
            else {
                r += this.space[n][i];
            }
            if (cb & 0x01n) {
                r += this.cb[n][i];
            }
            board1 >>= 1n;
            board2 >>= 1n;
            cb >>= 1n;
        }
        return r;
    }

    evaluate(board, color) {
        let board1, board2;

        if (board.color == BLACK) {
            board1 = board.black;
            board2 = board.white;
        } else {
            board1 = board.white;
            board2 = board.black;
        }

        //盤面の石の数を数える
        let result = this._eval(board1, board2, board.getPosBoard());

        //手番からみたスコアを計算する
        if (color == board.color) {
            return result;
        }
        else {
            return -result;
        }
    }
}