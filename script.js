const pieceSymbols = {
            'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
            'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
        };

        let currentGame = null;
        let chess = null;
        let moveHistory = [];
        let currentMoveIndex = -1;
        let stockfish = null;
        let previousEval = null;
        let gameStates = [];

        // Initialize Stockfish
        function initStockfish() {
            try {
                stockfish = new Worker('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
                stockfish.postMessage('uci');
                stockfish.postMessage('setoption name Hash value 16');
                stockfish.postMessage('setoption name Threads value 1');
                stockfish.postMessage('isready');
            } catch (e) {
                console.error('Stockfish initialization error:', e);
            }
        }

        initStockfish();

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

        function loadGame(index) {
            currentGame = window.gamesCache[index];
            chess = new Chess();
            moveHistory = [];
            gameStates = [];
            currentMoveIndex = -1;
            previousEval = null;

            // Parse PGN
            const pgn = currentGame.pgn;
            chess.load_pgn(pgn);
            
            // Extract moves
            const history = chess.history({ verbose: true });
            chess.reset();
            
            // Store each position
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
            document.getElementById('analysisPanel').innerHTML = '<h3>Move Analysis</h3><p style="color: #666;">Navigate through the game and click "Analyze Position" to get Stockfish analysis.</p>';
        }

        function renderBoard() {
            const board = chess.board();
            const boardElement = document.getElementById('chessboard');
            boardElement.innerHTML = '';

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

        function analyzePosition() {
            const btn = document.getElementById('analyzeBtn');
            btn.disabled = true;
            btn.textContent = 'Analyzing...';

            const panel = document.getElementById('analysisPanel');
            panel.innerHTML = '<h3>Move Analysis</h3><div class="loading"><div class="spinner"></div><p>Analyzing position with Stockfish...</p></div>';

            const fen = chess.fen();
            let bestMove = '';
            let evaluation = 0;
            let analysisTimeout;

            // Safety timeout - if no response in 3 seconds, show what we have
            analysisTimeout = setTimeout(() => {
                if (!bestMove) {
                    displayAnalysis(evaluation || 0, 'timeout');
                    btn.disabled = false;
                    btn.textContent = 'Analyze Position';
                }
            }, 3000);

            const messageHandler = function(event) {
                const line = event.data;
                
                if (line.includes('bestmove')) {
                    clearTimeout(analysisTimeout);
                    bestMove = line.split(' ')[1];
                    displayAnalysis(evaluation, bestMove);
                    btn.disabled = false;
                    btn.textContent = 'Analyze Position';
                    stockfish.removeEventListener('message', messageHandler);
                }
                
                if (line.includes('score cp')) {
                    const match = line.match(/score cp (-?\d+)/);
                    if (match) {
                        evaluation = parseInt(match[1]) / 100;
                    }
                } else if (line.includes('score mate')) {
                    const match = line.match(/score mate (-?\d+)/);
                    if (match) {
                        evaluation = match[1] > 0 ? 1000 : -1000;
                    }
                }
            };

            stockfish.addEventListener('message', messageHandler);
            stockfish.postMessage(`position fen ${fen}`);
            stockfish.postMessage(`go movetime 500`); // Reduced to 500ms for faster response
        }

        function displayAnalysis(evaluation, bestMove) {
            const panel = document.getElementById('analysisPanel');
            
            if (bestMove === 'timeout') {
                panel.innerHTML = '<h3>Move Analysis</h3><div class="analysis-result"><p style="color: #dc3545;">Analysis timed out. Stockfish may be loading slowly. Try again in a moment.</p></div>';
                return;
            }

            const evalClass = evaluation > 0 ? 'positive' : 'negative';
            const evalText = Math.abs(evaluation) >= 1000 ? 
                (evaluation > 0 ? 'Mate for White' : 'Mate for Black') :
                `${evaluation > 0 ? '+' : ''}${evaluation.toFixed(2)}`;

            let moveQuality = '';
            let moveQualityClass = '';
            let explanation = '';

            if (currentMoveIndex > 0 && previousEval !== null) {
                const evalDiff = Math.abs(evaluation - previousEval);
                const turn = moveHistory[currentMoveIndex - 1].color;
                const actualDiff = turn === 'w' ? (previousEval - evaluation) : (evaluation - previousEval);

                if (evalDiff < 0.2) {
                    moveQuality = 'Excellent Move';
                    moveQualityClass = 'excellent';
                    explanation = 'This is the best or near-best move in the position.';
                } else if (evalDiff < 0.5) {
                    moveQuality = 'Good Move';
                    moveQualityClass = 'good';
                    explanation = 'A solid move with minimal loss of advantage.';
                } else if (evalDiff < 1.0) {
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

            const bestMoveStr = formatMove(bestMove);

            let html = '<h3>Move Analysis</h3>';
            html += '<div class="analysis-result">';
            html += `<div class="evaluation ${evalClass}">Evaluation: ${evalText}</div>`;
            
            if (moveQuality) {
                html += `<div class="move-quality ${moveQualityClass}">${moveQuality}</div>`;
                html += `<p style="margin-top: 10px;">${explanation}</p>`;
            }
            
            html += `<div class="best-move"><strong>Best continuation:</strong> ${bestMoveStr}</div>`;
            html += `<p style="color: #666; margin-top: 10px; font-size: 12px;">Analysis depth: ~500ms</p>`;
            html += '</div>';

            panel.innerHTML = html;
        }

        function formatMove(move) {
            if (!move || move.length < 4) return move;
            const from = move.substring(0, 2);
            const to = move.substring(2, 4);
            return `${from} → ${to}`;
        }

        function backToSearch() {
            document.getElementById('searchSection').style.display = 'block';
            document.getElementById('analyzerSection').classList.remove('active');
            currentGame = null;
            chess = null;
            previousEval = null;
        }

        // Allow Enter key to search
        document.getElementById('usernameInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchGames();
            }
        });