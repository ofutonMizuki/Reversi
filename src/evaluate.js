import { NeuralNetwork } from "./nn.js";
import { BLACK } from "./board.js";

class Eval {
    constructor() {
        this.neuralNetwork = new NeuralNetwork(256, [32], 1);
        console.log(this.neuralNetwork.weights)
    }

    async init(path) {
        let response = await fetch(path);
        let text = await response.text()
        this.neuralNetwork = new NeuralNetwork(256, [32], 1);
        //this.neuralNetwork.load(text);
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

        let spaceBoard = !(board1 | board2);
        let posBoard = board.getPosBoard();
        //盤面の石の数を数える
        let boardArray = new Array(256);
        for (let i = 0; i < 64; i++) {
            boardArray[i] = (board1 >> i) & 0x01;
        }
        for (let i = 0; i < 64; i++) {
            boardArray[i + 64] = (board2 >> i) & 0x01;
        }
        for (let i = 0; i < 64; i++) {
            boardArray[i + 128] = (spaceBoard >> i) & 0x01;
        }
        for (let i = 0; i < 64; i++) {
            boardArray[i + 192] = (posBoard >> i) & 0x01;
        }
        let result = this.neuralNetwork.predict(boardArray)[0];

        //手番からみたスコアを計算する
        if (color == board.color) {
            return result;
        }
        else {
            return -result;
        }
    }
}
export { Eval };