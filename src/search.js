const INFINITE_SCORE = 32768;

class tBoard extends Board {
    constructor(board) {
        super(board);
        this.prev = null;
        this.next = new Array();
        this.numberOfChildNode = 0;
        this.n = 0;
        this.score = 0;
        this.position = { x: -1, y: -1 };
    }

    clone() {
        let newBoard = new tBoard(super.clone());
        newBoard.prev = this.prev;
        newBoard.next = this.next.concat();
        newBoard.numberOfChildNode = this.numberOfChildNode;
        newBoard.n = this.n;
        newBoard.score = this.score;
        newBoard.position = Object.assign({}, this.position);

        return newBoard;
    }
}

function createNextBoard(board, position) {
    //新しい盤面にコピー
    //let newBoard = { ...board };
    let newBoard = board.clone();

    //
    newBoard.next = [];
    newBoard.prev = board;
    newBoard.numberOfChildNode = 0;
    newBoard.n += 1;
    newBoard.position = position;

    //ひっくり返す
    newBoard.reverse(position);


    return newBoard;
}

function search(_board, maxDepth) {
    let board = new tBoard(_board);
    alphaBeta(board, maxDepth - 1, board.color, -INFINITE_SCORE, INFINITE_SCORE);

    return {
        position: board.position,
        score: board.score,
        numberOfNode: board.numberOfChildNode
    }
}

function alphaBeta(board, maxDepth, color, alpha, beta) {
    //もしパスならターンチェンジ
    if (board.isPass()) {
        board.changeColor();

        //それでもパスならゲーム終了
        if (board.isPass()) {

            //盤面の石の数を数える
            let result = board.count();

            //手番からみたスコアを計算する
            if (color == BLACK) {
                board.score = result.black - result.white;
            }
            else {
                board.score = result.white - result.black;
            }

            return board.score;
        }
    }

    //もし探索上限に達したら評価値を求める
    if (maxDepth < board.n) {
        board.score = evaluate(board, color);
        //board.score = Math.random();

        return board.score;
    }

    //合法手の生成
    let positionList = board.getNextPositionList();
    board.numberOfChildNode = positionList.length;


    if (color == board.color) {
        let prevBoard = board.prev;
        board.score = -INFINITE_SCORE;

        for (let i = 0; i < positionList.length; i++) {
            board.next.push(createNextBoard(board, positionList[i]));
            let score = alphaBeta(board.next[i], maxDepth, color, alpha, beta);
            board.numberOfChildNode += board.next[i].numberOfChildNode;

            if (board.score < score) {
                board.score = score;
            }
            if (alpha < score) {
                board.position = prevBoard == null ? Object.assign({}, board.next[i].position) : board.position;
                alpha = score;
            }
            if (alpha >= beta) {
                //使わない配列は明示的に解放
                board.next = [];
                return alpha;
            }
        }
    }
    else {
        let prevBoard = board.prev;
        board.score = INFINITE_SCORE;

        for (let i = 0; i < positionList.length; i++) {
            board.next.push(createNextBoard(board, positionList[i]));
            let score = alphaBeta(board.next[i], maxDepth, color, alpha, beta);
            board.numberOfChildNode += board.next[i].numberOfChildNode;

            if (board.score > score) {
                board.score = score;
            }
            if (beta > score) {
                board.position = prevBoard == null ? Object.assign({}, board.next[i].position) : board.position;
                beta = score;
            }
            if (alpha >= beta) {
                //使わない配列は明示的に解放
                board.next = [];
                return beta;
            }
        }
    }

    //使わない配列は明示的に解放
    board.next = [];
    return board.score;
}