function evaluate(board, color) {
    //盤面の石の数を数える
    let result = board.count();

    //手番からみたスコアを計算する
    if (color == BLACK) {
        return result.black - result.white;
    }
    else {
        return result.white - result.black;
    }
}