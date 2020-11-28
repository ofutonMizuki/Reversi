const size = 64;

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
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
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

function drowBoard(selectPosition, board) {
    let ctx = canvas.getContext("2d");

    //Canvas領域を塗りつぶす
    ctx.fillStyle = `rgb(255, 239, 255)`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    //盤面の描画
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let _i = i * size;
            let _j = j * size;

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
                ctx.fillRect(_i, _j, size, size);
            }

            //選択されたマスであれば色をつける
            if (i == selectPosition.x && j == selectPosition.y) {
                ctx.fillStyle = `rgb(255, 127, 127, 0.5)`;
                ctx.fillRect(_i, _j, size, size);
            }
        }
    }
}

function print(message) {
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = 'black';
    ctx.fillText(message, 0, ctx.canvas.height - 32);
}