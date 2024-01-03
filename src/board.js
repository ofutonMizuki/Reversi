const SPACE = 0;
const BLACK = 1;
const WHITE = -1;
const DEFAULT_BLACK_BOARD = 0x810000000n;
const DEFAULT_WHITE_BOARD = 0x1008000000n;

const TABLE = new Array(64);
let hash = 0x03F566ED27179461n;
for (let i = 0; i < 64; i++) {
    TABLE[hash >> 58n] = i;
    hash <<= 1n;
}

class BitBoard {
    constructor(board = 0x00n) {
        this.board = board;
    }

    clone() {
        let newBitBoard = new BitBoard();
        newBitBoard.board = this.board;
        return newBitBoard;
    }

    isSet(x, y) {
        let m = x + y * 8;
        return ((this.board << (BigInt(m))) & 0x8000000000000000n) != 0 ? true : false;
    }

    cr2bitboard(col, row) // col (0..7), row (0..7) に対応するビットボード生成
    {
        this.board = 0x8000000000000000n >> (BigInt(col) + BigInt(row) * 8n);
    }

    GetNumberOfTrailingZeros(x) {
        if (x == 0) return 64n;

        let y = (x & -x);
        let i = ((y * 0x03F566ED27179461n) >> 58n);
        return TABLE[i];
    }

    bitboard2cr() {
        let x = 63 - this.GetNumberOfTrailingZeros(this.board);
        return {
            x: (x % 8),
            y: (Math.floor(x / 8))
        };
    }

    isZero() {
        return this.board == 0 ? true : false;
    }

    _count() {
        let x = this.board;
        x = x - ((x >> 1n) & 0x5555555555555555n);

        x = (x & 0x3333333333333333n) + ((x >> 2n) & 0x3333333333333333n);

        x = (x + (x >> 4n)) & 0x0f0f0f0f0f0f0f0fn;
        x = x + (x >> 8n);
        x = x + (x >> 16n);
        x = x + (x >> 32n);
        return Number(x & 0x0000007fn);
    }

    count() {
        function popcount64(x1, x0) {
            let t0 = x1 - (x1 >>> 1 & 0x55555555);
            t0 = (t0 & 0x33333333) + ((t0 & 0xcccccccc) >>> 2);
            let t1 = x0 - (x0 >>> 1 & 0x55555555);
            t0 += (t1 & 0x33333333) + ((t1 & 0xcccccccc) >>> 2);
            t0 = (t0 & 0x0f0f0f0f) + ((t0 & 0xf0f0f0f0) >>> 4);
            return t0 * 0x01010101 >>> 24;
        }

        return popcount64(Number(this.board & 0xFFFFFFFFn), Number((this.board >> 32n) & 0xFFFFFFFFn))
    }

    rotate() {
        let b = this.board;
        b =
            ((b << 1n) & 0xAA00AA00AA00AA00n) |
            ((b >> 1n) & 0x0055005500550055n) |
            ((b >> 8n) & 0x00AA00AA00AA00AAn) |
            ((b << 8n) & 0x5500550055005500n);

        b =
            ((b << 2n) & 0xCCCC0000CCCC0000n) |
            ((b >> 2n) & 0x0000333300003333n) |
            ((b >> 16n) & 0x0000CCCC0000CCCCn) |
            ((b << 16n) & 0x3333000033330000n);

        b =
            ((b << 4n) & 0xF0F0F0F000000000n) |
            ((b >> 4n) & 0x000000000F0F0F0Fn) |
            ((b >> 32n) & 0x00000000F0F0F0F0n) |
            ((b << 32n) & 0x0F0F0F0F00000000n);

        this.board = b;
        return this;
    }
}

class Board {
    constructor(board) {
        if (board == undefined) {
            this.black = new BitBoard(DEFAULT_BLACK_BOARD);
            this.white = new BitBoard(DEFAULT_WHITE_BOARD);
            this.color = BLACK;
            this.posBoard = new BitBoard();

            this.getPosBoard();
        }
        else {
            this.black = board.black.clone();
            this.white = board.white.clone();
            this.color = board.color;
            this.posBoard = board.posBoard.clone();
        }
    }

