// ============================================
// 🎯 CONFIGURATION
// ============================================
const BACKEND_URL = 'https://codenames-arabic-server.onrender.com';

let socket;
let gameState = {
    username: '',
    userId: null,
    roomCode: '',
    myTeam: null,
    myRole: null,
    board: [],
    currentTurn: null,
    clue: null,
    guessesLeft: 0
};

// ============================================
// 🔊 SOUND EFFECTS
// ============================================
const playSound = (name) => {
    if (typeof Audio !== 'undefined') {
        try {
            const audio = new Audio(`./assets/sounds/${name}.mp3`);
            audio.volume = 0.5;
            audio.play().catch(e => console.warn('Sound play failed:', e));
        } catch (e) {
            console.warn('Sound error:', e);
        }
    }
};

// ============================================
// 🛠️ UTILITIES
// ============================================
const $ = (id) => document.getElementById(id);

const switchScreen = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
};

const Modal = {
    show(icon, title, message, onConfirm = null) {
        $('modal-icon').textContent = icon;
        $('modal-title').textContent = title;
        $('modal-message').textContent = message;
        $('modal').classList.add('active');
        
        if (onConfirm) {
            $('modal-confirm').onclick = () => {
                this.hide();
                onConfirm();
            };
        }
    },
    hide() {
        $('modal').classList.remove('active');
    },
    success(message, onConfirm) {
        this.show('✅', 'نجاح!', message, onConfirm);
    },
    error(message) {
        this.show('❌', 'خطأ!', message);
    },
    info(message) {
        this.show('ℹ️', 'معلومة', message);
    }
};

// ============================================
// 🌐 SOCKET CONNECTION
// ============================================
const connectSocket = () => {
    socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5
    });

    socket.on('connect', () => {
        console.log('✅ Connected:', socket.id);
        playSound('connected');
    });

    socket.on('disconnect', () => {
        console.log('❌ Disconnected');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        Modal.error('فشل الاتصال بالخادم. يرجى المحاولة لاحقاً.');
    });

    // Room events
    socket.on('roomCreated', handleRoomCreated);
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('roomError', (msg) => Modal.error(msg));

    // Game events
    socket.on('gameStarted', handleGameStarted);
    socket.on('gameUpdate', handleGameUpdate);
    socket.on('clueGiven', handleClueGiven);
    socket.on('cardRevealed', handleCardRevealed);
    socket.on('gameError', (msg) => Modal.error(msg));

    // Player events
    socket.on('playerDisconnected', (data) => {
        Modal.info(`انقطع اتصال ${data.username}`);
    });
    
    socket.on('playerReconnected', (data) => {
        Modal.info(`أعاد ${data.username} الاتصال`);
    });
};

// ============================================
// 📥 SOCKET EVENT HANDLERS
// ============================================
const handleRoomCreated = (data) => {
    console.log('Room created:', data);
    playSound('connected');
    gameState.roomCode = data.code;
    gameState.players = data.players;
    
    $('room-code-display').textContent = data.code;
    switchScreen('waiting-room');
    updatePlayersList(data.players);
    
    Modal.success(`تم إنشاء الغرفة بنجاح! الكود: ${data.code}`);
};

const handleRoomUpdate = (players) => {
    console.log('Room update:', players);
    gameState.players = players;
    updatePlayersList(players);
};

const handleGameStarted = (data) => {
    console.log('Game started:', data);
    playSound('game_start');
    
    gameState.board = data.board;
    gameState.currentTurn = data.currentTurn;
    gameState.firstTeam = data.firstTeam;
    
    // Find my player
    const myPlayer = data.players.find(p => p.socketId === socket.id || p.id === socket.id);
    if (myPlayer) {
        gameState.myTeam = myPlayer.team;
        gameState.myRole = myPlayer.role;
    }
    
    $('game-room-code').textContent = gameState.roomCode;
    switchScreen('game-screen');
    renderBoard();
    updateGameUI(data);
    
    Modal.success('بدأت اللعبة! حظاً موفقاً! 🎮');
};

const handleGameUpdate = (data) => {
    console.log('Game update:', data);
    
    if (data.currentTurn) gameState.currentTurn = data.currentTurn;
    if (data.clue) gameState.clue = data.clue;
    if (data.guessesLeft !== undefined) gameState.guessesLeft = data.guessesLeft;
    if (data.board) gameState.board = data.board;
    
    updateGameUI(data);
    
    if (data.winner) {
        playSound('win_game');
        const winnerText = data.winner === 'RED' ? 'الفريق الأحمر' : 'الفريق الأزرق';
        const isMyTeam = data.winner === gameState.myTeam;
        
        setTimeout(() => {
            Modal.show(
                '🏆', 
                isMyTeam ? 'فزتم!' : 'انتهت اللعبة',
                `فاز ${winnerText}! ${isMyTeam ? 'تهانينا! 🎉' : 'حظ أفضل في المرة القادمة!'}`
            );
        }, 500);
    }
};

