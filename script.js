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
    analysisToken: 0,
    analysisWorker: null,
    orientation: 'w',
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
    if (game.game_over()) return null;
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    const isWhite = game.turn() === 'w';
    let bestMove = moves[0];
    let bestValue = -Infinity;

    for (const move of moves) {
        game.move(move);
        const value = isWhite
            ? minimax(game, depth - 1, -Infinity, Infinity, false)
            : -minimax(game, depth - 1, -Infinity, Infinity, true);
        game.undo();

        if (value > bestValue) {
            bestValue = value;
            bestMove = move;
        }
    }

    return { move: bestMove, evaluation: isWhite ? bestValue : -bestValue };
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
    if ($('searchBtn').disabled) return;
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
        displayGames(gamesData.games.filter(game => game.rules === 'chess').slice(-RECENT_GAMES_LIMIT).reverse());
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
        const side = detectUserColor(state.currentUsername, game.white.username, game.black.username);
        const result = escapeHtml(game[side === 'w' ? 'white' : 'black'].result);
        const timeClass = escapeHtml(game.time_class);
        const date = new Date(game.end_time * 1000).toLocaleDateString();

        return `
            <button class="game-card" data-index="${index}">
                <div class="game-card-header">
                    <h3>○ ${white} <span class="versus">vs</span> ● ${black}</h3>
                </div>
                <div class="game-card-details">
                    <p><span class="label">Result:</span> ${result}</p>
                    <p><span class="label">Time:</span> ${timeClass}</p>
                    <p><span class="label">Date:</span> ${date}</p>
                </div>
            </button>
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
    if (!pgnParser.load_pgn(pgn)) {
        $('gamesListContainer').insertAdjacentHTML('afterbegin', '<p role="alert">This game could not be read. Please choose another game.</p>');
        return;
    }
    const sanMoves = pgnParser.history();

    state.orientation = state.userColor;
    state.chess = new Chess(pgnParser.header().FEN || undefined);
    state.moveHistory = [];
    state.gameStates = [state.chess.fen()];
    state.highlightedSquares = [];

    sanMoves.forEach(san => {
        const move = state.chess.move(san);
        state.moveHistory.push(move);
        state.gameStates.push(state.chess.fen());
    });

    state.chess.load(state.gameStates[0]);
    state.currentMoveIndex = 0;

    $('searchSection').style.display = 'none';
    $('analyzerSection').classList.add('active');

    goToMove(0);
}

// ===== BOARD RENDERING =====

function renderBoard() {
    const board = state.chess.board();
    const boardElement = $('chessboard');
    boardElement.innerHTML = '';

    const flipBoard = state.orientation === 'b';

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
                const glyph = document.createElement('span');
                glyph.className = `piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`;
                glyph.textContent = PIECE_SYMBOLS[piece.type];
                square.appendChild(glyph);
                square.setAttribute('aria-label', `${squareName}: ${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`);
            }

            boardElement.appendChild(square);
        }
    }

    renderLabels(flipBoard);
    renderPlayers();
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

function playerName(color) {
    return state.currentGame[color === 'w' ? 'white' : 'black'].username;
}

function renderPlayers() {
    const bottom = state.orientation;
    for (const [id, color] of [['bottomPlayer', bottom], ['topPlayer', bottom === 'w' ? 'b' : 'w']]) {
        const player = state.currentGame[color === 'w' ? 'white' : 'black'];
        $(id).innerHTML = `<span class="player-dot ${color}"></span><strong>${escapeHtml(player.username)}</strong><span>${color === 'w' ? 'White' : 'Black'} · ${player.rating || 'Unrated'}</span>${state.chess.turn() === color && !state.chess.game_over() ? '<small>To move</small>' : ''}`;
    }
}

function moveLabel(index) {
    const move = state.moveHistory[index - 1];
    const number = state.gameStates[index - 1].split(' ')[5];
    return `${number}${move.color === 'w' ? '.' : '...'} ${move.san}`;
}

function updateMoveInfo() {
    const index = state.currentMoveIndex;
    const status = state.chess.in_checkmate() ? 'Checkmate' : state.chess.in_draw() ? 'Draw' : `${state.chess.turn() === 'w' ? 'White' : 'Black'} to move${state.chess.in_check() ? ' · Check' : ''}`;
    $('moveInfo').textContent = `${index ? moveLabel(index) + ' · ' + playerName(state.moveHistory[index - 1].color) + ' played' : 'Starting position'} — ${status}`;
    $('moveList').innerHTML = state.moveHistory.map((move, i) => `<button data-ply="${i + 1}" class="${i + 1 === index ? 'selected' : ''}" aria-current="${i + 1 === index ? 'step' : 'false'}">${moveLabel(i + 1)}</button>`).join('');
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
    if (!state.chess || index < 0 || index >= state.gameStates.length) return;
    state.analysisToken++;
    if (state.analysisWorker) { state.analysisWorker.terminate(); state.analysisWorker = null; }
    state.currentMoveIndex = index;
    state.chess = positionAt(index);
    const last = state.moveHistory[index - 1];
    state.highlightedSquares = last ? [last.from, last.to] : [];
    $('analyzeBtn').disabled = false;
    $('analyzeBtn').textContent = index ? 'Analyze this move' : 'Analyze position';
    $('analysisPanel').innerHTML = '<h3>Position review</h3><p>Analyze the selected move to compare it with the best alternative. Board highlights show the move just played.</p><p class="analysis-note">Local depth-3 engine · approximate analysis</p>';
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

function positionAt(index) {
    const game = new Chess(state.gameStates[0]);
    for (let i = 0; i < index; i++) game.move(state.moveHistory[i].san);
    return game;
}

function calculateReview(fen, moves) {
    const position = new Chess(fen);
    let best = null;
    let actual = null;
    moves.forEach((san, index) => {
        if (index === moves.length - 1) best = findBestMove(position);
        position.move(san);
    });
    if (moves.length) actual = minimax(position, ANALYSIS_DEPTH - 1, -Infinity, Infinity, position.turn() === 'w');
    const reply = findBestMove(position);
    return { reply, best, actual, evaluation: reply ? reply.evaluation : evaluatePosition(position) };
}

function analyzePosition() {
    if (!state.chess) return;
    const token = ++state.analysisToken;
    const index = state.currentMoveIndex;
    const btn = $('analyzeBtn');
    btn.disabled = true;
    btn.textContent = 'Analyzing…';
    $('analysisPanel').innerHTML = '<h3>Position review</h3><p class="loading">Analyzing…</p>';
    setTimeout(async () => {
        if (token !== state.analysisToken || !state.chess) return;
        try {
            const position = positionAt(index);
            const moves = state.moveHistory.slice(0, index).map(move => move.san);
            const result = typeof Worker === 'undefined'
                ? calculateReview(state.gameStates[0], moves)
                : await new Promise((resolve, reject) => {
                    const worker = new Worker(new URL('analysis-worker.js', document.querySelector('script[src$="script.js"]').src));
                    state.analysisWorker = worker;
                    worker.onmessage = event => {
                        worker.terminate();
                        state.analysisWorker = null;
                        event.data.error ? reject(new Error(event.data.error)) : resolve(event.data);
                    };
                    worker.onerror = error => { worker.terminate(); state.analysisWorker = null; reject(error); };
                    worker.postMessage({ fen: state.gameStates[0], moves });
                });
            if (token !== state.analysisToken) return;
            const { reply, evaluation, best, actual } = result;
            let review = '';
            if (index) {
                const played = state.moveHistory[index - 1];
                if (best) {
                    const loss = Math.max(0, (best.evaluation - actual) * (played.color === 'w' ? 1 : -1));
                    const quality = getMoveQuality(loss);
                    review = `<h4>${escapeHtml(moveLabel(index))} · ${escapeHtml(playerName(played.color))}</h4><div class="move-quality ${quality.className}">${quality.label}</div><p>${quality.explanation}</p><div class="best-move"><span class="best-move-label">Best alternative before this move</span><strong>${best.move.san}</strong></div>`;
                }
            }
            const score = Math.abs(evaluation) >= MATE_SCORE / 2 ? (evaluation > 0 ? 'White has forced mate' : 'Black has forced mate') : `${evaluation >= 0 ? '+' : ''}${evaluation.toFixed(2)}`;
            $('analysisPanel').innerHTML = `<h3>Position review</h3>${review}<div class="evaluation"><span class="eval-label">Current position</span><strong class="eval-value">${score}</strong></div><p class="explanation">Positive favours White; negative favours Black.</p><div class="best-move"><span class="best-move-label">${reply ? (position.turn() === 'w' ? 'White' : 'Black') + ' to move · suggested continuation' : 'Game over'}</span><strong>${reply ? reply.move.san : position.in_checkmate() ? 'Checkmate' : 'Draw'}</strong></div><p class="analysis-note">Local depth-${ANALYSIS_DEPTH} engine. Ratings are approximate, not a full engine review. Highlights show the played move.</p>`;
        } catch (error) {
            console.error(error);
            $('analysisPanel').innerHTML = '<h3>Position review</h3><p role="alert">Analysis failed. Please try again.</p>';
        } finally {
            if (token !== state.analysisToken) return;
            btn.disabled = false;
            btn.textContent = index ? 'Analyze this move' : 'Analyze position';
        }
    }, ANALYSIS_DELAY_MS);
}

// ===== NAVIGATION BACK TO SEARCH =====

function backToSearch() {
    $('searchSection').style.display = 'block';
    $('analyzerSection').classList.remove('active');
    state.currentGame = null;
    state.chess = null;
    state.highlightedSquares = [];
    state.analysisToken++;
    if (state.analysisWorker) { state.analysisWorker.terminate(); state.analysisWorker = null; }
    state.userColor = 'w';
}

// ===== INITIALIZATION =====

function init() {
    if (typeof Chess === 'undefined') {
        $('gamesListContainer').innerHTML = '<p role="alert">The chess library could not load. Check your connection and reload.</p>';
        $('searchBtn').disabled = true;
        return;
    }
    $('flipBtn').addEventListener('click', () => { state.orientation = state.orientation === 'w' ? 'b' : 'w'; renderBoard(); });
    $('moveList').addEventListener('click', event => { const button = event.target.closest('[data-ply]'); if (button) goToMove(Number(button.dataset.ply)); });
    document.addEventListener('keydown', event => {
        if (!state.chess || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
        const action = { ArrowLeft: previousMove, ArrowRight: nextMove, Home: firstMove, End: lastMove }[event.key];
        if (action) { event.preventDefault(); action(); }
    });
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

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);
