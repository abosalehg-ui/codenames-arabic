const BACKEND_URL = 'https://codenames-arabic-server.onrender.com';

let socket;
let userState = {
    token: localStorage.getItem('token') || null,
    userId: localStorage.getItem('userId') || null,
    username: localStorage.getItem('username') || null,
    isAuthenticated: !!localStorage.getItem('token')
};
let gameState = {};

// =================================================================
// 🎭 MODAL SYSTEM - نظام النوافذ المنبثقة المخصص
// =================================================================

const Modal = {
    overlay: null,
    container: null,
    icon: null,
    title: null,
    message: null,
    btnConfirm: null,
    btnCancel: null,
    
    init() {
        this.overlay = document.getElementById('modal-overlay');
        this.container = this.overlay?.querySelector('.modal-container');
        this.icon = document.getElementById('modal-icon');
        this.title = document.getElementById('modal-title');
        this.message = document.getElementById('modal-message');
        this.btnConfirm = document.getElementById('modal-btn-confirm');
        this.btnCancel = document.getElementById('modal-btn-cancel');
    },
    
    show({ type = 'info', title = '', message = '', showCancel = false, onConfirm = null, onCancel = null }) {
        if (!this.overlay) this.init();
        
        // تعيين الأيقونة حسب النوع
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        this.icon.textContent = icons[type] || icons.info;
        this.icon.className = `modal-icon ${type}`;
        
        this.title.textContent = title;
        this.message.textContent = message;
        
        // إظهار/إخفاء زر الإلغاء
        if (showCancel) {
            this.btnCancel.classList.remove('hidden');
        } else {
            this.btnCancel.classList.add('hidden');
        }
        
        // معالجات الأحداث
        this.btnConfirm.onclick = () => {
            this.hide();
            if (onConfirm) onConfirm();
        };
        
        this.btnCancel.onclick = () => {
            this.hide();
            if (onCancel) onCancel();
        };
        
        // إظهار النافذة
        this.overlay.classList.add('active');
        
        // إغلاق عند النقر خارج النافذة
        this.overlay.onclick = (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        };
    },
    
    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
    },
    
    // دوال مختصرة
    success(message, onConfirm = null) {
        this.show({ type: 'success', title: 'نجاح!', message, onConfirm });
    },
    
    error(message, onConfirm = null) {
        this.show({ type: 'error', title: 'خطأ!', message, onConfirm });
    },
    
    warning(message, onConfirm = null) {
        this.show({ type: 'warning', title: 'تنبيه!', message, onConfirm });
    },
    
    info(message, onConfirm = null) {
        this.show({ type: 'info', title: 'معلومة', message, onConfirm });
    },
    
    confirm(message, onConfirm = null, onCancel = null) {
        this.show({ 
            type: 'warning', 
            title: 'تأكيد', 
            message, 
            showCancel: true, 
            onConfirm, 
            onCancel 
        });
    }
};

// =================================================================
// 1. دوال إدارة الواجهة (UI Management Functions)
// =================================================================

const switchScreen = (targetScreenId) => {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });
    
    const targetScreen = document.getElementById(targetScreenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        targetScreen.classList.add('active');
        console.log(`Switched to screen: ${targetScreenId}`);
    }
};

const updateLobbyUI = () => {
    const authSection = document.getElementById('auth-section');
    const roomSection = document.getElementById('room-section');

    if (userState.isAuthenticated) {
        authSection.classList.add('hidden');
        roomSection.classList.remove('hidden');
        
        const currentUsernameDisplay = document.getElementById('current-username');
        if (currentUsernameDisplay) {
            currentUsernameDisplay.textContent = userState.username;
        }

        document.getElementById('auth-submit').textContent = "تسجيل الخروج";
        document.getElementById('auth-toggle').classList.add('hidden');
    } else {
        authSection.classList.remove('hidden');
        roomSection.classList.add('hidden');
        document.getElementById('auth-submit').textContent = "تسجيل الدخول";
        document.getElementById('auth-toggle').classList.remove('hidden');
    }
};

