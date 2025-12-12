// ============================================
// ⚙️ الإعدادات العامة
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
    guessesLeft: 0,
    players: []
};

// ============================================
// 🔊 تشغيل الأصوات
// ============================================
const playSound = (name) => {
    if (typeof Audio !== 'undefined') {
        try {
            const audio = new Audio(`./assets/sounds/${name}.mp3`);
            audio.volume = 0.5;
            audio.play()
                .then(() => console.log(`✅ تم تشغيل الصوت: ${name}`))
                .catch(e => console.warn(`⚠️ فشل تشغيل الصوت (${name}):`, e));
        } catch (e) {
            console.error('خطأ في الصوت:', e);
        }
    }
};

// ============================================
// 🛠️ الأدوات المساعدة
// ============================================
const $ = (id) => document.getElementById(id);

const switchScreen = (screenId) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
};

// ============================================
// ⏳ مؤشر التحميل
// ============================================
const Loading = {
    show() {
        $('loading-overlay').classList.remove('hidden');
    },
    hide() {
        $('loading-overlay').classList.add('hidden');
    }
};

// ============================================
// 🎭 النوافذ المنبثقة
// ============================================
const Modal = {
    currentCallback: null,
    
    show(icon, title, message, onConfirm = null) {
        $('modal-icon').textContent = icon;
        $('modal-title').textContent = title;
        $('modal-message').textContent = message;
        $('modal').classList.add('active');
        
        this.currentCallback = onConfirm;
    },
    
    hide() {
        $('modal').classList.remove('active');
        this.currentCallback = null;
    },
    
    confirm() {
        if (this.currentCallback) {
            this.currentCallback();
        }
        this.hide();
    },
    
    success(message, onConfirm) {
        this.show('✅', 'نجاح!', message, onConfirm);
    },
    
    error(message) {
        this.show('❌', 'خطأ!', message);
    },
    
    info(message) {
        this.show('ℹ️', 'معلومة', message);
    },
    
    askConfirmation(message, onConfirm) {
        this.show('⚠️', 'تأكيد', message, onConfirm);
    }
};

// ============================================
// 🌐 اتصال Socket.IO
// ============================================
const connectSocket = () => {
    Loading.show();
    
    socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    // الاتصال
    socket.on('connect', () => {
        console.log('✅ تم الاتصال:', socket.id);
        Loading.hide();
        playSound('connected');
    });

    socket.on('disconnect', () => {
        console.log('⛔ انقطع الاتصال');
        Loading.hide();
    });

    socket.on('connect_error', (error) => {
        console.error('❌ خطأ في الاتصال:', error);
        Loading.hide();
        Modal.error('فشل الاتصال بالخادم. يرجى المحاولة لاحقاً.');
    });

    // أحداث الغرفة
    socket.on('roomCreated', handleRoomCreated);
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('roomError', (msg) => {
        Loading.hide();
        Modal.error(msg);
    });

    // أحداث اللعبة
    socket.on('gameStarted', handleGameStarted);
    socket.on('gameUpdate', handleGameUpdate);
    socket.on('clueGiven', handleClueGiven);
    socket.on('cardRevealed', handleCardRevealed);
    socket.on('gameError', (msg) => {
        Loading.hide();
        Modal.error(msg);
    });

    // أحداث اللاعبين
    socket.on('playerDisconnected', (data) => {
        Modal.info(`انقطع اتصال ${data.username}`);
    });
    
    socket.on('playerReconnected', (data) => {
        Modal.info(`أعاد ${data.username} الاتصال`);
    });
};

// ============================================
// 📥 معالجات أحداث Socket
// ============================================

// إنشاء غرفة
const handleRoomCreated = (data) => {
    console.log('🎉 تم إنشاء الغرفة:', data);
    Loading.hide();
    playSound('connected');
    
    gameState.roomCode = data.code;
    gameState.players = data.players;
    
    $('room-code-display').textContent = data.code;
    switchScreen('waiting-room');
    updatePlayersList(data.players);
    
    Modal.success(`تم إنشاء الغرفة بنجاح! الكود: ${data.code}`);
};

