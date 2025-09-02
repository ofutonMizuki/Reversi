const INFINITE_SCORE = 32768;
// TT flags
const TT_FLAG_EXACT = 0, TT_FLAG_LOWER = 1, TT_FLAG_UPPER = 2;
// Node: 明示 import、ブラウザ: 先に読み込まれた board.js のグローバルを参照
let SEARCH_BLACK_CONST = (typeof BLACK !== 'undefined') ? BLACK : undefined;
let BoardCtor = (typeof Board !== 'undefined') ? Board : undefined;
let BitBoardCtor = (typeof BitBoard !== 'undefined') ? BitBoard : undefined;
if (typeof module !== 'undefined' && module.exports) {
    const mod = require('./board.js');
    BoardCtor = mod.Board; // Node用参照（ブラウザでは既存の Board を使う）
    SEARCH_BLACK_CONST = mod.BLACK;
    BitBoardCtor = mod.BitBoard;
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
    // 増分用キャッシュ: 絶対チャネル [BLACK, WHITE, EMPTY, BLACK_LEGAL, WHITE_LEGAL]
    this.absFeat = null; // Float32Array(64*5)
    this._bLegalMask = 0n; // BigInt
    this._wLegalMask = 0n; // BigInt
    }

    clone() {
        let newBoard = new tBoard(super.clone());
        newBoard.prev = this.prev;
        newBoard.next = this.next.concat();
        newBoard.numberOfChildNode = this.numberOfChildNode;
        newBoard.n = this.n;
        newBoard.score = this.score;
        newBoard.position = Object.assign({}, this.position);
    // absFeat と合法手マスクもコピー
    newBoard.absFeat = this.absFeat ? new Float32Array(this.absFeat) : null;
    newBoard._bLegalMask = this._bLegalMask;
    newBoard._wLegalMask = this._wLegalMask;

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
    // posBoard は changeColor 内で更新済。増分キャッシュと整合させるため合法手マスクを保持
    // （absFeatは updateAbsFeat 内で子に対して反映）


    return newBoard;
}

function search(_board, maxDepth, eval) {
    let board = new tBoard(_board);
    // ルートの絶対特徴を初期化
    initAbsFeat(board);
    // per-search context
    const ctx = {
        tt: new Map(), // key -> { depth, score, flag, bestMove }
        killer: [], // killer[ply] = [{x,y}, {x,y}]
        history: Object.create(null), // 'x,y' -> score
        rootColor: board.color,
        enablePVS: true,
        enableLMR: true,
    };
    alphaBeta(board, maxDepth - 1, board.color, eval, -INFINITE_SCORE, INFINITE_SCORE, true, ctx);

    return {
        position: board.position,
        score: board.score,
        numberOfNode: board.numberOfChildNode
    }
}
function posKey(board, rootColor) {
    // include rootColor to keep TT safe within a single search orientation
    return `${board.black.board.toString(16)}_${board.white.board.toString(16)}_${board.color}_${rootColor}`;
}

function moveKey(p) { return `${p.x},${p.y}`; }

function scoreMoveHeuristic(ply, p, ctx) {
    let s = 0;
    const killers = ctx.killer[ply] || [];
    if (killers[0] && killers[0].x === p.x && killers[0].y === p.y) s += 1e6;
    if (killers[1] && killers[1].x === p.x && killers[1].y === p.y) s += 9e5;
    const hk = moveKey(p);
    s += (ctx.history[hk] || 0);
    return s;
}

// --- 増分更新ユーティリティ ---
const CH_BLACK = 0, CH_WHITE = 1, CH_EMPTY = 2, CH_BLEGAL = 3, CH_WLEGAL = 4;

function tzcnt64(x) {
    const bb = new BitBoardCtor();
    return Number(bb.GetNumberOfTrailingZeros(x));
}

function bitMaskXY(x, y) {
    // 0x8000.. >> (x + y*8)
    return 0x8000000000000000n >> (BigInt(x) + BigInt(y) * 8n);
}

function initAbsFeat(b) {
    const feat = new Float32Array(64 * 5);
    const bm = b.black.board;
    const wm = b.white.board;
    const occ = bm | wm;
    const em = ~occ & 0xFFFFFFFFFFFFFFFFn;
    const bl = b.genValidMove(b.black.board, b.white.board).board;
    const wl = b.genValidMove(b.white.board, b.black.board).board;
    let bb = bm, ww = wm, ee = em, bll = bl, wll = wl;
    for (let i = 0; i < 64; i++) {
        const base = i * 5;
        if (bb & 0x01n) feat[base + CH_BLACK] = 1;
        if (ww & 0x01n) feat[base + CH_WHITE] = 1;
        if (ee & 0x01n) feat[base + CH_EMPTY] = 1;
        if (bll & 0x01n) feat[base + CH_BLEGAL] = 1;
        if (wll & 0x01n) feat[base + CH_WLEGAL] = 1;
        bb >>= 1n; ww >>= 1n; ee >>= 1n; bll >>= 1n; wll >>= 1n;
    }
    b.absFeat = feat;
    b._bLegalMask = bl;
    b._wLegalMask = wl;
}

