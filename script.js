'use strict';

// ===== CONSTANTS =====

const PIECE_SYMBOLS = {
    p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
    P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔'
};

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const ANALYSIS_DEPTH = 3;          // plies searched by the engine
const ANALYSIS_DELAY_MS = 50;      // lets the "Analyzing..." UI paint before the (blocking) search runs
const RECENT_GAMES_LIMIT = 20;
const MATE_SCORE = 100;

// Ordered so the first matching threshold wins (see getMoveQuality).
const MOVE_QUALITY_THRESHOLDS = [
    { max: 0.3, label: '✓ Excellent Move', className: 'excellent', explanation: 'This is the best or near-best move in the position.' },
    { max: 0.8, label: '✓ Good Move', className: 'good', explanation: 'A solid move with minimal loss of advantage.' },
    { max: 1.5, label: '!? Inaccuracy', className: 'inaccuracy', explanation: 'Not the best move, but not terrible. Small advantage lost.' },
    { max: 3.0, label: '? Mistake', className: 'mistake', explanation: 'A significant error. Considerable advantage lost.' },
    { max: Infinity, label: '?? Blunder', className: 'blunder', explanation: 'A serious mistake that greatly worsens the position.' }
];

// ===== APPLICATION STATE =====

const state = {
    currentGame: null,
    chess: null,
    moveHistory: [],       // verbose move objects, in play order
    gameStates: [],        // FEN after each ply; gameStates[0] is the start position
    currentMoveIndex: -1,
    gamesCache: [],
    highlightedSquares: [],
    currentUsername: '',
    userColor: 'w'          // which side the searched player was in the loaded game
};

// ===== CHESS ENGINE =====

function evaluatePosition(game) {
    if (game.in_checkmate()) {
        return game.turn() === 'w' ? -MATE_SCORE : MATE_SCORE;
    }
    if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
        return 0;
    }

    let evaluation = 0;
    const board = game.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            const value = PIECE_VALUES[piece.type];
            const sign = piece.color === 'w' ? 1 : -1;
            evaluation += value * sign;

            if (piece.type === 'p') {
                const advancement = piece.color === 'w' ? 7 - row : row;
                evaluation += advancement * 0.1 * sign;
            }
            if (piece.type === 'n' || piece.type === 'b') {
                const centerBonus = (3 - Math.abs(3.5 - row)) * (3 - Math.abs(3.5 - col)) * 0.05;
                evaluation += centerBonus * sign;
            }
        }
    }

    const mobility = game.moves().length;
    evaluation += (game.turn() === 'w' ? mobility : -mobility) * 0.05;

    return evaluation;
}

function minimax(game, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || game.game_over()) {
        return evaluatePosition(game);
    }

    const moves = game.moves({ verbose: true });

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            game.move(move);
            const evalScore = minimax(game, depth - 1, alpha, beta, false);
            game.undo();
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    }

    let minEval = Infinity;
    for (const move of moves) {
        game.move(move);
        const evalScore = minimax(game, depth - 1, alpha, beta, true);
        game.undo();
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
    }
    return minEval;
}

/**
 * Finds the strongest move for the side to move, and its evaluation.
 * Operates on whatever Chess instance it is given, so callers can pass
 * a throwaway position without disturbing the position on screen.
 */
function findBestMove(game, depth = ANALYSIS_DEPTH) {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    const isWhite = game.turn() === 'w';
    let bestMove = moves[0];
    let bestValue = -Infinity;

    for (const move of moves) {
        game.move(move);
        const value = isWhite
            ? -minimax(game, depth - 1, -Infinity, Infinity, false)
            : minimax(game, depth - 1, -Infinity, Infinity, true);
        game.undo();

        if (value > bestValue) {
            bestValue = value;
            bestMove = move;
        }
    }

    return { move: bestMove, evaluation: bestValue };
}

