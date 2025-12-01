{"id":"48213","variant":"standard","title":"app.js (Fixed Version)"}
/////////////////////////////
// 1) الإعدادات العامة
/////////////////////////////

const BACKEND_URL = 'https://codenames-arabic-server.onrender.com';

let socket = null;

let userState = {
    token: localStorage.getItem('token'),
    userId: localStorage.getItem('userId'),
    username: localStorage.getItem('username'),
    isAuthenticated: !!localStorage.getItem('token')
};

let gameState = {};

/////////////////////////////
// 2) UI Helpers
/////////////////////////////

const switchScreen = (id) => {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.add('hidden'); s.classList.remove('active');
    });
    const t = document.getElementById(id);
    if (t) { t.classList.remove('hidden'); t.classList.add('active'); }
};

const updateLobbyUI = () => {
    const auth = document.getElementById('auth-section');
    const room = document.getElementById('room-section');
    const username = document.getElementById('username-input');

    if (userState.isAuthenticated) {
        auth.classList.add('hidden');
        room.classList.remove('hidden');
        username.value = userState.username;
        username.disabled = true;
        document.getElementById('auth-submit').textContent = "تسجيل الخروج";
    } else {
        auth.classList.remove('hidden');
        room.classList.add('hidden');
        username.value = "";
        username.disabled = false;
        document.getElementById('auth-submit').textContent = "تسجيل الدخول";
    }
};

/////////////////////////////
// 3) Wake Server + Connect
/////////////////////////////

const wakeUpAndConnect = async () => {

    switchScreen('loading-screen');

    try {
        const res = await fetch(`${BACKEND_URL}/`);
        if (!res.ok) throw new Error("server not ok");

        console.log("Server awake. Connecting socket...");
        
        socket = io(BACKEND_URL, {
            auth: { token: userState.token }
        });

        socket.on("connect", () => {
            console.log("Socket connected:", socket.id);
            switchScreen("lobby-screen");
            updateLobbyUI();
        });

        socket.on("connect_error", (err) => {
            console.error("Socket error:", err.message);
            alert("فشل الاتصال بالخادم.");
        });

        initSocketHandlers();

    } catch (err) {
        document.querySelector('.loader-content h1').textContent = 'فشل الاتصال بالخادم 😢';
        document.querySelector('.loader-content p').textContent = 'يرجى المحاولة لاحقاً.';
    }
};

/////////////////////////////
// 4) Socket Handlers
/////////////////////////////

const initSocketHandlers = () => {

    socket.on("roomError", msg => alert(msg));

    socket.on("roomCreated", (room) => {
        gameState = room;
        switchScreen("game-screen");
        updateRoomLobbyUI(room);
    });

    socket.on("roomUpdate", (players) => {
        gameState.players = players;
        updateRoomLobbyUI(gameState);
    });

    socket.on("gameStarted", (data) => {
        gameState = data;
        switchScreen("game-screen");
        // drawGameBoard(data.board);
    });
};

/////////////////////////////
// 5) Auth
/////////////////////////////

const handleAuthSubmit = async () => {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const username = document.getElementById('username-input').value;
    const isRegistering = document.getElementById('auth-submit').textContent === "تسجيل جديد";

    if (userState.isAuthenticated) return handleLogout();
    if (!email || !password || (isRegistering && !username)) return alert("املأ جميع الحقول");

    const endpoint = isRegistering ? "register" : "login";
    const url = `${BACKEND_URL}/api/users/${endpoint}`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify({ email, password, username })
        });
        const data = await res.json();

        if (res.ok) {
            userState = {
                token: data.token,
                userId: data._id,
                username: data.username,
                isAuthenticated: true
            };
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data._id);
            localStorage.setItem('username', data.username);

            updateLobbyUI();
            alert("تم تسجيل الدخول!");
        } else alert(data.message);

    } catch (err) {
        alert("فشل الاتصال بالخادم");
    }
};

const handleLogout = () => {
    localStorage.clear();
    userState = { isAuthenticated: false };
    updateLobbyUI();
};

/////////////////////////////
// 6) Room Actions
/////////////////////////////

const handleCreateRoom = () => {
    if (!userState.isAuthenticated) return alert("سجل دخولك أولاً");

    const name = document.getElementById('create-name').value.toUpperCase().trim();
    socket.emit("createRoom", {
        customName: name,
        username: userState.username,
        userId: userState.userId
    });
};

const handleJoinRoom = () => {
    if (!userState.isAuthenticated) return alert("سجل دخولك أولاً");

    const code = document.getElementById('join-code').value.toUpperCase().trim();
    if (!code) return alert("أدخل كود الغرفة");

    socket.emit("joinRoom", {
        roomCode: code,
        username: userState.username,
        userId: userState.userId
    });
};

/////////////////////////////
// 7) Room Waiting UI
/////////////////////////////

const updateRoomLobbyUI = (room) => {

    const code = document.getElementById("room-code-display");
    if (code) code.textContent = room.code;

    const list = document.getElementById("players-list");
    list.innerHTML = "";

    room.players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.username} - ${p.team || '?'} - ${p.role || '?'}`
        list.appendChild(li);
    });
};

/////////////////////////////
// 8) DOM Listeners
/////////////////////////////

document.addEventListener("DOMContentLoaded", () => {

    wakeUpAndConnect();

    // auth
    document.getElementById('auth-submit')
        ?.addEventListener('click', handleAuthSubmit);

    document.getElementById('auth-toggle')
        ?.addEventListener('click', (e) => {
            const isLogin = e.target.textContent === 'تسجيل جديد';
            e.target.textContent = isLogin ? 'العودة للدخول' : 'تسجيل جديد';
            document.getElementById('auth-submit').textContent =
                isLogin ? 'تسجيل جديد' : 'تسجيل الدخول';
        });

    // rooms
    document.getElementById("btn-create")
        ?.addEventListener("click", handleCreateRoom);

    document.getElementById("btn-join")
        ?.addEventListener("click", handleJoinRoom);

});