function updateAbsFeat(parent, child, move, revMask) {
    // 子の絶対特徴 = 親のコピー + 差分適用
    const feat = new Float32Array(parent.absFeat);
    const bmNew = child.black.board;
    const wmNew = child.white.board;
    const occNew = bmNew | wmNew;
    const emNew = ~occNew & 0xFFFFFFFFFFFFFFFFn;
    // 石配置の変化
    const bmOld = parent.black.board;
    const wmOld = parent.white.board;
    const diff = (bmOld ^ bmNew) | (wmOld ^ wmNew);
    let d = diff;
    while (d) {
        const lsb = d & (-d);
        const idx = tzcnt64(lsb);
        const base = idx * 5;
        // クリア
        feat[base + CH_BLACK] = 0;
        feat[base + CH_WHITE] = 0;
        feat[base + CH_EMPTY] = 0;
        // 新状態を書き込み
        if (bmNew & lsb) feat[base + CH_BLACK] = 1;
        else if (wmNew & lsb) feat[base + CH_WHITE] = 1;
        else feat[base + CH_EMPTY] = 1;
        d ^= lsb;
    }
    // 合法手の変化（子局面の posBoard を片側に流用し、もう片側のみ計算）
    let blNew, wlNew;
    if (child.color === SEARCH_BLACK_CONST) {
        // 直後は黒手番なので posBoard は黒の合法手
        blNew = child.posBoard.board;
        wlNew = child.genValidMove(child.white.board, child.black.board).board;
    } else {
        wlNew = child.posBoard.board;
        blNew = child.genValidMove(child.black.board, child.white.board).board;
    }
    let deltaBL = parent._bLegalMask ^ blNew;
    while (deltaBL) {
        const lsb = deltaBL & (-deltaBL);
        const idx = tzcnt64(lsb);
        feat[idx * 5 + CH_BLEGAL] = (blNew & lsb) ? 1 : 0;
        deltaBL ^= lsb;
    }
    let deltaWL = parent._wLegalMask ^ wlNew;
    while (deltaWL) {
        const lsb = deltaWL & (-deltaWL);
        const idx = tzcnt64(lsb);
        feat[idx * 5 + CH_WLEGAL] = (wlNew & lsb) ? 1 : 0;
        deltaWL ^= lsb;
    }
    child.absFeat = feat;
    child._bLegalMask = blNew;
    child._wLegalMask = wlNew;
}

