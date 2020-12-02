let size = 64;
let offset = { x: 0, y: 0 };

//クリックされるまで待つ
const waitClick = canvas => {
    return new Promise(resolve => {
        canvas.addEventListener("click", resolve);
    });
};

//マウスの座標を取得する
function getMousePosition(canvas, e) {
    let rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left - offset.x,
        y: e.clientY - rect.top - offset.y
    };
}

//マウスの座標を盤面の座標に変換
function getSelectPosition(mousePos) {
    //マウスの座標を1マスのサイズで割って小数点以下を切り捨てたら盤面座標に変換できるよね
    let posX = Math.floor(mousePos.x / size);
    let posY = Math.floor(mousePos.y / size);

    //求められた盤面座標が範囲外なら-1にする
    if (posX < 0 || 7 < posX) {
        posX = -1;
    }
    if (posY < 0 || 7 < posY) {
        posY = -1;
    }

    return {
        x: posX,
        y: posY
    }
}

function drow(selectPosition, board) {
    return resize(selectPosition, board);
}

function resize(selectPosition, board) {
    //サイズを取得
    let width = document.getElementById('board').clientWidth;
    let height = document.getElementById('board').clientHeight;
    let newBoard = board.clone();

    //描画領域のサイズを設定
    canvas.setAttribute("width", width);
    canvas.setAttribute("height", height);

    //縦横狭いほうのサイズに合わせて盤面のサイズとオフセットを変更
    if (width < height) {
        size = width / 8;
        offset.x = (width - width) / 2;
        offset.y = (height - width) / 2;
    }
    else {
        size = height / 8;
        offset.x = (width - height) / 2;
        offset.y = (height - height) / 2;
    }

    //サイズを変更すると真っ白になるので再描画
    drowBoard(offset, selectPosition, board);

    //もしゲームエンドなら結果を表示します
    if (newBoard.isPass()) {
        newBoard.changeColor();
        if (newBoard.isPass()) {
            drowResult(newBoard);
        }
    }
}

function drowResult(board){
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = `rgb(31, 31, 31, 0.9)`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    let result = board.count();

    //フォントサイズ、位置の設定
    ctx.font = `${size}px 'M PLUS Rounded 1c'`;
    ctx.textAlign = "center";
    ctx.fillStyle = 'white';
    ctx.textBaseline = "middle";

    //石数を表示
    ctx.fillText(`黒: ${result.black}, 白: ${result.white}`, ctx.canvas.width / 2, ctx.canvas.height / 2 - size, ctx.canvas.width);

    //どちらが勝ったかを表示する
    if(result.black == result.white){
        ctx.fillText(`引き分け`, ctx.canvas.width / 2, ctx.canvas.height / 2 + size, ctx.canvas.width);
    }
    else if(result.black > result.white){
        ctx.fillText(`黒の勝ち`, ctx.canvas.width / 2, ctx.canvas.height / 2 + size, ctx.canvas.width);
    }
    else if(result.black < result.white){
        ctx.fillText(`白の勝ち`, ctx.canvas.width / 2, ctx.canvas.height / 2 + size, ctx.canvas.width);
    }
}

function drowBoard(offset, selectPosition, board) {
    let ctx = canvas.getContext("2d");

    //Canvas領域を塗りつぶす
    ctx.fillStyle = `rgb(31, 31, 31)`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    //盤面の描画
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let _i = i * size + offset.x;
            let _j = j * size + offset.y;

            //背景を描く
            ctx.fillStyle = `rgb(127, 191, 255)`;
            ctx.fillRect(_i + 1, _j + 1, size - 2, size - 2);

            //石があれば色をつける
            let color = board.getColor({ x: i, y: j });
            if (color == BLACK) {
                ctx.fillStyle = `rgb(0, 0, 0)`;
            }
            else if (color == WHITE) {
                ctx.fillStyle = `rgb(255, 255, 255)`;
            }
            let blankSize = (size / 8);
            ctx.fillRect(_i + blankSize, _j + blankSize, size - blankSize * 2, size - blankSize * 2);

            //置ける場所であれば色をつける
            if (board.isPos({ x: i, y: j })) {
                ctx.fillStyle = `rgb(127, 255, 127, 0.5)`;
                ctx.fillRect(_i + 1, _j + 1, size - 2, size - 2);
            }

            //選択されたマスであれば色をつける
            if (i == selectPosition.x && j == selectPosition.y) {
                ctx.fillStyle = `rgb(255, 127, 127, 0.5)`;
                ctx.fillRect(_i + 1, _j + 1, size - 2, size - 2);
            }
        }
    }
}

function print(message) {
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = 'black';
    ctx.font = `${size / 8}px 'M PLUS Rounded 1c'`;
    ctx.fillText(message, 0, ctx.canvas.height - size / 2);
}