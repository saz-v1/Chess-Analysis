# ♔ Chess.com Game Analyzer

A free, browser-based tool for analyzing your Chess.com games with AI-powered move evaluation. Get detailed game reviews without needing a Chess.com subscription.

![Chess.com Game Analyzer](./screenshot-main.png)

## 🎯 Overview

Chess.com Game Analyzer allows any Chess.com player to review their games with intelligent move analysis. Simply enter your username, select a game, and navigate through each move to receive instant feedback on move quality, position evaluation, and best move suggestions.

**Why this exists:** Chess.com's game review feature requires a paid subscription. This tool provides similar functionality completely free, making chess improvement accessible to everyone.

## ✨ Features

- **🔍 Game Search** - Fetch your recent Chess.com games by username
- **📊 Move-by-Move Analysis** - Navigate through your games position by position
- **🤖 AI Evaluation** - Fast minimax algorithm evaluates each position
- **📈 Move Quality Rating** - Classifies moves as Excellent, Good, Inaccuracy, Mistake, or Blunder
- **💡 Best Move Suggestions** - Shows the optimal move with visual highlighting on the board
- **🎨 Interactive Chessboard** - Visual board with coordinate labels and piece positioning
- **⚡ Fast & Free** - No login required, instant analysis, zero cost

![Game Analysis](./screenshot-analysis.png)

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection to fetch games from Chess.com API
- A Chess.com account with games played

### Usage

1. **Enter Username** - Type your Chess.com username in the search box
2. **Select a Game** - Click on any game from your recent matches (last 20 games shown)
3. **Navigate Moves** - Use the Previous/Next buttons to step through the game
4. **Analyze Position** - Click "Analyze Position" to get AI evaluation
5. **Review Suggestions** - Green highlighted squares show the best move to play

![Navigation](./screenshot-board.png)

## 🎮 Controls

| Button | Function |
|--------|----------|
| **← Previous** | Go back one move |
| **Next →** | Advance one move |
| **⏮ First** | Jump to starting position |
| **Last ⏭** | Jump to final position |
| **🔍 Analyze Position** | Get AI evaluation of current position |

## 🧠 How It Works

### Chess Engine
The analyzer uses a **minimax algorithm with alpha-beta pruning** to evaluate positions:
- **Search Depth:** 3 plies (half-moves)
- **Evaluation Factors:** Material count, piece positioning, mobility
- **Move Classification:** Based on evaluation difference before/after move

### Move Quality Ratings

| Rating | Evaluation Loss | Description |
|--------|----------------|-------------|
| ✓ Excellent | < 0.3 | Best or near-best move |
| ✓ Good | 0.3 - 0.8 | Solid move, minimal advantage lost |
| !? Inaccuracy | 0.8 - 1.5 | Suboptimal, small mistake |
| ? Mistake | 1.5 - 3.0 | Significant error |
| ?? Blunder | > 3.0 | Serious mistake, major advantage lost |

### Performance Optimization
- **Limited Depth:** Analysis depth is restricted to 3 to ensure fast, real-time response
- **Client-Side Processing:** All computation happens in your browser
- **No Server Costs:** Completely free to run and use

## 🛠️ Technical Stack

- **HTML5** - Structure and layout
- **CSS3** - Modern, gradient-based dark theme with animations
- **Vanilla JavaScript** - No framework dependencies
- **Chess.js** - Chess move generation and validation library
- **Chess.com Public API** - Game data retrieval

## 📁 Project Structure

```
chess-game-analyzer/
├── index.html          # Main HTML structure
├── style.css           # Styling and animations
├── script.js           # Game logic and chess engine
└── README.md           # Documentation
```

## ⚙️ Configuration

The analysis depth can be modified in `script.js`:

```javascript
// Change depth value (higher = slower but more accurate)
function analyzePosition() {
    const result = findBestMove(chess, 3); // Change 3 to desired depth
}
```

**Note:** Increasing depth beyond 3-4 may cause noticeable lag on slower devices.

## 🔒 Privacy & Data

- **No Data Storage:** All analysis happens in your browser session
- **No Account Required:** No login or registration needed
- **No Tracking:** No analytics or user tracking
- **Chess.com API Only:** Only public game data is accessed via Chess.com's official API

## 🎯 Target Audience

- Chess.com users wanting free game analysis
- Players looking to improve without paid subscriptions
- Chess enthusiasts studying their games
- Beginners learning from their mistakes
- Anyone interested in chess AI and programming

## 🚧 Limitations

- **Analysis Depth:** Limited to depth 3 for speed (professional engines go 20+ depth)
- **Game Limit:** Shows only your 20 most recent games
- **No Opening Database:** Doesn't identify opening names or theory
- **Basic Evaluation:** Uses simplified position evaluation (not as accurate as Stockfish)
- **Session Only:** No saved analysis; refresh clears everything

## 🗺️ Roadmap & Future Features

### Planned Features
- [ ] **Keyboard Navigation** - Arrow keys to navigate moves
- [ ] **Board Flip** - View position from Black's perspective
- [ ] **Opening Name Detection** - Identify openings from ECO database
- [ ] **Export Analysis** - Save analysis as PDF or text
- [ ] **Tactical Trainer** - Practice puzzles from your mistakes
- [ ] **Compare Games** - Side-by-side game comparison
- [ ] **Evaluation Graph** - Visual chart showing position evaluation over time
- [ ] **Captured Pieces Display** - Show pieces captured by each side
- [ ] **Time Control Info** - Display time spent per move
- [ ] **Game Statistics** - Accuracy percentage, blunder count, etc.
- [ ] **Multi-Game Analysis** - Batch analyze multiple games
- [ ] **Sound Effects** - Audio feedback for moves
- [ ] **Mobile Optimization** - Improved touch controls
- [ ] **Save Analysis** - Export analyzed games with annotations

### Long-Term Goals
- Integration with stronger chess engines (Web Assembly Stockfish)
- User accounts for saving analysis history
- Social sharing of interesting positions
- Tournament game analysis
- Collaborative analysis features

## 🤝 Contributing

This is a personal project and the code is proprietary. However, if you find bugs or have feature suggestions, please open an issue on GitHub.

## 📝 License

**All Rights Reserved**

Copyright (c) 2024 Syed Zaheer

This code is the exclusive property of Syed Zaheer. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without explicit written permission from the copyright holder.

## 👨‍💻 Author

**Syed Zaheer**

Chess enthusiast and developer, created as a passion project to make chess improvement accessible to all Chess.com players.

## ⚡ Performance Tips

- Use Chrome or Firefox for best performance
- Close other browser tabs when analyzing
- For faster analysis, analyze positions selectively rather than every move
- Clear browser cache if experiencing issues

## 🎓 Learning Resources

Want to understand the code better?
- [Chess Programming Wiki](https://www.chessprogramming.org/)
- [Minimax Algorithm Explained](https://en.wikipedia.org/wiki/Minimax)
- [Alpha-Beta Pruning](https://en.wikipedia.org/wiki/Alpha%E2%80%93beta_pruning)
- [Chess.js Documentation](https://github.com/jhlywa/chess.js)