// تحديث الغرفة
const handleRoomUpdate = (players) => {
    console.log('🔄 تحديث الغرفة:', players);
    gameState.players = players;
    updatePlayersList(players);
};

// بدء اللعبة
const handleGameStarted = (data) => {
    console.log('🎮 بدأت اللعبة:', data);
    Loading.hide();
    playSound('game_start');
    
    gameState.board = data.board;
    gameState.currentTurn = data.currentTurn;
    gameState.firstTeam = data.firstTeam;
    
    // العثور على بيانات اللاعب الحالي
    const myPlayer = data.players.find(p => 
        p.socketId === socket.id || p.id === socket.id
    );
    
    if (myPlayer) {
        gameState.myTeam = myPlayer.team;
        gameState.myRole = myPlayer.role;
    }
    
    $('game-room-code').textContent = gameState.roomCode;
    switchScreen('game-screen');
    renderBoard();
    updatePlayerBadge();
    updateGameUI(data);
    
    Modal.success('بدأت اللعبة! حظاً موفقاً! 🎮');
};

// تحديث اللعبة
const handleGameUpdate = (data) => {
    console.log('🔄 تحديث اللعبة:', data);
    
    if (data.currentTurn) gameState.currentTurn = data.currentTurn;
    if (data.clue) gameState.clue = data.clue;
    if (data.guessesLeft !== undefined) gameState.guessesLeft = data.guessesLeft;
    if (data.board) gameState.board = data.board;
    
    updateGameUI(data);
    
    // التحقق من الفائز
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

// إعطاء تلميح
const handleClueGiven = (data) => {
    console.log('💡 تم إعطاء تلميح:', data);
    playSound('clue_given');
    
    gameState.clue = data.clue;
    gameState.guessesLeft = data.count + 1;
    
    $('current-clue').textContent = data.clue;
    $('clue-guesses').innerHTML = `محاولات متبقية: <strong>${data.count + 1}</strong>`;
    
    const teamText = data.team === 'RED' ? 'الأحمر' : 'الأزرق';
    Modal.info(`تلميح جديد من الفريق ${teamText}: "${data.clue}" - ${data.count} كلمات`);
};

// كشف بطاقة
const handleCardRevealed = (data) => {
    console.log('🎴 تم كشف بطاقة:', data);
    
    const { cardIndex, card } = data;
    
    // تحديث حالة اللوحة المحلية
    if (gameState.board[cardIndex]) {
        gameState.board[cardIndex] = card;
    }
    
    // تحديث واجهة المستخدم
    const cardElement = document.querySelector(`[data-index="${cardIndex}"]`);
    if (cardElement) {
        cardElement.classList.add('revealed', card.type);
    }
    
    // تشغيل الصوت المناسب
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
    
    // تحديث المحاولات المتبقية
    if (gameState.guessesLeft > 0) {
        gameState.guessesLeft--;
        $('clue-guesses').innerHTML = `محاولات متبقية: <strong>${gameState.guessesLeft}</strong>`;
    }
};

// ============================================
// 🏠 الشاشة الرئيسية
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
// 🏢 شاشة اللوبي
// ============================================

// إنشاء غرفة
$('btn-create-room').addEventListener('click', () => {
    const customName = $('create-room-name').value.toUpperCase().trim();
    
    if (customName && customName.length !== 6) {
        Modal.error('الاسم المخصص يجب أن يكون 6 أحرف بالضبط');
        return;
    }
    
    Loading.show();
    socket.emit('createRoom', {
        customName,
        username: gameState.username,
        userId: gameState.userId
    });
});

// الانضمام لغرفة
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
    
    Loading.show();
    socket.emit('joinRoom', {
        roomCode: code,
        username: gameState.username,
        userId: gameState.userId
    });
    
    socket.once('roomUpdate', (players) => {
        Loading.hide();
        gameState.roomCode = code;
        $('room-code-display').textContent = code;
        switchScreen('waiting-room');
        updatePlayersList(players);
    });
});

