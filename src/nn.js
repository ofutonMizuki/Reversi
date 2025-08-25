import fs from 'fs';
class NeuralNetwork {
    /**
     * ニューラルネットワークを初期化します。
     *
     * @param {number} inputNodes 入力層のノード数
     * @param {number[]} hiddenLayers 隠れ層のノード数の配列。各要素は各層のノード数を表します。
     * @param {number} outputNodes 出力層のノード数
     */
    constructor(inputNodes, hiddenLayers, outputNodes) {
        this.inputNodes = inputNodes;
        this.hiddenLayers = hiddenLayers;
        this.outputNodes = outputNodes;

        // 重みとバイアスの初期化
        this.weights = [];
        this.biases = [];

        // 入力層 - 最初の隠れ層の重みとバイアスを初期化
        this.weights.push(new Matrix(this.hiddenLayers[0], this.inputNodes));
        this.biases.push(new Matrix(this.hiddenLayers[0], 1));

        // 隠れ層 - 隠れ層 / 隠れ層 - 出力層の重みとバイアスを初期化
        for (let i = 0; i < this.hiddenLayers.length - 1; i++) {
            this.weights.push(new Matrix(this.hiddenLayers[i + 1], this.hiddenLayers[i]));
            this.biases.push(new Matrix(this.hiddenLayers[i + 1], 1));
        }

        // 最後の隠れ層 - 出力層の重みとバイアスを初期化
        this.weights.push(new Matrix(this.outputNodes, this.hiddenLayers[this.hiddenLayers.length - 1]));
        this.biases.push(new Matrix(this.outputNodes, 1));

        // 重み初期化: 全層tanhのため Xavier(Glorot) 初期化 (Normal) へ変更
        // std = sqrt(2 / (fan_in + fan_out))
        //this.weights[0].randomize(this.inputNodes, this.hiddenLayers[0], 'xavier');
        for (let i = 1; i < this.hiddenLayers.length; i++) {
            this.weights[i].randomize(this.hiddenLayers[i - 1], this.hiddenLayers[i], 'xavier');
        }
        // 最後の出力層
        this.weights[this.weights.length - 1].randomize(this.hiddenLayers[this.hiddenLayers.length - 1], this.outputNodes, 'xavier');
        // バイアスは 0 初期化（Adam でバイアスシフトが自然に学習される / 収束安定性向上）
        for (let i = 0; i < this.biases.length; i++) {
            this.biases[i] = new Matrix(this.biases[i].rows, this.biases[i].cols);
        }

        // 学習率（さらに発散抑制のため低めに）
        this.learningRate = 0.00001;

        // Adamオプティマイザのパラメータ
        this.beta1 = 0.9;
        this.beta2 = 0.999;
        this.epsilon = 1e-8;
        this.t = 0; // タイムステップ

        // Adamのモーメント推定値
        this.m_weights = this.weights.map(w => new Matrix(w.rows, w.cols));
        this.v_weights = this.weights.map(w => new Matrix(w.rows, w.cols));
        this.m_biases = this.biases.map(b => new Matrix(b.rows, b.cols));
        this.v_biases = this.biases.map(b => new Matrix(b.rows, b.cols));

        // 学習ステップ表示用設定
        this.stepLogging = { enabled: false, interval: 100 }; // デフォルト非表示
    }

    /**
     * ReLU関数を計算します。
     *
     * @param {number} x 入力値
     * @return {number} ReLU関数の出力値
     */
    relu(x) {
        return Math.max(0.001 * x, x);
    }

    /**
     * ReLU関数の微分を計算します。
     *
     * @param {number} y ReLU関数の出力値
     * @return {number} ReLU関数の微分の出力値
     */
    drelu(y) {
        return (y > 0) ? 1 : 0.001;
    }

    /**
     * tanh関数を計算します。
     *
     * @param {number} x 入力値
     * @return {number} tanh関数の出力値
     */
    tanh(x) {
        return Math.tanh(x);
    }

    /**
     * tanh関数の微分を計算します。
     *
     * @param {number} y tanh関数の出力値
     * @return {number} tanh関数の微分の出力値
     */
    dtanh(y) {
        return 1 - y * y;
    }

