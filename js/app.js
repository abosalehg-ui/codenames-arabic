const BACKEND_URL = 'https://codenames-arabic-server.onrender.com';

let socket; // متغير لتخزين اتصال Socket.io
let userState = { // حالة المستخدم المخزنة
    token: localStorage.getItem('token') || null,
    userId: localStorage.getItem('userId') || null,
    username: localStorage.getItem('username') || null,
    isAuthenticated: !!localStorage.getItem('token')
};
let gameState = {}; // لتخزين حالة اللعبة الحالية (اللوحة، الدور، إلخ)


// =================================================================
// دوال إدارة الواجهة (UI Management Functions)
// =================================================================

/**
 * تبديل الشاشات المعروضة في الواجهة الأمامية
 * @param {string} targetScreenId - مُعرِّف الشاشة الهدف (مثل: 'lobby-screen')
 */
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

/**
 * تحديث واجهة المصادقة (إخفاء نموذج Auth وعرض نموذج Room)
 */
const updateLobbyUI = () => {
    const authSection = document.getElementById('auth-section');
    const roomSection = document.getElementById('room-section');
    const usernameInput = document.getElementById('username-input');

    if (userState.isAuthenticated) {
        authSection.classList.add('hidden');
        roomSection.classList.remove('hidden');
        usernameInput.value = userState.username;
        usernameInput.disabled = true; // منع تغيير اسم المستخدم بعد تسجيل الدخول
        document.getElementById('auth-submit').textContent = "تسجيل الخروج"; // تغيير زر الدخول/الخروج
    } else {
        authSection.classList.remove('hidden');
        roomSection.classList.add('hidden');
        usernameInput.disabled = false;
        usernameInput.value = '';
        document.getElementById('auth-submit').textContent = "تسجيل الدخول";
    }
};


// =================================================================
// 🚨 حل مشكلة Cold Start وبدء الاتصال بالخادم
// =================================================================

const wakeUpAndConnect = async () => {
    // 1. إظهار شاشة التحميل أولاً
    switchScreen('loading-screen'); 
    
    try {
        console.log('Attemping to wake up the Render server...');
        // إرسال طلب بسيط لـ / للتحقق من أن الخادم استيقظ
        const response = await fetch(`${BACKEND_URL}/`); 

        if (response.ok) {
            console.log('Server is awake! Establishing Socket.io connection...');
            
            // 2. بدء اتصال Socket.io
            socket = io(BACKEND_URL, {
                // إرسال التوكن مع الاتصال الأولي إذا كان موجوداً
                auth: { token: userState.token } 
            });

            // 3. معالجة أحداث الاتصال
            socket.on('connect', () => {
                console.log('Socket connected successfully:', socket.id);
                // بعد الاتصال بنجاح، ننتقل إلى شاشة اللوبي
                switchScreen('lobby-screen');
                updateLobbyUI(); // تحديث واجهة اللوبي بناءً على حالة المصادقة
            });

            socket.on('connect_error', (err) => {
                console.error('Socket connection error:', err.message);
                alert('خطأ في الاتصال بالخادم. يرجى تحديث الصفحة.');
                // يمكن هنا إضافة منطق للمحاولة مرة أخرى
            });

            // 4. إعداد المعالجات لأحداث اللعبة المستقبلية (في الخطوات التالية)
            setupSocketListeners(); 

        } else {
            throw new Error('Server did not respond with OK status.');
        }

    } catch (error) {
        console.error('Failed to wake up server or connect:', error);
        // عرض رسالة خطأ واضحة للمستخدم
        document.querySelector('.loader-content h1').textContent = 'فشل الاتصال بالخادم 😢';
        document.querySelector('.loader-content p').textContent = 'يرجى التأكد من تشغيل الخادم والمحاولة لاحقاً.';
    }
};

/**
 * دالة لتجميع معالجات أحداث Socket.io (سيتم ملؤها لاحقاً)
 */
const setupSocketListeners = () => {
    // ------------------------------------
    // أحداث الغرفة واللعب الأساسية
    // ------------------------------------
    
    socket.on('roomError', (message) => {
        alert(`خطأ في الغرفة: ${message}`);
    });

    socket.on('gameStarted', (data) => {
        gameState = data;
        switchScreen('game-screen');
        // هنا يتم استدعاء دالة لرسم اللوحة
        // drawGameBoard(gameState.board); 
        console.log('Game Started:', gameState);
    });

    // ... (المزيد من الأحداث مثل roomUpdate, gameUpdate)
};


// =================================================================
// بدء التطبيق
// =================================================================

// عند تحميل الصفحة بالكامل، نبدأ عملية إيقاظ الخادم والاتصال به
document.addEventListener('DOMContentLoaded', wakeUpAndConnect);

// =================================================================
// دوال معالجة المصادقة (Auth Handlers)
// =================================================================

const handleAuthResponse = (data) => {
    // 1. حفظ بيانات المستخدم والتوكن
    userState.token = data.token;
    userState.userId = data._id;
    userState.username = data.username;
    userState.isAuthenticated = true;

    // 2. التخزين المحلي لضمان استمرار الجلسة
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data._id);
    localStorage.setItem('username', data.username);

    alert(`مرحباً بك يا ${data.username}! تم تسجيل الدخول بنجاح.`);
    
    // 3. تحديث واجهة اللوبي
    updateLobbyUI();
};

