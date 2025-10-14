// Piece symbols for display
const pieceSymbols = {
    'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
    'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
};

// Piece values for evaluation
const pieceValues = {
    'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
};

// Global state
let currentGame = null;
let chess = null;
let moveHistory = [];
let currentMoveIndex = -1;
let previousEval = null;
let gameStates = [];
let highlightedSquares = [];

// ===== CHESS ENGINE =====

function evaluatePosition(game) {
    if (game.in_checkmate()) {
        return game.turn() === 'w' ? -100 : 100;
    }
    if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
        return 0;
    }

    let evaluation = 0;
    const board = game.board();
    
    // Material and positional evaluation
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (piece) {
                const value = pieceValues[piece.type];
                const multiplier = piece.color === 'w' ? 1 : -1;
                evaluation += value * multiplier;
                
                // Positional bonuses
                if (piece.type === 'p') {
                    const rank = piece.color === 'w' ? 7 - i : i;
                    evaluation += (rank * 0.1) * multiplier;
                }
                if (piece.type === 'n' || piece.type === 'b') {
                    const centerBonus = (3 - Math.abs(3.5 - i)) * (3 - Math.abs(3.5 - j)) * 0.05;
                    evaluation += centerBonus * multiplier;
                }
            }
        }
    }

    // Mobility bonus
    const moves = game.moves().length;
    evaluation += (game.turn() === 'w' ? moves : -moves) * 0.05;

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
    } else {
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
}

function findBestMove(game, depth = 3) {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestValue = -Infinity;
    const isWhite = game.turn() === 'w';

    for (const move of moves) {
        game.move(move);
        const value = isWhite ? 
            -minimax(game, depth - 1, -Infinity, Infinity, false) :
            minimax(game, depth - 1, -Infinity, Infinity, true);
        game.undo();

        if (value > bestValue) {
            bestValue = value;
            bestMove = move;
        }
    }

    return { move: bestMove, evaluation: bestValue };
}

// ===== GAME SEARCH =====

