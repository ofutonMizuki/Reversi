// Node.js でのファイル入出力ヘルパ
let fsNode = null;
let EVAL_BLACK_CONST = (typeof BLACK !== 'undefined') ? BLACK : undefined;
if (typeof module !== 'undefined' && module.exports) {
    try { fsNode = require('fs'); } catch (_) { /* noop */ }
    try { EVAL_BLACK_CONST = require('./board.js').BLACK; } catch (_) { /* noop */ }
}

class Eval {
    constructor() {
        this.board1 = new Array();
        this.board2 = new Array();
        this.space = new Array();
        this.cb = new Array();
        // 単純な線形学習係数（デモ用）。本格的な学習器ではない。
        this.lr = 0.00001;
        this.lambda = 0.0; // L2 正則化係数（0 で無効）
    }

    setLearningRate(lr) { this.lr = lr; }
    setL2(lambda) { this.lambda = lambda; }

    async init(path) {
        // ブラウザ: fetch, Node: fs で読み込み
        let text;
        if (typeof fetch !== 'undefined') {
            let response = await fetch(path);
            text = await response.text();
        } else if (fsNode) {
            text = fsNode.readFileSync(path, 'utf8');
        } else {
            throw new Error('No loader available for eval data');
        }
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

    if (board.color == EVAL_BLACK_CONST) {
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

    // 単純な勾配っぽい更新（実験用）
    train(board, color, score) {
        // 現在手番視点でのボード表現を取得（_eval と同じ並び）
        let b1, b2;
        if (typeof EVAL_BLACK_CONST === 'undefined') {
            try { EVAL_BLACK_CONST = require('./board.js').BLACK; } catch (_) { /* noop */ }
        }
        if (board.color == EVAL_BLACK_CONST) {
            b1 = board.black.board;
            b2 = board.white.board;
        } else {
            b1 = board.white.board;
            b2 = board.black.board;
        }

        // 合法手ビットボード（候補手特徴）
        let cb = board.getPosBoard().board;
        //手番からみたスコアを計算する
    if (EVAL_BLACK_CONST == board.color) {
            score = score;
        }
        else {
            score = -score;
        }

        // 予測値を現在の color 視点で計算
        const pred = this.evaluate(board, color);
        // 教師値との差分（誤差）
        const err = (score - pred);

        // 石の総数でステージを決める（0..64）
        const n = board.black.count() + board.white.count();

        // 64 マスを走査し、活性化している重みを線形更新
        for (let i = 0; i < 64; i++) {
            if (b1 & 0x01n) {
                // 手番側の石
                this.board1[n][i] += this.lr * err - this.lambda * this.board1[n][i];
            } else if (b2 & 0x01n) {
                // 非手番側の石
                this.board2[n][i] += this.lr * err - this.lambda * this.board2[n][i];
            } else {
                // 空きマス
                this.space[n][i] += this.lr * err - this.lambda * this.space[n][i];
            }

            if (cb & 0x01n) {
                // 着手可能マス特徴
                this.cb[n][i] += this.lr * err - this.lambda * this.cb[n][i];
            }

            b1 >>= 1n;
            b2 >>= 1n;
            cb >>= 1n;
        }
    }

    load(path) {
        if (!fsNode) return; // ブラウザでは何もしない
        if (!fsNode.existsSync(path)) return;
        const text = fsNode.readFileSync(path, 'utf8').split('\n');
        let k = 0;
        for (let i = 0; i < 65; i++) {
            for (let j = 0; j < 64; j++) this.board1[i][j] = Number(text[k++]);
            for (let j = 0; j < 64; j++) this.board2[i][j] = Number(text[k++]);
            for (let j = 0; j < 64; j++) this.space[i][j] = Number(text[k++]);
            for (let j = 0; j < 64; j++) this.cb[i][j] = Number(text[k++]);
        }
    }

    save(path) {
        if (!fsNode) return; // ブラウザでは何もしない
        const lines = [];
        for (let i = 0; i < 65; i++) {
            for (let j = 0; j < 64; j++) lines.push(String(this.board1[i][j] ?? 0));
            for (let j = 0; j < 64; j++) lines.push(String(this.board2[i][j] ?? 0));
            for (let j = 0; j < 64; j++) lines.push(String(this.space[i][j] ?? 0));
            for (let j = 0; j < 64; j++) lines.push(String(this.cb[i][j] ?? 0));
        }
        fsNode.writeFileSync(path, lines.join('\n'));
    }
}

// 簡単な全結合NN評価関数（任意層）。
// 入力: 64マス x Cチャネル
//   既定: C=5（手番石/相手石/空き/自合法手/相手合法手）= 320 次元
// 出力: 実数スコア（手番視点）。evaluate(board, color) は color 視点に反転して返すのは従来通り。
class NNEval {
    constructor(options = {}) {
        // hiddenSizes: 任意長の配列。未指定なら [16,8]
        let hs = options.hiddenSizes;
        if (!Array.isArray(hs) || hs.length === 0) {
            const h1 = options.hiddenSize ?? 16;
            const h2 = options.hiddenSize2 ?? Math.max(8, Math.floor(h1 / 2));
            hs = [h1, h2];
        }
        // 正の整数のみ
        this.hiddenSizes = hs.filter(x => Number.isFinite(x) && x > 0).map(x => Math.floor(x));
        if (this.hiddenSizes.length === 0) this.hiddenSizes = [16, 8];

    this.lr = options.lr ?? 0.001;
    this.lambda = options.lambda ?? 0.00001; // L2 (weight decay as L2 grad)
    this.optimizer = (options.optimizer || 'adam').toLowerCase(); // 'adam' | 'sgd'
    this.beta1 = options.beta1 ?? 0.9;
    this.beta2 = options.beta2 ?? 0.999;
    this.eps = options.eps ?? 1e-8;

    // 入力チャネル数（保存済みモデル読み込み時は自動で上書きされる）
    this.inputChannels = options.inputChannels ?? 5; // 後方互換: 保存モデルに合わせて自動調整

    // 段階別パラメータ（0..64）。各段階 n で W[n] は層配列、b[n] はバイアス配列。
    // sizes = [64*inputChannels, ...hiddenSizes, 1]
        this.W = new Array(65); // [65][L] matrices: out x in
        this.b = new Array(65); // [65][L] vectors: out

        // Adam state（必要時に初期化）。
        this._opt = {
            t: new Array(65).fill(0),
            mW: new Array(65), // [65][L][out][in]
            vW: new Array(65),
            mb: new Array(65), // [65][L][out]
            vb: new Array(65),
        };

        this._initRandom();
    }

    setLearningRate(lr) { this.lr = lr; }
    setL2(lambda) { this.lambda = lambda; }

    _layerSizes() {
        return [64 * this.inputChannels, ...this.hiddenSizes, 1];
    }

    _initRandom() {
        const sizes = this._layerSizes();
        for (let n = 0; n < 65; n++) {
            const layersW = [];
            const layersB = [];
            for (let l = 1; l < sizes.length; l++) {
                const fanIn = sizes[l - 1];
                const fanOut = sizes[l];
                const scale = Math.sqrt(2 / (fanIn + fanOut));
                // 重み行列 [fanOut][fanIn]
                const Wl = new Array(fanOut);
                for (let o = 0; o < fanOut; o++) {
                    const row = new Float64Array(fanIn);
                    for (let i = 0; i < fanIn; i++) row[i] = (Math.random() * 2 - 1) * scale;
                    Wl[o] = Array.from(row);
                }
                layersW.push(Wl);
                // バイアス [fanOut]
                layersB.push(new Array(fanOut).fill(0));
            }
            this.W[n] = layersW;
            this.b[n] = layersB;
        }
    }

    _ensureAdamState(n) {
        if (!this._opt.mW[n]) {
            const sizes = this._layerSizes();
            this._opt.mW[n] = [];
            this._opt.vW[n] = [];
            this._opt.mb[n] = [];
            this._opt.vb[n] = [];
            for (let l = 1; l < sizes.length; l++) {
                const out = sizes[l];
                const inn = sizes[l - 1];
                // mW/vW
                const mWl = new Array(out);
                const vWl = new Array(out);
                for (let o = 0; o < out; o++) {
                    mWl[o] = new Float64Array(inn).fill(0);
                    vWl[o] = new Float64Array(inn).fill(0);
                }
                this._opt.mW[n][l - 1] = Array.from(mWl, a => Array.from(a));
                this._opt.vW[n][l - 1] = Array.from(vWl, a => Array.from(a));
                // mb/vb
                this._opt.mb[n][l - 1] = new Array(out).fill(0);
                this._opt.vb[n][l - 1] = new Array(out).fill(0);
            }
        }
    }

    // 特徴ベクトル x(64*C) と段階 n を作成
    _makeInput(board) {
        // 現手番視点のビットボード
        let b1, b2;
        if (typeof EVAL_BLACK_CONST === 'undefined') {
            // グローバル BLACK が無ければ board.js のエクスポートを試す
            try { EVAL_BLACK_CONST = require('./board.js').BLACK; } catch (_) { /* noop */ }
        }
        if (board.color == EVAL_BLACK_CONST) {
            b1 = board.black.board;
            b2 = board.white.board;
        } else {
            b1 = board.white.board;
            b2 = board.black.board;
        }
        let cb = board.getPosBoard().board; // 自分の合法手
        // 相手の合法手（相手手番にしてから計算）
        let opp = board.clone();
        opp.changeColor();
        let cbOpp = opp.getPosBoard().board;

        const C = this.inputChannels;
        const x = new Float64Array(64 * C);
        for (let i = 0; i < 64; i++) {
            const base = i * C;
            if (b1 & 0x01n) {
                x[base + 0] = 1;
            } else if (b2 & 0x01n) {
                x[base + 1] = 1;
            } else {
                x[base + 2] = 1;
            }
            if (cb & 0x01n) {
                if (C >= 4) x[base + 3] = 1;
            }
            if (cbOpp & 0x01n) {
                if (C >= 5) x[base + 4] = 1;
            }
            b1 >>= 1n; b2 >>= 1n; cb >>= 1n; cbOpp >>= 1n;
        }

        const n = board.black.count() + board.white.count();
        return { x, n };
    }

    // 前向き計算（手番視点）
    _forward(board) {
        const { x, n } = this._makeInput(board);
        const sizes = this._layerSizes();
        const L = sizes.length - 1; // 層数（出力層含む）
        // 各層の pre-activation(z) と activation(a) を保存
        const zs = new Array(L);
        const as = new Array(L + 1);
        as[0] = x; // 入力

        for (let l = 0; l < L; l++) {
            const Wl = this.W[n][l];
            const bl = this.b[n][l];
            const out = sizes[l + 1];
            const inn = sizes[l];
            const zl = new Float64Array(out);
            const al = new Float64Array(out);
            for (let o = 0; o < out; o++) {
                let s = bl[o];
                const row = Wl[o];
                for (let i = 0; i < inn; i++) s += row[i] * as[l][i];
                zl[o] = s;
                // 最終層は線形、それ以外はtanh
                al[o] = (l === L - 1) ? s : Math.tanh(s);
            }
            zs[l] = zl;
            as[l + 1] = al;
        }
        const y = as[L][0]; // 出力は1次元
        return { y, zs, as, n };
    }

    evaluate(board, color) {
        const { y } = this._forward(board);
        return (color === board.color) ? y : -y;
    }

    train(board, color, score) {
        // 目標値は board.color 視点で正にする（従来の train と整合）
        let target = score;
        if (typeof EVAL_BLACK_CONST === 'undefined') {
            try { EVAL_BLACK_CONST = require('./board.js').BLACK; } catch (_) { /* noop */ }
        }
        if (board.color !== EVAL_BLACK_CONST) target = -target;

        const { y, zs, as, n } = this._forward(board);
        const err = (y - target); // dL/dy for 0.5*(y-target)^2
        const sizes = this._layerSizes();
        const L = sizes.length - 1;

        // 逆伝播: 各層の delta を後ろから
        const deltas = new Array(L);
        // 出力層（線形）: delta_L = err
        deltas[L - 1] = new Float64Array([err]);

        for (let l = L - 2; l >= 0; l--) {
            const out = sizes[l + 1];
            const nextOut = sizes[l + 2];
            const delta = new Float64Array(out);
            for (let i = 0; i < out; i++) {
                let s = 0;
                // W_{l+1}^T * delta_{l+1}
                for (let k = 0; k < nextOut; k++) {
                    s += this.W[n][l + 1][k][i] * deltas[l + 1][k];
                }
                // tanh' = 1 - tanh^2(z)
                const dz = 1 - Math.tanh(zs[l][i]) ** 2;
                delta[i] = s * dz;
            }
            deltas[l] = delta;
        }

        if (this.optimizer === 'adam') this._ensureAdamState(n);

        // パラメータ更新（L2正則化）。SGD/Adam 切替
        for (let l = 0; l < L; l++) {
            const out = sizes[l + 1];
            const inn = sizes[l];
            const delta = deltas[l];
            const actPrev = as[l];

            if (this.optimizer === 'adam') {
                const t = (this._opt.t[n] = (this._opt.t[n] || 0) + 1);
                const b1 = this.beta1, b2 = this.beta2, eps = this.eps, lr = this.lr;
                // バイアス
                for (let o = 0; o < out; o++) {
                    const gradb = delta[o];
                    let mb = this._opt.mb[n][l][o] = b1 * this._opt.mb[n][l][o] + (1 - b1) * gradb;
                    let vb = this._opt.vb[n][l][o] = b2 * this._opt.vb[n][l][o] + (1 - b2) * (gradb * gradb);
                    const mhat = mb / (1 - Math.pow(b1, t));
                    const vhat = vb / (1 - Math.pow(b2, t));
                    this.b[n][l][o] -= lr * (mhat / (Math.sqrt(vhat) + eps));
                }
                // 重み
                for (let o = 0; o < out; o++) {
                    const row = this.W[n][l][o];
                    const mrow = this._opt.mW[n][l][o];
                    const vrow = this._opt.vW[n][l][o];
                    for (let i = 0; i < inn; i++) {
                        const grad = delta[o] * actPrev[i] + this.lambda * row[i];
                        mrow[i] = b1 * mrow[i] + (1 - b1) * grad;
                        vrow[i] = b2 * vrow[i] + (1 - b2) * (grad * grad);
                        const mhat = mrow[i] / (1 - Math.pow(b1, t));
                        const vhat = vrow[i] / (1 - Math.pow(b2, t));
                        row[i] -= lr * (mhat / (Math.sqrt(vhat) + eps));
                    }
                }
            } else {
                // SGD
                // バイアス
                for (let o = 0; o < out; o++) this.b[n][l][o] -= this.lr * delta[o];
                // 重み
                for (let o = 0; o < out; o++) {
                    const row = this.W[n][l][o];
                    for (let i = 0; i < inn; i++) {
                        const grad = delta[o] * actPrev[i] + this.lambda * row[i];
                        row[i] -= this.lr * grad;
                    }
                }
            }
        }
    }

    // JSON で保存/読込（存在しなければ新規初期化）
    load(path) {
        if (!fsNode) return; // ブラウザでは何もしない
        if (!fsNode.existsSync(path)) return;
        try {
            const text = fsNode.readFileSync(path, 'utf8');
            const obj = JSON.parse(text);
            if (obj && obj.__type === 'NNEval') {
                // v3: 任意層
                if (obj.version === 3 && obj.hiddenSizes && obj.W && obj.b) {
                    this.hiddenSizes = obj.hiddenSizes;
                    this.W = obj.W;
                    this.b = obj.b;
                    // 入力チャネル数を学習済みモデルから推定（入力層の in 次元 / 64）
                    try {
                        const fin = this.W[0][0][0].length;
                        this.inputChannels = Math.max(1, Math.round(fin / 64));
                        // 4ch→5ch マイグレーション: 先頭層の入力次元が256で、5chを使いたい場合に拡張
                        if (fin === 256 && (this.inputChannels < 5)) {
                            const add = 64; // 1チャネル分
                            for (let n = 0; n < 65; n++) {
                                // 第1層の各出力ユニットの重み行ベクトルを拡張
                                const firstLayer = this.W[n][0];
                                for (let o = 0; o < firstLayer.length; o++) {
                                    const row = firstLayer[o];
                                    for (let k = 0; k < add; k++) row.push(0); // 新チャネルは0初期化
                                }
                            }
                            this.inputChannels = 5;
                        }
                    } catch (_) { /* keep default */ }
                    return;
                }
                // v2: 2層（W1,b1,W2,b2,W3,b3）
                if (obj.hiddenSizes && obj.W1 && obj.b1 && obj.W2 && obj.b2 && obj.W3 && obj.b3) {
                    this.hiddenSizes = obj.hiddenSizes;
                    // 変換: v2 → v3
                    const sizes = [256, this.hiddenSizes[0], this.hiddenSizes[1], 1];
                    this.W = new Array(65);
                    this.b = new Array(65);
                    for (let n = 0; n < 65; n++) {
                        this.W[n] = [];
                        this.b[n] = [];
                        // 層0: 256->H1
                        this.W[n][0] = obj.W1[n];
                        this.b[n][0] = obj.b1[n];
                        // 層1: H1->H2
                        this.W[n][1] = obj.W2[n];
                        this.b[n][1] = obj.b2[n];
                        // 層2: H2->1 （W3はベクトルなので1xH2行列に）
                        this.W[n][2] = [obj.W3[n]]; // 1行
                        this.b[n][2] = [obj.b3[n]];
                    }
                    return;
                }
                // v1: 1層（互換）→ 新規初期化
                if (obj.hiddenSize && obj.W1 && obj.b1 && obj.W2 && obj.b2) {
                    const h1 = obj.hiddenSize;
                    this.hiddenSizes = [h1, Math.max(8, Math.floor(h1 / 2))];
                    this._initRandom();
                    return;
                }
            }
            // 旧フォーマット（数値行列や不正JSON）は無視して新規初期化のまま
        } catch (_) {
            // JSON でなければ無視（新規初期化のまま）
        }
    }

    save(path) {
        if (!fsNode) return; // ブラウザでは何もしない
    const obj = {
            __type: 'NNEval',
            version: 3,
            hiddenSizes: this.hiddenSizes,
            W: this.W,
            b: this.b
        };
        fsNode.writeFileSync(path, JSON.stringify(obj));
    }

    // ブラウザ/Node両対応の非同期読み込み
    async init(path) {
        try {
            if (typeof fetch !== 'undefined') {
                const res = await fetch(path, { cache: 'no-cache' });
                if (!res.ok) throw new Error('fetch failed');
                const text = await res.text();
                try {
                    const obj = JSON.parse(text);
                    if (obj && obj.__type === 'NNEval') {
                        if (obj.version === 3 && obj.hiddenSizes && obj.W && obj.b) {
                            this.hiddenSizes = obj.hiddenSizes;
                            this.W = obj.W; this.b = obj.b;
                            try {
                                const fin = this.W[0][0][0].length;
                                this.inputChannels = Math.max(1, Math.round(fin / 64));
                                if (fin === 256 && (this.inputChannels < 5)) {
                                    const add = 64;
                                    for (let n = 0; n < 65; n++) {
                                        const firstLayer = this.W[n][0];
                                        for (let o = 0; o < firstLayer.length; o++) {
                                            const row = firstLayer[o];
                                            for (let k = 0; k < add; k++) row.push(0);
                                        }
                                    }
                                    this.inputChannels = 5;
                                }
                            } catch (_) { /* keep default */ }
                            return;
                        }
                        if (obj.hiddenSizes && obj.W1 && obj.b1 && obj.W2 && obj.b2 && obj.W3 && obj.b3) {
                            this.hiddenSizes = obj.hiddenSizes;
                            this.W = new Array(65); this.b = new Array(65);
                            for (let n = 0; n < 65; n++) {
                                this.W[n] = [];
                                this.b[n] = [];
                                this.W[n][0] = obj.W1[n]; this.b[n][0] = obj.b1[n];
                                this.W[n][1] = obj.W2[n]; this.b[n][1] = obj.b2[n];
                                this.W[n][2] = [obj.W3[n]]; this.b[n][2] = [obj.b3[n]];
                            }
                            return;
                        }
                        if (obj.hiddenSize && obj.W1 && obj.b1 && obj.W2 && obj.b2) {
                            const h1 = obj.hiddenSize;
                            this.hiddenSizes = [h1, Math.max(8, Math.floor(h1 / 2))];
                            this._initRandom();
                            return;
                        }
                    }
                } catch (_) {
                    // 非JSONや不正は無視
                }
            } else if (fsNode) {
                this.load(path);
            }
        } catch (_) {
            // 失敗時は乱数初期化のまま
        }
    }
}

// Node.js 用エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Eval, NNEval };
}