    /**
     * ニューラルネットワークで推論を行います。
     *
     * @param {number[]} input_array 入力値の配列
     * @return {number[]} 出力値の配列
     */
    predict(input_array) {
        // 入力値をMatrixオブジェクトに変換
        let inputs = Matrix.fromArray(input_array);

        // 隠れ層の計算（全層 tanh）
        let hidden = Matrix.multiply(this.weights[0], inputs);
        hidden.add(this.biases[0]);
        hidden.map(this.tanh);
        for (let i = 1; i < this.hiddenLayers.length; i++) {
            hidden = Matrix.multiply(this.weights[i], hidden);
            hidden.add(this.biases[i]);
            hidden.map(this.tanh);
        }

        // 出力層の計算（tanh）
        let output = Matrix.multiply(this.weights[this.weights.length - 1], hidden);
        output.add(this.biases[this.biases.length - 1]);
        output.map(this.tanh);

        // 出力値を配列に変換して返す
        return output.toArray();
    }

    /**
     * ニューラルネットワークを学習します。
     *
     * @param {number[]} input_array 入力値の配列
     * @param {number[]} target_array 目標値の配列
     */
    train(input_array, target_array) {
        // 単一サンプル学習（オンライン学習）
        const inputs = Matrix.fromArray(input_array);      // a0
        const targets = Matrix.fromArray(target_array);

        // 順伝播: 各層の活性を保存
        const activations = [inputs]; // a0 ... aL
        // 隠れ層 (tanh)
        for (let i = 0; i < this.hiddenLayers.length; i++) {
            let z = Matrix.multiply(this.weights[i], activations[activations.length - 1]); // W_i * a_{i}
            z.add(this.biases[i]);
            z.map(this.tanh); // a_{i+1}
            activations.push(z);
        }
        // 出力層（tanh）
        let output = Matrix.multiply(this.weights[this.weights.length - 1], activations[activations.length - 1]);
        output.add(this.biases[this.biases.length - 1]);
        output.map(this.tanh);

        // タイムステップ更新（Adam）
        this.t++;
        if (this.stepLogging.enabled && (this.t % this.stepLogging.interval === 0)) {
            console.log(`[NN] step=${this.t}`);
        }

        // 出力層デルタ（tanh: 負勾配 = (targets - y) * (1 - y^2)）
        const negGradOut = Matrix.subtract(targets, output); // targets - y
        let delta = Matrix.map(output, (y, r, c) => negGradOut.data[r][c] * this.dtanh(y));

        // 出力層更新
        const lastHiddenT = Matrix.transpose(activations[activations.length - 1]);
        const gradW_out = Matrix.multiply(delta, lastHiddenT); // (targets - output) * a_last^T
        this.updateWithAdam(this.weights.length - 1, gradW_out, delta);

        // 逆伝播（隠れ層）
        // ここでの delta は「負勾配（targets - output）」が伝搬される形。
        for (let layer = this.hiddenLayers.length - 1; layer >= 0; layer--) {
            // 次層（直後）の delta を使って現在層の delta を計算
            // delta_l = (W_{l+1}^T * delta_{l+1}) .* f'(a_l)
            const W_next_T = Matrix.transpose(this.weights[layer + 1]);
            let delta_prev = Matrix.multiply(W_next_T, delta); // まだ活性微分を掛けていない
            const a_l = activations[layer + 1]; // 隠れ層出力（relu後）
            // f'(a_l) を掛ける（tanh: 1 - a_l^2）
            delta_prev = Matrix.map(a_l, (val, r, c) => this.dtanh(val) * delta_prev.data[r][c]);

            // 勾配（負勾配方向）: (targets - output) が伝播しているので updateWithAdam で加算すれば descent
            const a_lm1_T = Matrix.transpose(activations[layer]);
            const gradW = Matrix.multiply(delta_prev, a_lm1_T);
            this.updateWithAdam(layer, gradW, delta_prev);

            delta = delta_prev; // 次ループへ
        }
    }