async function searchGames() {
    const username = document.getElementById('usernameInput').value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }

    const btn = document.getElementById('searchBtn');
    btn.disabled = true;
    btn.textContent = 'Loading...';

    const container = document.getElementById('gamesListContainer');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Fetching games...</p></div>';

    try {
        const response = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
        if (!response.ok) throw new Error('Player not found');
        
        const data = await response.json();
        const latestArchive = data.archives[data.archives.length - 1];
        
        const gamesResponse = await fetch(latestArchive);
        const gamesData = await gamesResponse.json();
        
        displayGames(gamesData.games.slice(-20).reverse());
    } catch (error) {
        container.innerHTML = `<p style="color: #ff4444;">Error: ${error.message}. Please check the username and try again.</p>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Search Games';
    }
}

function displayGames(games) {
    const container = document.getElementById('gamesListContainer');
    if (games.length === 0) {
        container.innerHTML = '<p>No games found.</p>';
        return;
    }

    const html = games.map((game, index) => {
        const white = game.white.username;
        const black = game.black.username;
        const result = game.white.result;
        const date = new Date(game.end_time * 1000).toLocaleDateString();
        
        return `
            <div class="game-card" onclick="loadGame(${index})">
                <div class="game-card-header">
                    <h3>${white} vs ${black}</h3>
                </div>
                <div class="game-card-details">
                    <p><span class="label">Result:</span> ${result}</p>
                    <p><span class="label">Time:</span> ${game.time_class}</p>
                    <p><span class="label">Date:</span> ${date}</p>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="games-list">${html}</div>`;
    window.gamesCache = games;
}

// ===== GAME LOADING =====

function loadGame(index) {
    currentGame = window.gamesCache[index];
    chess = new Chess();
    moveHistory = [];
    gameStates = [];
    currentMoveIndex = -1;
    previousEval = null;
    highlightedSquares = [];

    const pgn = currentGame.pgn;
    chess.load_pgn(pgn);
    
    const history = chess.history({ verbose: true });
    chess.reset();
    
    gameStates.push(chess.fen());
    history.forEach(move => {
        chess.move(move);
        moveHistory.push(move);
        gameStates.push(chess.fen());
    });
    
    chess.reset();
    currentMoveIndex = 0;

    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('analyzerSection').classList.add('active');
    
    renderBoard();
    updateMoveInfo();
    updateButtons();
    document.getElementById('analysisPanel').innerHTML = '<h3>Move Analysis</h3><p style="color: #888888;">Navigate through the game and click "Analyze Position" to get AI analysis.</p>';
}

// ===== BOARD RENDERING =====

function renderBoard() {
    const board = chess.board();
    const boardElement = document.getElementById('chessboard');
    boardElement.innerHTML = '';

    // Render squares and pieces
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
            const squareName = files[col] + ranks[row];
            
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.square = squareName;
            
            // Check if this square should be highlighted
            if (highlightedSquares.includes(squareName)) {
                square.classList.add('highlight');
            }
            
            const piece = board[row][col];
            if (piece) {
                square.textContent = pieceSymbols[piece.color === 'w' ? piece.type.toUpperCase() : piece.type];
            }
            
            boardElement.appendChild(square);
        }
    }

    // Render labels
    renderLabels();
}

function renderLabels() {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    // File labels (a-h) below the board
    const fileLabels = document.getElementById('fileLabels');
    fileLabels.innerHTML = '';
    files.forEach(file => {
        const span = document.createElement('span');
        span.textContent = file;
        fileLabels.appendChild(span);
    });

    // Rank labels (8-1) to the left of the board
    const rankLabels = document.getElementById('rankLabels');
    rankLabels.innerHTML = '';
    ranks.forEach(rank => {
        const div = document.createElement('div');
        div.textContent = rank;
        rankLabels.appendChild(div);
    });
}

function updateMoveInfo() {
    const info = document.getElementById('moveInfo');
    if (currentMoveIndex === 0) {
        info.textContent = 'Move 0: Starting Position';
    } else {
        const move = moveHistory[currentMoveIndex - 1];
        const moveNum = Math.ceil(currentMoveIndex / 2);
        const color = currentMoveIndex % 2 === 1 ? 'White' : 'Black';
        info.textContent = `Move ${moveNum}: ${color} plays ${move.san}`;
    }
}

function updateButtons() {
    document.getElementById('firstBtn').disabled = currentMoveIndex === 0;
    document.getElementById('prevBtn').disabled = currentMoveIndex === 0;
    document.getElementById('nextBtn').disabled = currentMoveIndex >= moveHistory.length;
    document.getElementById('lastBtn').disabled = currentMoveIndex >= moveHistory.length;
}

// ===== NAVIGATION =====

function firstMove() {
    currentMoveIndex = 0;
    chess.load(gameStates[currentMoveIndex]);
    highlightedSquares = [];
    renderBoard();
    updateMoveInfo();
    updateButtons();
}

function previousMove() {
    if (currentMoveIndex > 0) {
        currentMoveIndex--;
        chess.load(gameStates[currentMoveIndex]);
        highlightedSquares = [];
        renderBoard();
        updateMoveInfo();
        updateButtons();
    }
}

function nextMove() {
    if (currentMoveIndex < moveHistory.length) {
        currentMoveIndex++;
        chess.load(gameStates[currentMoveIndex]);
        highlightedSquares = [];
        renderBoard();
        updateMoveInfo();
        updateButtons();
    }
}

function lastMove() {
    currentMoveIndex = moveHistory.length;
    chess.load(gameStates[currentMoveIndex]);
    highlightedSquares = [];
    renderBoard();
    updateMoveInfo();
    updateButtons();
}

// ===== ANALYSIS =====

function analyzePosition() {
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = true;
    btn.textContent = 'Analyzing...';

    const panel = document.getElementById('analysisPanel');
    panel.innerHTML = '<h3>Move Analysis</h3><div class="loading"><div class="spinner"></div><p>Analyzing position...</p></div>';

    setTimeout(() => {
        try {
            const result = findBestMove(chess, 3);
            
            if (!result) {
                panel.innerHTML = '<h3>Move Analysis</h3><div class="analysis-result"><p>Game is over or no moves available.</p></div>';
                btn.disabled = false;
                btn.textContent = '🔍 Analyze Position';
                return;
            }

            const evaluation = result.evaluation;
            const bestMove = result.move;
            
            // Highlight the best move on the board
            highlightedSquares = [bestMove.from, bestMove.to];
            renderBoard();
            
            displayAnalysis(evaluation, bestMove);
            btn.disabled = false;
            btn.textContent = '🔍 Analyze Position';
        } catch (error) {
            console.error('Analysis error:', error);
            panel.innerHTML = '<h3>Move Analysis</h3><div class="analysis-result"><p style="color: #ff4444;">Analysis error. Please try again.</p></div>';
            btn.disabled = false;
            btn.textContent = '🔍 Analyze Position';
        }
    }, 50);
}

function displayAnalysis(evaluation, bestMove) {
    const panel = document.getElementById('analysisPanel');

    const evalClass = evaluation > 0 ? 'positive' : 'negative';
    const evalText = Math.abs(evaluation) >= 50 ? 
        (evaluation > 0 ? 'Mate for White' : 'Mate for Black') :
        `${evaluation > 0 ? '+' : ''}${evaluation.toFixed(2)}`;

    let moveQuality = '';
    let moveQualityClass = '';
    let explanation = '';

    if (currentMoveIndex > 0 && previousEval !== null) {
        const evalDiff = Math.abs(evaluation - previousEval);

        if (evalDiff < 0.3) {
            moveQuality = '✓ Excellent Move';
            moveQualityClass = 'excellent';
            explanation = 'This is the best or near-best move in the position.';
        } else if (evalDiff < 0.8) {
            moveQuality = '✓ Good Move';
            moveQualityClass = 'good';
            explanation = 'A solid move with minimal loss of advantage.';
        } else if (evalDiff < 1.5) {
            moveQuality = '!? Inaccuracy';
            moveQualityClass = 'inaccuracy';
            explanation = 'Not the best move, but not terrible. Small advantage lost.';
        } else if (evalDiff < 3.0) {
            moveQuality = '? Mistake';
            moveQualityClass = 'mistake';
            explanation = 'A significant error. Considerable advantage lost.';
        } else {
            moveQuality = '?? Blunder';
            moveQualityClass = 'blunder';
            explanation = 'A serious mistake that greatly worsens the position.';
        }
    }

    previousEval = evaluation;

    const bestMoveStr = bestMove.san || `${bestMove.from} → ${bestMove.to}`;

    let html = '<h3>Move Analysis</h3>';
    html += '<div class="analysis-result">';
    html += `<div class="evaluation ${evalClass}">
                <span class="eval-label">Evaluation:</span>
                <span class="eval-value">${evalText}</span>
             </div>`;
    
    if (moveQuality) {
        html += `<div class="move-quality ${moveQualityClass}">${moveQuality}</div>`;
        html += `<p class="explanation">${explanation}</p>`;
    }
    
    html += `<div class="best-move">
                <span class="best-move-label">Best move:</span>
                <span class="best-move-value">${bestMoveStr}</span>
                <span class="best-move-squares">${bestMove.from} → ${bestMove.to}</span>
             </div>`;
    html += `<p class="analysis-note">Fast AI analysis (depth 3) • Green squares show best move</p>`;
    html += '</div>';

    panel.innerHTML = html;
}

// ===== UTILITY =====

function backToSearch() {
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('analyzerSection').classList.remove('active');
    currentGame = null;
    chess = null;
    previousEval = null;
    highlightedSquares = [];
}

// Enter key to search
document.getElementById('usernameInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchGames();
    }
});