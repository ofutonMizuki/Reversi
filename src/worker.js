import { Board, BLACK, BitBoard } from './board.js';
import { search } from './search.js';
import { Eval } from './evaluate.js';

const MANUAL_PLAYER = 1, COM_PLAYER = 2, RANDOM_PLAYER = 3;

function runGames(depth, numGames) {
    let allResults = [];
    // Create Eval once per worker and try to load existing model
    const e = new Eval();
    try {
        e.load('model');
    } catch (err) {
        console.warn('Worker: model load failed or no model present, continuing with fresh Eval.');
    }
    for (let n = 0; n < numGames; n++) {
        let resultArray = [];
        let gamemode = { black: RANDOM_PLAYER, white: RANDOM_PLAYER };
        let board = new Board();
        let move = { x: -1, y: -1 };

        function game(board, gamemode, move, depth) {
            board.getPosBoard();
            if (board.isPass()) {
                board.changeColor();
                if (board.isPass()) {
                    let result = board.count();
                    return result;
                }
            }
            let count = board.count();
            let result = search(
                new Board({
                    black: new BitBoard(board.black.board),
                    white: new BitBoard(board.white.board),
                    color: board.color,
                    posBoard: new BitBoard(board.posBoard.board)
                }), (64 - (count.black + count.white) < 6) ? 6 : depth,
                e
            );
            switch ((board.color == BLACK) ? gamemode.black : gamemode.white) {
                case COM_PLAYER:
                    move.x = result.position.x;
                    move.y = result.position.y;
                    resultArray.push({ board: board.clone(), score: result.score });
                    break;
                case RANDOM_PLAYER:
                    while (1) {
                        move.x = Math.floor(Math.random() * 8);
                        move.y = Math.floor(Math.random() * 8);
                        if (board.isPos(move)) break;
                    }
                    resultArray.push({ board: board.clone(), score: result.score });
                    break;
                default:
                    break;
            }
            board.reverse(move);
            return game(board, gamemode, move, depth);
        }

        let resultScore = game(board, gamemode, move, Number(depth));
        let result = 0;
        if (resultScore.black > resultScore.white) {
            result = 1;
        } else if (resultScore.black < resultScore.white) {
            result = -1;
        }
        allResults.push({ resultArray, resultScore, result });
    }
    return allResults;
}

// worker_threads 用
import { parentPort, workerData } from 'worker_threads';
if (parentPort) {
    const { depth, numGames = 1 } = workerData;
    const results = runGames(depth, numGames);
    parentPort.postMessage(results);
}
