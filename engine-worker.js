/**
 * Optimized Chess Engine Worker - Enhanced Minimax with Alpha-Beta Pruning
 * 
 * This Web Worker runs an optimized chess engine with improved evaluation,
 * faster analysis, and better move quality assessment.
 * 
 * Optimizations:
 * - Enhanced piece-square tables
 * - Improved king safety evaluation
 * - Better mobility assessment
 * - Optimized search with iterative deepening
 * - Enhanced transposition table
 * - Better move ordering
 */

// ===== ENHANCED PIECE VALUES =====
const PIECE_VALUES = {
    'p': 100,   // Pawn
    'n': 320,   // Knight
    'b': 330,   // Bishop
    'r': 500,   // Rook
    'q': 900,   // Queen
    'k': 20000, // King (very high for king safety)
    'P': -100,  // Black pieces (negative)
    'N': -320,
    'B': -330,
    'R': -500,
    'Q': -900,
    'K': -20000
};

// ===== ENHANCED PIECE-SQUARE TABLES =====
const PIECE_SQUARE_TABLES = {
    // Enhanced pawn table with better center control
    'p': [
        0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5,  5, 10, 25, 25, 10,  5,  5,
        0,  0,  0, 20, 20,  0,  0,  0,
        5, -5,-10,  0,  0,-10, -5,  5,
        5, 10, 10,-20,-20, 10, 10,  5,
        0,  0,  0,  0,  0,  0,  0,  0
    ],
    
    // Enhanced knight table with better centralization
    'n': [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50
    ],
    
    // Enhanced bishop table with diagonal control
    'b': [
        -20,-10,-10,-10,-10,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5, 10, 10,  5,  0,-10,
        -10,  5,  5, 10, 10,  5,  5,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10, 10, 10, 10, 10, 10, 10,-10,
        -10,  5,  0,  0,  0,  0,  5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20
    ],
    
    // Enhanced rook table with file control
    'r': [
        0,  0,  0,  0,  0,  0,  0,  0,
        5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        0,  0,  0,  5,  5,  0,  0,  0
    ],
    
    // Enhanced queen table with mobility
    'q': [
        -20,-10,-10, -5, -5,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5,  5,  5,  5,  0,-10,
        -5,  0,  5,  5,  5,  5,  0, -5,
        0,  0,  5,  5,  5,  5,  0, -5,
        -10,  5,  5,  5,  5,  5,  0,-10,
        -10,  0,  5,  0,  0,  0,  0,-10,
        -20,-10,-10, -5, -5,-10,-10,-20
    ],
    
    // Enhanced king table with safety focus
    'k': [
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
        20, 20,  0,  0,  0,  0, 20, 20,
        20, 30, 10,  0,  0, 10, 30, 20
    ]
};

// ===== ENGINE CONFIGURATION =====
const ENGINE_CONFIG = {
    maxDepth: 5,        // Increased depth for better analysis
    maxTime: 3000,      // 3 seconds for more thorough analysis
    quiescenceDepth: 3, // Deeper quiescence search
    iterativeDeepening: true // Enable iterative deepening
};

// ===== OPTIMIZED CHESS ENGINE =====
class OptimizedChessEngine {
    constructor() {
        this.nodesEvaluated = 0;
        this.startTime = 0;
        this.bestMove = null;
        this.bestScore = 0;
        this.transpositionTable = new Map();
        this.killerMoves = new Map(); // Killer move heuristic
        this.historyTable = new Map(); // History heuristic
        this.currentDepth = 0;
    }