function getMoveQuality(evalDiff) {
    return MOVE_QUALITY_THRESHOLDS.find(threshold => evalDiff < threshold.max);
}

// ===== SMALL UTILITIES =====

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
}

function $(id) {
    return document.getElementById(id);
}

// ===== GAME SEARCH =====

async function searchGames() {
    const username = $('usernameInput').value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }

    state.currentUsername = username;
    const btn = $('searchBtn');
    btn.disabled = true;
    btn.textContent = 'Loading...';

    const container = $('gamesListContainer');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Fetching games...</p></div>';

    try {
        const archivesResponse = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`);
        if (!archivesResponse.ok) throw new Error('Player not found');

        const archivesData = await archivesResponse.json();
        if (!archivesData.archives || archivesData.archives.length === 0) {
            throw new Error('No games found for this player');
        }

        const latestArchive = archivesData.archives[archivesData.archives.length - 1];
        const gamesResponse = await fetch(latestArchive);
        if (!gamesResponse.ok) throw new Error('Could not load games');

        const gamesData = await gamesResponse.json();
        displayGames(gamesData.games.slice(-RECENT_GAMES_LIMIT).reverse());
    } catch (error) {
        container.innerHTML = `<p style="color: #ff4444;">Error: ${escapeHtml(error.message)}. Please check the username and try again.</p>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Search Games';
    }
}

function displayGames(games) {
    const container = $('gamesListContainer');
    if (games.length === 0) {
        container.innerHTML = '<p>No games found.</p>';
        return;
    }

    const html = games.map((game, index) => {
        const white = escapeHtml(game.white.username);
        const black = escapeHtml(game.black.username);
        const result = escapeHtml(game.white.result);
        const timeClass = escapeHtml(game.time_class);
        const date = new Date(game.end_time * 1000).toLocaleDateString();

        return `
            <div class="game-card" data-index="${index}">
                <div class="game-card-header">
                    <h3>${white} vs ${black}</h3>
                </div>
                <div class="game-card-details">
                    <p><span class="label">Result:</span> ${result}</p>
                    <p><span class="label">Time:</span> ${timeClass}</p>
                    <p><span class="label">Date:</span> ${date}</p>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="games-list">${html}</div>`;
    state.gamesCache = games;

    container.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => loadGame(Number(card.dataset.index)));
    });
}

// ===== GAME LOADING =====

/** Works out which color the searched player had in this game. */
function detectUserColor(username, whiteUsername, blackUsername) {
    const lowerUsername = username.toLowerCase();
    if (lowerUsername === whiteUsername.toLowerCase()) return 'w';
    if (lowerUsername === blackUsername.toLowerCase()) return 'b';
    return 'w'; // fallback if the username couldn't be matched
}

function loadGame(index) {
    state.currentGame = state.gamesCache[index];
    const pgn = state.currentGame.pgn;

    state.userColor = detectUserColor(
        state.currentUsername,
        state.currentGame.white.username,
        state.currentGame.black.username
    );

    // Parse the PGN once to get the canonical move list in SAN (e.g. "Nf3", "O-O").
    // Replaying from SAN - rather than replaying the verbose move objects chess.js
    // hands back - is what chess.js itself considers a "legal" move, so every
    // resulting position and move index lines up correctly with the game as played.
    const pgnParser = new Chess();
    pgnParser.load_pgn(pgn);
    const sanMoves = pgnParser.history();

    state.chess = new Chess();
    state.moveHistory = [];
    state.gameStates = [state.chess.fen()];
    state.highlightedSquares = [];

    sanMoves.forEach(san => {
        const move = state.chess.move(san);
        state.moveHistory.push(move);
        state.gameStates.push(state.chess.fen());
    });

    state.chess.reset();
    state.currentMoveIndex = 0;

    $('searchSection').style.display = 'none';
    $('analyzerSection').classList.add('active');

    renderBoard();
    updateMoveInfo();
    updateButtons();
    $('analysisPanel').innerHTML =
        '<h3>Move Analysis</h3><p style="color: #888888;">Navigate through the game and click "Analyze Position" to get AI analysis.</p>';
}

