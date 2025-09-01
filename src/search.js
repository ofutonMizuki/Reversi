const INFINITE_SCORE = 32768;
// Transposition table entry flags
const TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2;
// Node: 明示 import、ブラウザ: 先に読み込まれた board.js のグローバルを参照
let SEARCH_BLACK_CONST = (typeof BLACK !== 'undefined') ? BLACK : undefined;
let BoardCtor = (typeof Board !== 'undefined') ? Board : undefined;
if (typeof module !== 'undefined' && module.exports) {
    const mod = require('./board.js');
    BoardCtor = mod.Board; // Node用参照（ブラウザでは既存の Board を使う）
    SEARCH_BLACK_CONST = mod.BLACK;
}

function boardKey(b) {
    return b.zkey ?? `${b.black.board.toString(16)}_${b.white.board.toString(16)}_${b.color}`;
}

class tBoard extends BoardCtor {
    constructor(board) {
        super(board);
        this.prev = null;
        this.next = new Array();
        this.numberOfChildNode = 0;
        this.n = 0;
        this.score = 0;
        this.position = { x: -1, y: -1 };
        this.isPerfect = false;
    }

    clone() {
        let newBoard = new tBoard(super.clone());
        newBoard.prev = this.prev;
        newBoard.next = this.next.concat();
        newBoard.numberOfChildNode = this.numberOfChildNode;
        newBoard.n = this.n;
        newBoard.score = this.score;
        newBoard.position = Object.assign({}, this.position);

        return newBoard;
    }
}

function createNextBoard(board, position) {
    //新しい盤面にコピー
    //let newBoard = { ...board };
    let newBoard = board.clone();

    //
    newBoard.next = [];
    newBoard.prev = board;
    newBoard.numberOfChildNode = 0;
    newBoard.n += 1;
    newBoard.position = position;

    //ひっくり返す
    newBoard.reverse(position);


    return newBoard;
}

function search(_board, maxDepth, eval, options = {}) {
    // options:
    // - useIterative: boolean (default: false)
    // - timeMs: number | undefined (not used yet)
    // - hintMove: {x,y} | undefined
    // - useAspiration: boolean (default true when iterative)
    // - aspirationDelta: number (default 0.5)
    // - useTT: boolean (default true when iterative)
    if (options && options.useIterative) {
        return iterativeDeepening(_board, maxDepth / 4, eval, options);
    }
    let board = new tBoard(_board);
    const ctx = { tt: null, options };
    alphaBeta(board, maxDepth - 1, board.color, eval, -INFINITE_SCORE, INFINITE_SCORE, true, options && options.hintMove, ctx, -INFINITE_SCORE, INFINITE_SCORE);
    return {
        position: board.position,
        score: board.score,
        numberOfNode: board.numberOfChildNode
    };
}

function iterativeDeepening(_board, maxDepth, eval, options = {}) {
    let bestMove = options.hintMove || null;
    let bestScore = 0;
    let lastNodes = 0;
    const useAsp = options.useAspiration !== false; // default true
    const useTT = options.useTT !== false; // default true
    const deltaBase = options.aspirationDelta ?? 0.5;
    const ctx = { tt: useTT ? new Map() : null, options };
    for (let d = 1; d <= maxDepth; d++) {
        const board = new tBoard(_board);
        // Use previous iteration's best move as root hint ordering
        let alpha = -INFINITE_SCORE, beta = INFINITE_SCORE;
        if (useAsp && d > 1 && Number.isFinite(bestScore)) {
            let delta = deltaBase;
            // Aspiration window around previous best score
            alpha = bestScore - delta;
            beta = bestScore + delta;
            // Re-search with widening window on fail-low/high
            let done = false;
            for (let tries = 0; tries < 6 && !done; tries++) {
                alphaBeta(board, d - 1, board.color, eval, alpha, beta, true, bestMove, ctx, alpha, beta);
                if (board.score <= alpha) {
                    // fail-low → widen downward
                    delta *= 2; alpha = bestScore - delta;
                } else if (board.score >= beta) {
                    // fail-high → widen upward
                    delta *= 2; beta = bestScore + delta;
                } else {
                    done = true;
                }
            }
            if (!Number.isFinite(board.score)) {
                // Fallback to full window
                alphaBeta(board, d - 1, board.color, eval, -INFINITE_SCORE, INFINITE_SCORE, true, bestMove, ctx, -INFINITE_SCORE, INFINITE_SCORE);
            }
        } else {
            alphaBeta(board, d - 1, board.color, eval, alpha, beta, true, bestMove, ctx, alpha, beta);
        }
        bestMove = board.position && { x: board.position.x, y: board.position.y };
        bestScore = board.score;
        lastNodes = board.numberOfChildNode;
    }
    return {
        position: bestMove || { x: -1, y: -1 },
        score: bestScore,
        numberOfNode: lastNodes
    };
}