// العودة للشاشة الرئيسية
$('btn-back-home').addEventListener('click', () => {
    if (socket) {
        socket.disconnect();
    }
    switchScreen('home-screen');
});

// ============================================
// ⏳ غرفة الانتظار
// ============================================

// اختيار الدور
document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const team = this.dataset.team;
        const role = this.dataset.role;
        
        gameState.myTeam = team;
        gameState.myRole = role;
        
        socket.emit('setRole', { team, role });
        
        // تأثير بصري
        document.querySelectorAll('.role-btn').forEach(b => {
            b.style.opacity = '0.5';
        });
        this.style.opacity = '1';
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 200);
        
        playSound('click');
    });
});

// بدء اللعبة
$('btn-start-game').addEventListener('click', () => {
    Loading.show();
    socket.emit('startGame');
});

// مغادرة الغرفة
$('btn-leave-room').addEventListener('click', () => {
    Modal.askConfirmation('هل تريد مغادرة الغرفة؟', () => {
        switchScreen('lobby-screen');
    });
});

// تحديث قائمة اللاعبين
const updatePlayersList = (players) => {
    const list = $('players-list');
    $('players-count').textContent = players.length;
    
    list.innerHTML = players.map(p => {
        const teamIcon = p.team === 'RED' ? '🔴' : p.team === 'BLUE' ? '🔵' : '⚪';
        const roleIcon = p.role === 'SPYMASTER' ? ' 👑' : p.role === 'GUESSER' ? ' 🔍' : '';
        const isMe = p.id === socket.id || p.socketId === socket.id;
        
        return `
            <li style="padding: var(--spacing-md); background: var(--bg-secondary); 
                border-radius: var(--radius-sm); ${isMe ? 'border: 2px solid var(--color-blue);' : ''}">
                ${teamIcon} ${p.username}${roleIcon} ${isMe ? '(أنت)' : ''}
            </li>
        `;
    }).join('');
    
    // إظهار زر البدء إذا كان المضيف ويوجد لاعبون كافيون
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
// 🎮 شاشة اللعبة
// ============================================

// عرض اللوحة
const renderBoard = () => {
    const board = $('game-board');
    board.innerHTML = '';
    
    if (!gameState.board || gameState.board.length === 0) {
        console.error('❌ لا توجد بيانات للوحة');
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
            // إظهار تلميحات الألوان للقائد
            const hintClass = {
                'RED': 'spy-hint-red',
                'BLUE': 'spy-hint-blue',
                'INNOCENT': 'spy-hint-beige',
                'ASSASSIN': 'spy-hint-black'
            };
            div.classList.add(hintClass[card.type]);
        }
        
        // إضافة معالج النقر للمخمنين
        if (gameState.myRole === 'GUESSER' && !card.revealed && 
            gameState.currentTurn === gameState.myTeam) {
            div.addEventListener('click', () => handleCardClick(index));
        }
        
        board.appendChild(div);
    });
    
    updateControls();
    updateScores();
};

// معالجة نقرة البطاقة
const handleCardClick = (index) => {
    if (gameState.guessesLeft === 0) {
        Modal.error('لا توجد محاولات متبقية');
        return;
    }
    
    playSound('click');
    socket.emit('makeGuess', { cardIndex: index });
};

// تحديث أدوات التحكم
const updateControls = () => {
    const spymaster = $('spymaster-controls');
    const guesser = $('guesser-controls');
    
    const isMyTurn = gameState.currentTurn === gameState.myTeam;
    
    if (gameState.myRole === 'SPYMASTER') {
        spymaster.classList.toggle('hidden', !isMyTurn);
        guesser.classList.add('hidden');
    } else if (gameState.myRole === 'GUESSER') {
        spymaster.classList.add('hidden');
        guesser.classList.toggle('hidden', !isMyTurn);
    } else {
        spymaster.classList.add('hidden');
        guesser.classList.add('hidden');
    }
};