const handleClueGiven = (data) => {
    console.log('Clue given:', data);
    playSound('clue_given');
    
    gameState.clue = data.clue;
    gameState.guessesLeft = data.count + 1;
    
    $('current-clue').textContent = data.clue;
    $('clue-guesses').innerHTML = `محاولات متبقية: <strong>${data.count + 1}</strong>`;
    
    const teamText = data.team === 'RED' ? 'الأحمر' : 'الأزرق';
    Modal.info(`تلميح جديد من الفريق ${teamText}: "${data.clue}" - ${data.count} كلمات`);
};

const handleCardRevealed = (data) => {
    console.log('Card revealed:', data);
    
    const { cardIndex, card, result } = data;
    
    // Update local board state
    if (gameState.board[cardIndex]) {
        gameState.board[cardIndex] = card;
    }
    
    // Update UI
    const cardElement = document.querySelector(`[data-index="${cardIndex}"]`);
    if (cardElement) {
        cardElement.classList.add('revealed', card.type);
    }
    
    // Play appropriate sound
    switch (card.type) {
        case 'RED':
        case 'BLUE':
            playSound('correct');
            break;
        case 'INNOCENT':
            playSound('wrong');
            break;
        case 'ASSASSIN':
            playSound('assassin_hit');
            break;
    }
    
    updateScores();
};

// ============================================
// 🏠 HOME SCREEN
// ============================================
$('btn-enter-game').addEventListener('click', () => {
    const username = $('username-input').value.trim();
    
    if (!username) {
        Modal.error('يرجى إدخال اسمك');
        return;
    }
    
    if (username.length < 2 || username.length > 20) {
        Modal.error('يجب أن يكون الاسم بين 2 و 20 حرف');
        return;
    }
    
    gameState.username = username;
    $('player-name-display').textContent = username;
    
    switchScreen('lobby-screen');
    connectSocket();
});

// ============================================
// 🏢 LOBBY SCREEN
// ============================================
$('btn-create-room').addEventListener('click', () => {
    const customName = $('create-room-name').value.toUpperCase().trim();
    
    if (customName && customName.length !== 6) {
        Modal.error('الاسم المخصص يجب أن يكون 6 أحرف بالضبط');
        return;
    }
    
    socket.emit('createRoom', {
        customName,
        username: gameState.username,
        userId: gameState.userId
    });
});

$('btn-join-room').addEventListener('click', () => {
    const code = $('join-room-code').value.toUpperCase().trim();
    
    if (!code) {
        Modal.error('يرجى إدخال كود الغرفة');
        return;
    }
    
    if (code.length !== 6) {
        Modal.error('كود الغرفة يجب أن يكون 6 أحرف');
        return;
    }
    
    socket.emit('joinRoom', {
        roomCode: code,
        username: gameState.username,
        userId: gameState.userId
    });
    
    socket.once('roomUpdate', (players) => {
        gameState.roomCode = code;
        $('room-code-display').textContent = code;
        switchScreen('waiting-room');
        updatePlayersList(players);
    });
});

$('btn-back-home').addEventListener('click', () => {
    if (socket) {
        socket.disconnect();
    }
    switchScreen('home-screen');
});

// ============================================
// ⏳ WAITING ROOM
// ============================================
document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const team = this.dataset.team;
        const role = this.dataset.role;
        
        gameState.myTeam = team;
        gameState.myRole = role;
        
        socket.emit('setRole', { team, role });
        
        // Visual feedback
        document.querySelectorAll('.role-btn').forEach(b => {
            b.style.opacity = '0.5';
        });
        this.style.opacity = '1';
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 200);
    });
});

$('btn-start-game').addEventListener('click', () => {
    socket.emit('startGame');
});

$('btn-leave-room').addEventListener('click', () => {
    Modal.show('⚠️', 'تأكيد', 'هل تريد مغادرة الغرفة؟', () => {
        switchScreen('lobby-screen');
    });
});

const updatePlayersList = (players) => {
    const list = $('players-list');
    $('players-count').textContent = players.length;
    
    list.innerHTML = players.map(p => {
        const teamIcon = p.team === 'RED' ? '🔴' : p.team === 'BLUE' ? '🔵' : '⚪';
        const roleIcon = p.role === 'SPYMASTER' ? ' 👑' : p.role === 'GUESSER' ? ' 🎯' : '';
        const isMe = p.id === socket.id || p.socketId === socket.id;
        
        return `
            <li style="padding: var(--spacing-md); background: var(--bg-secondary); 
                border-radius: var(--radius-sm); ${isMe ? 'border: 2px solid var(--color-blue);' : ''}">
                ${teamIcon} ${p.username}${roleIcon} ${isMe ? '(أنت)' : ''}
            </li>
        `;
    }).join('');
    
    // Show start button if host and enough players
    const hasRedSpymaster = players.some(p => p.team === 'RED' && p.role === 'SPYMASTER');
    const hasBlueSpymaster = players.some(p => p.team === 'BLUE' && p.role === 'SPYMASTER');
    const hasEnoughPlayers = players.length >= 4;
    const isHost = players[0] && (players[0].id === socket.id || players[0].socketId === socket.id);
    
    if (isHost && hasEnoughPlayers && hasRedSpymaster && hasBlueSpymaster) {
        $('btn-start-game').classList.remove('hidden');
    } else {
        $('btn-start-game').classList.add('hidden');
    }
};

