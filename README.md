# Chess.com Game Analyzer

Use this tool to analyze your Chess.com games. It uses AI to check each move. You do not need a Chess.com subscription.

## 1 Overview

This tool lets a Chess.com player review games and gives feedback on each move.

Do this:
1. Enter your username.
2. Select a game.
3. Move through each position in the game.

You will see the quality of each move and the best move for each position.

**Why we made this tool:** Chess.com has a game review function, but you must pay for it. This tool gives you the same function for free.

## 2 Functions

- **Game search** – Enter your username to find your recent Chess.com games.
- **Move analysis** – Move through the game, one position at a time.
- **AI evaluation** – A fast algorithm checks each position.
- **Move quality rating** – Each move gets a rating: Excellent, Good, Inaccuracy, Mistake, or Blunder.
- **Best move suggestion** – The best move is highlighted on the board.
- **Interactive board** – The board shows the position of each piece and the coordinate labels.
- **No cost** – You do not need to log in. The analysis is instant and free.

## 3 Before You Start

You need:

- A web browser. Use Chrome, Firefox, Safari, or Edge.
- An internet connection, to get games from the Chess.com API.
- A Chess.com account with games in the account.

## 4 How to Use This Tool

1. **Enter your username.** Type your Chess.com username in the search box.
2. **Select a game.** Click on a game from your last 20 games.
3. **Move through the game.** Click "Previous" or "Next".
4. **Analyze a position.** Click "Analyze Position" to see the AI evaluation.
5. **Check the suggestion.** The best move is highlighted in green.

## 5 Controls

| Button | Function |
|--------|----------|
| **← Previous** | Go back one move. |
| **Next →** | Go forward one move. |
| **⏮ First** | Go to the start of the game. |
| **Last ⏭** | Go to the end of the game. |
| **🔍 Analyze Position** | Get the AI evaluation of the current position. |

## 6 How This Works

### 6.1 Chess Engine

A minimax algorithm with alpha-beta pruning evaluates each position.

- **Search depth:** 3 plies (half-moves).
- **Evaluation factors:** Material count, piece position, and piece mobility.
- **Move classification:** Based on a comparison of the evaluation before and after the move.

### 6.2 Move Quality Ratings

| Rating | Evaluation loss | Description |
|--------|----------------|-------------|
| ✓ Excellent | Less than 0.3 | The best move, or a move near to the best move. |
| ✓ Good | 0.3 to 0.8 | A solid move that loses very little advantage. |
| !? Inaccuracy | 0.8 to 1.5 | Not the best move; a small mistake. |
| ? Mistake | 1.5 to 3.0 | A significant error. |
| ?? Blunder | More than 3.0 | A serious mistake that loses a large advantage. |

### 6.3 Performance

- **Limited depth:** A depth of 3 keeps the analysis fast.
- **Client-side processing:** Your browser does all the computation.
- **No server cost:** Free to run and free to use.

## 7 Technical Stack

- **HTML5** – Structure and layout.
- **CSS3** – A dark theme with gradients and animations.
- **Vanilla JavaScript** – No framework is used.
- **Chess.js** – A library for chess move generation and validation.
- **Chess.com Public API** – The source of the game data.

## 8 Project Structure

```
chess-game-analyzer/
├── index.html          # Main HTML structure
├── style.css           # Styling and animations
├── script.js           # Game logic and chess engine
└── README.md           # Documentation
```

## 9 Configuration

You can change the analysis depth in `script.js`.

```javascript
// Change the depth value. A higher value gives a slower but more accurate analysis.
function analyzePosition() {
    const result = findBestMove(chess, 3); // Change 3 to the depth you want.
}
```

**Note:** Do not set the depth above 3 or 4. A higher depth can cause lag on slow devices.

## 10 Privacy and Data

- **No data storage:** The analysis happens only in your browser session.
- **No account:** You do not need to log in or register.
- **No tracking:** No analytics and no user tracking.
- **Chess.com API only:** Only public game data is accessed, through the official Chess.com API.

## 11 Target Users

- Chess.com users who want free game analysis.
- Players who want to improve without a paid subscription.
- Chess enthusiasts who want to study their games.
- Beginners who want to learn from their mistakes.
- Users who are interested in chess AI and programming.

## 12 Limitations

- **Analysis depth:** Limited to 3, for speed. Professional engines use a depth of 20 or more.
- **Game limit:** Only your 20 most recent games are shown.
- **No opening database:** Opening names and opening theory are not identified.
- **Basic evaluation:** A simple evaluation method is used, not as accurate as Stockfish.
- **Session only:** No analysis is saved. A page refresh clears it.

## 13 Roadmap

### 13.1 Planned Features

- [ ] **Keyboard navigation** – Use arrow keys to move through the game.
- [ ] **Board flip** – View the position from Black's side.
- [ ] **Opening name detection** – Identify openings from an ECO database.
- [ ] **Export analysis** – Save the analysis as a PDF file or a text file.
- [ ] **Tactical trainer** – Practice puzzles that come from your mistakes.
- [ ] **Game comparison** – Compare two games side by side.
- [ ] **Evaluation graph** – A chart that shows the position evaluation over the game.
- [ ] **Captured pieces display** – Show the pieces that each side captured.
- [ ] **Time control information** – Show the time each player used for each move.
- [ ] **Game statistics** – Show the accuracy percentage and the blunder count.
- [ ] **Multi-game analysis** – Analyze more than one game at the same time.
- [ ] **Sound effects** – Play a sound for each move.
- [ ] **Mobile optimization** – Improve the touch controls.
- [ ] **Save analysis** – Export the analyzed game with notes.

### 13.2 Long-Term Goals

- Add a stronger chess engine (WebAssembly Stockfish).
- Add user accounts, to save the analysis history.
- Add a function to share positions.
- Add tournament game analysis.
- Add a function for users to analyze games together.

## 14 Contributions

This is a personal project. The code is proprietary. If you find a bug, or if you have a suggestion for a new feature, open an issue on GitHub.

## 15 License

**All Rights Reserved**

Copyright (c) 2024 Syed Zaheer.

This code is the property of Syed Zaheer. You must not copy, modify, distribute, or use this software without written permission from Syed Zaheer.

## 16 Author

**Syed Zaheer**

Syed Zaheer is a chess enthusiast and a developer. Syed Zaheer made this tool to give all Chess.com players access to game improvement.

## 17 Performance Tips

- Use Chrome or Firefox, for the best performance.
- Close other browser tabs when you analyze a game.
- Analyze only the positions you need. Do not analyze every move.
- Clear the browser cache if you have a problem.

## 18 Learning Resources

Read these resources to understand the code:

- [Chess Programming Wiki](https://www.chessprogramming.org/)
- [Minimax Algorithm Explained](https://en.wikipedia.org/wiki/Minimax)
- [Alpha-Beta Pruning](https://en.wikipedia.org/wiki/Alpha%E2%80%93beta_pruning)
- [Chess.js Documentation](https://github.com/jhlywa/chess.js)
