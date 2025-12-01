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
    const usernameInput = document.getElementById('username-input');

    if (userState.isAuthenticated) {
        authSection.classList.add('hidden');
        roomSection.classList.remove('hidden');
        
        // تحديث اسم المستخدم المعروض (يجب أن يكون لديك عنصر في HTML باسم 'current-username')
        const currentUsernameDisplay = document.getElementById('current-username');
        if (currentUsernameDisplay) {
             currentUsernameDisplay.textContent = userState.username;
        }

        document.getElementById('auth-submit').textContent = "تسجيل الخروج";
        document.getElementById('auth-toggle').classList.add('hidden'); // إخفاء زر التبديل عند الدخول
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
        console.log('Attemping to wake up the Render server...');
        // إرسال طلب بسيط لـ / للتحقق من أن الخادم استيقظ
        const response = await fetch(`${BACKEND_URL}/`); 

        if (response.ok) {
            console.log('Server is awake! Establishing Socket.io connection...');
            
            // 2. بدء اتصال Socket.io
            socket = io(BACKEND_URL, {
                auth: { token: userState.token } 
            });

            // 3. إعداد المعالجات لأحداث اللعبة قبل الاتصال (لضمان عدم فقدان أي حدث)
            setupSocketListeners(); 

            // 4. معالجة أحداث الاتصال
            socket.on('connect', () => {
                console.log('Socket connected successfully:', socket.id);
                // بعد الاتصال بنجاح، ننتقل إلى شاشة اللوبي
                switchScreen('lobby-screen');
                updateLobbyUI(); 
            });

            socket.on('connect_error', (err) => {
                console.error('Socket connection error:', err.message);
                alert('خطأ في الاتصال بالخادم. يرجى تحديث الصفحة.');
                document.querySelector('.loader-content p').textContent = 'خطأ في الاتصال (Socket.io). ربما خطأ في CORS أو الشبكة.';
            });

        } else {
            throw new new Error('Server did not respond with OK status.');
        }

    } catch (error) {
        console.error('Failed to wake up server or connect:', error);
        // عرض رسالة خطأ واضحة للمستخدم
        document.querySelector('.loader-content h1').textContent = 'فشل الاتصال بالخادم 😢';
        document.querySelector('.loader-content p').textContent = 'يرجى التأكد من تشغيل الخادم والمحاولة لاحقاً.';
    }
};

// =================================================================
// 3. دالة تجميع معالجات أحداث Socket.io
// =================================================================

const setupSocketListeners = () => {
    
    // أحداث الغرفة واللعب الأساسية
    socket.on('roomError', (message) => {
        alert(`خطأ في الغرفة: ${message}`);
    });

    socket.on('roomCreated', (roomData) => {
        gameState = roomData;
        switchScreen('game-screen'); // أو شاشة الانتظار المخصصة
        updateRoomLobbyUI(gameState);
        alert(`تم إنشاء الغرفة بنجاح. الكود: ${roomData.code}`);
    });

    socket.on('roomUpdate', (players) => {
        gameState.players = players;
        updateRoomLobbyUI(gameState);
    });
    
    socket.on('gameStarted', (data) => {
        gameState = data;
        switchScreen('game-screen');
        // هنا يجب تحديد دور اللاعب الحالي لرسم اللوحة
        const player = gameState.players.find(p => p.id === socket.id);
        if (player) {
            drawGameBoard(gameState.board, player.role);
        }
        console.log('Game Started:', gameState);
    });

    // ... (المزيد من الأحداث مثل gameUpdate, cardRevealed)
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

    alert(`مرحباً بك يا ${data.username}! تم تسجيل الدخول بنجاح.`);
    
    updateLobbyUI();
};

const handleAuthSubmit = async (e) => {
    e.preventDefault(); // منع إعادة تحميل الصفحة
    
    // إذا كان الزر يعرض 'تسجيل الخروج'، نفذ الخروج
    if (document.getElementById('auth-submit').textContent === "تسجيل الخروج") {
        handleLogout();
        return;
    }

    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const usernameInput = document.getElementById('username-input');
    
    // 🚨 التصحيح: تحديد هل العملية تسجيل أو دخول بناءً على حالة زر التبديل
    const isRegistering = document.getElementById('auth-submit').getAttribute('data-action') === 'register';
    const username = usernameInput.value;


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
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    
    userState.token = null;
    userState.userId = null;
    userState.username = null;
    userState.isAuthenticated = false;

    // إعادة الاتصال بالـ Socket لإزالة التوكن القديم
    if(socket) socket.auth.token = null; 

    updateLobbyUI();
    alert('تم تسجيل الخروج بنجاح.');
};


// =================================================================
// 5. دوال إدارة الغرف واللعب (Room & Game Handlers)
// =================================================================

