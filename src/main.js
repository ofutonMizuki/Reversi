const canvas = document.getElementById("field");
const MANUAL_PLAYER = 1, COM_PLAYER = 2, RANDOM_PLAYER = 3;

let searchWorker = new Worker('worker.js');

let debug = {};

let isThinking = false;

//探索終了まで待つ関数
const waitSearch = search => {
    return new Promise(resolve => {
        search.addEventListener("message", resolve);
    });
};

async function game(board, gamemode, move, depth) {
    //置ける場所を求める(実際はすでに求められてると思うけれど念の為)
    board.getPosBoard();

    //もしパスならターンチェンジ
    if (board.isPass()) {
        board.changeColor();

        //それでもパスならゲーム終了
        if (board.isPass()) {

            //盤面の石の数を数えて返す
            let result = board.count();
            return result;
        }
    }

    //プレイヤーのゲームモードによって分岐する
    switch ((board.color == BLACK) ? gamemode.black : gamemode.white) {
        //コンピュータープレイヤー
        case COM_PLAYER:
            isThinking = true;

            //思考時間の計測を始める
            var time = performance.now();

            //もし終盤なら探索を深くする
            let count = board.count();
            if (64 - (count.black + count.white) < depth * 1.5) {
                //思考を別スレッドで開始する
                searchWorker.postMessage(
                    {
                        board: board.clone(),
                        maxDepth: Math.floor(depth * 1.5)
                    }
                );
            }
            else {
                //思考を別スレッドで開始する
                searchWorker.postMessage(
                    {
                        board: board.clone(),
                        maxDepth: depth
                    }
                );
            }

            //思考結果が返ってくるまで待つ
            let result = (await waitSearch(searchWorker)).data;

            //
            move.x = result.position.x;
            move.y = result.position.y;

            isThinking = false;

            //デバッグ用
            debug.thinkTime = (performance.now() - time);
            debug.score = result.score;
            debug.numberOfNode = result.numberOfNode;
            //await waitClick(canvas)
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
            break;
        default:
            break;
    }

    //石を置いてひっくり返す
    board.reverse(move);

    //game()を再帰呼び出しする
    game(board, gamemode, move, depth);
}

function main() {
    let board = new Board();
    let move = { x: -1, y: -1 };

    let url = new URL(window.location.href);
    let params = url.searchParams;
    let depth = params.get("depth") ? params.get("depth") : 1;

    //探索部のテスト用初期値 
    // board = new Board({
    //     black: (new BitBoard(0xce849b9fefaf1228n)).rotate().rotate(),
    //     white: (new BitBoard(0x302a646010502444n)).rotate().rotate(),
    //     color: WHITE,
    //     posBoard: new BitBoard()
    // });

    //ゲームモードの設定
    let gamemode = { black: COM_PLAYER, white: COM_PLAYER };

    setTimeout(() => {
        //ゲームの開始
        game(board, gamemode, move, Number(depth));
    }, 100);
}