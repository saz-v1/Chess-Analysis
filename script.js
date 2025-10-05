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
        container.innerHTML = `<p style="color: red;">Error: ${error.message}. Please check the username and try again.</p>`;
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
                <h3>${white} vs ${black}</h3>
                <p>Result: ${result}</p>
                <p>Time Control: ${game.time_class}</p>
                <p>Date: ${date}</p>
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
    document.getElementById('analysisPanel').innerHTML = '<h3>Move Analysis</h3><p style="color: #666;">Navigate through the game and click "Analyze Position" to get AI analysis.</p>';
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
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            
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
    const letters = ['a','b','c','d','e','f','g','h'];
    const numbers = [8,7,6,5,4,3,2,1];

    // Letters under the board
    const lettersRow = document.getElementById('lettersRow');
    lettersRow.innerHTML = '';
    letters.forEach(l => {
        const span = document.createElement('span');
        span.textContent = l;
        span.style.flex = '1';
        span.style.textAlign = 'center';
        lettersRow.appendChild(span);
    });

    // Numbers on the left
    const numbersCol = document.getElementById('numbersColumn');
    numbersCol.innerHTML = '';
    numbers.forEach(n => {
        const div = document.createElement('div');
        div.textContent = n;
        div.style.flex = '1';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        numbersCol.appendChild(div);
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
    renderBoard();
    updateMoveInfo();
    updateButtons();
}

function previousMove() {
    if (currentMoveIndex > 0) {
        currentMoveIndex--;
        chess.load(gameStates[currentMoveIndex]);
        renderBoard();
        updateMoveInfo();
        updateButtons();
    }
}

function nextMove() {
    if (currentMoveIndex < moveHistory.length) {
        currentMoveIndex++;
        chess.load(gameStates[currentMoveIndex]);
        renderBoard();
        updateMoveInfo();
        updateButtons();
    }
}

function lastMove() {
    currentMoveIndex = moveHistory.length;
    chess.load(gameStates[currentMoveIndex]);
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
                btn.textContent = 'Analyze Position';
                return;
            }

            const evaluation = result.evaluation;
            const bestMove = result.move;
            
            displayAnalysis(evaluation, bestMove);
            btn.disabled = false;
            btn.textContent = 'Analyze Position';
        } catch (error) {
            console.error('Analysis error:', error);
            panel.innerHTML = '<h3>Move Analysis</h3><div class="analysis-result"><p style="color: #dc3545;">Analysis error. Please try again.</p></div>';
            btn.disabled = false;
            btn.textContent = 'Analyze Position';
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
            moveQuality = 'Excellent Move';
            moveQualityClass = 'excellent';
            explanation = 'This is the best or near-best move in the position.';
        } else if (evalDiff < 0.8) {
            moveQuality = 'Good Move';
            moveQualityClass = 'good';
            explanation = 'A solid move with minimal loss of advantage.';
        } else if (evalDiff < 1.5) {
            moveQuality = 'Inaccuracy';
            moveQualityClass = 'inaccuracy';
            explanation = 'Not the best move, but not terrible. Small advantage lost.';
        } else if (evalDiff < 3.0) {
            moveQuality = 'Mistake';
            moveQualityClass = 'mistake';
            explanation = 'A significant error. Considerable advantage lost.';
        } else {
            moveQuality = 'Blunder';
            moveQualityClass = 'blunder';
            explanation = 'A serious mistake that greatly worsens the position.';
        }
    }

    previousEval = evaluation;

    const bestMoveStr = bestMove.san || `${bestMove.from} → ${bestMove.to}`;

    let html = '<h3>Move Analysis</h3>';
    html += '<div class="analysis-result">';
    html += `<div class="evaluation ${evalClass}">Evaluation: ${evalText}</div>`;
    
    if (moveQuality) {
        html += `<div class="move-quality ${moveQualityClass}">${moveQuality}</div>`;
        html += `<p style="margin-top: 10px;">${explanation}</p>`;
    }
    
    html += `<div class="best-move"><strong>Best move:</strong> ${bestMoveStr}</div>`;
    html += `<p style="color: #666; margin-top: 10px; font-size: 12px;">Fast AI analysis (depth 3)</p>`;
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
}

// Enter key to search
document.getElementById('usernameInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchGames();
    }
});