// =================================================================
// 2. 🚨 حل مشكلة Cold Start وبدء الاتصال بالخادم
// =================================================================

const wakeUpAndConnect = async () => {
    switchScreen('loading-screen'); 
    
    try {
        console.log('Attempting to wake up the Render server...');
        const response = await fetch(`${BACKEND_URL}/`); 

        if (response.ok) {
            console.log('Server is awake! Establishing Socket.io connection...');
            
            socket = io(BACKEND_URL, {
                auth: { token: userState.token } 
            });

            setupSocketListeners(); 

            socket.on('connect', () => {
                console.log('Socket connected successfully:', socket.id);
                switchScreen('lobby-screen');
                updateLobbyUI(); 
            });

            socket.on('connect_error', (err) => {
                console.error('Socket connection error:', err.message);
                Modal.error('خطأ في الاتصال بالخادم. يرجى تحديث الصفحة.');
                document.querySelector('.loader-content p').textContent = 'خطأ في الاتصال (Socket.io)';
            });

        } else {
            throw new Error('Server did not respond with OK status.');
        }

    } catch (error) {
        console.error('Failed to wake up server or connect:', error);
        document.querySelector('.loader-content h1').textContent = 'فشل الاتصال بالخادم 😢';
        document.querySelector('.loader-content p').textContent = 'يرجى التأكد من تشغيل الخادم والمحاولة لاحقاً.';
    }
};

// =================================================================
// 3. دالة تجميع معالجات أحداث Socket.io
// =================================================================

const setupSocketListeners = () => {
    
    socket.on('roomError', (message) => {
        Modal.error(`خطأ في الغرفة: ${message}`);
    });

    socket.on('roomCreated', (roomData) => {
        gameState = roomData;
        switchScreen('game-screen');
        updateRoomLobbyUI(gameState);
        Modal.success(`تم إنشاء الغرفة بنجاح. الكود: ${roomData.code}`);
    });

    socket.on('roomUpdate', (players) => {
        gameState.players = players;
        updateRoomLobbyUI(gameState);
    });
    
    socket.on('gameStarted', (data) => {
        gameState = data;
        switchScreen('game-screen');
        
        const player = gameState.players.find(p => p.id === socket.id);
        if (player) {
            drawGameBoard(gameState.board, player.role);
            updateGameControls(player);
        }
        
        // إخفاء لوحة اختيار الأدوار
        document.getElementById('role-selection-area').classList.add('hidden');
        
        Modal.success('بدأت اللعبة! حظاً موفقاً! 🎮');
        console.log('Game Started:', gameState);
    });

    socket.on('gameUpdate', (data) => {
        Object.assign(gameState, data);
        updateGameUI();
    });

    socket.on('cardRevealed', (data) => {
        const { cardIndex, card } = data;
        const cardElement = document.querySelector(`[data-index="${cardIndex}"]`);
        
        if (cardElement) {
            cardElement.classList.add('revealed', card.type);
            cardElement.style.backgroundColor = getCardColor(card.type);
            
            // إضافة للسجل
            addToLog(card.word, card.type);
        }
        
        updateScores();
    });

    socket.on('clueGiven', (data) => {
        document.getElementById('clue-word').textContent = data.clue;
        Modal.info(`التلميح: "${data.clue}" - عدد الكلمات: ${data.count}`);
    });

    socket.on('gameError', (message) => {
        Modal.error(message);
    });

    socket.on('clueError', (message) => {
        Modal.warning(message);
    });

    socket.on('guessError', (message) => {
        Modal.warning(message);
    });

    socket.on('roleError', (message) => {
        Modal.warning(message);
    });
};

// =================================================================
// 4. دوال معالجة المصادقة (Auth Handlers)
// =================================================================