const handleAuthSubmit = async () => {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const username = document.getElementById('username-input').value;
    const isRegistering = document.getElementById('auth-submit').textContent === 'تسجيل جديد';
    
    if (userState.isAuthenticated) {
        handleLogout();
        return;
    }

    if (!email || !password || (isRegistering && !username)) {
        alert('يرجى ملء جميع الحقول المطلوبة.');
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
            alert(`خطأ في ${isRegistering ? 'التسجيل' : 'الدخول'}: ${data.message || 'حدث خطأ غير معروف.'}`);
        }

    } catch (error) {
        console.error('Network Error:', error);
        alert('فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.');
    }
};

const handleLogout = () => {
    // إزالة البيانات المخزنة محلياً
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    
    // إعادة تعيين حالة المستخدم
    userState.token = null;
    userState.userId = null;
    userState.username = null;
    userState.isAuthenticated = false;

    updateLobbyUI();
    alert('تم تسجيل الخروج بنجاح.');
};

// =================================================================
// دوال إدارة الغرف (Room Handlers)
// =================================================================

const handleCreateRoom = () => {
    if (!userState.isAuthenticated) {
        alert('يجب تسجيل الدخول لإنشاء غرفة.');
        return;
    }
    
    const customName = document.getElementById('create-name').value.toUpperCase().trim();
    
    // إرسال الحدث إلى السيرفر
    socket.emit('createRoom', { 
        customName, 
        username: userState.username,
        userId: userState.userId
    });
};

const handleJoinRoom = () => {
    if (!userState.isAuthenticated) {
        alert('يجب تسجيل الدخول للانضمام لغرفة.');
        return;
    }

    const roomCode = document.getElementById('join-code').value.toUpperCase().trim();
    if (!roomCode) {
        alert('يرجى إدخال كود الغرفة.');
        return;
    }
    
    // إرسال الحدث إلى السيرفر
    socket.emit('joinRoom', { 
        roomCode, 
        username: userState.username,
        userId: userState.userId
    });
};

// ----------------------------------------------------
// ⚠️ ملاحظة: نحتاج لإنشاء شاشة انتظار (Lobby Waiting Screen) 
// ليتسنى للاعبين اختيار أدوارهم والانتظار حتى يبدأ القادة اللعبة
// ----------------------------------------------------

socket.on('roomCreated', (roomData) => {
    console.log('Room Created:', roomData);
    // يمكنك هنا التبديل إلى شاشة انتظار الدور/الفريق
    // switchScreen('waiting-room-screen');
    alert(`تم إنشاء الغرفة بنجاح. الكود: ${roomData.code}`);
    // سأفترض أننا سننتقل إلى شاشة اللعب المؤقتة (game-screen) لعرض تفاصيل الغرفة
    switchScreen('game-screen');
});

socket.on('roomUpdate', (players) => {
    console.log('Room Players Update:', players);
    // هنا يتم تحديث قائمة اللاعبين على الشاشة لعرض الأدوار والأفرقة المختارة
    // updatePlayerList(players);
});

// =================================================================
// ربط الأحداث (DOM Event Listeners)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    wakeUpAndConnect(); // بدء عملية الاتصال

    // 1. ربط أزرار المصادقة
    const authSubmitButton = document.getElementById('auth-submit');
    const authToggleButton = document.getElementById('auth-toggle');

    if (authSubmitButton) {
        authSubmitButton.addEventListener('click', handleAuthSubmit);
    }
    
    if (authToggleButton) {
        // تبديل النص بين 'تسجيل الدخول' و 'تسجيل جديد'
        authToggleButton.addEventListener('click', (e) => {
            const isLogin = e.target.textContent === 'تسجيل جديد';
            e.target.textContent = isLogin ? 'العودة للدخول' : 'تسجيل جديد';
            
            const submitBtn = document.getElementById('auth-submit');
            submitBtn.textContent = isLogin ? 'تسجيل جديد' : 'تسجيل الدخول';
        });
    }

    // 2. ربط أزرار الغرفة
    const btnCreate = document.getElementById('btn-create');
    const btnJoin = document.getElementById('btn-join');

    if (btnCreate) {
        btnCreate.addEventListener('click', handleCreateRoom);
    }
    if (btnJoin) {
        btnJoin.addEventListener('click', handleJoinRoom);
    }
    
    // ... سيتم إضافة ربط بقية أزرار اللعب (Give Clue, Pass Turn, Start Game) لاحقاً ...
});

// =================================================================
// 🚨 تحديث الدوال السابقة لإظهار شاشة اختيار الأدوار
// =================================================================

// تحديث event listener للغرف في setupSocketListeners
socket.on('roomCreated', (roomData) => {
    gameState = roomData;
    switchScreen('game-screen'); // أو شاشة الانتظار المخصصة
    updateRoomLobbyUI(gameState);
});