    // 現在の学習ステップ（Adam内部タイムステップ）を返す
    getStep() {
        return this.t;
    }

    // ステップ数ログ出力を有効化（interval ステップ毎）
    enableStepLogging(interval = 100) {
        this.stepLogging.enabled = true;
        this.stepLogging.interval = Math.max(1, interval | 0);
    }

    // ステップ数ログ出力を無効化
    disableStepLogging() {
        this.stepLogging.enabled = false;
    }

    /**
     * Adamオプティマイザを使用して重みとバイアスを更新します。
     *
     * @param {number} i 更新する層のインデックス
     * @param {Matrix} weight_deltas 重みの勾配
     * @param {Matrix} bias_deltas バイアスの勾配
     */
    updateWithAdam(i, weight_deltas, bias_deltas) {
        // バイアスの更新
        this.m_biases[i].multiply(this.beta1);
        this.m_biases[i].add(Matrix.map(bias_deltas, x => x * (1 - this.beta1)));
        this.v_biases[i].multiply(this.beta2);
        this.v_biases[i].add(Matrix.map(bias_deltas, x => x * x * (1 - this.beta2)));

        let m_hat_b = Matrix.map(this.m_biases[i], x => x / (1 - Math.pow(this.beta1, this.t)));
        let v_hat_b = Matrix.map(this.v_biases[i], x => x / (1 - Math.pow(this.beta2, this.t)));

        let delta_b = Matrix.map(v_hat_b, (val, r, c) => this.learningRate * m_hat_b.data[r][c] / (Math.sqrt(val) + this.epsilon));
        this.biases[i].add(delta_b);
        // 重みの更新
        this.m_weights[i].multiply(this.beta1);
        this.m_weights[i].add(Matrix.map(weight_deltas, x => x * (1 - this.beta1)));
        this.v_weights[i].multiply(this.beta2);
        this.v_weights[i].add(Matrix.map(weight_deltas, x => x * x * (1 - this.beta2)));

        let m_hat_w = Matrix.map(this.m_weights[i], x => x / (1 - Math.pow(this.beta1, this.t)));
        let v_hat_w = Matrix.map(this.v_weights[i], x => x / (1 - Math.pow(this.beta2, this.t)));

        let delta_w = Matrix.map(v_hat_w, (val, r, c) => this.learningRate * m_hat_w.data[r][c] / (Math.sqrt(val) + this.epsilon));
        this.weights[i].add(delta_w);

    }

    /**
     * 学習した重みとバイアスをファイルに保存します。
     *
     * @param {string} filename 保存するファイル名
     */
    save(filename) {
        let data = {
            weights: this.weights.map(w => w.data),
            biases: this.biases.map(b => b.data)
        };
        let json = JSON.stringify(data);
        fs.writeFileSync(filename, json, 'utf8');
        //console.log(`Model saved to ${filename}`);
    }

    /**
     * ファイルから重みとバイアスを読み込みます。
     *
     * @param {string} filename 読み込むjson
     */
    load(filename) {
        let json = fs.readFileSync(filename, 'utf8');
        if (json) {
            let data = JSON.parse(json);
            this.weights = data.weights.map(w => new Matrix(w.length, w[0].length));
            this.biases = data.biases.map(b => new Matrix(b.length, b[0].length));
            for (let i = 0; i < this.weights.length; i++) {
                this.weights[i].data = data.weights[i];
            }
            for (let i = 0; i < this.biases.length; i++) {
                this.biases[i].data = data.biases[i];
            }
        }
    }
}

/**
 * 行列演算のためのクラス
 */