function alphaBeta(board, maxDepth, color, eval, alpha, beta, moFlag, rootHintMove, ctx, alpha0, beta0) {
    const useTT = ctx && ctx.tt;
    const key = useTT ? boardKey(board) : null;
    if (useTT && ctx.tt.has(key)) {
        const ent = ctx.tt.get(key);
        if (ent.depth >= (maxDepth + 1)) { // depth as remaining plies incl. current
            if (ent.flag === TT_EXACT) return ent.value;
            if (ent.flag === TT_LOWER && ent.value > alpha) alpha = ent.value;
            else if (ent.flag === TT_UPPER && ent.value < beta) beta = ent.value;
            if (alpha >= beta) return ent.value;
        }
    }
    //もしパスならターンチェンジ
    if (board.isPass()) {
        board.changeColor();

        //それでもパスならゲーム終了
        if (board.isPass()) {

            //盤面の石の数を数える
            let result = board.count();

            //手番からみたスコアを計算する
            if (color == SEARCH_BLACK_CONST) {
                board.score = result.black - result.white;
            }
            else {
                board.score = result.white - result.black;
            }

            if (useTT) ctx.tt.set(key, { depth: maxDepth + 1, value: board.score, flag: TT_EXACT, move: null });
            return board.score;
        }
    }

    //もし探索上限に達したら評価値を求める
    if (maxDepth < board.n) {
        board.score = eval.evaluate(board, color);
        //board.score = Math.random();

        return board.score;
    }

    //合法手の生成
    let positionList = board.getNextPositionList();
    // Root-level hint ordering (only applies at root: n === 0)
    if (rootHintMove && board.n === 0) {
        const idx = positionList.findIndex(it => it.p.x === rootHintMove.x && it.p.y === rootHintMove.y);
        if (idx > 0) {
            const [mv] = positionList.splice(idx, 1);
            positionList.unshift(mv);
        }
    }
    // TT move ordering
    if (useTT && ctx.tt.has(key) && positionList.length > 1) {
        const mv = ctx.tt.get(key).move;
        if (mv) {
            const idx = positionList.findIndex(it => it.p.x === mv.x && it.p.y === mv.y);
            if (idx > 0) {
                const [m] = positionList.splice(idx, 1);
                positionList.unshift(m);
            }
        }
    }
    board.numberOfChildNode = positionList.length;
    //ソートをする深さを設定(深さはなんとなくで設定)
    const sortDepth = moFlag ? Math.floor(maxDepth / 1.5) : maxDepth;

    let bestMoveLocal = null;
    if (color == board.color) {
        let prevBoard = board.prev;
        board.score = -INFINITE_SCORE;

        //枝刈りのためのソートをする場合ソート
        if (board.n < sortDepth && moFlag) {
            const cronedBoard = board.clone();
            for (let i = 0; i < positionList.length; i++) {
                cronedBoard.next.push(createNextBoard(cronedBoard, positionList[i].p));
                positionList[i].s = alphaBeta(cronedBoard.next[i], sortDepth - 1, color, eval, alpha, beta, false);
            }

            positionList.sort((a, b) => b.s - a.s);
        }

        for (let i = 0; i < positionList.length; i++) {
            board.next.push(createNextBoard(board, positionList[i].p));
            let score = alphaBeta(board.next[i], maxDepth, color, eval, alpha, beta, moFlag, null, ctx, alpha, beta);
            board.numberOfChildNode += board.next[i].numberOfChildNode;

            if (board.score < score) {
                board.score = score;
                bestMoveLocal = positionList[i].p;
            }
            if (alpha < score) {
                board.position = prevBoard == null ? Object.assign({}, board.next[i].position) : board.position;
                alpha = score;
            }
            if (alpha >= beta) {
                //使わない配列は明示的に解放
                board.next = [];
                if (useTT) ctx.tt.set(key, { depth: maxDepth + 1, value: alpha, flag: TT_LOWER, move: bestMoveLocal });
                return alpha;
            }
        }
    }
    else {
        let prevBoard = board.prev;
        board.score = INFINITE_SCORE;

        //枝刈りのためのソートをする場合ソート
        if (board.n < sortDepth && moFlag) {
            const cronedBoard = board.clone();
            for (let i = 0; i < positionList.length; i++) {
                cronedBoard.next.push(createNextBoard(cronedBoard, positionList[i].p));
                positionList[i].s = alphaBeta(cronedBoard.next[i], sortDepth - 1, color, eval, alpha, beta, false);
            }

            positionList.sort((a, b) => a.s - b.s);
        }

        for (let i = 0; i < positionList.length; i++) {
            board.next.push(createNextBoard(board, positionList[i].p));
            let score = alphaBeta(board.next[i], maxDepth, color, eval, alpha, beta, moFlag, null, ctx, alpha, beta);
            board.numberOfChildNode += board.next[i].numberOfChildNode;

            if (board.score > score) {
                board.score = score;
                bestMoveLocal = positionList[i].p;
            }
            if (beta > score) {
                board.position = prevBoard == null ? Object.assign({}, board.next[i].position) : board.position;
                beta = score;
            }
            if (alpha >= beta) {
                //使わない配列は明示的に解放
                board.next = [];
                if (useTT) ctx.tt.set(key, { depth: maxDepth + 1, value: beta, flag: TT_UPPER, move: bestMoveLocal });
                return beta;
            }
        }
    }

    //使わない配列は明示的に解放
    board.next = [];
    // Store TT entry
    if (useTT) {
        let flag = TT_EXACT;
        if (board.score <= alpha0) flag = TT_UPPER;
        else if (board.score >= beta0) flag = TT_LOWER;
        ctx.tt.set(key, { depth: maxDepth + 1, value: board.score, flag, move: bestMoveLocal });
    }
    return board.score;
}

// Node.js 用エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { search };
}