socket.on('roomUpdate', (players) => {
    // يتم استدعاء هذه الدالة عند انضمام/مغادرة لاعب أو تغيير دور
    gameState.players = players;
    updateRoomLobbyUI(gameState);
});

// =================================================================
// 4. دوال إدارة شاشة انتظار الغرفة واختيار الأدوار
// =================================================================

const updateRoomLobbyUI = (room) => {
    // عرض كود الغرفة
    const roomCodeDisplay = document.getElementById('room-code-display');
    if (roomCodeDisplay) {
        roomCodeDisplay.textContent = room.code;
    }

    // عرض قائمة اللاعبين وأدوارهم
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    room.players.forEach(p => {
        const li = document.createElement('li');
        const roleText = p.role ? (p.role === 'SPYMASTER' ? ' (قائد)' : ' (مخمن)') : '';
        const teamText = p.team ? (p.team === 'RED' ? '🔴' : '🔵') : '⚪';
        
        li.textContent = `${teamText} ${p.username} ${roleText}`;
        playersList.appendChild(li);
    });
    
    // إظهار زر بدء اللعبة (فقط لشخص واحد، يمكن تحديده كأول لاعب ينضم)
    const btnStart = document.getElementById('btn-start-game');
    const isHost = room.players[0] && room.players[0].userId === userState.userId;
    
    if (isHost && room.players.length >= 2) { // شرط أساسي لوجود لاعبين على الأقل
        btnStart.classList.remove('hidden');
    } else {
        btnStart.classList.add('hidden');
    }
};

const handleRoleSelection = (e) => {
    const team = e.target.getAttribute('data-team');
    const role = e.target.getAttribute('data-role');
    
    if (team && role) {
        socket.emit('setRole', { team, role });
        // يمكن هنا إضافة تأثير بصري على الزر المختار
    }
};

const handleStartGame = () => {
    // يجب أن يتم التحقق من وجود قائدين (أحمر وأزرق) في الواجهة الأمامية أيضاً قبل الإرسال
    const redSpymaster = gameState.players.some(p => p.team === 'RED' && p.role === 'SPYMASTER');
    const blueSpymaster = gameState.players.some(p => p.team === 'BLUE' && p.role === 'SPYMASTER');
    
    if (!redSpymaster || !blueSpymaster) {
        alert('يجب اختيار قائد أحمر وقائد أزرق لبدء اللعبة!');
        return;
    }

    socket.emit('startGame');
};

// ... (يجب إضافة Event Listener في نهاية الملف) ...
// -----------------------------------------------------------------
// ربط أزرار اختيار الدور وزر بدء اللعبة
// -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

    const teamSelectionDiv = document.getElementById('team-selection');
    if (teamSelectionDiv) {
        teamSelectionDiv.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                handleRoleSelection(e);
            }
        });
    }

    const btnStartGame = document.getElementById('btn-start-game');
    if (btnStartGame) {
        btnStartGame.addEventListener('click', handleStartGame);
    }
});

// =================================================================
// 5. دوال رسم اللوحة وتحديث الواجهة
// =================================================================

/**
 * رسم لوحة اللعب 5x5 بناءً على بيانات الخادم
 * @param {Array} board - مصفوفة البطاقات (25 بطاقة)
 * @param {string} playerRole - دور اللاعب الحالي (SPYMASTER/GUESSER)
 */
const drawGameBoard = (board, playerRole) => {
    const gameBoard = document.getElementById('game-board');
    gameBoard.innerHTML = ''; // تنظيف اللوحة القديمة

    board.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card-word');
        
        // عرض الكلمة
        cardElement.textContent = card.word;
        cardElement.setAttribute('data-index', index); // لتحديد البطاقة عند النقر
        
        // 1. تحديد ما إذا كانت مكشوفة
        if (card.revealed) {
            cardElement.classList.add('revealed', card.type);
            cardElement.style.backgroundColor = getCardColor(card.type); // تطبيق لون الخلفية
        } else if (playerRole === 'SPYMASTER') {
            // 2. إذا كان قائداً، يجب أن يرى الألوان حتى للبطاقات غير المكشوفة
            cardElement.classList.add(card.type);
            cardElement.style.borderColor = getCardColor(card.type); // إظهار اللون بالحدود
        }
        
        // 3. إضافة معالج النقر (للمخمن فقط)
        if (playerRole === 'GUESSER' && !card.revealed) {
            cardElement.addEventListener('click', handleCardGuess);
        }

        gameBoard.appendChild(cardElement);
    });
};

const getCardColor = (type) => {
    switch(type) {
        case 'RED': return '#B80F0A';
        case 'BLUE': return '#0038A8';
        case 'INNOCENT': return '#F0E6D8';
        case 'ASSASSIN': return '#1A1A1A';
        default: return 'white';
    }
};

const handleCardGuess = (e) => {
    const cardIndex = parseInt(e.target.getAttribute('data-index'));
    
    // التحقق من أن الدور حالياً هو التخمين (GUESSING)
    // وأن المخمن هو صاحب الدور (يجب أن يتم التحقق بشكل كامل في الـ Backend)
    
    socket.emit('makeGuess', { cardIndex });
};