// تحديث واجهة اللعبة
const updateGameUI = (data) => {
    // تحديث مؤشر الدور
    if (data.currentTurn) {
        const isMyTurn = data.currentTurn === gameState.myTeam;
        const turnText = data.currentTurn === 'RED' ? 
            '🔴 دور الفريق الأحمر' : '🔵 دور الفريق الأزرق';
        
        $('turn-indicator').textContent = turnText + (isMyTurn ? ' (دوركم!)' : '');
        $('turn-indicator').style.background = data.currentTurn === 'RED' ? 
            'linear-gradient(135deg, rgba(211, 47, 47, 0.2), transparent)' :
            'linear-gradient(135deg, rgba(25, 118, 210, 0.2), transparent)';
    }
    
    // تحديث عرض التلميح
    if (data.clue) {
        $('current-clue').textContent = data.clue;
    }
    
    if (data.guessesLeft !== undefined) {
        $('clue-guesses').innerHTML = `محاولات متبقية: <strong>${data.guessesLeft}</strong>`;
    }
    
    updateScores();
    updateControls();
};

// تحديث النتائج
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

// تحديث شارة اللاعب
const updatePlayerBadge = () => {
    const badge = $('player-info-badge');
    if (!badge) return;
    
    const teamText = gameState.myTeam === 'RED' ? '🔴 الفريق الأحمر' : 
                     gameState.myTeam === 'BLUE' ? '🔵 الفريق الأزرق' : 'لا فريق';
    
    const roleText = gameState.myRole === 'SPYMASTER' ? '👑 القائد' : 
                     gameState.myRole === 'GUESSER' ? '🔍 المخمن' : '';
    
    badge.querySelector('.badge-team').textContent = teamText;
    badge.querySelector('.badge-role').textContent = roleText;
    
    // إضافة فئة الفريق
    badge.classList.remove('team-red', 'team-blue');
    if (gameState.myTeam === 'RED') {
        badge.classList.add('team-red');
        badge.querySelector('.badge-icon').textContent = '🔴';
    } else if (gameState.myTeam === 'BLUE') {
        badge.classList.add('team-blue');
        badge.querySelector('.badge-icon').textContent = '🔵';
    }
};

// ============================================
// 👑 أدوات القائد
// ============================================
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
    
    // تأكيد إعطاء التلميح
    Modal.askConfirmation(
        `هل تريد إعطاء التلميح: "${clue}" - ${count} كلمات؟`,
        () => {
            Loading.show();
            socket.emit('giveClue', { clue, count });
            
            // مسح الحقول
            $('clue-input').value = '';
            $('count-input').value = '';
            
            setTimeout(() => Loading.hide(), 1000);
        }
    );
});

// ============================================
// 🔍 أدوات المخمن
// ============================================
$('btn-end-turn').addEventListener('click', () => {
    Modal.askConfirmation('هل تريد إنهاء دورك؟', () => {
        playSound('door');
        socket.emit('endTurn');
    });
});

// ============================================
// 🎭 أحداث النافذة المنبثقة
// ============================================
$('modal-confirm').addEventListener('click', () => {
    Modal.confirm();
});

$('modal').addEventListener('click', (e) => {
    if (e.target === $('modal')) {
        Modal.hide();
    }
});

// إغلاق بزر ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('modal').classList.contains('active')) {
        Modal.hide();
    }
});

// ============================================
// ⌨️ اختصارات لوحة المفاتيح
// ============================================
$('username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') $('btn-enter-game').click();
});

$('join-room-code').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') $('btn-join-room').click();
});

$('clue-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') $('btn-give-clue').click();
});

// ============================================
// 🚀 التهيئة عند تحميل الصفحة
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 تم تحميل التطبيق');
    
    // إيقاظ الخادم
    fetch(`${BACKEND_URL}/`)
        .then(() => console.log('✅ تم الاتصال بالخادم'))
        .catch(err => console.warn('⚠️ فشل الاتصال بالخادم:', err));
    
    // التركيز على حقل الاسم
    $('username-input').focus();
    
    console.log('🎉 جاهز للعب!');
});
