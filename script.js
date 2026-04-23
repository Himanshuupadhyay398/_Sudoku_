document.addEventListener("DOMContentLoaded", () => {
    // ==== DOM Elements ====
    const boardEl = document.getElementById("sudoku-board");
    const numpadEl = document.getElementById("numpad");
    const diffBtns = document.querySelectorAll(".diff-btn");
    const timerEl = document.querySelector(".timer");
    const btnUndo = document.getElementById("btn-undo");
    const btnErase = document.getElementById("btn-erase");
    const btnHint = document.getElementById("btn-hint");
    const btnSolve = document.getElementById("btn-solve");
    const gameOverOverlay = document.querySelector(".game-over-overlay");
    const newGameBtn = document.getElementById("new-game-btn");
    const finalTimeEl = document.getElementById("final-time");

    // ==== Game State ====
    let board = [];
    let initialBoard = [];
    let solution = [];
    let selectedCell = null; // index 0-80
    let difficulty = "easy";
    let history = []; // array of {index, prevVal, newVal}
    
    let timerInterval = null;
    let secondsElapsed = 0;
    let gameWon = false;

    // ==== Sudoku Generator / Solver Logic ====
    class SudokuCore {
        static isValid(board, row, col, num) {
            for (let i = 0; i < 9; i++) {
                if (board[row][i] === num && i !== col) return false;
                if (board[i][col] === num && i !== row) return false;
                const boxRow = 3 * Math.floor(row / 3) + Math.floor(i / 3);
                const boxCol = 3 * Math.floor(col / 3) + (i % 3);
                if (board[boxRow][boxCol] === num && (boxRow !== row || boxCol !== col)) return false;
            }
            return true;
        }

        static solve(board) {
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (board[row][col] === 0) {
                        for (let num = 1; num <= 9; num++) {
                            if (this.isValid(board, row, col, num)) {
                                board[row][col] = num;
                                if (this.solve(board)) return true;
                                board[row][col] = 0;
                            }
                        }
                        return false;
                    }
                }
            }
            return true;
        }

        static fillDiagonal(board) {
            for (let i = 0; i < 9; i += 3) {
                let nums = [1,2,3,4,5,6,7,8,9];
                nums.sort(() => Math.random() - 0.5); // Shuffle
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        board[i + r][i + c] = nums.pop();
                    }
                }
            }
        }

        static generateSolution() {
            let b = Array.from({ length: 9 }, () => Array(9).fill(0));
            this.fillDiagonal(b);
            this.solve(b);
            return b;
        }

        static generatePuzzle(difficulty) {
            let sol = this.generateSolution();
            let puz = sol.map(row => [...row]);
            
            // Adjust cells to remove based on difficulty
            let removeCount = 35; // Easy Mode
            if (difficulty === 'medium') removeCount = 45;
            if (difficulty === 'hard') removeCount = 55;

            let attempts = removeCount;
            while (attempts > 0) {
                let row = Math.floor(Math.random() * 9);
                let col = Math.floor(Math.random() * 9);
                if (puz[row][col] !== 0) {
                    puz[row][col] = 0;
                    attempts--;
                }
            }
            return { puzzle: puz, solution: sol };
        }
    }

    // ==== Initialization ====
    function init() {
        createBoardUI();
        createNumpadUI();
        setupEventListeners();
        startNewGame();
    }

    function startNewGame() {
        const generated = SudokuCore.generatePuzzle(difficulty);
        board = [];
        initialBoard = [];
        solution = [];
        gameWon = false;
        
        for (let r=0; r<9; r++) {
            board.push([...generated.puzzle[r]]);
            initialBoard.push([...generated.puzzle[r]]);
            solution.push([...generated.solution[r]]);
        }
        
        history = [];
        selectedCell = null;
        gameOverOverlay.classList.add("hidden");
        
        resetTimer();
        startTimer();
        updateBoardUI();
    }

    function formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!gameWon) {
                secondsElapsed++;
                timerEl.textContent = formatTime(secondsElapsed);
            }
        }, 1000);
    }

    function resetTimer() {
        if (timerInterval) clearInterval(timerInterval);
        secondsElapsed = 0;
        timerEl.textContent = formatTime(0);
    }

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
    }

    function createBoardUI() {
        boardEl.innerHTML = '';
        for (let i = 0; i < 81; i++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
            cell.dataset.index = i;
            // Accessibility
            cell.setAttribute("role", "button");
            cell.setAttribute("tabindex", "0");
            cell.addEventListener("click", () => selectCell(i));
            cell.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectCell(i);
                }
            });
            boardEl.appendChild(cell);
        }
    }

    function createNumpadUI() {
        numpadEl.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement("button");
            btn.classList.add("num-btn");
            btn.textContent = i;
            btn.addEventListener("click", () => handleInput(i));
            numpadEl.appendChild(btn);
        }
    }

    function setupEventListeners() {
        document.addEventListener("keydown", (e) => {
            if (gameWon) return; // Prevent input if game won
            if (selectedCell === null) return;
            
            if (e.key >= '1' && e.key <= '9') {
                handleInput(parseInt(e.key));
            } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
                handleInput(0);
            } else if (e.key === 'ArrowUp') {
                navCell(-9);
            } else if (e.key === 'ArrowDown') {
                navCell(9);
            } else if (e.key === 'ArrowLeft') {
                if (selectedCell % 9 !== 0) navCell(-1);
            } else if (e.key === 'ArrowRight') {
                if (selectedCell % 9 !== 8) navCell(1);
            }
        });

        diffBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                diffBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                difficulty = btn.dataset.diff;
                startNewGame();
            });
        });

        newGameBtn.addEventListener("click", startNewGame);
        btnUndo.addEventListener("click", handleUndo);
        btnErase.addEventListener("click", () => handleInput(0));
        btnHint.addEventListener("click", handleHint);
        btnSolve.addEventListener("click", solveFullBoard);
    }

    function navCell(offset) {
        let nxt = selectedCell + offset;
        if (nxt >= 0 && nxt < 81) selectCell(nxt);
    }

    function updateBoardUI() {
        const cells = boardEl.querySelectorAll(".cell");
        cells.forEach((cell, i) => {
            let r = Math.floor(i / 9);
            let c = i % 9;
            let val = board[r][c];
            
            // Clean previous classes while keeping base class
            cell.className = "cell";
            cell.textContent = val === 0 ? "" : val;
            
            if (initialBoard[r][c] !== 0) {
                cell.classList.add("fixed");
            } else if (val !== 0) {
                // If the user's input doesn't match the solution, it's an error
                if (val !== solution[r][c]) {
                    cell.classList.add("error");
                }
            }

            // Highlighting Logic
            if (selectedCell === i) {
                cell.classList.add("selected");
            } else if (selectedCell !== null) {
                let sr = Math.floor(selectedCell / 9);
                let sc = selectedCell % 9;
                let sBoxR = Math.floor(sr / 3);
                let sBoxC = Math.floor(sc / 3);
                let boxR = Math.floor(r / 3);
                let boxC = Math.floor(c / 3);
                
                // Highlight row, column, and 3x3 block
                if (r === sr || c === sc || (boxR === sBoxR && boxC === sBoxC)) {
                    cell.classList.add("highlighted");
                }
                
                // Highlight exact matching numbers across the board
                let selectedVal = board[sr][sc];
                if (selectedVal !== 0 && val === selectedVal) {
                    cell.classList.add("selected"); // Same effect as selected
                }
            }
        });
        
        if (!gameWon) checkWinCondition();
    }

    function checkWinCondition() {
        let isCompleteAndCorrect = true;
        for (let r=0; r<9; r++) {
            for (let c=0; c<9; c++) {
                if (board[r][c] !== solution[r][c]) {
                    isCompleteAndCorrect = false;
                    break;
                }
            }
        }
        if (isCompleteAndCorrect) {
            gameWon = true;
            stopTimer();
            finalTimeEl.textContent = formatTime(secondsElapsed);
            gameOverOverlay.classList.remove("hidden");
        }
    }

    function selectCell(index) {
        if (gameWon) return; // Prevent interaction after winning
        selectedCell = index;
        updateBoardUI();
    }

    function handleInput(val) {
        if (selectedCell === null || gameWon) return;
        
        let r = Math.floor(selectedCell / 9);
        let c = selectedCell % 9;
        
        // Cannot modify predefined cells
        if (initialBoard[r][c] !== 0) return;

        let prev = board[r][c];
        if (prev !== val) {
            history.push({index: selectedCell, prevVal: prev, newVal: val});
            board[r][c] = val;
            
            // Pop animation on input
            if (val !== 0) {
                const cells = boardEl.querySelectorAll(".cell");
                cells[selectedCell].classList.add("pop");
                setTimeout(() => {
                    if (cells[selectedCell]) cells[selectedCell].classList.remove("pop");
                }, 200);
            }

            updateBoardUI();
        }
    }

    function handleUndo() {
        if (history.length === 0 || gameWon) return;
        const lastAction = history.pop();
        let r = Math.floor(lastAction.index / 9);
        let c = lastAction.index % 9;
        board[r][c] = lastAction.prevVal;
        selectCell(lastAction.index);
    }

    function handleHint() {
        if (gameWon) return;
        if (selectedCell === null) {
            // Find first empty or incorrect cell
            for (let i=0; i<81; i++) {
                let r = Math.floor(i / 9);
                let c = i % 9;
                if (board[r][c] !== solution[r][c] && initialBoard[r][c] === 0) {
                    selectedCell = i;
                    break;
                }
            }
            if (selectedCell === null) return; 
        }
        
        let r = Math.floor(selectedCell / 9);
        let c = selectedCell % 9;
        
        if (initialBoard[r][c] === 0 && board[r][c] !== solution[r][c]) {
            board[r][c] = solution[r][c];
            history.push({index: selectedCell, prevVal: board[r][c], newVal: solution[r][c]});
            updateBoardUI();
        }
    }

    function solveFullBoard() {
        if (gameWon) return;
        for (let r=0; r<9; r++) {
            for (let c=0; c<9; c++) {
                if (initialBoard[r][c] === 0) {
                    board[r][c] = solution[r][c];
                }
            }
        }
        // Force the win check inside updateBoardUI to properly trigger win logic
        gameWon = true; 
        stopTimer();
        updateBoardUI();
        
        // Show overlay explicitly
        finalTimeEl.textContent = formatTime(secondsElapsed);
        gameOverOverlay.classList.remove("hidden");
    }

    // Start App
    init();
});