class Matrix {
    /**
     * 行列を作成します。
     *
     * @param {number} rows 行数
     * @param {number} cols 列数
     */
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.data = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
    }

    /**
     * 行列の各要素をHe初期化でランダムな値に設定します。
     * @param {number} fan_in 入力ノード数
     */
    randomize(fan_in, fan_out, type = 'xavier') {
        // Box-Muller法で正規分布 N(0,1) を生成し必要な標準偏差を掛ける
        let std;
        if (type === 'he') {
            std = Math.sqrt(2 / (fan_in || 1));
        } else if (type === 'xavier') { // Glorot normal (tanh向け)
            std = Math.sqrt(2 / ((fan_in || 1) + (fan_out || fan_in || 1)));
        } else { // フォールバック: Xavier
            std = Math.sqrt(2 / ((fan_in || 1) + (fan_out || fan_in || 1)));
        }
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                let u = 1 - Math.random();
                let v = 1 - Math.random();
                let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
                this.data[i][j] = z * std;
            }
        }
    }

    /**
     * 配列から行列を作成します。
     *
     * @param {number[]} arr 配列
     * @return {Matrix} 行列
     */
    static fromArray(arr) {
        let m = new Matrix(arr.length, 1);
        for (let i = 0; i < arr.length; i++) {
            m.data[i][0] = arr[i];
        }
        return m;
    }

    /**
     * 行列を配列に変換します。
     *
     * @return {number[]} 配列
     */
    toArray() {
        let arr = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                arr.push(this.data[i][j]);
            }
        }
        return arr;
    }

    /**
     * 行列に値を加算します。
     *
     * @param {number|Matrix} n 加算する値または行列
     */
    add(n) {
        if (n instanceof Matrix) {
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] += n.data[i][j];
                }
            }
        } else {
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] += n;
                }
            }
        }
    }

    /**
     * 行列から値を減算します。
     *
     * @param {Matrix} n 減算する行列
     */
    static subtract(a, b) {
        let result = new Matrix(a.rows, a.cols);
        for (let i = 0; i < a.rows; i++) {
            for (let j = 0; j < a.cols; j++) {
                result.data[i][j] = a.data[i][j] - b.data[i][j];
            }
        }
        return result;
    }

    /**
     * 行列をスカラー値で乗算します。
     *
     * @param {number} n 乗算する値
     */
    multiply(n) {
        if (n instanceof Matrix) {
            // 行列の積
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] *= n.data[i][j];
                }
            }
        } else {
            // スカラー値との積
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) {
                    this.data[i][j] *= n;
                }
            }
        }
    }

    /**
     * 2つの行列の積を計算します。
     *
     * @param {Matrix} a 1つ目の行列
     * @param {Matrix} b 2つ目の行列
     * @return {Matrix} 積の結果
     */
    static multiply(a, b) {
        if (a.cols !== b.rows) {
            console.log('Columns of A must match rows of B.');
            return undefined;
        }
        let result = new Matrix(a.rows, b.cols);
        for (let i = 0; i < result.rows; i++) {
            for (let j = 0; j < result.cols; j++) {
                let sum = 0;
                for (let k = 0; k < a.cols; k++) {
                    sum += a.data[i][k] * b.data[k][j];
                }
                result.data[i][j] = sum;
            }
        }
        return result;
    }

    /**
     * 行列を転置します。
     *
     * @return {Matrix} 転置された行列
     */
    static transpose(matrix) {
        let result = new Matrix(matrix.cols, matrix.rows);
        for (let i = 0; i < matrix.rows; i++) {
            for (let j = 0; j < matrix.cols; j++) {
                result.data[j][i] = matrix.data[i][j];
            }
        }
        return result;
    }

    /**
     * 行列の各要素に関数を適用します。
     *
     * @param {function} func 適用する関数
     */
    map(func) {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                this.data[i][j] = func(this.data[i][j], i, j);
            }
        }
    }

    /**
     * 静的メソッドとして、行列の各要素に関数を適用します。
     *
     * @param {Matrix} matrix 適用対象の行列
     * @param {function} func 適用する関数
     * @return {Matrix} 関数が適用された行列
     */
    static map(matrix, func) {
        let result = new Matrix(matrix.rows, matrix.cols);
        for (let i = 0; i < matrix.rows; i++) {
            for (let j = 0; j < matrix.cols; j++) {
                result.data[i][j] = func(matrix.data[i][j], i, j);
            }
        }
        return result;
    }

    /**
     * 行列の内容をコンソールに出力します。
     */
    print() {
        console.table(this.data);
    }
}

export { NeuralNetwork };