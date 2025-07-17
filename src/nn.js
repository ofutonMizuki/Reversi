//import fs from 'fs';
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

        // 重みとバイアスの初期値をHe初期化で設定
        // 各重み行列のfan_in（入力ノード数）を渡す
        this.weights[0].randomize(this.inputNodes);
        for (let i = 1; i < this.weights.length; i++) {
            this.weights[i].randomize(this.weights[i].cols);
        }
        // バイアスの初期値は0
        for (let i = 0; i < this.biases.length; i++) {
            this.biases[i].randomize(1); // 0で初期化したい場合は this.biases[i] = new Matrix(this.biases[i].rows, this.biases[i].cols); でもOK
        }

        // 学習率（さらに発散抑制のため低めに）
        this.learningRate = 0.0001;

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

        // 隠れ層の計算（通常の多層パーセプトロン）
        let hidden = Matrix.multiply(this.weights[0], inputs);
        hidden.add(this.biases[0]);
        hidden.map(this.relu);
        for (let i = 1; i < this.hiddenLayers.length; i++) {
            hidden = Matrix.multiply(this.weights[i], hidden);
            hidden.add(this.biases[i]);
            hidden.map(this.relu);
        }

        // 出力層の計算（恒等関数）
        let output = Matrix.multiply(this.weights[this.weights.length - 1], hidden);
        output.add(this.biases[this.biases.length - 1]);

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
        // 入力値と目標値をMatrixオブジェクトに変換
        let inputs = Matrix.fromArray(input_array);
        let targets = Matrix.fromArray(target_array);

        // 隠れ層の計算（通常の多層パーセプトロン）
        let hiddens = [];
        let h0 = Matrix.multiply(this.weights[0], inputs);
        h0.add(this.biases[0]);
        h0.map(this.relu);
        hiddens.push(h0);

        for (let i = 1; i < this.hiddenLayers.length; i++) {
            let h = Matrix.multiply(this.weights[i], hiddens[i - 1]);
            h.add(this.biases[i]);
            h.map(this.relu);
            hiddens.push(h);
        }

        // 出力層の計算（恒等関数）
        let outputs = Matrix.multiply(this.weights[this.weights.length - 1], hiddens[hiddens.length - 1]);
        outputs.add(this.biases[this.biases.length - 1]);

        // タイムステップをインクリメント
        this.t++;

        // 出力層の誤差
        let output_errors = Matrix.subtract(targets, outputs);

        // 隠れ層の誤差 (逆伝播)
        let hidden_errors = [];
        hidden_errors.unshift(Matrix.multiply(Matrix.transpose(this.weights[this.weights.length - 1]), output_errors));

        for (let i = this.hiddenLayers.length - 1; i > 0; i--) {
            hidden_errors.unshift(Matrix.multiply(Matrix.transpose(this.weights[i]), hidden_errors[0]));
        }

        // 重みとバイアスの更新 (出力層)
        // 恒等関数の微分は1
        let gradients_ho = Matrix.map(outputs, () => 1);
        gradients_ho.multiply(output_errors);
        let hidden_t = Matrix.transpose(hiddens[hiddens.length - 1]);
        let weights_ho_deltas = Matrix.multiply(gradients_ho, hidden_t);
        this.updateWithAdam(this.weights.length - 1, weights_ho_deltas, gradients_ho);


        // 重みとバイアスの更新 (隠れ層)
        for (let i = this.hiddenLayers.length - 1; i > 0; i--) {
            let gradients_ih = Matrix.map(hiddens[i], this.drelu);
            gradients_ih.multiply(hidden_errors[i]);
            let inputs_t = Matrix.transpose(hiddens[i - 1]);
            let weights_ih_deltas = Matrix.multiply(gradients_ih, inputs_t);
            this.updateWithAdam(i, weights_ih_deltas, gradients_ih);
        }

        // 重みとバイアスの更新 (入力層 - 最初の隠れ層)
        let gradients_ih = Matrix.map(hiddens[0], this.drelu);
        gradients_ih.multiply(hidden_errors[0]);
        let inputs_t = Matrix.transpose(inputs);
        let weights_ih_deltas = Matrix.multiply(gradients_ih, inputs_t);
        this.updateWithAdam(0, weights_ih_deltas, gradients_ih);
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

    /**
     * 非同期でWeb上のJSONファイルから重みとバイアスを読み込みます（ブラウザ用）。
     * @param {string} url 読み込むjsonファイルのURL
     * @returns {Promise<void>}
     */
    async init(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch model: ${url}`);
        }
        const data = await response.json();
        this.weights = data.weights.map(w => new Matrix(w.length, w[0].length));
        for (let i = 0; i < this.weights.length; i++) {
            this.weights[i].data = data.weights[i];
        }
        // バイアスも必要ならここで同様に復元
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
    randomize(fan_in) {
        // He初期化: N(0, sqrt(2/fan_in)) 
        const std = Math.sqrt(2 / (fan_in || 1)) * 0.1;
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                // Box-Muller法で正規分布に従う乱数を生成
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