// ===== BOARD RENDERING =====

function renderBoard() {
    const board = state.chess.board();
    const boardElement = $('chessboard');
    boardElement.innerHTML = '';

    const flipBoard = state.userColor === 'b';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            // The square actually shown at this grid cell, accounting for the flip.
            const actualRow = flipBoard ? 7 - row : row;
            const actualCol = flipBoard ? 7 - col : col;
            const squareName = FILES[actualCol] + RANKS[actualRow];

            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.square = squareName;

            if (state.highlightedSquares.includes(squareName)) {
                square.classList.add('highlight');
            }

            // Look up the piece using the same flipped coordinates as the square
            // name above, so the piece drawn always matches the label under it.
            const piece = board[actualRow][actualCol];
            if (piece) {
                square.textContent = PIECE_SYMBOLS[piece.color === 'w' ? piece.type.toUpperCase() : piece.type];
            }

            boardElement.appendChild(square);
        }
    }

    renderLabels(flipBoard);
}

function renderLabels(flipBoard) {
    const fileLabels = $('fileLabels');
    fileLabels.innerHTML = '';
    const displayFiles = flipBoard ? [...FILES].reverse() : FILES;
    displayFiles.forEach(file => {
        const span = document.createElement('span');
        span.textContent = file;
        fileLabels.appendChild(span);
    });

    const rankLabels = $('rankLabels');
    rankLabels.innerHTML = '';
    const displayRanks = flipBoard ? [...RANKS].reverse() : RANKS;
    displayRanks.forEach(rank => {
        const div = document.createElement('div');
        div.textContent = rank;
        rankLabels.appendChild(div);
    });
}

function updateMoveInfo() {
    const info = $('moveInfo');

    if (state.currentMoveIndex === 0) {
        info.textContent = 'Move 0: Starting Position';
        return;
    }

    const move = state.moveHistory[state.currentMoveIndex - 1];
    const moveNumber = Math.ceil(state.currentMoveIndex / 2);
    const colorText = move.color === state.userColor
        ? 'You'
        : (move.color === 'w' ? 'White' : 'Black');

    info.textContent = `Move ${moveNumber}: ${colorText} played ${move.san}`;
}

function updateButtons() {
    const atStart = state.currentMoveIndex === 0;
    const atEnd = state.currentMoveIndex >= state.moveHistory.length;

    $('firstBtn').disabled = atStart;
    $('prevBtn').disabled = atStart;
    $('nextBtn').disabled = atEnd;
    $('lastBtn').disabled = atEnd;
}

// ===== NAVIGATION =====

function goToMove(index) {
    state.currentMoveIndex = index;
    state.chess.load(state.gameStates[index]);
    state.highlightedSquares = [];
    renderBoard();
    updateMoveInfo();
    updateButtons();
}

function firstMove() {
    goToMove(0);
}

function previousMove() {
    if (state.currentMoveIndex > 0) {
        goToMove(state.currentMoveIndex - 1);
    }
}

function nextMove() {
    if (state.currentMoveIndex < state.moveHistory.length) {
        goToMove(state.currentMoveIndex + 1);
    }
}

function lastMove() {
    goToMove(state.moveHistory.length);
}

// ===== ANALYSIS =====