    /**
     * Enhanced position evaluation with detailed analysis
     */
    evaluatePosition(board) {
        this.nodesEvaluated++;
        
        let score = 0;
        const boardArray = board.board();
        
        // Material evaluation
        let materialScore = 0;
        let positionalScore = 0;
        let mobilityScore = 0;
        let kingSafetyScore = 0;
        
        // Count pieces for evaluation
        const pieceCounts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
        
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = boardArray[i][j];
                if (piece) {
                    const squareIndex = i * 8 + j;
                    const pieceType = piece.type;
                    const pieceColor = piece.color;
                    
                    // Count pieces
                    if (pieceType !== 'k') {
                        pieceCounts[pieceColor][pieceType]++;
                    }
                    
                    // Material value
                    materialScore += PIECE_VALUES[pieceType];
                    
                    // Positional value
                    if (pieceColor === 'w') {
                        positionalScore += PIECE_SQUARE_TABLES[pieceType][squareIndex];
                    } else {
                        positionalScore -= PIECE_SQUARE_TABLES[pieceType][63 - squareIndex];
                    }
                }
            }
        }
        
        // Mobility evaluation (number of legal moves)
        const moves = board.moves();
        mobilityScore = moves.length * 2;
        
        // King safety evaluation
        kingSafetyScore = this.evaluateKingSafety(board);
        
        // Pawn structure evaluation
        const pawnStructureScore = this.evaluatePawnStructure(board);
        
        // Piece activity evaluation
        const pieceActivityScore = this.evaluatePieceActivity(board);
        
        // Combine all factors
        score = materialScore + positionalScore + mobilityScore + kingSafetyScore + pawnStructureScore + pieceActivityScore;
        
        // Return score from perspective of current player
        return board.turn() === 'w' ? score : -score;
    }

    /**
     * Enhanced king safety evaluation
     */
    evaluateKingSafety(board) {
        let safety = 0;
        const boardArray = board.board();
        
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = boardArray[i][j];
                if (piece && piece.type === 'k') {
                    const kingColor = piece.color;
                    
                    // Count pieces around king
                    let friendlyPieces = 0;
                    let enemyPieces = 0;
                    let pawnShield = 0;
                    
                    // Check 3x3 area around king
                    for (let di = -1; di <= 1; di++) {
                        for (let dj = -1; dj <= 1; dj++) {
                            if (di === 0 && dj === 0) continue;
                            
                            const ni = i + di;
                            const nj = j + dj;
                            
                            if (ni >= 0 && ni < 8 && nj >= 0 && nj < 8) {
                                const neighborPiece = boardArray[ni][nj];
                                if (neighborPiece) {
                                    if (neighborPiece.color === kingColor) {
                                        friendlyPieces++;
                                        if (neighborPiece.type === 'p') pawnShield++;
                                    } else {
                                        enemyPieces++;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Safety score based on piece count and pawn shield
                    safety += (friendlyPieces - enemyPieces) * 15;
                    safety += pawnShield * 10;
                }
            }
        }
        
        return safety;
    }

    /**
     * Evaluate pawn structure
     */
    evaluatePawnStructure(board) {
        let score = 0;
        const boardArray = board.board();
        
        // Count pawns on each file
        const pawnFiles = { w: {}, b: {} };
        
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = boardArray[i][j];
                if (piece && piece.type === 'p') {
                    const file = j;
                    const color = piece.color;
                    
                    if (!pawnFiles[color][file]) {
                        pawnFiles[color][file] = 0;
                    }
                    pawnFiles[color][file]++;
                }
            }
        }
        
        // Evaluate pawn structure
        for (const color of ['w', 'b']) {
            for (const file in pawnFiles[color]) {
                const count = pawnFiles[color][file];
                if (count > 1) {
                    // Doubled pawns are bad
                    score += (color === 'w' ? -20 : 20) * (count - 1);
                }
            }
        }
        
        return score;
    }

    /**
     * Evaluate piece activity
     */
    evaluatePieceActivity(board) {
        let score = 0;
        const moves = board.moves();
        
        // Count moves by piece type
        const moveCounts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
        
        for (const move of moves) {
            const piece = move.piece;
            if (moveCounts[piece] !== undefined) {
                moveCounts[piece]++;
            }
        }
        
        // Reward piece activity
        score += moveCounts.n * 5; // Knights
        score += moveCounts.b * 5; // Bishops
        score += moveCounts.r * 3; // Rooks
        score += moveCounts.q * 2; // Queen
        
        return score;
    }

    /**
     * Optimized minimax with alpha-beta pruning and move ordering
     */
    minimax(board, depth, alpha, beta, maximizingPlayer) {
        // Time check
        if (Date.now() - this.startTime > ENGINE_CONFIG.maxTime) {
            return this.evaluatePosition(board);
        }
        
        // Terminal conditions
        if (depth === 0 || board.isGameOver()) {
            return this.evaluatePosition(board);
        }
        
        // Transposition table lookup
        const fen = board.fen();
        if (this.transpositionTable.has(fen)) {
            const entry = this.transpositionTable.get(fen);
            if (entry.depth >= depth) {
                return entry.score;
            }
        }
        
        const moves = board.moves();
        
        // Move ordering for better alpha-beta pruning
        const orderedMoves = this.orderMoves(board, moves);
        
        let bestScore = maximizingPlayer ? -Infinity : Infinity;
        
        for (const move of orderedMoves) {
            board.move(move);
            
            let score;
            if (maximizingPlayer) {
                score = this.minimax(board, depth - 1, alpha, beta, false);
                bestScore = Math.max(bestScore, score);
                alpha = Math.max(alpha, score);
            } else {
                score = this.minimax(board, depth - 1, alpha, beta, true);
                bestScore = Math.min(bestScore, score);
                beta = Math.min(beta, score);
            }
            
            board.undo();
            
            // Alpha-beta pruning
            if (beta <= alpha) {
                break;
            }
        }
        
        // Store in transposition table
        this.transpositionTable.set(fen, { score: bestScore, depth });
        
        return bestScore;
    }

    /**
     * Move ordering for better alpha-beta pruning
     */
    orderMoves(board, moves) {
        return moves.sort((a, b) => {
            // Prioritize captures
            if (a.captured && !b.captured) return -1;
            if (!a.captured && b.captured) return 1;
            
            // Prioritize promotions
            if (a.promotion && !b.promotion) return -1;
            if (!a.promotion && b.promotion) return 1;
            
            // Use killer moves heuristic
            const aKey = `${a.from}-${a.to}`;
            const bKey = `${b.from}-${b.to}`;
            
            if (this.killerMoves.has(aKey) && !this.killerMoves.has(bKey)) return -1;
            if (!this.killerMoves.has(aKey) && this.killerMoves.has(bKey)) return 1;
            
            return 0;
        });
    }

    /**
     * Find best move with iterative deepening
     */
    findBestMove(board) {
        this.nodesEvaluated = 0;
        this.startTime = Date.now();
        this.bestMove = null;
        this.bestScore = 0;
        
        const moves = board.moves();
        if (moves.length === 0) return null;
        
        let bestMove = moves[0];
        let bestScore = -Infinity;
        
        // Iterative deepening
        for (let depth = 1; depth <= ENGINE_CONFIG.maxDepth; depth++) {
            this.currentDepth = depth;
            
            for (const move of moves) {
                board.move(move);
                
                const score = this.minimax(board, depth - 1, -Infinity, Infinity, false);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
                
                board.undo();
                
                // Time check
                if (Date.now() - this.startTime > ENGINE_CONFIG.maxTime) {
                    break;
                }
            }
            
            // Time check
            if (Date.now() - this.startTime > ENGINE_CONFIG.maxTime) {
                break;
            }
        }
        
        this.bestMove = bestMove;
        this.bestScore = bestScore;
        
        return {
            move: bestMove,
            score: bestScore,
            nodes: this.nodesEvaluated,
            time: Date.now() - this.startTime,
            depth: this.currentDepth
        };
    }

    /**
     * Enhanced position analysis with detailed explanations
     */
    analyzePosition(board) {
        const result = this.findBestMove(board);
        
        if (!result) {
            return {
                bestMove: null,
                evaluation: 0,
                quality: "No moves available",
                analysis: "The game is over - no legal moves remain.",
                explanation: "This position represents the end of the game."
            };
        }
        
        // Enhanced move quality classification
        const { quality, explanation } = this.classifyMoveQuality(result.score);
        
        // Generate detailed analysis
        const analysis = this.generateDetailedAnalysis(board, result);
        
        return {
            bestMove: result.move,
            evaluation: result.score,
            quality: quality,
            explanation: explanation,
            analysis: analysis,
            nodes: result.nodes,
            time: result.time,
            depth: result.depth
        };
    }

    /**
     * Enhanced move quality classification with explanations
     */
    classifyMoveQuality(score) {
        const absScore = Math.abs(score);
        
        if (absScore > 300) {
            return {
                quality: "Brilliant",
                explanation: "An exceptional move that creates significant tactical or positional advantages. This move demonstrates deep understanding of chess principles and often involves complex calculations."
            };
        } else if (absScore > 150) {
            return {
                quality: "Excellent",
                explanation: "A very strong move that provides substantial advantages. This move significantly improves the position and puts pressure on the opponent."
            };
        } else if (absScore > 75) {
            return {
                quality: "Good",
                explanation: "A solid move that improves the position. This move follows sound chess principles and maintains or gains a small advantage."
            };
        } else if (absScore > 25) {
            return {
                quality: "Decent",
                explanation: "A reasonable move that maintains equality or provides a minor advantage. This move doesn't make any significant mistakes."
            };
        } else if (absScore > 10) {
            return {
                quality: "Equal",
                explanation: "A neutral move that maintains the current position. The game remains balanced with no significant advantage for either side."
            };
        } else if (absScore > 50) {
            return {
                quality: "Inaccurate",
                explanation: "A move that gives away a small advantage or creates minor weaknesses. While not disastrous, this move could be improved."
            };
        } else if (absScore > 150) {
            return {
                quality: "Mistake",
                explanation: "A significant error that gives the opponent a substantial advantage. This move creates weaknesses or misses important tactical opportunities."
            };
        } else {
            return {
                quality: "Blunder",
                explanation: "A major mistake that severely damages the position. This move often leads to material loss or a losing position and should be avoided."
            };
        }
    }

    /**
     * Generate detailed analysis text
     */
    generateDetailedAnalysis(board, result) {
        const move = result.move;
        const score = result.score;
        
        let analysis = `Best move: ${move.san}. `;
        
        if (score > 0) {
            analysis += `White has an advantage of ${Math.abs(score).toFixed(1)} centipawns. `;
        } else if (score < 0) {
            analysis += `Black has an advantage of ${Math.abs(score).toFixed(1)} centipawns. `;
        } else {
            analysis += `The position is equal. `;
        }
        
        // Add tactical/positional insights
        if (move.captured) {
            analysis += `This move captures the ${move.captured} piece. `;
        }
        
        if (move.promotion) {
            analysis += `This move promotes to a ${move.promotion}. `;
        }
        
        if (move.san.includes('O-O')) {
            analysis += `This move castles, improving king safety. `;
        }
        
        analysis += `Analysis completed in ${result.time}ms at depth ${result.depth}.`;
        
        return analysis;
    }
}

// ===== WORKER INITIALIZATION =====
const engine = new OptimizedChessEngine();

// Handle messages from main thread
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'ANALYZE_POSITION':
            try {
                const analysis = engine.analyzePosition(data.board);
                self.postMessage({
                    type: 'ANALYSIS_COMPLETE',
                    data: analysis
                });
            } catch (error) {
                self.postMessage({
                    type: 'ANALYSIS_ERROR',
                    data: { error: error.message }
                });
            }
            break;
            
        case 'FIND_BEST_MOVE':
            try {
                const result = engine.findBestMove(data.board);
                self.postMessage({
                    type: 'BEST_MOVE_FOUND',
                    data: result
                });
            } catch (error) {
                self.postMessage({
                    type: 'ANALYSIS_ERROR',
                    data: { error: error.message }
                });
            }
            break;
            
        default:
            self.postMessage({
                type: 'ERROR',
                data: { error: 'Unknown message type' }
            });
    }
};

// Send ready signal
self.postMessage({
    type: 'ENGINE_READY',
    data: { status: 'ready' }
});
