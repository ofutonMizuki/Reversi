import { NeuralNetwork } from "./nn.js";
import { BLACK } from "./board.js";

class Eval {
    constructor() {
        this.neuralNetworks = new Array();
        for(let i = 0; i < 65; i++){
            this.neuralNetworks.push(new NeuralNetwork(192, [8], 1));
        }
        console.dir(this.neuralNetworks);
    }

    evaluate(board, color) {
        let board1, board2;

        if (board.color == BLACK) {
            board1 = board.black.board;
            board2 = board.white.board;
        } else {
            board1 = board.white.board;
            board2 = board.black.board;
        }

        let spaceBoard = ~(board1 | board2);
        let posBoard = board.getPosBoard().board;
        //盤面の石の数を数える
        let boardArray = new Array(192);
        for (let i = 0n; i < 64n; i++) {
            boardArray[i] = Number((board1 >> i) & 0x01n);
        }
        for (let i = 0n; i < 64n; i++) {
            boardArray[i + 64n] = Number((board2 >> i) & 0x01n);
        }
        for (let i = 0n; i < 64n; i++) {
            boardArray[i + 128n] = Number((posBoard >> i) & 0x01n);
        }
        let count = board.count();
        let result = this.neuralNetworks[count.black + count.white].predict(boardArray)[0] * 64;

        //手番からみたスコアを計算する
        if (color == board.color) {
            return result;
        }
        else {
            return -result;
        }
    }

    train(board, color, score){
        let board1, board2;
        if (board.color == BLACK) {
            board1 = board.black.board;
            board2 = board.white.board;
        } else {
            board1 = board.white.board;
            board2 = board.black.board;
        }

        let spaceBoard = ~(board1 | board2);
        let posBoard = board.getPosBoard().board;

        //手番からみたスコアを計算する
        if (BLACK == board.color) {
            score = score;
        }
        else {
            score = -score;
        }

        // console.log("board1", board1);
        // console.log("board2", board2);
        // console.log("spaceBoard", spaceBoard);
        // console.log("posBoard", posBoard);
        // console.log("score", score);

        let count = board.count();
        this.neuralNetworks[count.black + count.white].train(
            [
                ...Array.from({ length: 64 }, (_, i) => Number((board1 >> BigInt(i)) & 0x01n)),
                ...Array.from({ length: 64 }, (_, i) => Number((board2 >> BigInt(i)) & 0x01n)),
                ...Array.from({ length: 64 }, (_, i) => Number((posBoard >> BigInt(i)) & 0x01n))
            ],
            [score / 64]
        );
    }

    save(path) {
        this.neuralNetworks.forEach((nn, index) => {
            nn.save(`${path}/model_${index}.json`);
        });
        console.log(`Models saved to ${path}`);
    }

    load(path) {
        this.neuralNetworks.forEach((nn, index) => {
            nn.load(`${path}/model_${index}.json`);
        });
        console.log(`Models loaded from ${path}`);
    }
}
export { Eval };