    clone() {
        let newBoard = new Board({ black: new BitBoard(), white: new BitBoard(), color: BLACK, posBoard: new BitBoard() });
        //let newBoard = new Board();
        newBoard.black = this.black.clone();
        newBoard.white = this.white.clone();
        newBoard.color = this.color;
        newBoard.posBoard = this.posBoard.clone();

        return newBoard;
    }

    //指定した座標の色を教えてくれます
    getColor(position) {
        let x = position.x, y = position.y;
        let black = this.black.isSet(x, y);
        let white = this.white.isSet(x, y);
        if (black == white) {
            return SPACE;
        }
        else {
            if (black) {
                return BLACK;
            }
            else if (white) {
                return WHITE;
            }
        }
    }

    //ターンチェンジをしてくれます
    changeColor() {
        switch (this.color) {
            case BLACK:
                this.color = WHITE;
                break;
            case WHITE:
                this.color = BLACK;
                break;

            default:
                this.color = SPACE;
        }

        this.getPosBoard();
    }

    //パスか確認
    isPass() {
        return this.posBoard.isZero();
    }

    //指定した座標に置けるか確認してくれます
    isPos(position) {
        let x = position.x, y = position.y;
        return this.posBoard.isSet(x, y);
    }

    getNextPositionList() {
        let x = this.posBoard.clone();
        let positionList = new Array();
        while (x.board != 0) {
            positionList.push({ p: x.bitboard2cr(), s: 0 });

            x.board &= x.board - 1n;
        }

        return positionList;
    }

    //指定した座標に石をおいて反転します。
    //この関数では合法手であるかどうかのチェックは行われないので事前にisPos()でチェックしておくこと
    reverse(position) {
        let x = position.x, y = position.y;
        let m = new BitBoard();
        let rev = new BitBoard();

        m.cr2bitboard(x, y);

        if (this.color == BLACK) {
            rev = this.getRevPat(this.black.board, this.white.board, m.board);
            this.black.board ^= m.board | rev;
            this.white.board ^= rev;
        }
        else {
            rev = this.getRevPat(this.white.board, this.black.board, m.board);
            this.white.board ^= m.board | rev;
            this.black.board ^= rev;
        }

        this.changeColor();

        return rev;
    }

    count() {
        return {
            black: this.black.count(),
            white: this.white.count()
        }
    }

    //以下、外から使わない関数

    getPosBoard() {
        let board1 = 0n, board2 = 0n;

        if (this.color == BLACK) {
            board1 = this.black.board;
            board2 = this.white.board;
        }
        else {
            board1 = this.white.board;
            board2 = this.black.board;
        }

        return this.posBoard = this.genValidMove(board1, board2);
    }

    genValidMove(board1, board2) {
        let i;
        let blank = new BitBoard(), masked = new BitBoard(), valid = new BitBoard(), t = 0n;

        // 空マスのビットボードを（黒または白）のビットNOTで得る
        blank.board = ~(board1 | board2);

        // 右方向
        masked.board = board2 & 0x7e7e7e7e7e7e7e7en;
        t = masked.board & (board1 << 1n);
        for (i = 0; i < 5; i++) {
            t |= masked.board & (t << 1n);
        }
        valid.board = blank.board & (t << 1n);

        // 左方向
        masked.board = board2 & 0x7e7e7e7e7e7e7e7en;
        t = masked.board & (board1 >> 1n);
        for (i = 0; i < 5; i++) {
            t |= masked.board & (t >> 1n);
        }
        valid.board |= blank.board & (t >> 1n);

        // 上方向
        masked.board = board2 & 0x00ffffffffffff00n;
        t = masked.board & (board1 << 8n);
        for (i = 0; i < 5; i++) {
            t |= masked.board & (t << 8n);
        }
        valid.board |= blank.board & (t << 8n);

        // 下方向
        masked.board = board2 & 0x00ffffffffffff00n;
        t = masked.board & (board1 >> 8n);
        for (i = 0; i < 5; i++) {
            t |= masked.board & (t >> 8n);
        }
        valid.board |= blank.board & (t >> 8n);

        // 右上方向
        masked.board = board2 & 0x007e7e7e7e7e7e00n;
        t = masked.board & (board1 << 7n);
        for (i = 0; i < 5; i++) {
            t |= masked.board & (t << 7n);
        }
        valid.board |= blank.board & (t << 7n);

        // 左上方向
        masked.board = board2 & 0x007e7e7e7e7e7e00n;
        t = masked.board & (board1 << 9n);
        for (i = 0; i < 5; i++) {
            t |= masked.board & (t << 9n);
        }
        valid.board |= blank.board & (t << 9n);

        // 右下方向
        masked.board = board2 & 0x007e7e7e7e7e7e00n;
        t = masked.board & (board1 >> 9n);
        for (i = 0; i < 5; i++) {
            t |= masked.board & (t >> 9n);
        }
        valid.board |= blank.board & (t >> 9n);

        // 左下方向
        masked.board = board2 & 0x007e7e7e7e7e7e00n;
        t = masked.board & (board1 >> 7n);
        for (i = 0; i < 5; i++) {
            t |= masked.board & (t >> 7n);
        }
        valid.board |= blank.board & (t >> 7n);

        return valid;
    }

