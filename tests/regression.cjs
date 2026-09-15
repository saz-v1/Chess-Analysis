// Run: node tests/regression.cjs /path/to/chess.min.js
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const elements = new Map();
function element() { return { innerHTML: '', textContent: '', style: {}, dataset: {}, children: [], classList: { add() {}, remove() {} }, appendChild(x) {this.children.push(x);}, setAttribute() {}, querySelectorAll(){return [];}, addEventListener() {} }; }
const document = {getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,addEventListener(){}};
const timers=[];
const ctx=vm.createContext({document,console,setTimeout:fn=>timers.push(fn)});
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'),ctx);
vm.runInContext(fs.readFileSync('script.js','utf8'),ctx);
function run(code){return vm.runInContext(code,ctx);}
assert.equal(run(`detectUserColor('PLAYER', 'Other', 'Player')`),'b');
for(const fen of ['7k/5Q2/6K1/8/8/8/8/8 w - - 0 1','8/8/8/8/8/6k1/5q2/7K b - - 0 1']){
 const result=run(`(()=>{const g=new Chess('${fen}');const r=findBestMove(g,2);g.move(r.move);return {mate:g.in_checkmate(),score:r.evaluation};})()`);
 assert.equal(result.mate,true);assert.equal(result.score,fen.includes(' w ')?100:-100);
}
run(`state.currentUsername='Player';state.gamesCache=[{pgn:'1. e4 e5 2. Nf3 Nc6',white:{username:'Other'},black:{username:'Player'}}];loadGame(0);`);
assert.equal(run('state.chess.turn()'),'w');assert.equal(run('state.orientation'),'b');
run('nextMove()');assert.equal(run("state.chess.get('e4').color"),'w');assert.equal(run('state.chess.turn()'),'b');assert.match(elements.get('moveInfo').textContent,/1\. e4/);
run('analyzePosition(); nextMove()');timers.shift()();assert.match(elements.get('analysisPanel').innerHTML,/Analyze the selected/);
run('backToSearch(); loadGame(0)');assert.equal(run('state.userColor'),'b');
run('goToMove(4); analyzePosition()');timers.shift()();assert.match(elements.get('analysisPanel').innerHTML,/Best alternative before this move/);assert.match(elements.get('analysisPanel').innerHTML,/White to move/);
run(String.raw`state.gamesCache=[{pgn:'[SetUp "1"]\n[FEN "7k/8/8/8/8/8/8/K7 b - - 0 23"]\n\n23... Kg8',white:{username:'Other'},black:{username:'Player'}}];loadGame(0);nextMove();`);
assert.match(elements.get('moveInfo').textContent,/23\.\.\. Kg8/);
console.log('Passed: both-side mate selection, evaluation signs, player orientation, ply navigation, stale analysis cancellation, reopening games, review labels, custom FEN.');
run(`state.gamesCache=[{pgn:'1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8',white:{username:'Other'},black:{username:'Player'}}];loadGame(0);lastMove();`);
assert.equal(run('state.chess.in_threefold_repetition()'),true);
assert.equal(run('findBestMove(state.chess)'),null);
run(`state.gamesCache=[{pgn:'1. f3 e5 2. g4 Qh4#',white:{username:'Other'},black:{username:'Player'}}];loadGame(0);lastMove();analyzePosition();`);
timers.shift()();
assert.match(elements.get('analysisPanel').innerHTML,/Black has forced mate/);
assert.match(elements.get('moveInfo').textContent,/2\.\.\. Qh4#/);
console.log('Passed: repetition history and checkmating move review.');