const updateRoomLobbyUI = (room) => {
    const roomCodeDisplay = document.getElementById('room-code-display');
    if (roomCodeDisplay) roomCodeDisplay.textContent = room.code;

    // (منطق عرض اللاعبين والأدوار)
    const playersList = document.getElementById('players-list');
    if (playersList) {
        playersList.innerHTML = '';
        room.players.forEach(p => {
            const li = document.createElement('li');
            const roleText = p.role ? (p.role === 'SPYMASTER' ? ' (قائد)' : ' (مخمن)') : '';
            const teamText = p.team ? (p.team === 'RED' ? '🔴' : '🔵') : '⚪';
            li.textContent = `${teamText} ${p.username} ${roleText}`;
            playersList.appendChild(li);
        });
    }

    // (منطق إظهار زر بدء اللعبة)
    const btnStart = document.getElementById('btn-start-game');
    const isHost = room.players[0] && room.players[0].userId === userState.userId;
    
    if (btnStart) {
        if (isHost && room.players.length >= 2) {
            btnStart.classList.remove('hidden');
        } else {
            btnStart.classList.add('hidden');
        }
    }
};

const handleCreateRoom = () => {
    if (!userState.isAuthenticated) {
        alert('يجب تسجيل الدخول لإنشاء غرفة.');
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
        alert('يجب تسجيل الدخول للانضمام لغرفة.');
        return;
    }
    const roomCode = document.getElementById('join-code').value.toUpperCase().trim();
    if (!roomCode) {
        alert('يرجى إدخال كود الغرفة.');
        return;
    }
    socket.emit('joinRoom', { 
        roomCode, 
        username: userState.username,
        userId: userState.userId
    });
};

const handleRoleSelection = (e) => {
    const team = e.target.getAttribute('data-team');
    const role = e.target.getAttribute('data-role');
    
    if (team && role) {
        socket.emit('setRole', { team, role });
    }
};

const handleStartGame = () => {
    // (منطق التحقق من القادة)
    const redSpymaster = gameState.players.some(p => p.team === 'RED' && p.role === 'SPYMASTER');
    const blueSpymaster = gameState.players.some(p => p.team === 'BLUE' && p.role === 'SPYMASTER');
    
    if (!redSpymaster || !blueSpymaster) {
        alert('يجب اختيار قائد أحمر وقائد أزرق لبدء اللعبة!');
        return;
    }
    socket.emit('startGame');
};


// 6. دوال رسم اللوحة والألوان (يجب أن تسبق دالة drawGameBoard)
const getCardColor = (type) => {
    switch(type) {
        case 'RED': return '#B80F0A';
        case 'BLUE': return '#0038A8';
        case 'INNOCENT': return '#F0E6D8';
        case 'ASSASSIN': return '#1A1A1A';
        default: return 'white';
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
            cardElement.classList.add(card.type);
            cardElement.style.borderColor = getCardColor(card.type); 
        }
        
        // إضافة معالج النقر (للمخمن فقط)
        if (playerRole === 'GUESSER' && !card.revealed) {
            cardElement.addEventListener('click', handleCardGuess);
        }

        gameBoard.appendChild(cardElement);
    });
};

const handleCardGuess = (e) => {
    const cardIndex = parseInt(e.target.getAttribute('data-index'));
    socket.emit('makeGuess', { cardIndex });
};


// =================================================================
// 7. 🚨 دمج وربط الأحداث النهائية (DOM Event Listeners)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. بدء عملية الاتصال والـ Cold Start
    wakeUpAndConnect(); 

    // 2. ربط أزرار المصادقة
    const authSubmitButton = document.getElementById('auth-submit');
    const authToggleButton = document.getElementById('auth-toggle');

    if (authSubmitButton) {
        authSubmitButton.addEventListener('click', handleAuthSubmit);
        // التعيين المبدئي للإجراء
        authSubmitButton.setAttribute('data-action', 'login');
    }
    
    if (authToggleButton) {
        // تبديل حالة زر الدخول/التسجيل
        authToggleButton.addEventListener('click', (e) => {
            const isLogin = authSubmitButton.getAttribute('data-action') === 'login';
            
            e.target.textContent = isLogin ? 'العودة للدخول' : 'تسجيل جديد';
            authSubmitButton.textContent = isLogin ? 'تسجيل جديد' : 'تسجيل الدخول';
            authSubmitButton.setAttribute('data-action', isLogin ? 'register' : 'login');
            
            const usernameField = document.getElementById('username-input');
            usernameField.classList.toggle('hidden', !isLogin); // إظهار الاسم عند التسجيل
        });
    }

    // 3. ربط أزرار الغرفة
    const btnCreate = document.getElementById('btn-create');
    const btnJoin = document.getElementById('btn-join');
    const btnStartGame = document.getElementById('btn-start-game');

    if (btnCreate) btnCreate.addEventListener('click', handleCreateRoom);
    if (btnJoin) btnJoin.addEventListener('click', handleJoinRoom);
    if (btnStartGame) btnStartGame.addEventListener('click', handleStartGame);
    
    // 4. ربط أزرار اختيار الدور
    const teamSelectionDiv = document.getElementById('team-selection');
    if (teamSelectionDiv) {
        teamSelectionDiv.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                handleRoleSelection(e);
            }
        });
    }
});
