
import { Board, BLACK, BitBoard } from './board.js';
import { search } from './search.js';
import { Eval } from './evaluate.js';
import { Worker } from 'worker_threads';

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
    // if (64 - (count.black + count.white) < 6) {
    //     gamemode.black = COM_PLAYER;
    //     gamemode.white = COM_PLAYER;
    // }

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

async function main() {
    let depth = 0;
    //e.load(`model`);

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

    const NUM_WORKERS = 12; // 並列数はCPUコア数などに応じて調整
    while (true) {
        let workerPromises = [];
        const NUM_GAMES_PER_WORKER = 4; // 1ワーカーあたりの局数
        for (let i = 0; i < NUM_WORKERS; i++) {
            let depth = 4;
            workerPromises.push(new Promise((resolve, reject) => {
                const worker = new Worker('./src/worker.js', {
                    workerData: { depth, numGames: NUM_GAMES_PER_WORKER }
                });
                worker.on('message', resolve);
                worker.on('error', reject);
                worker.on('exit', (code) => {
                    if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
                });
            }));
        }

        let results;
        try {
            results = await Promise.all(workerPromises);
        } catch (err) {
            console.error('Worker error:', err);
            continue;
        }

        // results: [[{ resultArray, resultScore, result }, ...], ...]
        for (const workerResults of results) {
            for (const res of workerResults) {
                for (let r = 0; r < 4; r++) {
                    for (let j = 0; j < res.resultArray.length; j++) {
                        let score = res.resultArray[j].score;
                        if (res.resultArray[j].board.color == BLACK) {
                            score = score;
                        } else {
                            score = -score;
                        }
                        const boardObj = res.resultArray[j % res.resultArray.length].board;
                        const boardInstance = new Board({
                            black: new BitBoard(boardObj.black.board),
                            white: new BitBoard(boardObj.white.board),
                            color: boardObj.color,
                            posBoard: new BitBoard(boardObj.posBoard.board)
                        });
                        await e.train(boardInstance.rotate(), boardInstance.color, (score + res.resultScore.black - res.resultScore.white) / 2);
                        //e.train(boardInstance.rotate(), boardInstance.color, score);
                    }
                }
            }
        }

        // 1回ごとにCOM_PLAYER同士で評価
        resultArray = [];
        let gamemode = { black: COM_PLAYER, white: COM_PLAYER };
        let depth = 3;
        let board = new Board();
        let move = { x: -1, y: -1 };
        let resultScore = game(board, gamemode, move, Number(depth));
        for (let i = 0; i < resultArray.length; i++) {
            console.log(`score: ${resultArray[i].board.color == BLACK ? resultArray[i].score : -resultArray[i].score}, black: ${resultArray[i].board.count().black}, white: ${resultArray[i].board.count().white}`);
        }
        e.save(`model`);
        // 必要なら await new Promise(res => setTimeout(res, 100)); などで休止も可能
    }
}

main();