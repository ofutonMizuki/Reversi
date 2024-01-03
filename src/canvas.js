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
    resize(selectPosition, board);

    let ctx = canvas.getContext("2d");
    let newBoard = board.clone();

    //Canvas領域を塗りつぶす
    ctx.fillStyle = `rgb(31, 31, 31)`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

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

function resize() {
    //サイズを取得
    let width = document.getElementById('board').clientWidth;
    let height = document.getElementById('board').clientHeight;

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
}

function drowThink(){
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = `rgb(31, 31, 31, 0.9)`;
    ctx.fillRect(offset.x, offset.y, size * 8, size * 8);

    //フォントサイズ、位置の設定
    ctx.font = `${size}px 'M PLUS Rounded 1c'`;
    ctx.textAlign = "center";
    ctx.fillStyle = 'white';
    ctx.textBaseline = "middle";
    
    //盤面の中心座標を計算
    let center = {x: (offset.x + size * 4), y: (offset.y + size * 4)};

    //石数を表示
    ctx.fillText(`AI思考中`, center.x, center.y);
}

function drowResult(board) {
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = `rgb(31, 31, 31, 0.9)`;
    ctx.fillRect(offset.x, offset.y, size * 8, size * 8);

    let result = board.count();

    //フォントサイズ、位置の設定
    ctx.font = `${size}px 'M PLUS Rounded 1c'`;
    ctx.textAlign = "center";
    ctx.fillStyle = 'white';
    ctx.textBaseline = "middle";

    //盤面の中心座標を計算
    let center = {x: (offset.x + size * 4), y: (offset.y + size * 4)};

    //石数を表示
    ctx.fillText(`黒: ${result.black}, 白: ${result.white}`, center.x, center.y - size);

    //どちらが勝ったかを表示する
    if (result.black == result.white) {
        ctx.fillText(`引き分け`, center.x, center.y + size);
    }
    else if (result.black > result.white) {
        ctx.fillText(`黒の勝ち`, center.x, center.y + size);
    }
    else if (result.black < result.white) {
        ctx.fillText(`白の勝ち`, center.x, center.y + size);
    }
}

function drowBoard(offset, selectPosition, board) {
    let ctx = canvas.getContext("2d");

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

function print(debug) {
    let ctx = canvas.getContext("2d");
    let fontSize = size / 8;
    let basePosition = {x: 0, y: ctx.canvas.height - size};

    ctx.fillStyle = 'black';
    ctx.textAlign = "start";
    ctx.textBaseline = "top";
    ctx.font = `${fontSize}px 'M PLUS Rounded 1c'`;

    function drowText(message, position){
        ctx.fillText(message, basePosition.x, basePosition.y + position * fontSize);
    }

    drowText(`思考時間: ${Math.floor(debug.thinkTime)}[ms]`, 0);
    drowText(`score: ${debug.score}`, 1);
    drowText(`node: ${debug.numberOfNode}`, 2);
    drowText(`探索速度: ${Math.floor(debug.numberOfNode / (debug.thinkTime / 1000))}[node/s]`, 3);
}