    getRevPat(board1, board2, m) { //反転ビットマスクを取得
        let rev = new BitBoard();
        if (((board1 | board2) & m) == 0) {
            let buf = new BitBoard();
            let mask = (m << 1n) & 0xfefefefefefefefen;
            while (mask != 0 && (mask & board2) != 0) {
                buf.board |= mask;
                mask = (mask << 1n) & 0xfefefefefefefefen;
            }
            if ((mask & board1) != 0)
                rev.board |= buf.board;

            buf.board = 0n;
            mask = (m << 9n) & 0xfefefefefefefe00n;
            while (mask != 0 && (mask & board2) != 0) {
                buf.board |= mask;
                mask = (mask << 9n) & 0xfefefefefefefe00n;
            }
            if ((mask & board1) != 0)
                rev.board |= buf.board;

            buf.board = 0n;
            mask = (m << 8n) & 0xffffffffffffff00n;
            while (mask != 0 && (mask & board2) != 0) {
                buf.board |= mask;
                mask = (mask << 8n) & 0xffffffffffffff00n;
            }
            if ((mask & board1) != 0)
                rev.board |= buf.board;

            buf.board = 0n;
            mask = (m << 7n) & 0x7f7f7f7f7f7f7f00n;
            while (mask != 0 && (mask & board2) != 0) {
                buf.board |= mask;
                mask = (mask << 7n) & 0x7f7f7f7f7f7f7f00n;
            }
            if ((mask & board1) != 0)
                rev.board |= buf.board;

            buf.board = 0n;
            mask = (m >> 1n) & 0x7f7f7f7f7f7f7f7fn;
            while (mask != 0 && (mask & board2) != 0) {
                buf.board |= mask;
                mask = (mask >> 1n) & 0x7f7f7f7f7f7f7f7fn;
            }
            if ((mask & board1) != 0)
                rev.board |= buf.board;

            buf.board = 0n;
            mask = (m >> 9n) & 0x007f7f7f7f7f7f7fn;
            while (mask != 0 && (mask & board2) != 0) {
                buf.board |= mask;
                mask = (mask >> 9n) & 0x007f7f7f7f7f7f7fn;
            }
            if ((mask & board1) != 0)
                rev.board |= buf.board;

            buf.board = 0n;
            mask = (m >> 8n) & 0x00ffffffffffffffn;
            while (mask != 0 && (mask & board2) != 0) {
                buf.board |= mask;
                mask = (mask >> 8n) & 0x00ffffffffffffffn;
            }
            if ((mask & board1) != 0)
                rev.board |= buf.board;

            buf.board = 0n;
            mask = (m >> 7n) & 0x00fefefefefefefen;
            while (mask != 0 && (mask & board2) != 0) {
                buf.board |= mask;
                mask = (mask >> 7n) & 0x00fefefefefefefen;
            }
            if ((mask & board1) != 0)
                rev.board |= buf.board;
        }

        return rev.board;
    }
}