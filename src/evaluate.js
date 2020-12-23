const MASK_HOR1 = 0x00000000000000FFn;
const MASK_HOR2 = 0x000000000000FF00n;
const MASK_HOR3 = 0x0000000000FF0000n;
const MASK_HOR4 = 0x00000000FF000000n;
const MASK_DIAG2 = 0x0000000000000102n;
const MASK_DIAG3 = 0x0000000000010204n;
const MASK_DIAG4 = 0x0000000001020408n;
const MASK_DIAG5 = 0x0000000102040810n;
const MASK_DIAG6 = 0x0000010204081020n;
const MASK_DIAG7 = 0x0001020408102040n;
const MASK_DIAG8 = 0x0102040810204080n;

let maskArray = [
    { pattern: MASK_HOR1, count: 8 },
    { pattern: MASK_HOR2, count: 8 },
    { pattern: MASK_HOR3, count: 8 },
    { pattern: MASK_HOR4, count: 8 },
    { pattern: MASK_DIAG2, count: 2 },
    { pattern: MASK_DIAG3, count: 3 },
    { pattern: MASK_DIAG4, count: 4 },
    { pattern: MASK_DIAG5, count: 5 },
    { pattern: MASK_DIAG6, count: 6 },
    { pattern: MASK_DIAG7, count: 7 },
    { pattern: MASK_DIAG8, count: 8 }
];

let pow3 = [
    Math.pow(3, 0),
    Math.pow(3, 1),
    Math.pow(3, 2),
    Math.pow(3, 3),
    Math.pow(3, 4),
    Math.pow(3, 5),
    Math.pow(3, 6),
    Math.pow(3, 7),
    Math.pow(3, 8),
    Math.pow(3, 9),
    Math.pow(3, 10),
    Math.pow(3, 11),
    Math.pow(3, 12),
    Math.pow(3, 13),
    Math.pow(3, 14),
    Math.pow(3, 15),
    Math.pow(3, 16),
    Math.pow(3, 17),
    Math.pow(3, 18),
    Math.pow(3, 19),
]

let weight = new Array(maskArray.length);

function initWeight(w) {
    if (w == undefined) {
        for(let i = 0; i < maskArray.length; i++){
            weight[i] = new Array(pow3[maskArray[i].count]);
            for(let j = 0; j < weight[i].length; j++){
                weight[i][j] = Math.random() - 0.5;
            }
        }
    }
    else {

    }

    console.log(JSON.stringify(weight));
}