const handleAuthResponse = (data) => {
    userState.token = data.token;
    userState.userId = data._id;
    userState.username = data.username;
    userState.isAuthenticated = true;

    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data._id);
    localStorage.setItem('username', data.username);

    Modal.success(`مرحباً بك يا ${data.username}! تم تسجيل الدخول بنجاح.`);
    
    updateLobbyUI();
};

const handleAuthSubmit = async (e) => {
    e.preventDefault();
    
    if (document.getElementById('auth-submit').textContent === "تسجيل الخروج") {
        handleLogout();
        return;
    }

    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const usernameInput = document.getElementById('username-input');
    
    const isRegistering = document.getElementById('auth-submit').getAttribute('data-action') === 'register';
    const username = usernameInput.value;

    if (!email || !password || (isRegistering && !username)) {
        Modal.warning('يرجى ملء جميع الحقول المطلوبة.');
        return;
    }

    const endpoint = isRegistering ? 'register' : 'login';
    const url = `${BACKEND_URL}/api/users/${endpoint}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username })
        });

        const data = await response.json();

        if (response.ok) {
            handleAuthResponse(data);
        } else {
            Modal.error(`خطأ في ${isRegistering ? 'التسجيل' : 'الدخول'}: ${data.message || 'حدث خطأ غير معروف.'}`);
        }

    } catch (error) {
        console.error('Network Error:', error);
        Modal.error('فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.');
    }
};

const handleLogout = () => {
    Modal.confirm(
        'هل أنت متأكد من تسجيل الخروج؟',
        () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            
            userState.token = null;
            userState.userId = null;
            userState.username = null;
            userState.isAuthenticated = false;

            if(socket) socket.auth.token = null; 

            updateLobbyUI();
            Modal.success('تم تسجيل الخروج بنجاح.');
        }
    );
};

// =================================================================
// 5. دوال إدارة الغرف واللعب (Room & Game Handlers)
// =================================================================

const updateRoomLobbyUI = (room) => {
    const roomCodeDisplay = document.getElementById('room-code-display');
    if (roomCodeDisplay) roomCodeDisplay.textContent = room.code;

    const playersList = document.getElementById('players-list');
    if (playersList) {
        playersList.innerHTML = '';
        room.players.forEach(p => {
            const li = document.createElement('li');
            const roleText = p.role ? (p.role === 'SPYMASTER' ? ' 👑' : ' 🎯') : '';
            const teamText = p.team ? (p.team === 'RED' ? '🔴' : '🔵') : '⚪';
            li.textContent = `${teamText} ${p.username} ${roleText}`;
            playersList.appendChild(li);
        });
    }

    const btnStart = document.getElementById('btn-start-game');
    const isHost = room.players[0] && room.players[0].userId === userState.userId;
    
    if (btnStart) {
        if (isHost && room.players.length >= 2) {
            btnStart.classList.remove('hidden');
        } else {
            btnStart.classList.add('hidden');
        }
    }
    
    // إظهار لوحة اختيار الأدوار
    document.getElementById('role-selection-area').classList.remove('hidden');
};

const handleCreateRoom = () => {
    if (!userState.isAuthenticated) {
        Modal.warning('يجب تسجيل الدخول لإنشاء غرفة.');
        return;
    }
    const customName = document.getElementById('create-name').value.toUpperCase().trim();
    
    socket.emit('createRoom', { 
        customName, 
        username: userState.username,
        userId: userState.userId
    });
};

const handleJoinRoom = () => {
    if (!userState.isAuthenticated) {
        Modal.warning('يجب تسجيل الدخول للانضمام لغرفة.');
        return;
    }
    const roomCode = document.getElementById('join-code').value.toUpperCase().trim();
    if (!roomCode) {
        Modal.warning('يرجى إدخال كود الغرفة.');
        return;
    }
    socket.emit('joinRoom', { 
        roomCode, 
        username: userState.username,
        userId: userState.userId
    });
};

const handleRoleSelection = (e) => {
    const team = e.target.closest('[data-team]')?.getAttribute('data-team');
    const role = e.target.closest('[data-role]')?.getAttribute('data-role');
    
    if (team && role) {
        socket.emit('setRole', { team, role });
    }
};

const handleStartGame = () => {
    const redSpymaster = gameState.players.some(p => p.team === 'RED' && p.role === 'SPYMASTER');
    const blueSpymaster = gameState.players.some(p => p.team === 'BLUE' && p.role === 'SPYMASTER');
    
    if (!redSpymaster || !blueSpymaster) {
        Modal.error('يجب اختيار قائد أحمر وقائد أزرق لبدء اللعبة!');
        return;
    }
    socket.emit('startGame');
};

// =================================================================
// 6. دوال رسم اللوحة والتحكم باللعبة
// =================================================================

const getCardColor = (type) => {
    switch(type) {
        case 'RED': return '#FF3B5C';
        case 'BLUE': return '#2D5FF5';
        case 'INNOCENT': return '#3D4556';
        case 'ASSASSIN': return '#13151C';
        default: return '#252B3A';
    }
};

const drawGameBoard = (board, playerRole) => {
    const gameBoard = document.getElementById('game-board');
    gameBoard.innerHTML = '';

    board.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card-word');
        cardElement.textContent = card.word;
        cardElement.setAttribute('data-index', index);
        
        if (card.revealed) {
            cardElement.classList.add('revealed', card.type);
            cardElement.style.backgroundColor = getCardColor(card.type);
        } else if (playerRole === 'SPYMASTER') {
            cardElement.style.borderColor = getCardColor(card.type);
            cardElement.style.borderWidth = '3px';
        }
        
        if (playerRole === 'GUESSER' && !card.revealed) {
            cardElement.addEventListener('click', handleCardGuess);
        }

        gameBoard.appendChild(cardElement);
    });
    
    updateScores();
};

const handleCardGuess = (e) => {
    const cardIndex = parseInt(e.target.getAttribute('data-index'));
    socket.emit('makeGuess', { cardIndex });
};

const updateGameControls = (player) => {
    const spymasterControls = document.getElementById('spymaster-controls');
    const guesserControls = document.getElementById('guesser-controls');
    
    if (player.role === 'SPYMASTER') {
        spymasterControls.classList.remove('hidden');
        guesserControls.classList.add('hidden');
    } else if (player.role === 'GUESSER') {
        spymasterControls.classList.add('hidden');
        guesserControls.classList.remove('hidden');
    }
};

const updateGameUI = () => {
    // تحديث التلميح
    if (gameState.clue) {
        document.getElementById('clue-word').textContent = gameState.clue;
    }
    
    // تحديث المحاولات المتبقية
    if (gameState.guessesLeft !== undefined) {
        document.getElementById('guesses-left').textContent = gameState.guessesLeft;
    }
    
    // تحديث الدور الحالي
    if (gameState.currentTurn) {
        const turnText = gameState.currentTurn === 'RED' ? 'دور الفريق الأحمر' : 'دور الفريق الأزرق';
        document.getElementById('current-turn-team').textContent = turnText;
    }
    
    // التحقق من الفوز
    if (gameState.winner) {
        const winnerText = gameState.winner === 'RED' ? 'الفريق الأحمر' : 'الفريق الأزرق';
        Modal.show({
            type: 'success',
            title: '🎉 انتهت اللعبة!',
            message: `فاز ${winnerText}! تهانينا! 🏆`
        });
    }
};

const updateScores = () => {
    if (!gameState.board) return;
    
    let redRemaining = 0;
    let blueRemaining = 0;
    
    gameState.board.forEach(card => {
        if (!card.revealed) {
            if (card.type === 'RED') redRemaining++;
            if (card.type === 'BLUE') blueRemaining++;
        }
    });
    
    const redScore = document.getElementById('red-remaining');
    const blueScore = document.getElementById('blue-remaining');
    
    if (redScore) redScore.textContent = redRemaining;
    if (blueScore) blueScore.textContent = blueRemaining;
};

const addToLog = (word, type) => {
    const logList = document.getElementById('log-list');
    const li = document.createElement('li');
    
    const typeEmoji = {
        'RED': '🔴',
        'BLUE': '🔵',
        'INNOCENT': '⚪',
        'ASSASSIN': '💀'
    };
    
    li.textContent = `${typeEmoji[type] || ''} ${word}`;
    logList.insertBefore(li, logList.firstChild);
    
    // الاحتفاظ بآخر 10 سجلات فقط
    while (logList.children.length > 10) {
        logList.removeChild(logList.lastChild);
    }
};

// معالجة إعطاء التلميح
const handleGiveClue = () => {
    const clueWord = document.getElementById('clue-word-input').value.trim();
    const clueCount = parseInt(document.getElementById('clue-count-input').value);
    
    if (!clueWord || !clueCount || clueCount < 1 || clueCount > 9) {
        Modal.warning('يرجى إدخال تلميح صحيح وعدد كلمات بين 1 و 9.');
        return;
    }
    
    socket.emit('giveClue', { clue: clueWord, count: clueCount });
    
    // تفريغ الحقول
    document.getElementById('clue-word-input').value = '';
    document.getElementById('clue-count-input').value = '';
};

// معالجة إنهاء الدور
const handleEndTurn = () => {
    Modal.confirm(
        'هل أنت متأكد من إنهاء الدور؟',
        () => {
            socket.emit('endTurn');
        }
    );
};

// =================================================================
// 7. 🚨 دمج وربط الأحداث النهائية (DOM Event Listeners)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // تهيئة نظام Modal
    Modal.init();
    
    // بدء عملية الاتصال
    wakeUpAndConnect(); 

    // ربط أزرار المصادقة
    const authSubmitButton = document.getElementById('auth-submit');
    const authToggleButton = document.getElementById('auth-toggle');

    if (authSubmitButton) {
        authSubmitButton.addEventListener('click', handleAuthSubmit);
        authSubmitButton.setAttribute('data-action', 'login');
    }
    
    if (authToggleButton) {
        authToggleButton.addEventListener('click', (e) => {
            const isLogin = authSubmitButton.getAttribute('data-action') === 'login';
            
            e.target.textContent = isLogin ? 'العودة للدخول' : 'تسجيل جديد';
            authSubmitButton.textContent = isLogin ? 'تسجيل جديد' : 'تسجيل الدخول';
            authSubmitButton.setAttribute('data-action', isLogin ? 'register' : 'login');
            
            const usernameField = document.getElementById('username-input');
            if (isLogin) {
                usernameField.style.display = 'block';
            } else {
                usernameField.style.display = 'none';
            }
        });
    }

    // ربط أزرار الغرفة
    const btnCreate = document.getElementById('btn-create');
    const btnJoin = document.getElementById('btn-join');
    const btnStartGame = document.getElementById('btn-start-game');

    if (btnCreate) btnCreate.addEventListener('click', handleCreateRoom);
    if (btnJoin) btnJoin.addEventListener('click', handleJoinRoom);
    if (btnStartGame) btnStartGame.addEventListener('click', handleStartGame);
    
    // ربط أزرار اختيار الدور
    const teamSelectionDiv = document.getElementById('team-selection');
    if (teamSelectionDiv) {
        teamSelectionDiv.addEventListener('click', handleRoleSelection);
    }
    
    // ربط أزرار اللعبة
    const btnGiveClue = document.getElementById('btn-give-clue');
    const btnPassTurn = document.getElementById('btn-pass-turn');
    
    if (btnGiveClue) btnGiveClue.addEventListener('click', handleGiveClue);
    if (btnPassTurn) btnPassTurn.addEventListener('click', handleEndTurn);
});
