import { Board, BLACK, BitBoard } from './board.js';
import { search } from './search.js';
import { Eval } from './evaluate.js';

const MANUAL_PLAYER = 1, COM_PLAYER = 2, RANDOM_PLAYER = 3;

const e = new Eval();
let resultArray = [];

function game(board, gamemode, move, depth) {
    //置ける場所を求める(実際はすでに求められてると思うけれど念の為)
    board.getPosBoard();

    //もしパスならターンチェンジ
    if (board.isPass()) {
        board.changeColor();

        //それでもパスならゲーム終了
        if (board.isPass()) {

            //盤面の石の数を数えて返す
            let result = board.count();
            //console.log(result);
            return result;
        }
    }

    //もし終盤なら探索を深くする
    let count = board.count();
    if (64 - (count.black + count.white) < 6) {
        gamemode.black = COM_PLAYER;
        gamemode.white = COM_PLAYER;
    }

    let result = search(
        new Board(
            {
                black: new BitBoard(board.black.board),
                white: new BitBoard(board.white.board),
                color: board.color,
                posBoard: new BitBoard(board.posBoard.board)
            }
        ), (64 - (count.black + count.white) < 6) ? 6 : depth, e
    );
    //プレイヤーのゲームモードによって分岐する
    switch ((board.color == BLACK) ? gamemode.black : gamemode.white) {
        //コンピュータープレイヤー
        case COM_PLAYER:

            move.x = result.position.x;
            move.y = result.position.y;

            resultArray.push({
                board: board.clone(),
                score: result.score,
            });
            break;

        //ランダムプレイヤー
        case RANDOM_PLAYER:
            //もっと良い方法があるけれど愚直に実装した。あとで書き直したいかも

            //置ける場所に置けるまでランダムに置いてみる
            while (1) {
                move.x = Math.floor(Math.random() * 8);
                move.y = Math.floor(Math.random() * 8);

                //もし置けるならループから抜け出す
                if (board.isPos(move)) {
                    break;
                }
            }
            resultArray.push({
                board: board.clone(),
                score: result.score,
            });
            break;
        default:
            break;
    }


    //石を置いてひっくり返す
    board.reverse(move);

    //game()を再帰呼び出しする
    return game(board, gamemode, move, depth);
}

function main() {
    let depth = 0;
    e.load(`model`);

    //探索部のテスト用初期値 
    // board = new Board({
    //     black: (new BitBoard(0xce849b9fefaf1228n)).rotate().rotate(),
    //     white: (new BitBoard(0x302a646010502444n)).rotate().rotate(),
    //     color: WHITE,
    //     posBoard: new BitBoard()
    // });

    //ゲームモードの設定
    // let gamemode = { black: COM_PLAYER, white: COM_PLAYER };
    // let board = new Board();
    // let move = { x: -1, y: -1 };
    // game(board, gamemode, move, Number(depth))
    // console.dir(resultArray);

    while (true) {
        for (let i = 0; i < 10; i++) {
            resultArray = [];
            let gamemode = { black: RANDOM_PLAYER, white: RANDOM_PLAYER };
            let depth = 1 + Math.floor(Math.random() * 2);
            let board = new Board();
            let move = { x: -1, y: -1 };
            let resultScore = game(board, gamemode, move, Number(depth));
            let result = 0;
            if (resultScore.black > resultScore.white) {
                result = 1;
            } else if (resultScore.black < resultScore.white) {
                result = -1;
            }

            for (let r = 0; r < 4; r++) {
                for (let j = 0; j < resultArray.length; j++) {
                    let score = resultArray[j].score;
                    if (resultArray[j].board.color == BLACK) {
                        score = score;
                    } else {
                        score = -score;
                    }
                    //e.train(resultArray[j % resultArray.length].board.rotate(), resultArray[j % resultArray.length].board.color, resultScore.black - resultScore.white);
                    e.train(resultArray[j % resultArray.length].board.rotate(), resultArray[j % resultArray.length].board.color, score);
                    //e.train(resultArray[j % resultArray.length].board.rotate(), resultArray[j % resultArray.length].board.color, (resultScore.black - resultScore.white + score) / 2);
                }
            }
            //e.train(board, board.color, resultScore.black - resultScore.white);

        }
        resultArray = [];
        let gamemode = { black: COM_PLAYER, white: COM_PLAYER };
        let depth = 2;
        let board = new Board();
        let move = { x: -1, y: -1 };
        let resultScore = game(board, gamemode, move, Number(depth));
        for (let i = 0; i < resultArray.length; i++) {
            console.log(`score: ${resultArray[i].board.color == BLACK ? resultArray[i].score : -resultArray[i].score}, black: ${resultArray[i].board.count().black}, white: ${resultArray[i].board.count().white}`);
        }
        //console.dir(resultArray);
        e.save(`model`);
    }
}

main();