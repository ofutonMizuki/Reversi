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

        // 重みとバイアスの初期値をランダムに設定
        for (let i = 0; i < this.weights.length; i++) {
            this.weights[i].randomize();
            this.biases[i].randomize();
        }

        // 学習率
        this.learningRate = 0.1;
    }

    /**
     * sigmoid関数を計算します。
     *
     * @param {number} x 入力値
     * @return {number} sigmoid関数の出力値
     */
    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    /**
     * sigmoid関数の微分を計算します。
     *
     * @param {number} y sigmoid関数の出力値
     * @return {number} sigmoid関数の微分の出力値
     */
    dsigmoid(y) {
        return y * (1 - y);
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

        // 隠れ層の計算
        let hidden = Matrix.multiply(this.weights[0], inputs);
        hidden.add(this.biases[0]);
        hidden.map(this.sigmoid);

        for (let i = 1; i < this.hiddenLayers.length; i++) {
            hidden = Matrix.multiply(this.weights[i], hidden);
            hidden.add(this.biases[i]);
            hidden.map(this.sigmoid);
        }

        // 出力層の計算
        let output = Matrix.multiply(this.weights[this.weights.length - 1], hidden);
        output.add(this.biases[this.biases.length - 1]);
        output.map(this.sigmoid);

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

        // 隠れ層の計算 (predictと同じ)
        let hiddens = [];
        hiddens.push(Matrix.multiply(this.weights[0], inputs));
        hiddens[0].add(this.biases[0]);
        hiddens[0].map(this.sigmoid);

        for (let i = 1; i < this.hiddenLayers.length; i++) {
            hiddens.push(Matrix.multiply(this.weights[i], hiddens[i - 1]));
            hiddens[i].add(this.biases[i]);
            hiddens[i].map(this.sigmoid);
        }

        // 出力層の計算 (predictと同じ)
        let outputs = Matrix.multiply(this.weights[this.weights.length - 1], hiddens[hiddens.length - 1]);
        outputs.add(this.biases[this.biases.length - 1]);
        outputs.map(this.sigmoid);

        // 出力層の誤差
        let output_errors = Matrix.subtract(targets, outputs);

        // 隠れ層の誤差 (逆伝播)
        let hidden_errors = [];
        hidden_errors.unshift(Matrix.multiply(Matrix.transpose(this.weights[this.weights.length - 1]), output_errors));

        for (let i = this.hiddenLayers.length - 2; i >= 0; i--) {
            hidden_errors.unshift(Matrix.multiply(Matrix.transpose(this.weights[i]), hidden_errors[0]));
        }

        // 重みとバイアスの更新 (出力層)
        let gradients_ho = Matrix.map(outputs, this.dsigmoid);
        gradients_ho.multiply(output_errors);
        gradients_ho.multiply(this.learningRate);
        let hidden_t = Matrix.transpose(hiddens[hiddens.length - 1]);
        let weights_ho_deltas = Matrix.multiply(gradients_ho, hidden_t);
        this.weights[this.weights.length - 1].add(weights_ho_deltas);
        this.biases[this.biases.length - 1].add(gradients_ho);

        // 重みとバイアスの更新 (隠れ層)
        for (let i = this.hiddenLayers.length - 1; i > 0; i--) {
            let gradients_ih = Matrix.map(hiddens[i], this.dsigmoid);
            gradients_ih.multiply(hidden_errors[i]);
            gradients_ih.multiply(this.learningRate);
            let inputs_t = Matrix.transpose(hiddens[i - 1]);
            let weights_ih_deltas = Matrix.multiply(gradients_ih, inputs_t);
            this.weights[i].add(weights_ih_deltas);
            this.biases[i].add(gradients_ih);
        }

        // 重みとバイアスの更新 (入力層 - 最初の隠れ層)
        let gradients_ih = Matrix.map(hiddens[0], this.dsigmoid);
        gradients_ih.multiply(hidden_errors[0]);
        gradients_ih.multiply(this.learningRate);
        let inputs_t = Matrix.transpose(inputs);
        let weights_ih_deltas = Matrix.multiply(gradients_ih, inputs_t);
        this.weights[0].add(weights_ih_deltas);
        this.biases[0].add(gradients_ih);
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
        localStorage.setItem(filename, json);
    }

    /**
     * ファイルから重みとバイアスを読み込みます。
     *
     * @param {string} json 読み込むjson
     */
    load(json) {
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
     * 行列の各要素をランダムな値で初期化します。
     */
    randomize() {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                this.data[i][j] = Math.random() * 2 - 1; // -1から1までのランダムな値
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
                this.data[i][j] = func(this.data[i][j]);
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
                result.data[i][j] = func(matrix.data[i][j]);
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