function analyzePosition() {
    const btn = $('analyzeBtn');
    btn.disabled = true;
    btn.textContent = 'Analyzing...';

    const panel = $('analysisPanel');
    panel.innerHTML = '<h3>Move Analysis</h3><div class="loading"><div class="spinner"></div><p>Analyzing position...</p></div>';

    // Deferred so the "Analyzing..." state has a chance to paint before the
    // (synchronous, potentially slow) search blocks the main thread.
    setTimeout(() => {
        try {
            const result = findBestMove(state.chess, ANALYSIS_DEPTH);

            if (!result) {
                panel.innerHTML = '<h3>Move Analysis</h3><div class="analysis-result"><p>Game is over or no moves available.</p></div>';
                btn.disabled = false;
                btn.textContent = '🔍 Analyze Position';
                return;
            }

            state.highlightedSquares = [result.move.from, result.move.to];
            renderBoard();

            // Evaluate the position immediately before this move fresh, on a
            // throwaway board, rather than reusing whatever was last analyzed.
            // That keeps the move-quality rating correct even when the user
            // jumps around the game instead of analyzing every move in order.
            let priorEvaluation = null;
            if (state.currentMoveIndex > 0) {
                const priorPosition = new Chess(state.gameStates[state.currentMoveIndex - 1]);
                const priorResult = findBestMove(priorPosition, ANALYSIS_DEPTH);
                priorEvaluation = priorResult ? priorResult.evaluation : null;
            }

            displayAnalysis(result.evaluation, result.move, priorEvaluation);
        } catch (error) {
            console.error('Analysis error:', error);
            panel.innerHTML = '<h3>Move Analysis</h3><div class="analysis-result"><p style="color: #ff4444;">Analysis error. Please try again.</p></div>';
        } finally {
            btn.disabled = false;
            btn.textContent = '🔍 Analyze Position';
        }
    }, ANALYSIS_DELAY_MS);
}

function displayAnalysis(evaluation, bestMove, priorEvaluation) {
    const panel = $('analysisPanel');

    const evalClass = evaluation > 0 ? 'positive' : 'negative';
    const evalText = Math.abs(evaluation) >= MATE_SCORE / 2
        ? (evaluation > 0 ? 'Mate for White' : 'Mate for Black')
        : `${evaluation > 0 ? '+' : ''}${evaluation.toFixed(2)}`;

    const quality = priorEvaluation !== null ? getMoveQuality(Math.abs(evaluation - priorEvaluation)) : null;
    const bestMoveText = bestMove.san || `${bestMove.from} → ${bestMove.to}`;

    let html = '<h3>Move Analysis</h3>';
    html += '<div class="analysis-result">';
    html += `<div class="evaluation ${evalClass}">
                <span class="eval-label">Evaluation:</span>
                <span class="eval-value">${evalText}</span>
             </div>`;

    if (quality) {
        html += `<div class="move-quality ${quality.className}">${quality.label}</div>`;
        html += `<p class="explanation">${quality.explanation}</p>`;
    }

    html += `<div class="best-move">
                <span class="best-move-label">Best move:</span>
                <span class="best-move-value">${bestMoveText}</span>
                <span class="best-move-squares">${bestMove.from} → ${bestMove.to}</span>
             </div>`;
    html += `<p class="analysis-note">Fast AI analysis (depth ${ANALYSIS_DEPTH}) • Green squares show best move</p>`;
    html += '</div>';

    panel.innerHTML = html;
}

// ===== NAVIGATION BACK TO SEARCH =====

function backToSearch() {
    $('searchSection').style.display = 'block';
    $('analyzerSection').classList.remove('active');
    state.currentGame = null;
    state.chess = null;
    state.highlightedSquares = [];
    state.currentUsername = '';
    state.userColor = 'w';
}

// ===== INITIALIZATION =====

function init() {
    $('searchBtn').addEventListener('click', searchGames);
    $('usernameInput').addEventListener('keypress', event => {
        if (event.key === 'Enter') searchGames();
    });

    $('backButton').addEventListener('click', backToSearch);
    $('prevBtn').addEventListener('click', previousMove);
    $('nextBtn').addEventListener('click', nextMove);
    $('firstBtn').addEventListener('click', firstMove);
    $('lastBtn').addEventListener('click', lastMove);
    $('analyzeBtn').addEventListener('click', analyzePosition);
}

document.addEventListener('DOMContentLoaded', init);