function getIndex(board, mask) {
    let index = 0;
    let black = 0n;
    let white = 0n;

    //普通にpext関数使うより愚直に計算したほうが速かったので置き換える。もし置き換えてなかったらpext関数を使う
    if (mask.pattern == MASK_HOR1) {
        black = board.black.board & 0xFFn;
        white = board.white.board & 0xFFn;
    }
    else if (mask.pattern == MASK_HOR2) {
        black = (board.black.board >> 8n) & 0xFFn;
        white = (board.white.board >> 8n) & 0xFFn;
    }
    else if (mask.pattern == MASK_HOR3) {
        black = (board.black.board >> 16n) & 0xFFn;
        white = (board.white.board >> 16n) & 0xFFn;
    }
    else if (mask.pattern == MASK_HOR4) {
        black = (board.black.board >> 24n) & 0xFFn;
        white = (board.white.board >> 24n) & 0xFFn;
    }
    else if (mask.pattern == MASK_DIAG2) {
        let _black = board.black.board >> 1n;
        let _white = board.white.board >> 1n;
        black = (_black) & 0x01n | (_black >> 6n) & 0x02n;

        white = (_white) & 0x01n | (_white >> 6n) & 0x02n;
    }
    else if (mask.pattern == MASK_DIAG3) {
        let _black = board.black.board >> 2n;
        let _white = board.white.board >> 2n;
        black = (_black) & 0x01n | (_black >> 6n) & 0x02n | (_black >> 12n) & 0x04n;

        white = (_white) & 0x01n | (_white >> 6n) & 0x02n | (_white >> 12n) & 0x04n;
    }
    else if (mask.pattern == MASK_DIAG4) {
        let _black = board.black.board >> 3n;
        let _white = board.white.board >> 3n;
        black = (_black) & 0x01n | (_black >> 6n) & 0x02n | (_black >> 12n) & 0x04n | (_black >> 18n) & 0x08n;

        white = (_white) & 0x01n | (_white >> 6n) & 0x02n | (_white >> 12n) & 0x04n | (_white >> 18n) & 0x08n;
    }
    else if (mask.pattern == MASK_DIAG5) {
        let _black = board.black.board >> 4n;
        let _white = board.white.board >> 4n;
        black = (_black) & 0x01n | (_black >> 6n) & 0x02n | (_black >> 12n) & 0x04n | (_black >> 18n) & 0x08n |
            (_black >> 24n) & 0x10n;

        white = (_white) & 0x01n | (_white >> 6n) & 0x02n | (_white >> 12n) & 0x04n | (_white >> 18n) & 0x08n |
            (_white >> 24n) & 0x10n;
    }
    else if (mask.pattern == MASK_DIAG6) {
        let _black = board.black.board >> 5n;
        let _white = board.white.board >> 5n;
        black = (_black) & 0x01n | (_black >> 6n) & 0x02n | (_black >> 12n) & 0x04n | (_black >> 18n) & 0x08n |
            (_black >> 24n) & 0x10n | (_black >> 30n) & 0x20n;

        white = (_white) & 0x01n | (_white >> 6n) & 0x02n | (_white >> 12n) & 0x04n | (_white >> 18n) & 0x08n |
            (_white >> 24n) & 0x10n | (_white >> 30n) & 0x20n;
    }
    else if (mask.pattern == MASK_DIAG7) {
        let _black = board.black.board >> 6n;
        let _white = board.white.board >> 6n;
        black = (_black) & 0x01n | (_black >> 6n) & 0x02n | (_black >> 12n) & 0x04n | (_black >> 18n) & 0x08n |
            (_black >> 24n) & 0x10n | (_black >> 30n) & 0x20n | (_black >> 36n) & 0x40n;

        white = (_white) & 0x01n | (_white >> 6n) & 0x02n | (_white >> 12n) & 0x04n | (_white >> 18n) & 0x08n |
            (_white >> 24n) & 0x10n | (_white >> 30n) & 0x20n | (_white >> 36n) & 0x40n;
    }
    else if (mask.pattern == MASK_DIAG8) {
        let _black = board.black.board >> 7n;
        let _white = board.white.board >> 7n;
        black = (_black) & 0x01n | (_black >> 6n) & 0x02n | (_black >> 12n) & 0x04n | (_black >> 18n) & 0x08n |
            (_black >> 24n) & 0x10n | (_black >> 30n) & 0x20n | (_black >> 36n) & 0x40n | (_black >> 42n) & 0x80n;

        white = (_white) & 0x01n | (_white >> 6n) & 0x02n | (_white >> 12n) & 0x04n | (_white >> 18n) & 0x08n |
            (_white >> 24n) & 0x10n | (_white >> 30n) & 0x20n | (_white >> 36n) & 0x40n | (_white >> 42n) & 0x80n;
    }
    else {
        black = board.black.pext(mask.pattern);
        white = board.white.pext(mask.pattern);
    }

    //得られたビット列からindex値を計算する
    for (let i = 0; i < mask.count; i++) {
        index += (black & 0x01n) != 0 ? i != 0 ? pow3[i] + 1 : 1 : 0;
        index += (white & 0x01n) != 0 ? i != 0 ? pow3[i] + 2 : 2 : 0;

        black >>= 1n;
        white >>= 1n;
    }

    return index;
}

function _eval(board, color) {
    let score = 0;
    for (let i = 0; i < 4; i++) {
        board.black.rotate();
        board.white.rotate();
        for (let j = 0; j < maskArray.length; j++) {
            score += weight[i][getIndex(board, maskArray[j])];
        }
    }

    return score;
}

function evaluate(board, color) {

    return _eval(board, color);
    //盤面の石の数を数える
    let result = board.count();

    //手番からみたスコアを計算する
    if (color == BLACK) {
        return result.black - result.white;
    }
    else {
        return result.white - result.black;
    }
}