function alphaBeta(board, maxDepth, color, eval, alpha, beta, moFlag, ctx) {
    const alphaOrig = alpha;
    const ply = board.n;
    let bestMoveLocal = null;

    // パス判定（キャッシュされた合法手マスクがあればそれを優先）
    let hasMove = null;
    if (board.absFeat) {
        if (board.color === SEARCH_BLACK_CONST) hasMove = board._bLegalMask !== 0n; else hasMove = board._wLegalMask !== 0n;
    }
    if (hasMove === null) hasMove = !board.isPass();
    if (!hasMove) {
        board.changeColor();

        //それでもパスならゲーム終了
        let oppHasMove = null;
        if (board.absFeat) {
            if (board.color === SEARCH_BLACK_CONST) oppHasMove = board._bLegalMask !== 0n; else oppHasMove = board._wLegalMask !== 0n;
        }
        if (oppHasMove === null) oppHasMove = !board.isPass();
        if (!oppHasMove) {

            //盤面の石の数を数える
            let result = board.count();

            //手番からみたスコアを計算する
            if (color == SEARCH_BLACK_CONST) {
                board.score = result.black - result.white;
            }
            else {
                board.score = result.white - result.black;
            }

            return board.score;
        }
    }

    //もし探索上限に達したら評価値を求める
    if (maxDepth < board.n) {
        if (typeof eval.evaluateFromAbs === 'function' && board.absFeat) {
            board.score = eval.evaluateFromAbs(board.absFeat, board, color);
        } else {
            board.score = eval.evaluate(board, color);
        }
        //board.score = Math.random();

        return board.score;
    }

    // TT 参照
    const key = posKey(board, ctx.rootColor);
    const remDepth = maxDepth - board.n; // 残り深さ（同一ノードでの基準）
    const ttEntry = ctx.tt.get(key);
    if (ttEntry && ttEntry.depth >= remDepth) {
        if (ttEntry.flag === TT_FLAG_EXACT) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG_LOWER && ttEntry.score >= beta) return ttEntry.score;
        if (ttEntry.flag === TT_FLAG_UPPER && ttEntry.score <= alpha) return ttEntry.score;
    }

    //合法手の生成
    let positionList = board.getNextPositionList();
    board.numberOfChildNode = positionList.length;
    // ムーブオーダリング
    // 1) TTベストムーブを先頭へ 2) キラー/ヒストリーで降順
    if (ttEntry && ttEntry.bestMove) {
        const idx = positionList.findIndex(m => m.p.x === ttEntry.bestMove.x && m.p.y === ttEntry.bestMove.y);
        if (idx > 0) {
            const [mv] = positionList.splice(idx, 1);
            positionList.unshift(mv);
        }
    }
    positionList.sort((a, b) => scoreMoveHeuristic(ply, b.p, ctx) - scoreMoveHeuristic(ply, a.p, ctx));

    if (color == board.color) {
        let prevBoard = board.prev;
        board.score = -INFINITE_SCORE;

        for (let i = 0; i < positionList.length; i++) {
            const move = positionList[i].p;
            const child = createNextBoard(board, move);
            // 増分特徴更新
            try { updateAbsFeat(board, child, move, 0n); } catch (_) { /* fail-safe */ }
            let score;
            const late = (i >= 2) && ctx.enableLMR && (remDepth >= 3);
            if (ctx.enablePVS && i > 0) {
                // PVS: まず null-window。LMR で深さを 1 減らすことも。
                const red = late ? 1 : 0;
                score = alphaBeta(child, maxDepth - red, color, eval, alpha, alpha + 1, false, ctx);
                if (score > alpha && score < beta) {
                    // 再探索（フルウィンドウ）
                    score = alphaBeta(child, maxDepth, color, eval, alpha, beta, moFlag, ctx);
                }
            } else {
                // 通常探索（LMR考慮）
                const red = late ? 1 : 0;
                score = alphaBeta(child, maxDepth - red, color, eval, alpha, beta, moFlag, ctx);
            }
            board.numberOfChildNode += child.numberOfChildNode;

            if (board.score < score) {
                board.score = score;
                bestMoveLocal = move;
            }
            if (alpha < score) {
                board.position = prevBoard == null ? Object.assign({}, child.position) : board.position;
                alpha = score;
            }
            if (alpha >= beta) {
                //使わない配列は明示的に解放
                board.next = [];
                // killer & history 更新
                ctx.killer[ply] = ctx.killer[ply] || [];
                const km = ctx.killer[ply];
                if (!km[0] || km[0].x !== move.x || km[0].y !== move.y) {
                    km[1] = km[0];
                    km[0] = move;
                }
                const hk = moveKey(move);
                ctx.history[hk] = (ctx.history[hk] || 0) + (remDepth * remDepth + 1);
                // TT 書き込み（下限境界）
                ctx.tt.set(key, { depth: remDepth, score: alpha, flag: TT_FLAG_LOWER, bestMove: move });
                return alpha;
            }
        }
    }
    else {
        let prevBoard = board.prev;
        board.score = INFINITE_SCORE;

        for (let i = 0; i < positionList.length; i++) {
            const move = positionList[i].p;
            const child = createNextBoard(board, move);
            // 増分特徴更新
            try { updateAbsFeat(board, child, move, 0n); } catch (_) { /* fail-safe */ }
            let score;
            const late = (i >= 2) && ctx.enableLMR && (remDepth >= 3);
            if (ctx.enablePVS && i > 0) {
                const red = late ? 1 : 0;
                score = alphaBeta(child, maxDepth - red, color, eval, beta - 1, beta, false, ctx);
                if (score > alpha && score < beta) {
                    score = alphaBeta(child, maxDepth, color, eval, alpha, beta, moFlag, ctx);
                }
            } else {
                const red = late ? 1 : 0;
                score = alphaBeta(child, maxDepth - red, color, eval, alpha, beta, moFlag, ctx);
            }
            board.numberOfChildNode += child.numberOfChildNode;

            if (board.score > score) {
                board.score = score;
                bestMoveLocal = move;
            }
            if (beta > score) {
                board.position = prevBoard == null ? Object.assign({}, child.position) : board.position;
                beta = score;
            }
            if (alpha >= beta) {
                //使わない配列は明示的に解放
                board.next = [];
                // killer & history 更新
                ctx.killer[ply] = ctx.killer[ply] || [];
                const km = ctx.killer[ply];
                if (!km[0] || km[0].x !== move.x || km[0].y !== move.y) {
                    km[1] = km[0];
                    km[0] = move;
                }
                const hk = moveKey(move);
                ctx.history[hk] = (ctx.history[hk] || 0) + (remDepth * remDepth + 1);
                // TT 書き込み（上限境界）
                ctx.tt.set(key, { depth: remDepth, score: beta, flag: TT_FLAG_UPPER, bestMove: move });
                return beta;
            }
        }
    }

    //使わない配列は明示的に解放
    board.next = [];
    // TT 書き込み（EXACT または境界）
    let flag = TT_FLAG_EXACT;
    if (board.score <= alphaOrig) flag = TT_FLAG_UPPER; // fail-low
    else if (board.score >= beta) flag = TT_FLAG_LOWER; // fail-high
    ctx.tt.set(key, { depth: remDepth, score: board.score, flag, bestMove: bestMoveLocal || board.position });
    return board.score;
}

// Node.js 用エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { search };
}