// ============================================
// 🎮 GAME SCREEN
// ============================================
const renderBoard = () => {
    const board = $('game-board');
    board.innerHTML = '';
    
    if (!gameState.board || gameState.board.length === 0) {
        console.error('No board data available');
        return;
    }
    
    gameState.board.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = 'word-card';
        div.textContent = card.word;
        div.dataset.index = index;
        
        if (card.revealed) {
            div.classList.add('revealed', card.type);
        } else if (gameState.myRole === 'SPYMASTER') {
            // Show color hints for spymaster
            const hintClass = {
                'RED': 'spy-hint-red',
                'BLUE': 'spy-hint-blue',
                'INNOCENT': 'spy-hint-beige',
                'ASSASSIN': 'spy-hint-black'
            };
            div.classList.add(hintClass[card.type]);
        }
        
        // Add click handler for guessers
        if (gameState.myRole === 'GUESSER' && !card.revealed && 
            gameState.currentTurn === gameState.myTeam) {
            div.addEventListener('click', () => handleCardClick(index));
        }
        
        board.appendChild(div);
    });
    
    updateControls();
    updateScores();
};

const handleCardClick = (index) => {
    if (gameState.guessesLeft === 0) {
        Modal.error('لا توجد محاولات متبقية');
        return;
    }
    
    socket.emit('makeGuess', { cardIndex: index });
};

const updateControls = () => {
    const spymaster = $('spymaster-controls');
    const guesser = $('guesser-controls');
    
    if (gameState.myRole === 'SPYMASTER') {
        spymaster.classList.remove('hidden');
        guesser.classList.add('hidden');
    } else if (gameState.myRole === 'GUESSER') {
        spymaster.classList.add('hidden');
        guesser.classList.remove('hidden');
    } else {
        spymaster.classList.add('hidden');
        guesser.classList.add('hidden');
    }
};

const updateGameUI = (data) => {
    // Update turn indicator
    if (data.currentTurn) {
        const isMyTurn = data.currentTurn === gameState.myTeam;
        const turnText = data.currentTurn === 'RED' ? 
            '🔴 دور الفريق الأحمر' : '🔵 دور الفريق الأزرق';
        
        $('turn-indicator').textContent = turnText + (isMyTurn ? ' (دوركم!)' : '');
        $('turn-indicator').style.background = data.currentTurn === 'RED' ? 
            'linear-gradient(135deg, rgba(211, 47, 47, 0.2), transparent)' :
            'linear-gradient(135deg, rgba(25, 118, 210, 0.2), transparent)';
    }
    
    // Update clue display
    if (data.clue) {
        $('current-clue').textContent = data.clue;
    }
    
    if (data.guessesLeft !== undefined) {
        $('clue-guesses').innerHTML = `محاولات متبقية: <strong>${data.guessesLeft}</strong>`;
    }
    
    updateScores();
};

const updateScores = () => {
    if (!gameState.board || gameState.board.length === 0) return;
    
    let red = 0, blue = 0;
    
    gameState.board.forEach(card => {
        if (!card.revealed) {
            if (card.type === 'RED') red++;
            if (card.type === 'BLUE') blue++;
        }
    });
    
    $('red-score').textContent = red;
    $('blue-score').textContent = blue;
};

// Spymaster controls
$('btn-give-clue').addEventListener('click', () => {
    const clue = $('clue-input').value.trim();
    const count = parseInt($('count-input').value);
    
    if (!clue) {
        Modal.error('يرجى إدخال التلميح');
        return;
    }
    
    if (!count || count < 1 || count > 9) {
        Modal.error('يرجى إدخال عدد صحيح بين 1 و 9');
        return;
    }
    
    if (gameState.currentTurn !== gameState.myTeam) {
        Modal.error('ليس دور فريقك');
        return;
    }
    
    socket.emit('giveClue', { clue, count });
    
    // Clear inputs
    $('clue-input').value = '';
    $('count-input').value = '';
});

// Guesser controls
$('btn-end-turn').addEventListener('click', () => {
    Modal.show('⚠️', 'تأكيد', 'هل تريد إنهاء دورك؟', () => {
        socket.emit('endTurn');
    });
});

// ============================================
// 🎭 MODAL
// ============================================
$('modal-confirm').addEventListener('click', () => {
    Modal.hide();
});

$('modal').addEventListener('click', (e) => {
    if (e.target === $('modal')) {
        Modal.hide();
    }
});

// ============================================
// 🚀 INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    
    // Wake up server
    fetch(`${BACKEND_URL}/`)
        .then(() => console.log('Server pinged successfully'))
        .catch(err => console.warn('Server ping failed:', err));
    
    // Focus username input
    $('username-input').focus();
    
    // Enter key on inputs
    $('username-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') $('btn-enter-game').click();
    });
    
    $('join-room-code').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') $('btn-join-room').click();
    });
    
    $('clue-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') $('btn-give-clue').click();
    });
});
