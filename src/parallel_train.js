// Orchestrate parallel self-play and training using worker_threads
const os = require('os');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');
const { Board, BLACK, BitBoard } = require('./board.js');
const { NNEval } = require('./evaluate.js');

const WORKER_PATH = path.join(__dirname, 'train_worker.js');

function snapshotModel(e) {
    // 小さめのJSONにするため、そのまま構造を渡す
    return { hiddenSizes: e.hiddenSizes, W: e.W, b: e.b };
}

function createWorker() {
    const worker = new Worker(WORKER_PATH);
    function run(payload) {
        return new Promise((resolve, reject) => {
            const onMsg = (msg) => { cleanup(); resolve(msg.samples || []); };
            const onErr = (err) => { cleanup(); reject(err); };
            function cleanup() {
                worker.off('message', onMsg);
                worker.off('error', onErr);
            }
            worker.once('message', onMsg);
            worker.once('error', onErr);
            worker.postMessage(payload);
        });
    }
    return { worker, run };
}

async function main() {
    const threads = Math.max(1, Math.min(os.cpus().length, Number(process.env.WORKERS || os.cpus().length)));
    const gamesPerWorker = Number(process.env.GAMES || 10);
    const depth = Number(process.env.DEPTH || 1);
    const forceRandomPlies = Number(process.env.RANDOM_PLIES || 20);
    const endgameExtraDepth = Number(process.env.ENDGAME_EXTRA || 1);
    const modelPath = process.env.MODEL || 'model.nn.json';
    const outcomeWeightBase = Number(process.env.OUTCOME_WEIGHT || 0.5); // 0..1
    const outcomeScale = Number(process.env.OUTCOME_SCALE || 1);
    const dynamicOutcome = (process.env.DYNAMIC_OUTCOME ?? '1') !== '0';
    const epsilon = Number(process.env.EPSILON || 0.05);
    const endgameTrigger = Number(process.env.ENDGAME_TRIGGER || 6); // 残りマス数で発動
    // 探索オプション（自己対戦は軽量化が有利なので既定オフ）
    // const useIterative = (process.env.USE_ID ?? '0') !== '0';
    // const useTT = (process.env.USE_TT ?? '0') !== '0';
    // const useAspiration = (process.env.USE_ASP ?? '0') !== '0';
    // const aspirationDelta = Number(process.env.ASP_DELTA || 0.5);

    const evaler = new NNEval({ hiddenSizes: [16, 16, 16, 16], lr: 0.0001, lambda: 1e-6, optimizer: 'adam', beta1: 0.9, beta2: 0.999, eps: 1e-8, featureOpponentMoves: true });
    try { evaler.load(modelPath); } catch (_) { }
    let iter = 0;
    let emaMSE = null;
    let emaMAE = null;
    const alpha = Number(process.env.METRIC_ALPHA || 0.1);
    const logCsv = process.env.LOG_CSV || 'train_log.csv';
    if (!fs.existsSync(logCsv)) {
        try { fs.writeFileSync(logCsv, 'iter,samples,mse,rmse,mae,ema_mse,ema_mae,time_ms,workers,games,depth,random_plies,endgame_extra\n'); } catch (_) { }
    }

    // ワーカープール生成
    const pool = Array.from({ length: threads }, () => createWorker());

    while (true) {
        const t0 = Date.now();
        const snap = snapshotModel(evaler);
        const payload = {
            type: 'generate',
            model: snap,
            games: gamesPerWorker,
            depth,
            forceRandomPlies,
            endgameExtraDepth,
            endgameTrigger,
            epsilon,
        };
        const results = await Promise.all(pool.map(p => p.run(payload)));
        const samples = results.flat();

        // Metrics + Train from samples
        let mseSum = 0, maeSum = 0;
        for (const s of samples) {
            const board = new Board({
                black: new BitBoard(BigInt(s.black)),
                white: new BitBoard(BigInt(s.white)),
                color: s.color,
                posBoard: new BitBoard()
            });
            // 90度回転データ拡張（偏り軽減）。回転回数は0..3ランダム
            const rot = Math.floor(Math.random() * 4);
            for (let r = 0; r < rot; r++) {
                board.black.rotate();
                board.white.rotate();
                board.posBoard.rotate();
            }
            // prediction before update
            const pred = evaler.evaluate(board, board.color);
            // targets in board.color perspective
            const stones = board.count().black + board.count().white;
            const wOutcome = Math.max(0, Math.min(1, dynamicOutcome ? outcomeWeightBase * (stones / 64) : outcomeWeightBase));
            const scoreT = s.score; // search score already in board.color perspective
            const outcomeT = (s.outcome != null) ? ((board.color === BLACK) ? s.outcome : -s.outcome) * outcomeScale : 0;
            const combined = (1 - wOutcome) * scoreT + wOutcome * outcomeT;
            const diff = pred - combined;
            mseSum += diff * diff;
            maeSum += Math.abs(diff);
            // update
            const combinedBlack = (board.color === BLACK) ? combined : -combined;
            evaler.train(board, board.color, combinedBlack);
        }
        const n = Math.max(1, samples.length);
        const mse = mseSum / n;
        const rmse = Math.sqrt(mse);
        const mae = maeSum / n;
        emaMSE = (emaMSE == null) ? mse : alpha * mse + (1 - alpha) * emaMSE;
        emaMAE = (emaMAE == null) ? mae : alpha * mae + (1 - alpha) * emaMAE;

        const dt = Date.now() - t0;

        try { evaler.save(modelPath); } catch (_) { }
        console.log(`[iter ${iter}] samples=${samples.length} mse=${mse.toFixed(4)} rmse=${rmse.toFixed(4)} mae=${mae.toFixed(4)} ema_mse=${emaMSE.toFixed(4)} time=${dt}ms workers=${threads} outcome_w_base=${outcomeWeightBase} dyn=${dynamicOutcome}`);
        try {
            fs.appendFileSync(logCsv, [
                iter,
                samples.length,
                mse,
                rmse,
                mae,
                emaMSE,
                emaMAE,
                dt,
                threads,
                gamesPerWorker,
                depth,
                forceRandomPlies,
                endgameExtraDepth
            ].join(',') + '\n');
        } catch (_) { }
        iter++;
    }
}

if (require.main === module) {
    main().catch((e) => { console.error(e); process.exit(1); });
}
