const canvas = document.getElementById("field");
const MANUAL_PLAYER = 1, COM_PLAYER = 2, RANDOM_PLAYER = 3;

let searchWorker = new Worker('worker.js');

let debugMessage = "";

//探索終了まで待つ関数
const waitSearch = search => {
    return new Promise(resolve => {
        search.addEventListener("message", resolve);
    });
};

async function game(board, gamemode, _move) {
    let move = { x: -1, y: -1 };
    if (_move != undefined) {
        move = _move;
    }

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
        //人間プレイヤー
        case MANUAL_PLAYER:
            //置ける場所をクリックするまで無限ループ
            while (1) {
                //マウスの位置を取得(waitClick()はクリックされるまでブロックする)
                let mousePos = getMousePosition(canvas, await waitClick(canvas));

                //マウスの位置から盤面の座標に変換
                let selectPos = getSelectPosition(mousePos);

                //もし置けるならループから抜け出す
                if (board.isPos(selectPos)) {
                    move.x = selectPos.x;
                    move.y = selectPos.y;
                    break;
                }
            }
            break;
        //コンピュータープレイヤー
        case COM_PLAYER:
            var time = performance.now();
            searchWorker.postMessage({board: board.clone(), maxDepth: 6});
            let result = (await waitSearch(searchWorker)).data;
            debugMessage = (performance.now() - time);
            move = result.position;
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

    setTimeout(() => {
        //game()を再帰呼び出しする
        game(board, gamemode, move);
    }, 0);
}

function main() {
    init_board_js();
    let board = new Board();
    let move = { x: -1, y: -1 };

    //探索部のテスト用初期値 
    // board = new Board({
    //     black: (new BitBoard(0xce849b9fefaf1228n)).rotate().rotate(), 
    //     white: (new BitBoard(0x302a646010502444n)).rotate().rotate(), 
    //     color: BLACK, 
    //     posBoard: new BitBoard() 
    // });

    //ゲームモードの設定
    let gamemode = { black: MANUAL_PLAYER, white: COM_PLAYER };

    setTimeout(() => {
        //ゲームの開始
        game(board, gamemode, move);
    }, 100);

    //1/60秒間隔で画面更新する
    setInterval(() => {
        //描画
        drow(move, board);
        print(debugMessage);
    }, 1000 / 60);
}

//エラーを検知したときにメッセージを吐きます
window.onerror = function (message, file, lineNo, colNo, error) {
    alert(message + '\n' +
        file + ': ' + lineNo + ': ' + colNo + '\n' + (error != null ? error.stack : 'エラーオブジェクトは存在しません'));
}

window.onload = function () {
    main();
}