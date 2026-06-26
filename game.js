const SUPABASE_URL = 'https://bszfmbxcojeyfbeovxsx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vPyWWlYyhKmsgU2ZEnSUcQ_gVNBIhHH';
const isSupabaseConfigured = SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('ВСТАВЬ');
const supabaseClient = isSupabaseConfigured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentPlayer = null;
let gamePlayerName = '';

function getSavedNames() {
    try { return JSON.parse(localStorage.getItem('mia_saved_names_' + (currentPlayer?.id || 'guest')) || '[]'); }
    catch(e) { return []; }
}

function saveName(name) {
    const key = 'mia_saved_names_' + (currentPlayer?.id || 'guest');
    const names = getSavedNames().filter(n => n !== name);
    names.unshift(name);
    if (names.length > 5) names.length = 5;
    localStorage.setItem(key, JSON.stringify(names));
}

function renderSavedNames() {
    const container = document.getElementById('saved-names-container');
    const names = getSavedNames();
    if (names.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'flex';
    container.innerHTML = '';
    names.forEach(n => {
        const btn = document.createElement('button');
        btn.className = 'saved-name-btn';
        btn.textContent = n;
        btn.addEventListener('click', () => selectSavedName(n));
        container.appendChild(btn);
    });
}

function selectSavedName(name) {
    document.getElementById('player-name-input').value = name;
}

function setAuthMessage(msg) {
    const el = document.getElementById('auth-message');
    if (el) el.textContent = msg;
}

function showGameUI() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('leaderboard-panel').style.display = 'block';
    document.getElementById('player-bar').style.display = 'block';
    document.getElementById('lives-display').style.display = 'block';
    document.getElementById('current-player-name').textContent = currentPlayer?.name || 'Гравець';
    // Telegram Mini App: show BackButton
    if (window.__tgBackButton) window.__tgBackButton.show();
}

function showAuthUI() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('leaderboard-panel').style.display = 'none';
    document.getElementById('player-bar').style.display = 'none';
    document.getElementById('lives-display').style.display = 'none';
    resetAuthForms();
}

function resetAuthForms() {
    document.getElementById('auth-question').style.display = 'block';
    document.getElementById('auth-login-form').style.display = 'none';
    document.getElementById('auth-register-form').style.display = 'none';
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-name').value = '';
    document.getElementById('auth-email2').value = '';
    document.getElementById('auth-password2').value = '';
    const msg = document.getElementById('auth-message');
    if (msg) msg.textContent = '';
    const msg2 = document.getElementById('auth-message-register');
    if (msg2) msg2.textContent = '';
}

function showLoginForm() {
    document.getElementById('auth-question').style.display = 'none';
    document.getElementById('auth-login-form').style.display = 'block';
    document.getElementById('auth-register-form').style.display = 'none';
    document.getElementById('auth-message').textContent = '';
}

function showRegisterForm() {
    document.getElementById('auth-question').style.display = 'none';
    document.getElementById('auth-login-form').style.display = 'none';
    document.getElementById('auth-register-form').style.display = 'block';
    document.getElementById('auth-message-register').textContent = '';
}

function showStartUI() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('leaderboard-panel').style.display = 'block';
    document.getElementById('player-bar').style.display = 'none';
    document.getElementById('lives-display').style.display = 'none';

    if (currentPlayer) {
        // Залогинен — показываем только "Начать гру" и "Змінити акаунт"
        document.getElementById('logged-in-container').style.display = 'block';
        document.getElementById('guest-container').style.display = 'none';
        document.getElementById('greeting-text').textContent = 'Ласкаво просимо, ' + (currentPlayer?.name || '') + '!';
    } else {
        // Гость — показываем ввод имени
        document.getElementById('logged-in-container').style.display = 'none';
        document.getElementById('guest-container').style.display = 'block';
        document.getElementById('greeting-text').textContent = 'Ласкаво просимо!';
        renderSavedNames();
        const savedNames = getSavedNames();
        if (savedNames.length > 0) {
            document.getElementById('player-name-input').value = savedNames[0];
        }
    }
}

async function loadPlayerProfile(user) {
    if (!supabaseClient) return;
    const { data } = await supabaseClient
        .from('profiles')
        .select('id, player_name')
        .eq('id', user.id)
        .single();
    currentPlayer = {
        id: user.id,
        email: user.email,
        name: data?.player_name || user.email
    };
}

async function refreshLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list || !supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('scores')
        .select('score, player_name')
        .order('score', { ascending: false })
        .limit(10);

    if (error) {
        list.innerHTML = '<li style="color:#FF6699;">Помилка</li>';
        return;
    }

    list.innerHTML = '';
    (data || []).forEach(row => {
        const li = document.createElement('li');
        li.textContent = row.player_name + ': ' + row.score;
        list.appendChild(li);
    });
}

async function submitScore(score) {
    if (!supabaseClient || !currentPlayer || !score) return;
    const { data: oldScore } = await supabaseClient
        .from('scores')
        .select('id, score')
        .eq('user_id', currentPlayer.id)
        .maybeSingle();

    if (!oldScore) {
        await supabaseClient.from('scores').insert({
            user_id: currentPlayer.id,
            player_name: currentPlayer.name,
            score
        });
    } else if (score > oldScore.score) {
        await supabaseClient
            .from('scores')
            .update({ score, player_name: currentPlayer.name, created_at: new Date().toISOString() })
            .eq('id', oldScore.id);
    }
    await refreshLeaderboard();
}

async function registerPlayer() {
    if (!supabaseClient) { document.getElementById('auth-message-register').textContent = 'Supabase не налаштовано'; return; }
    const name = document.getElementById('auth-name').value.trim();
    const email = document.getElementById('auth-email2').value.trim();
    const password = document.getElementById('auth-password2').value;

    if (!name || !email || !password) {
        document.getElementById('auth-message-register').textContent = 'Заповни ім\'я, email та пароль';
        return;
    }

    document.getElementById('auth-message-register').textContent = 'Реєструємо...';
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { document.getElementById('auth-message-register').textContent = error.message; return; }

    if (data.user) {
        await supabaseClient.from('profiles').upsert({ id: data.user.id, player_name: name });
        await loadPlayerProfile(data.user);
        document.getElementById('auth-name').value = '';
        document.getElementById('auth-email2').value = '';
        document.getElementById('auth-password2').value = '';
        showStartUI();
        await refreshLeaderboard();
    }
}

async function loginPlayer() {
    if (!supabaseClient) { setAuthMessage('Supabase не налаштовано'); return; }
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) { setAuthMessage('Введи email та пароль'); return; }

    setAuthMessage('Входимо...');
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { setAuthMessage(error.message); return; }

    await loadPlayerProfile(data.user);
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    showStartUI();
    await refreshLeaderboard();
    setAuthMessage('');
}

async function logoutPlayer() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    if (window._game) {
        window._game.destroy(true);
        window._game = null;
    }
    currentPlayer = null;
    gamePlayerName = '';
    showAuthUI();
}

function changeAccount() {
    if (window._game) {
        window._game.destroy(true);
        window._game = null;
    }
    currentPlayer = null;
    gamePlayerName = '';
    document.getElementById('player-name-input').value = '';
    showAuthUI();
}

function changePlayer() {
    if (window._game) {
        window._game.destroy(true);
        window._game = null;
    }
    gamePlayerName = '';
    document.getElementById('player-name-input').value = '';
    showStartUI();
    renderSavedNames();
}

function startGameLogged() {
    if (currentPlayer) {
        gamePlayerName = currentPlayer.name;
        startGameWithName(gamePlayerName);
    }
}

function startGameWithName(name) {
    if (!name) return;
    gamePlayerName = name;
    showGameUI();
    window._startGameWithName = name;
    if (window._game) {
        window._game.destroy(true);
        window._game = null;
    }
    setTimeout(() => {
        window._game = new Phaser.Game(config);
    }, 50);
}

function startGame() {
    const name = document.getElementById('player-name-input').value.trim();
    if (!name) {
        document.getElementById('player-name-input').style.borderColor = '#ff3366';
        setTimeout(() => document.getElementById('player-name-input').style.borderColor = '', 1500);
        return;
    }
    saveName(name);
    startGameWithName(name);
}

window.addEventListener('DOMContentLoaded', async () => {
    // Крок 1: опрос — есть ли аккаунт
    document.getElementById('auth-have-account-btn').addEventListener('click', showLoginForm);
    document.getElementById('auth-no-account-btn').addEventListener('click', showRegisterForm);
    document.getElementById('back-to-question-from-login').addEventListener('click', resetAuthForms);
    document.getElementById('back-to-question-from-register').addEventListener('click', resetAuthForms);

    // Крок 2: логин
    document.getElementById('login-button').addEventListener('click', loginPlayer);
    document.getElementById('auth-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loginPlayer();
    });

    // Крок 3: регистрация
    document.getElementById('register-button').addEventListener('click', registerPlayer);
    document.getElementById('auth-password2').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') registerPlayer();
    });

    // Выход и смена аккаунта
    document.getElementById('logout-player-btn').addEventListener('click', logoutPlayer);
    document.getElementById('change-account-btn').addEventListener('click', changeAccount);
    document.getElementById('change-player-btn').addEventListener('click', changePlayer);

    // Старт игры
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('start-game-btn-logged').addEventListener('click', startGameLogged);
    document.getElementById('player-name-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') startGame();
    });

    // Перевіряємо чи вже є активна сесія
    if (supabaseClient) {
        const { data } = await supabaseClient.auth.getSession();
        if (data.session?.user) {
            await loadPlayerProfile(data.session.user);
            showStartUI();
            await refreshLeaderboard();
            return;
        }
    }
    showAuthUI();
});

class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.score = 0;
        this.gameOver = false;
        this.gameSpeed = 1.19;
        this.lives = 3;
        this.playerName = window._startGameWithName || 'Мія';
        this.totalRegularItems = 0;
        this.totalBirds = 0;
    }

    preload() {
        // Загружаем аудио-файлы один раз на весь game (глобально, переживает рестарты сцены)
        if (!window._miaAudioBuffers) {
            window._miaAudioBuffers = {};
            window._miaAudioBuffers.bark = new Audio('lay-sobaki3.mp3');
            window._miaAudioBuffers.jump1 = new Audio('jump1.mp3');
            window._miaAudioBuffers.jump2 = new Audio('jump2.mp3');
            window._miaAudioBuffers.vorona = new Audio('vorona.mp3');
            window._miaAudioBuffers.ohno = new Audio('ohno.mp3');
            window._miaAudioBuffers.finalSound = new Audio('final.mp3');
            for (let i = 0; i < 5; i++) {
                window._miaAudioBuffers['laugh' + i] = new Audio('assets/baby-laughing-' + i + '.mp3');
            }
            window._miaAudioBuffers.dreamMusic = new Audio('cherepaha-cut.mp3');
            window._miaAudioBuffers.dreamMusic.loop = true;
        }
        this.audioBuffers = window._miaAudioBuffers;

        // Защита от пересоздания текстур при рестарте сцены
        if (this.textures.exists('mia0')) { 
            return; 
        }

        let g = this.make.graphics({x: 0, y: 0, add: false});

        // ── Мія — Кадр 0 (біг/стояння, худа версія) ── 24×48
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(12, 47, 16, 3);
        // Ноги (тонші)
        g.fillStyle(0xFFD5B0);
        g.fillRect(8, 36, 3, 10);
        g.fillRect(13, 36, 3, 10);
        // Гольфи
        g.fillStyle(0xFFFFFF);
        g.fillRect(8, 38, 3, 6);
        g.fillRect(13, 38, 3, 6);
        g.fillStyle(0xEEEEEE);
        g.fillRect(8, 38, 3, 2);
        g.fillRect(13, 38, 3, 2);
        // Чобітки
        g.fillStyle(0xFF00FF);
        g.fillRect(6, 44, 6, 4);
        g.fillRect(12, 44, 6, 4);
        g.fillStyle(0xDD00DD);
        g.fillRect(6, 44, 6, 1);
        g.fillRect(12, 44, 6, 1);
        g.fillStyle(0xCC00CC);
        g.fillRect(6, 46, 6, 2);
        g.fillRect(12, 46, 6, 2);
        g.fillStyle(0xAA00AA);
        g.fillRect(6, 47, 6, 1);
        g.fillRect(12, 47, 6, 1);
        // Бантики на чобітках
        g.fillStyle(0x00FFFF);
        g.fillRect(4, 44, 3, 2);
        g.fillRect(9, 44, 3, 2);
        g.fillRect(16, 44, 3, 2);
        g.fillRect(20, 44, 3, 2);
        g.fillStyle(0xAAFFFF);
        g.fillRect(4, 44, 1, 1);
        g.fillRect(9, 44, 1, 1);
        g.fillRect(16, 44, 1, 1);
        g.fillRect(20, 44, 1, 1);
        // Тіло (верх сукні — вужче)
        g.fillStyle(0xFFB6C1);
        g.fillRect(5, 18, 14, 10);
        g.fillStyle(0xDD99AA);
        g.fillRect(5, 26, 14, 2);
        // Комірець
        g.fillStyle(0xFFFFFF);
        g.fillRect(6, 18, 12, 2);
        g.fillStyle(0xE0E0E0);
        g.fillRect(6, 18, 12, 1);
        // Намисто
        g.fillStyle(0xFFFF00);
        g.fillRect(9, 20, 6, 1);
        g.fillStyle(0xFF00FF);
        g.fillRect(10, 20, 4, 2);
        g.fillStyle(0xFFFFFF);
        g.fillRect(11, 20, 2, 1);
        // Ґудзики
        g.fillStyle(0xFF00FF);
        g.fillRect(10, 23, 2, 2);
        g.fillRect(10, 27, 2, 2);
        g.fillStyle(0xFFFFFF);
        g.fillRect(11, 23, 1, 1);
        g.fillRect(11, 27, 1, 1);
        // Спідниця (вужча)
        g.fillStyle(0xFF69B4);
        g.fillRect(4, 28, 16, 3);
        g.fillRect(2, 31, 20, 3);
        g.fillRect(1, 34, 22, 3);
        g.fillStyle(0xFF88CC);
        g.fillRect(4, 28, 16, 1);
        g.fillRect(2, 31, 20, 1);
        g.fillRect(1, 34, 22, 1);
        g.fillStyle(0xDD5599);
        g.fillRect(1, 36, 22, 1);
        // Складки спідниці
        g.fillStyle(0xFF88CC);
        g.fillRect(6, 29, 2, 2);
        g.fillRect(12, 29, 2, 2);
        g.fillRect(16, 29, 2, 2);
        g.fillStyle(0xDD5599);
        g.fillRect(6, 32, 2, 2);
        g.fillRect(12, 32, 2, 2);
        g.fillRect(16, 32, 2, 2);
        // Пояс
        g.fillStyle(0xFF00FF);
        g.fillRect(5, 27, 14, 2);
        g.fillStyle(0xDD00DD);
        g.fillRect(5, 27, 14, 1);
        // Пряжка
        g.fillStyle(0xFFFF00);
        g.fillRect(11, 27, 2, 2);
        g.fillStyle(0xFFFFFF);
        g.fillRect(12, 27, 1, 1);
        // Руки (тонші)
        g.fillStyle(0xFFE4C4);
        g.fillRect(1, 19, 5, 10);
        g.fillRect(18, 19, 5, 10);
        g.fillStyle(0xFFD5B0);
        g.fillRect(1, 19, 1, 10);
        g.fillRect(22, 19, 1, 10);
        // Рукави
        g.fillStyle(0xFFB6C1);
        g.fillRect(1, 19, 5, 4);
        g.fillRect(18, 19, 5, 4);
        g.fillStyle(0xDD99AA);
        g.fillRect(1, 22, 5, 1);
        g.fillRect(18, 22, 5, 1);
        // Кисті рук
        g.fillStyle(0xFFE4C4);
        g.fillRect(0, 28, 6, 3);
        g.fillRect(18, 28, 6, 3);
        g.fillStyle(0xFFD5B0);
        g.fillRect(0, 28, 1, 3);
        g.fillRect(23, 28, 1, 3);
        // Пальчики
        g.fillStyle(0xFFE4C4);
        g.fillRect(1, 29, 1, 2);
        g.fillRect(3, 29, 1, 2);
        g.fillRect(20, 29, 1, 2);
        g.fillRect(22, 29, 1, 2);
        // Голова (прямокутник — чіткий піксельний край)
        g.fillStyle(0xFFE4C4);
        g.fillRect(4, 3, 16, 14);
        g.fillRect(5, 2, 14, 16);
        // Вуха (маленькі, акуратні)
        g.fillStyle(0xFFE4C4);
        g.fillRect(2, 7, 3, 3);
        g.fillRect(19, 7, 3, 3);
        g.fillStyle(0xFFCCAA);
        g.fillRect(2, 8, 2, 1);
        g.fillRect(20, 8, 2, 1);
        // Очі (великі, круглі)
        g.fillStyle(0xFFFFFF);
        g.fillRect(6, 6, 4, 4);
        g.fillRect(14, 6, 4, 4);
        g.fillStyle(0x00CCCC);
        g.fillRect(7, 7, 3, 3);
        g.fillRect(15, 7, 3, 3);
        g.fillStyle(0x006666);
        g.fillRect(8, 8, 2, 2);
        g.fillRect(16, 8, 2, 2);
        // Блики
        g.fillStyle(0xFFFFFF);
        g.fillRect(7, 6, 1, 1);
        g.fillRect(15, 6, 1, 1);
        g.fillRect(9, 9, 1, 1);
        g.fillRect(17, 9, 1, 1);
        // Носик (майже непомітний)
        g.fillStyle(0xFFDDC4);
        g.fillRect(11, 10, 2, 1);
        // Рот (маленька усмішка)
        g.fillStyle(0xFF4477);
        g.fillRect(10, 13, 4, 1);
        g.fillRect(11, 12, 2, 2);
        // Рум'янець
        g.fillStyle(0xFF9999, 0.25);
        g.fillRect(5, 9, 3, 2);
        g.fillRect(16, 9, 3, 2);
        // Волосся — основна маса
        g.fillStyle(0xFF00FF);
        g.fillRect(3, 0, 18, 4);
        g.fillRect(2, 2, 20, 3);
        g.fillStyle(0xDD00DD);
        g.fillRect(3, 0, 18, 1);
        g.fillRect(2, 2, 20, 1);
        // Чьолка
        g.fillStyle(0xFF22FF);
        g.fillRect(4, 1, 7, 4);
        g.fillRect(13, 1, 7, 4);
        // Бічні пасма
        g.fillStyle(0xFF00FF);
        g.fillRect(1, 4, 3, 10);
        g.fillRect(20, 4, 3, 10);
        // Хвостики
        g.fillStyle(0xFF00FF);
        g.fillRect(0, 6, 4, 12);
        g.fillRect(20, 6, 4, 12);
        g.fillStyle(0xDD00DD);
        g.fillRect(0, 7, 2, 11);
        g.fillRect(22, 7, 2, 11);
        // Резинки
        g.fillStyle(0x00FFFF);
        g.fillRect(0, 5, 4, 2);
        g.fillRect(20, 5, 4, 2);
        g.generateTexture('mia0', 24, 48);
        g.clear();

        // ── Мія — Кадр 1 (стрибок, худа версія) ── 24×48
        g.fillStyle(0xFFD5B0);
        g.fillRect(5, 36, 3, 9);
        g.fillRect(16, 36, 3, 9);
        g.fillStyle(0xFFFFFF);
        g.fillRect(5, 38, 3, 5);
        g.fillRect(16, 38, 3, 5);
        g.fillStyle(0xEEEEEE);
        g.fillRect(5, 38, 3, 2);
        g.fillRect(16, 38, 3, 2);
        g.fillStyle(0xFF00FF);
        g.fillRect(3, 43, 6, 4);
        g.fillRect(16, 44, 6, 4);
        g.fillStyle(0xDD00DD);
        g.fillRect(3, 43, 6, 1);
        g.fillRect(16, 44, 6, 1);
        g.fillStyle(0xCC00CC);
        g.fillRect(3, 45, 6, 2);
        g.fillRect(16, 46, 6, 2);
        g.fillStyle(0xAA00AA);
        g.fillRect(3, 46, 6, 1);
        g.fillRect(16, 47, 6, 1);
        g.fillStyle(0x00FFFF);
        g.fillRect(2, 43, 2, 2); g.fillRect(9, 43, 2, 2);
        g.fillRect(17, 44, 2, 2); g.fillRect(21, 44, 2, 2);
        g.fillStyle(0xAAFFFF);
        g.fillRect(2, 43, 1, 1); g.fillRect(9, 43, 1, 1);
        g.fillRect(17, 44, 1, 1); g.fillRect(21, 44, 1, 1);
        g.fillStyle(0xFFB6C1);
        g.fillRect(5, 18, 14, 10);
        g.fillStyle(0xDD99AA);
        g.fillRect(5, 26, 14, 2);
        g.fillStyle(0xFFFFFF);
        g.fillRect(6, 18, 12, 2);
        g.fillStyle(0xE0E0E0);
        g.fillRect(6, 18, 12, 1);
        g.fillStyle(0xFFFF00);
        g.fillRect(9, 20, 6, 1);
        g.fillStyle(0xFF00FF);
        g.fillRect(10, 20, 4, 2);
        g.fillStyle(0xFFFFFF);
        g.fillRect(11, 20, 2, 1);
        g.fillStyle(0xFF00FF);
        g.fillRect(10, 23, 2, 2);
        g.fillRect(10, 27, 2, 2);
        g.fillStyle(0xFFFFFF);
        g.fillRect(11, 23, 1, 1);
        g.fillRect(11, 27, 1, 1);
        g.fillStyle(0xFF69B4);
        g.fillRect(4, 28, 16, 3);
        g.fillRect(2, 31, 20, 3);
        g.fillRect(1, 34, 22, 3);
        g.fillStyle(0xFF88CC);
        g.fillRect(4, 28, 16, 1);
        g.fillRect(2, 31, 20, 1);
        g.fillRect(1, 34, 22, 1);
        g.fillStyle(0xDD5599);
        g.fillRect(1, 36, 22, 1);
        g.fillStyle(0xFF88CC);
        g.fillRect(6, 29, 2, 2); g.fillRect(12, 29, 2, 2); g.fillRect(16, 29, 2, 2);
        g.fillStyle(0xDD5599);
        g.fillRect(6, 32, 2, 2); g.fillRect(12, 32, 2, 2); g.fillRect(16, 32, 2, 2);
        g.fillStyle(0xFF00FF);
        g.fillRect(5, 27, 14, 2);
        g.fillStyle(0xDD00DD);
        g.fillRect(5, 27, 14, 1);
        g.fillStyle(0xFFFF00);
        g.fillRect(11, 27, 2, 2);
        g.fillStyle(0xFFFFFF);
        g.fillRect(12, 27, 1, 1);
        g.fillStyle(0xFFE4C4);
        g.fillRect(1, 17, 5, 9);
        g.fillRect(18, 21, 5, 9);
        g.fillStyle(0xFFD5B0);
        g.fillRect(1, 17, 1, 9);
        g.fillRect(22, 21, 1, 9);
        g.fillStyle(0xFFB6C1);
        g.fillRect(1, 17, 5, 4);
        g.fillRect(18, 21, 5, 4);
        g.fillStyle(0xDD99AA);
        g.fillRect(1, 20, 5, 1);
        g.fillRect(18, 23, 5, 1);
        g.fillStyle(0xFFE4C4);
        g.fillRect(0, 25, 6, 3);
        g.fillRect(18, 29, 6, 3);
        g.fillStyle(0xFFD5B0);
        g.fillRect(0, 25, 1, 3);
        g.fillRect(23, 29, 1, 3);
        g.fillStyle(0xFFE4C4);
        g.fillRect(1, 26, 1, 2);
        g.fillRect(3, 26, 1, 2);
        g.fillRect(20, 30, 1, 2);
        g.fillRect(22, 30, 1, 2);
        // Голова (прямокутник — чіткий піксельний край)
        g.fillStyle(0xFFE4C4);
        g.fillRect(4, 3, 16, 14);
        g.fillRect(5, 2, 14, 16);
        // Вуха (маленькі, акуратні)
        g.fillStyle(0xFFE4C4);
        g.fillRect(2, 7, 3, 3);
        g.fillRect(19, 7, 3, 3);
        g.fillStyle(0xFFCCAA);
        g.fillRect(2, 8, 2, 1);
        g.fillRect(20, 8, 2, 1);
        // Очі (великі, круглі)
        g.fillStyle(0xFFFFFF);
        g.fillRect(6, 6, 4, 4);
        g.fillRect(14, 6, 4, 4);
        g.fillStyle(0x00CCCC);
        g.fillRect(7, 7, 3, 3);
        g.fillRect(15, 7, 3, 3);
        g.fillStyle(0x006666);
        g.fillRect(8, 8, 2, 2);
        g.fillRect(16, 8, 2, 2);
        // Блики
        g.fillStyle(0xFFFFFF);
        g.fillRect(7, 6, 1, 1);
        g.fillRect(15, 6, 1, 1);
        g.fillRect(9, 9, 1, 1);
        g.fillRect(17, 9, 1, 1);
        // Носик (майже непомітний)
        g.fillStyle(0xFFDDC4);
        g.fillRect(11, 10, 2, 1);
        // Рот (маленька усмішка)
        g.fillStyle(0xFF4477);
        g.fillRect(10, 13, 4, 1);
        g.fillRect(11, 12, 2, 2);
        // Рум'янець
        g.fillStyle(0xFF9999, 0.25);
        g.fillRect(5, 9, 3, 2);
        g.fillRect(16, 9, 3, 2);
        // Волосся — основна маса
        g.fillStyle(0xFF00FF);
        g.fillRect(3, 0, 18, 4);
        g.fillRect(2, 2, 20, 3);
        g.fillStyle(0xDD00DD);
        g.fillRect(3, 0, 18, 1);
        g.fillRect(2, 2, 20, 1);
        // Чьолка
        g.fillStyle(0xFF22FF);
        g.fillRect(4, 1, 7, 4);
        g.fillRect(13, 1, 7, 4);
        // Бічні пасма
        g.fillStyle(0xFF00FF);
        g.fillRect(1, 4, 3, 10);
        g.fillRect(20, 4, 3, 10);
        // Хвостики
        g.fillStyle(0xFF00FF);
        g.fillRect(0, 6, 4, 12);
        g.fillRect(20, 6, 4, 12);
        g.fillStyle(0xDD00DD);
        g.fillRect(0, 7, 2, 11);
        g.fillRect(22, 7, 2, 11);
        // Резинки
        g.fillStyle(0x00FFFF);
        g.fillRect(0, 5, 4, 2);
        g.fillRect(20, 5, 4, 2);
        g.generateTexture('mia1', 24, 48);
        g.clear();

        // ── Куст (36×36) — детализировано
        g.fillStyle(0x006600);
        g.fillCircle(18, 20, 13);
        g.fillStyle(0x004400);
        g.fillCircle(18, 20, 9);
        g.fillStyle(0x00AA00);
        g.fillCircle(10, 24, 10);
        g.fillCircle(26, 24, 10);
        g.fillStyle(0x008800);
        g.fillCircle(10, 24, 7);
        g.fillCircle(26, 24, 7);
        g.fillStyle(0x00FF00);
        g.fillCircle(16, 18, 8);
        g.fillCircle(22, 16, 7);
        g.fillCircle(14, 12, 5);
        g.fillStyle(0x00DD00);
        g.fillCircle(16, 18, 5);
        g.fillCircle(22, 16, 4);
        g.fillStyle(0xFF00FF); // Цветы
        g.fillCircle(8, 12, 3);
        g.fillCircle(22, 10, 3);
        g.fillCircle(28, 20, 3);
        g.fillStyle(0xFF44FF);
        g.fillCircle(8, 12, 2);
        g.fillCircle(22, 10, 2);
        g.fillCircle(28, 20, 2);
        g.fillStyle(0xFFFF00);
        g.fillCircle(8, 12, 1);
        g.fillCircle(22, 10, 1);
        g.fillCircle(28, 20, 1);
        g.generateTexture('bush', 36, 36);
        g.clear();

        // ── Гриб (32×38) — детализировано
        g.fillStyle(0xFFEEDD);
        g.fillRect(12, 16, 8, 22); // Ножка
        g.fillStyle(0xDDCCAA);
        g.fillRect(12, 16, 2, 22); // Тень ножки
        g.fillStyle(0xCCBB99);
        g.fillRect(12, 34, 8, 4);  // Основание
        g.fillStyle(0xFF00FF); 
        g.fillCircle(16, 12, 13);  // Шляпка
        g.fillRect(5, 11, 22, 4);
        g.fillStyle(0xDD00DD);
        g.fillCircle(16, 12, 10);
        g.fillRect(6, 11, 20, 3);
        g.fillStyle(0xCC00CC);
        g.fillCircle(16, 12, 8);   // Внутренний круг
        g.fillStyle(0xAA00AA);
        g.fillCircle(16, 12, 5);   // Тень центра
        g.fillStyle(0x00FFFF);
        g.fillCircle(10, 7, 3);
        g.fillCircle(22, 8, 2.5);
        g.fillCircle(16, 6, 2);
        g.fillStyle(0x88FFFF);
        g.fillCircle(10, 7, 2);
        g.fillCircle(22, 8, 1.5);
        g.fillStyle(0xFFFFFF);
        g.fillCircle(10, 6, 1);
        g.fillCircle(22, 7, 1);
        g.fillStyle(0xFFFF00, 0.4);
        g.fillCircle(12, 10, 1);
        g.generateTexture('mushroom', 32, 38);
        g.clear();

        // ── Леденец (34×48) — детализировано
        g.fillStyle(0xFFFFFF);
        g.fillRect(16, 20, 2, 28); // Палочка
        g.fillStyle(0xEEEEEE);
        g.fillRect(16, 20, 1, 28); // Тень палочки
        g.fillStyle(0xFF6699);
        g.fillCircle(17, 20, 13);
        g.fillStyle(0xFF4488);
        g.fillCircle(17, 20, 10);
        g.fillStyle(0xFF2266);
        g.fillCircle(17, 20, 7);
        g.fillStyle(0xFF0044);
        g.fillCircle(17, 20, 4);
        g.fillStyle(0xFFFFFF, 0.4);
        g.fillCircle(13, 16, 3);
        g.fillCircle(21, 24, 2);
        g.fillStyle(0xFF88AA, 0.3);
        g.fillCircle(17, 20, 12);
        g.lineStyle(1, 0xFFFFFF, 0.5);
        g.beginPath();
        g.arc(17, 20, 11, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(150), false);
        g.strokePath();
        g.lineStyle(1, 0xFF6699, 0.4);
        g.beginPath();
        g.arc(17, 20, 8, Phaser.Math.DegToRad(210), Phaser.Math.DegToRad(330), false);
        g.strokePath();
        g.generateTexture('lollipop', 34, 48);
        g.clear();


        // ── Собака — Кадр 0 (стоит) ── 42×32
        // Тень
        g.fillStyle(0x000000, 0.12);
        g.fillEllipse(21, 30, 28, 4);
        // Тело
        g.fillStyle(0xD2691E);
        g.fillRect(10, 10, 20, 14);
        g.fillStyle(0xA0522D);
        g.fillRect(10, 10, 20, 2);   // Верхняя тень тела
        g.fillStyle(0xE6A15A);
        g.fillRect(12, 12, 8, 6);    // Светлое пятно
        g.fillStyle(0xF0B070);
        g.fillRect(12, 12, 3, 3);    // Блик на пятне
        // Шерсть (полоски)
        g.fillStyle(0xA0522D);
        g.fillRect(14, 15, 1, 3);
        g.fillRect(18, 16, 1, 3);
        g.fillRect(24, 14, 1, 4);
        // Голова
        g.fillStyle(0x8B4513);
        g.fillRect(25, 4, 14, 14);
        g.fillStyle(0x6B3410);
        g.fillRect(25, 4, 14, 2);    // Тень верха головы
        g.fillStyle(0xA0522D);
        g.fillRect(27, 6, 10, 6);    // Светлая морда
        g.fillStyle(0xB87333);
        g.fillRect(27, 6, 5, 3);     // Блик на морде
        // Ошейник
        g.fillStyle(0x00FFFF);
        g.fillRect(23, 14, 4, 4);
        g.fillStyle(0x00CCCC);
        g.fillRect(23, 14, 4, 1);
        // Бирка
        g.fillStyle(0xFFFF00);
        g.fillCircle(25, 16, 2);
        g.fillStyle(0xFFDD00);
        g.fillCircle(25, 16, 1);
        // Зубы
        g.fillStyle(0xFFFFFF);
        g.fillRect(33, 12, 2, 1);
        g.fillRect(36, 12, 2, 1);
        g.fillStyle(0xDDDDDD);
        g.fillRect(33, 12, 1, 1);
        g.fillRect(36, 12, 1, 1);
        // Язык
        g.fillStyle(0xFF6699);
        g.fillRect(34, 13, 2, 1);
        g.fillStyle(0xFF4477);
        g.fillRect(34, 13, 1, 1);
        // Ноги
        g.fillStyle(0x8B4513);
        g.fillRect(12, 24, 4, 6);
        g.fillRect(22, 24, 4, 6);
        g.fillStyle(0x6B3410);
        g.fillRect(12, 24, 4, 1);
        g.fillRect(22, 24, 4, 1);
        g.fillStyle(0xA0522D);
        g.fillRect(12, 28, 4, 2);
        g.fillRect(22, 28, 4, 2);
        // Когти
        g.fillStyle(0x000000);
        g.fillRect(12, 29, 1, 1); g.fillRect(14, 29, 1, 1);
        g.fillRect(22, 29, 1, 1); g.fillRect(24, 29, 1, 1);
        // Хвост
        g.fillStyle(0xD2691E);
        g.fillRect(5, 8, 6, 3);
        g.fillStyle(0xA0522D);
        g.fillRect(5, 8, 6, 1);
        g.fillStyle(0xE6A15A);
        g.fillRect(4, 6, 3, 2);   // Кончик хвоста
        g.fillStyle(0xF0B070);
        g.fillRect(4, 6, 2, 1);
        // Глаз
        g.fillStyle(0x000000);
        g.fillRect(32, 7, 3, 3);
        g.fillStyle(0xFFFFFF);
        g.fillRect(32, 7, 2, 2);
        g.fillRect(33, 7, 1, 1);   // Блик
        g.fillStyle(0x000000);
        g.fillRect(33, 8, 1, 1);    // Зрачок
        // Нос
        g.fillStyle(0x000000);
        g.fillRect(36, 10, 2, 1);
        g.fillStyle(0x333333);
        g.fillRect(36, 10, 1, 1);
        // Уши
        g.fillStyle(0x8B4513);
        g.fillTriangle(25, 4, 26, 0, 29, 4);
        g.fillTriangle(38, 4, 37, 0, 34, 4);
        g.fillStyle(0xA0522D);
        g.fillTriangle(26, 3, 27, 1, 28, 3);
        g.fillTriangle(36, 3, 35, 1, 34, 3);
        g.generateTexture('dog0', 42, 32);
        g.clear();

        // ── Собака — Кадр 1 (прыжок/бег) ── 42×32
        // Тень
        g.fillStyle(0x000000, 0.12);
        g.fillEllipse(21, 30, 28, 4);
        // Тело
        g.fillStyle(0xD2691E);
        g.fillRect(10, 10, 20, 14);
        g.fillStyle(0xA0522D);
        g.fillRect(10, 10, 20, 2);
        g.fillStyle(0xE6A15A);
        g.fillRect(12, 12, 8, 6);
        g.fillStyle(0xF0B070);
        g.fillRect(12, 12, 3, 3);
        g.fillStyle(0xA0522D);
        g.fillRect(14, 15, 1, 3);
        g.fillRect(18, 16, 1, 3);
        g.fillRect(24, 14, 1, 4);
        g.fillStyle(0x8B4513);
        g.fillRect(25, 4, 14, 14);
        g.fillStyle(0x6B3410);
        g.fillRect(25, 4, 14, 2);
        g.fillStyle(0xA0522D);
        g.fillRect(27, 6, 10, 6);
        g.fillStyle(0xB87333);
        g.fillRect(27, 6, 5, 3);
        // Ошейник
        g.fillStyle(0x00FFFF);
        g.fillRect(23, 14, 4, 4);
        g.fillStyle(0x00CCCC);
        g.fillRect(23, 14, 4, 1);
        g.fillStyle(0xFFFF00);
        g.fillCircle(25, 16, 2);
        g.fillStyle(0xFFDD00);
        g.fillCircle(25, 16, 1);
        g.fillStyle(0xFFFFFF);
        g.fillRect(33, 12, 2, 1); g.fillRect(36, 12, 2, 1);
        g.fillStyle(0xDDDDDD);
        g.fillRect(33, 12, 1, 1); g.fillRect(36, 12, 1, 1);
        g.fillStyle(0xFF6699);
        g.fillRect(34, 13, 2, 1);
        g.fillStyle(0xFF4477);
        g.fillRect(34, 13, 1, 1);
        // Ноги согнуты (бег)
        g.fillStyle(0x8B4513);
        g.fillRect(14, 22, 4, 5);
        g.fillRect(20, 22, 4, 5);
        g.fillStyle(0x6B3410);
        g.fillRect(14, 22, 4, 1);
        g.fillRect(20, 22, 4, 1);
        g.fillStyle(0xA0522D);
        g.fillRect(14, 25, 4, 2);
        g.fillRect(20, 25, 4, 2);
        g.fillStyle(0x000000);
        g.fillRect(14, 26, 1, 1); g.fillRect(16, 26, 1, 1);
        g.fillRect(20, 26, 1, 1); g.fillRect(22, 26, 1, 1);
        // Хвост (задран)
        g.fillStyle(0xD2691E);
        g.fillRect(5, 5, 6, 3);
        g.fillStyle(0xA0522D);
        g.fillRect(5, 5, 6, 1);
        g.fillStyle(0xE6A15A);
        g.fillRect(4, 3, 3, 2);
        g.fillStyle(0xF0B070);
        g.fillRect(4, 3, 2, 1);
        // Глаз
        g.fillStyle(0x000000);
        g.fillRect(32, 7, 3, 3);
        g.fillStyle(0xFFFFFF);
        g.fillRect(32, 7, 2, 2);
        g.fillRect(33, 7, 1, 1);
        g.fillStyle(0x000000);
        g.fillRect(33, 8, 1, 1);
        g.fillStyle(0x000000);
        g.fillRect(36, 10, 2, 1);
        g.fillStyle(0x333333);
        g.fillRect(36, 10, 1, 1);
        // Уши
        g.fillStyle(0x8B4513);
        g.fillTriangle(25, 4, 26, 0, 29, 4);
        g.fillTriangle(38, 4, 37, 0, 34, 4);
        g.fillStyle(0xA0522D);
        g.fillTriangle(26, 3, 27, 1, 28, 3);
        g.fillTriangle(36, 3, 35, 1, 34, 3);
        g.generateTexture('dog1', 42, 32);
        g.clear();

        // ── Птица — кадр 0 (крылья вверх) ── 32×24
        // Тень
        g.fillStyle(0x000000, 0.08);
        g.fillEllipse(15, 22, 20, 3);
        // Хвост
        g.fillStyle(0xFF00FF);
        g.fillTriangle(23, 12, 31, 6, 31, 18);
        g.fillStyle(0xDD00DD);
        g.fillTriangle(23, 12, 31, 8, 31, 16);
        g.fillStyle(0xFF66FF);
        g.fillTriangle(23, 12, 28, 9, 28, 15);
        // Крылья вверх
        g.fillStyle(0xFF00FF);
        g.fillTriangle(15, 10, 9, 0, 20, 4);
        g.fillTriangle(15, 11, 21, 1, 25, 12);
        g.fillStyle(0xFF66FF);
        g.fillTriangle(15, 10, 12, 2, 19, 5);
        g.fillTriangle(16, 11, 21, 4, 23, 11);
        g.fillStyle(0xFFFFFF, 0.2);
        g.fillTriangle(15, 10, 14, 4, 18, 6);
        // Тело
        g.fillStyle(0x00FFFF);
        g.fillRect(9, 8, 14, 9);
        g.fillStyle(0x00CCCC);
        g.fillRect(9, 8, 14, 3);  // Тень верха
        g.fillStyle(0x00DDDD);
        g.fillRect(16, 8, 7, 9);
        g.fillStyle(0xAAFFFF);
        g.fillRect(11, 10, 4, 2);  // Блик на теле
        // Голова
        g.fillStyle(0xAAFFFF);
        g.fillCircle(8, 10, 6);
        g.fillStyle(0x88DDDD);
        g.fillCircle(8, 10, 4);    // Тень
        g.fillStyle(0xCCFFFF);
        g.fillCircle(8, 10, 3);    // Блик
        // Клюв
        g.fillStyle(0xFFFF00);
        g.fillTriangle(2, 10, 0, 7, 0, 13);
        g.fillStyle(0xFFDD00);
        g.fillTriangle(2, 10, 0, 8, 0, 12);
        // Глаз
        g.fillStyle(0xFFFFFF);
        g.fillRect(6, 7, 3, 3);
        g.fillStyle(0xEEEEEE);
        g.fillRect(6, 7, 3, 1);
        g.fillStyle(0x000000);
        g.fillRect(7, 8, 1, 1);
        g.fillStyle(0xFFFFFF);
        g.fillRect(7, 8, 1, 1);
        // Лапки
        g.fillStyle(0xFFAA00);
        g.fillRect(13, 17, 2, 4);
        g.fillRect(18, 17, 2, 4);
        g.fillStyle(0xDD8800);
        g.fillRect(13, 17, 2, 1);
        g.fillRect(18, 17, 2, 1);
        g.fillStyle(0xFFAA00);
        g.fillRect(12, 20, 3, 1);
        g.fillRect(18, 20, 3, 1);
        g.generateTexture('bird0', 32, 24);
        g.clear();

        // ── Птица — кадр 1 (крылья вниз) ── 32×24
        // Тень
        g.fillStyle(0x000000, 0.08);
        g.fillEllipse(15, 22, 20, 3);
        // Хвост
        g.fillStyle(0xFF00FF);
        g.fillTriangle(23, 12, 31, 6, 31, 18);
        g.fillStyle(0xDD00DD);
        g.fillTriangle(23, 12, 31, 8, 31, 16);
        g.fillStyle(0xFF66FF);
        g.fillTriangle(23, 12, 28, 9, 28, 15);
        // Крылья вниз
        g.fillStyle(0xFF00FF);
        g.fillTriangle(15, 13, 8, 23, 20, 20);
        g.fillTriangle(16, 13, 25, 22, 25, 11);
        g.fillStyle(0xFF66FF);
        g.fillTriangle(15, 13, 11, 20, 19, 18);
        g.fillTriangle(17, 13, 23, 19, 23, 12);
        g.fillStyle(0xFFFFFF, 0.2);
        g.fillTriangle(17, 13, 20, 17, 22, 13);
        // Тело
        g.fillStyle(0x00FFFF);
        g.fillRect(9, 8, 14, 9);
        g.fillStyle(0x00CCCC);
        g.fillRect(9, 8, 14, 3);
        g.fillStyle(0x00DDDD);
        g.fillRect(16, 8, 7, 9);
        g.fillStyle(0xAAFFFF);
        g.fillRect(11, 10, 4, 2);
        // Голова
        g.fillStyle(0xAAFFFF);
        g.fillCircle(8, 10, 6);
        g.fillStyle(0x88DDDD);
        g.fillCircle(8, 10, 4);
        g.fillStyle(0xCCFFFF);
        g.fillCircle(8, 10, 3);
        // Клюв
        g.fillStyle(0xFFFF00);
        g.fillTriangle(2, 10, 0, 7, 0, 13);
        g.fillStyle(0xFFDD00);
        g.fillTriangle(2, 10, 0, 8, 0, 12);
        // Глаз
        g.fillStyle(0xFFFFFF);
        g.fillRect(6, 7, 3, 3);
        g.fillStyle(0xEEEEEE);
        g.fillRect(6, 7, 3, 1);
        g.fillStyle(0x000000);
        g.fillRect(7, 8, 1, 1);
        g.fillStyle(0xFFFFFF);
        g.fillRect(7, 8, 1, 1);
        // Лапки
        g.fillStyle(0xFFAA00);
        g.fillRect(13, 17, 2, 4);
        g.fillRect(18, 17, 2, 4);
        g.fillStyle(0xDD8800);
        g.fillRect(13, 17, 2, 1);
        g.fillRect(18, 17, 2, 1);
        g.fillStyle(0xFFAA00);
        g.fillRect(12, 20, 3, 1);
        g.fillRect(18, 20, 3, 1);
        g.generateTexture('bird1', 32, 24);
        g.clear();

        // ── Звезда (24×24) — детализировано
        g.fillStyle(0xFFFF00);
        g.fillRect(10, 1, 4, 22);
        g.fillRect(1, 10, 22, 4);
        g.fillRect(5, 5, 14, 14);
        g.fillStyle(0xFFDD00);
        g.fillRect(10, 3, 4, 9);
        g.fillRect(5, 10, 14, 4);
        g.fillStyle(0xFFAA00);
        g.fillCircle(12, 12, 3);
        g.fillStyle(0xFFFFFF, 0.6);
        g.fillRect(11, 5, 2, 2);
        g.fillRect(5, 11, 2, 2);
        g.generateTexture('star', 24, 24);
        g.clear();

        // ── Сердце (24×24) — детализировано
        g.fillStyle(0xFF0033);
        g.fillCircle(7, 7, 6);
        g.fillCircle(17, 7, 6);
        g.fillTriangle(2, 10, 22, 10, 12, 22);
        g.fillStyle(0xFF2255);
        g.fillCircle(7, 7, 4);
        g.fillCircle(17, 7, 4);
        g.fillTriangle(5, 10, 19, 10, 12, 19);
        g.fillStyle(0xFF6699);
        g.fillCircle(7, 7, 2);
        g.fillCircle(17, 7, 2);
        g.fillStyle(0xFFFFFF);
        g.fillCircle(5, 5, 1.5);
        g.fillCircle(16, 4, 1.5);
        g.fillStyle(0xFFFFFF, 0.5);
        g.fillCircle(8, 4, 1);
        g.fillCircle(18, 5, 1);
        g.generateTexture('heart', 24, 24);
        g.clear();

        // ── Цветочек (24×24) — детализировано
        g.fillStyle(0xFF00FF);
        g.fillCircle(12, 5, 5); g.fillCircle(12, 19, 5);
        g.fillCircle(5, 12, 5); g.fillCircle(19, 12, 5);
        g.fillCircle(12, 12, 5);
        g.fillStyle(0xFF44FF);
        g.fillCircle(12, 5, 3); g.fillCircle(12, 19, 3);
        g.fillCircle(5, 12, 3); g.fillCircle(19, 12, 3);
        g.fillStyle(0xFFFF00);
        g.fillCircle(12, 12, 5);
        g.fillStyle(0xFFAA00);
        g.fillCircle(12, 12, 3);
        g.fillStyle(0xFFFFFF, 0.6);
        g.fillCircle(10, 10, 1);
        g.fillCircle(14, 14, 1);
        g.generateTexture('flower', 24, 24);
        g.clear();

        // ── Облако (90×44) — пушистое, с мягким неоновым свечением
        // Основная масса (тёмная подложка)
        g.fillStyle(0x222244, 0.15);
        g.fillCircle(45, 22, 22);
        g.fillCircle(25, 24, 18);
        g.fillCircle(65, 24, 18);
        g.fillCircle(36, 16, 14);
        g.fillCircle(55, 16, 14);
        g.fillCircle(18, 18, 12);
        g.fillCircle(72, 18, 12);
        // Слой 1 — полупрозрачная белая основа
        g.fillStyle(0xFFFFFF, 0.18);
        g.fillCircle(45, 22, 20);
        g.fillCircle(25, 24, 16);
        g.fillCircle(65, 24, 16);
        g.fillCircle(36, 16, 13);
        g.fillCircle(55, 16, 13);
        g.fillCircle(18, 18, 11);
        g.fillCircle(72, 18, 11);
        // Слой 2 — плотнее
        g.fillStyle(0xFFFFFF, 0.28);
        g.fillCircle(45, 22, 15);
        g.fillCircle(25, 24, 12);
        g.fillCircle(65, 24, 12);
        g.fillCircle(36, 16, 10);
        g.fillCircle(55, 16, 10);
        // Слой 3 — ядро
        g.fillStyle(0xFFFFFF, 0.40);
        g.fillCircle(45, 22, 10);
        g.fillCircle(25, 24, 7);
        g.fillCircle(65, 24, 7);
        g.fillCircle(36, 16, 6);
        g.fillCircle(55, 16, 6);
        // Неоновое свечение (фиолетово-голубое)
        g.fillStyle(0x9944FF, 0.08);
        g.fillCircle(42, 20, 18);
        g.fillCircle(50, 26, 18);
        g.fillStyle(0x00CCFF, 0.06);
        g.fillCircle(38, 18, 14);
        g.fillCircle(52, 28, 14);
        // Блики от неона
        g.fillStyle(0xCC88FF, 0.12);
        g.fillCircle(40, 18, 8);
        g.fillCircle(50, 28, 8);
        g.fillStyle(0x66FFFF, 0.08);
        g.fillCircle(36, 16, 5);
        g.fillCircle(54, 30, 5);
        // Мягкое ореол-свечение по краям
        g.fillStyle(0xFFFFFF, 0.03);
        g.fillCircle(18, 18, 14);
        g.fillCircle(72, 18, 14);
        g.fillCircle(45, 22, 24);
        g.generateTexture('cloud', 90, 44);
        g.clear();

        // ── Дерево (50×120) — неоновый силуэт с деталями кроны
        // Ствол с корнями
        g.fillStyle(0x0a0a1e);
        g.fillRect(22, 50, 6, 70);       // Основной ствол
        g.fillStyle(0x12122e);
        g.fillRect(22, 50, 6, 3);        // Верх ствола
        g.fillStyle(0x1a1a3e);
        g.fillRect(23, 55, 4, 60);       // Светлая сторона ствола
        g.fillStyle(0x222255);
        g.fillRect(23, 55, 2, 35);       // Блик на стволе
        // Корни
        g.fillStyle(0x0a0a1e);
        g.fillRect(16, 110, 18, 10);
        g.fillRect(10, 115, 30, 5);
        g.fillStyle(0x12122e);
        g.fillRect(10, 115, 30, 2);
        // Ветви
        g.fillStyle(0x0a0a1e);
        g.fillRect(10, 45, 12, 4);       // Левая ветвь
        g.fillRect(28, 40, 12, 4);       // Правая ветвь
        g.fillRect(14, 35, 8, 3);        // Левая верхняя
        g.fillRect(28, 30, 8, 3);        // Правая верхняя
        g.fillStyle(0x1a1a3e);
        g.fillRect(10, 45, 4, 4);        // Блик левой ветви
        g.fillRect(34, 40, 4, 4);        // Блик правой ветви
        // Тонкие ветки
        g.fillStyle(0x0a0a1e);
        g.fillRect(6, 48, 4, 2);
        g.fillRect(40, 42, 4, 2);
        g.fillRect(8, 38, 3, 2);
        g.fillRect(38, 32, 4, 2);
        // Крона — основной объём (тёмная)
        g.fillStyle(0x0a0a24);
        g.fillCircle(25, 30, 26);
        g.fillCircle(10, 44, 20);
        g.fillCircle(40, 44, 20);
        g.fillCircle(18, 50, 18);
        g.fillCircle(32, 50, 18);
        g.fillCircle(5, 36, 14);
        g.fillCircle(45, 36, 14);
        g.fillCircle(14, 22, 16);
        g.fillCircle(36, 22, 16);
        g.fillCircle(25, 14, 14);
        // Крона — средний слой
        g.fillStyle(0x181840);
        g.fillCircle(25, 28, 22);
        g.fillCircle(12, 42, 16);
        g.fillCircle(38, 42, 16);
        g.fillCircle(16, 48, 14);
        g.fillCircle(34, 48, 14);
        g.fillCircle(7, 34, 11);
        g.fillCircle(43, 34, 11);
        g.fillCircle(14, 24, 12);
        g.fillCircle(36, 24, 12);
        g.fillCircle(25, 16, 11);
        // Крона — светлый слой (блики)
        g.fillStyle(0x282860);
        g.fillCircle(25, 26, 17);
        g.fillCircle(14, 38, 12);
        g.fillCircle(36, 38, 12);
        g.fillCircle(16, 44, 10);
        g.fillCircle(34, 44, 10);
        g.fillCircle(8, 32, 8);
        g.fillCircle(42, 32, 8);
        g.fillCircle(16, 22, 9);
        g.fillCircle(34, 22, 9);
        g.fillCircle(25, 18, 8);
        // Крона — яркие блики
        g.fillStyle(0x383888);
        g.fillCircle(25, 24, 12);
        g.fillCircle(16, 36, 8);
        g.fillCircle(34, 36, 8);
        g.fillCircle(10, 30, 5);
        g.fillCircle(40, 30, 5);
        g.fillCircle(18, 20, 6);
        g.fillCircle(32, 20, 6);
        g.fillCircle(25, 20, 5);
        // Неоновое свечение кроны (фиолетовое и голубое)
        g.fillStyle(0x9944FF, 0.08);
        g.fillCircle(25, 28, 24);
        g.fillCircle(14, 38, 16);
        g.fillCircle(36, 38, 16);
        g.fillStyle(0x00CCFF, 0.05);
        g.fillCircle(20, 24, 18);
        g.fillCircle(30, 24, 18);
        g.fillCircle(8, 32, 12);
        g.fillCircle(42, 32, 12);
        // Светящиеся точки в кроне
        g.fillStyle(0x9944FF, 0.20);
        g.fillCircle(20, 20, 2);
        g.fillCircle(30, 28, 2);
        g.fillCircle(14, 32, 1.5);
        g.fillCircle(36, 32, 1.5);
        g.fillCircle(8, 26, 1);
        g.fillCircle(42, 26, 1);
        g.fillCircle(25, 14, 1.5);
        g.fillStyle(0x00FFFF, 0.15);
        g.fillCircle(22, 24, 1.5);
        g.fillCircle(28, 18, 1.5);
        g.fillCircle(16, 28, 1);
        g.fillCircle(34, 28, 1);
        g.generateTexture('tree', 50, 120);
        g.clear();

        // ── Мега-комета (34×34) — детализировано
        g.fillStyle(0xFFD700);
        g.fillCircle(17, 16, 12);
        g.fillStyle(0xFFAA00);
        g.fillCircle(17, 16, 9);
        g.fillStyle(0xFFFF66);
        g.fillRect(14, 1, 6, 30);
        g.fillRect(2, 13, 30, 6);
        g.fillStyle(0xFF9900);
        g.fillTriangle(0, 16, 11, 8, 11, 24);
        g.fillStyle(0xFF6600);
        g.fillTriangle(0, 16, 11, 11, 11, 21);
        g.fillStyle(0xFFFFFF);
        g.fillCircle(14, 11, 4);
        g.fillStyle(0xFFFFAA);
        g.fillCircle(14, 11, 2);
        g.fillStyle(0xFFFFFF, 0.4);
        g.fillCircle(20, 20, 3);
        g.fillCircle(10, 8, 2);
        g.generateTexture('megaComet', 34, 34);
        g.clear();

        // ── Энерго-витамин (30×30) — детализировано
        g.fillStyle(0x00CCFF);
        g.fillCircle(15, 15, 13);
        g.fillStyle(0x0099CC);
        g.fillCircle(15, 15, 10);
        g.fillStyle(0xFF00FF);
        g.fillCircle(15, 15, 8);
        g.fillStyle(0xCC00CC);
        g.fillCircle(15, 15, 6);
        g.fillStyle(0xFFFFFF);
        g.fillRect(13, 5, 4, 20);
        g.fillRect(5, 13, 20, 4);
        g.fillStyle(0xCCFFFF, 0.6);
        g.fillRect(13, 7, 4, 6);
        g.fillRect(7, 13, 6, 4);
        g.fillStyle(0xFFFFFF, 0.4);
        g.fillCircle(10, 9, 2);
        g.fillCircle(20, 21, 2);
        g.generateTexture('energyVitamin', 30, 30);
        g.clear();

        // ── Сердце-ангел (34×28) — детализировано
        g.fillStyle(0xFFFFFF, 0.9);
        g.fillTriangle(0, 14, 10, 8, 10, 20);
        g.fillTriangle(34, 14, 24, 8, 24, 20);
        g.fillStyle(0xDDDDDD, 0.7);
        g.fillTriangle(1, 14, 9, 9, 9, 19);
        g.fillTriangle(33, 14, 25, 9, 25, 19);
        g.fillStyle(0xFF3366);
        g.fillCircle(13, 12, 7);
        g.fillCircle(21, 12, 7);
        g.fillTriangle(7, 15, 27, 15, 17, 27);
        g.fillStyle(0xFF5588);
        g.fillCircle(13, 12, 5);
        g.fillCircle(21, 12, 5);
        g.fillTriangle(9, 15, 25, 15, 17, 24);
        g.fillStyle(0xFFFFFF);
        g.fillCircle(12, 10, 2);
        g.fillCircle(22, 10, 2);
        g.fillStyle(0xFFFF00, 0.6);
        g.fillCircle(17, 18, 2);
        g.fillCircle(12, 20, 1);
        g.generateTexture('angelHeart', 34, 28);
        g.clear();

        // ── Радужный кристалл (26×34) — детализировано
        g.fillStyle(0x00FFFF);
        g.fillTriangle(13, 0, 25, 12, 13, 34);
        g.fillStyle(0x9966FF);
        g.fillTriangle(13, 0, 1, 12, 13, 34);
        g.fillStyle(0x6644CC);
        g.fillTriangle(13, 0, 4, 10, 13, 28);
        g.fillStyle(0xFFFFFF);
        g.fillTriangle(13, 4, 18, 12, 13, 25);
        g.fillStyle(0xFFFFFF, 0.5);
        g.fillTriangle(13, 6, 16, 12, 13, 20);
        g.fillStyle(0xFFFF00, 0.3);
        g.fillRect(12, 14, 2, 10);
        g.generateTexture('rainbowCrystal', 26, 34);
        g.clear();

        // ── Фея-бонус (28×30) — детализировано
        g.fillStyle(0xAAFFFF, 0.9);
        g.fillCircle(8, 12, 7);
        g.fillCircle(20, 12, 7);
        g.fillStyle(0x88DDDD, 0.6);
        g.fillCircle(8, 12, 5);
        g.fillCircle(20, 12, 5);
        g.fillStyle(0xFFFF99);
        g.fillCircle(14, 13, 7);
        g.fillStyle(0xFFDD44);
        g.fillCircle(14, 13, 5);
        g.fillStyle(0xFF00FF);
        g.fillRect(11, 18, 6, 10);
        g.fillStyle(0xDD00DD);
        g.fillRect(11, 18, 6, 2);
        g.fillStyle(0xFFFFFF);
        g.fillCircle(12, 11, 1.5);
        g.fillCircle(16, 11, 1.5);
        g.fillStyle(0x000000);
        g.fillCircle(12, 11, 0.5);
        g.fillCircle(16, 11, 0.5);
        g.fillStyle(0xFF6699);
        g.fillCircle(14, 15, 2);
        g.fillStyle(0xAAFFFF, 0.4);
        g.fillCircle(6, 7, 3);
        g.fillCircle(22, 7, 3);
        g.generateTexture('fairyBonus', 28, 30);
        g.clear();

        // ── Витаминка суперпрыжка (26×26) — детализировано
        g.fillStyle(0x00FF66);
        g.fillCircle(13, 13, 12);
        g.fillStyle(0x00CC44);
        g.fillCircle(13, 13, 9);
        g.fillStyle(0xAAFF00);
        g.fillCircle(13, 13, 7);
        g.fillStyle(0x88DD00);
        g.fillCircle(13, 13, 5);
        g.fillStyle(0xFFFFFF);
        g.fillRect(11, 4, 4, 18);
        g.fillRect(4, 11, 18, 4);
        g.fillStyle(0xCCFFFF, 0.6);
        g.fillRect(11, 6, 4, 6);
        g.fillRect(6, 11, 6, 4);
        g.fillStyle(0xFFFF00);
        g.fillCircle(9, 8, 2);
        g.fillCircle(18, 18, 2);
        g.fillStyle(0xFFDD00);
        g.fillCircle(9, 8, 1);
        g.fillCircle(18, 18, 1);
        g.fillStyle(0xFFFFFF, 0.5);
        g.fillCircle(7, 16, 2);
        g.fillCircle(19, 9, 2);
        g.lineStyle(1, 0xFFFFFF, 0.9);
        g.strokeCircle(13, 13, 12);
        g.generateTexture('vitamin', 26, 26);
        g.clear();

        // ── Мечта (36×36) — золота зірка з неоновим сяйвом
        g.fillStyle(0x1a0033, 0.3);
        g.fillCircle(18, 18, 18);
        g.fillStyle(0xFFD700);
        g.fillCircle(18, 18, 12);
        g.fillStyle(0xFFAA00);
        g.fillCircle(18, 18, 9);
        g.fillStyle(0xFFFF66);
        g.fillRect(14, 2, 8, 32);
        g.fillRect(2, 14, 32, 8);
        g.fillStyle(0xFFFFFF, 0.8);
        g.fillCircle(14, 10, 3);
        g.fillCircle(22, 26, 2);
        g.fillStyle(0x00FFFF, 0.5);
        g.fillCircle(6, 6, 2);
        g.fillCircle(30, 30, 2);
        g.fillCircle(30, 6, 1.5);
        g.fillCircle(6, 30, 1.5);
        g.lineStyle(2, 0xFFFFFF, 0.3);
        g.strokeCircle(18, 18, 14);
        g.generateTexture('dream', 36, 36);
        g.clear();

        // 13. Частица
        g.fillStyle(0xFFFFFF);
        g.fillCircle(4, 4, 4);
        g.generateTexture('particle', 8, 8);
        g.clear();

        this.synthCtx = null;
    }

    playSynthSound(type) {
        try {
            if (!this.synthCtx) {
                this.synthCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.synthCtx.state === 'suspended') {
                this.synthCtx.resume();
            }

            const now = this.synthCtx.currentTime;

            if (type === 'jump') {
                const osc = this.synthCtx.createOscillator();
                const gain = this.synthCtx.createGain();
                osc.connect(gain);
                gain.connect(this.synthCtx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                return;
            }

            if (type === 'star') {
                const osc = this.synthCtx.createOscillator();
                const gain = this.synthCtx.createGain();
                osc.connect(gain);
                gain.connect(this.synthCtx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(1100, now + 0.06);
                osc.frequency.setValueAtTime(1320, now + 0.12);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
                return;
            }

            if (type === 'heart') {
                const osc = this.synthCtx.createOscillator();
                const gain = this.synthCtx.createGain();
                osc.connect(gain);
                gain.connect(this.synthCtx.destination);
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(554, now + 0.1);
                osc.frequency.setValueAtTime(660, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
                return;
            }

            if (type === 'flower') {
                const osc = this.synthCtx.createOscillator();
                const gain = this.synthCtx.createGain();
                osc.connect(gain);
                gain.connect(this.synthCtx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.setValueAtTime(750, now + 0.05);
                osc.frequency.setValueAtTime(900, now + 0.1);
                osc.frequency.setValueAtTime(1200, now + 0.15);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
                return;
            }

            if (type === 'superItem') {
                const osc = this.synthCtx.createOscillator();
                const gain = this.synthCtx.createGain();
                osc.connect(gain);
                gain.connect(this.synthCtx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(900, now);
                osc.frequency.setValueAtTime(1200, now + 0.06);
                osc.frequency.setValueAtTime(1600, now + 0.12);
                osc.frequency.setValueAtTime(2000, now + 0.18);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
                return;
            }

            if (type === 'vitamin') {
                const osc = this.synthCtx.createOscillator();
                const gain = this.synthCtx.createGain();
                osc.connect(gain);
                gain.connect(this.synthCtx.destination);
                osc.type = 'square';
                osc.frequency.setValueAtTime(700, now);
                osc.frequency.setValueAtTime(1000, now + 0.06);
                osc.frequency.setValueAtTime(1400, now + 0.12);
                gain.gain.setValueAtTime(0.09, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
                osc.start(now);
                osc.stop(now + 0.28);
                return;
            }

            if (type === 'bark') {
                // Гав-гав!
                const osc = this.synthCtx.createOscillator();
                const gain = this.synthCtx.createGain();
                osc.connect(gain);
                gain.connect(this.synthCtx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.linearRampToValueAtTime(120, now + 0.06);
                osc.frequency.setValueAtTime(200, now + 0.08);
                osc.frequency.linearRampToValueAtTime(140, now + 0.14);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.setValueAtTime(0.05, now + 0.07);
                gain.gain.setValueAtTime(0.1, now + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                return;
            }

            if (type === 'bird') {
                const osc = this.synthCtx.createOscillator();
                const gain = this.synthCtx.createGain();
                osc.connect(gain);
                gain.connect(this.synthCtx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(200, now + 0.04);
                osc.frequency.setValueAtTime(350, now + 0.08);
                osc.frequency.linearRampToValueAtTime(220, now + 0.12);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.setValueAtTime(0.06, now + 0.06);
                gain.gain.setValueAtTime(0.1, now + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                return;
            }

            if (type === 'gameover') {
                const osc1 = this.synthCtx.createOscillator();
                const osc2 = this.synthCtx.createOscillator();
                const gain = this.synthCtx.createGain();
                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(this.synthCtx.destination);
                osc1.type = 'sine';
                osc2.type = 'sine';
                osc1.frequency.setValueAtTime(523, now);
                osc2.frequency.setValueAtTime(659, now);
                osc1.frequency.linearRampToValueAtTime(262, now + 0.6);
                osc2.frequency.linearRampToValueAtTime(330, now + 0.6);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.8);
                osc2.stop(now + 0.8);
            }
        } catch(e) {
            console.warn("Audio context user gesture block");
        }
    }

    create() {
        this.score = 0;
        this.gameOver = false;
        this.gameSpeed = 1.7;
        this.lastWasDog = false;
        this.lollipopCount = 0;
        this.superJumps = 0;
        this.canUseAirSuperJump = true;
        this.dreamMode = false;
        this.dreamSpawned = false;
        this.dreamMusic = null;
        this.mriyaNextThreshold = 1000; // Наступна Мрія через 1000 очок

        // Фіксовані константи ігрового поля (1000×600)
        this.GW = 1000;
        this.GH = 600;
        this.groundY = 560;
        this.spawnX = 1100;

        // Клавиатура
        this.cursors = this.input.keyboard.createCursorKeys();

        // Обработчики прыжка
        this.input.on('pointerdown', () => { this.initAudioContext(); this.jump(); });
        this.input.keyboard.on('keydown-SPACE', () => { this.initAudioContext(); this.jump(); });
        this.input.keyboard.on('keydown-UP', () => { this.initAudioContext(); this.jump(); });

        // Неоновое небо
        this.bgGraphics = this.add.graphics();
        this.bgGraphics.setDepth(-1);
        this.bgGraphics.fillGradientStyle(0x020208, 0x020208, 0x2d0036, 0x1a0033, 1);
        this.bgGraphics.fillRect(0, 0, this.GW, this.GH);

        // Облака (пушистые, с неоновым свечением)
        this.clouds = this.add.group();
        for(let i=0; i<5; i++) {
            let cloud = this.add.image(Phaser.Math.Between(-50, this.GW + 50), Phaser.Math.Between(15, this.GH * 0.2), 'cloud');
            cloud.setScale(0.5 + Math.random() * 1.0);
            cloud.setAlpha(0.5 + Math.random() * 0.5);
            this.clouds.add(cloud);
        }

        // Деревья на фоне (неоновые силуэты с детальной кроной)
        this.trees = this.add.group();
        let spacing = 150;
        for(let i=0; i<6; i++) {
            let x = i * spacing + Phaser.Math.Between(0, 50);
            let tree = this.add.image(x, this.groundY, 'tree');
            tree.setOrigin(0.5, 1);
            let scale = 0.6 + Math.random() * 1.0;
            tree.setScale(scale);
            tree.setAlpha(0.3 + Math.random() * 0.4);
            this.trees.add(tree);
        }

        // Земля в неоновом стиле
        this.ground = this.add.rectangle(this.GW / 2, this.groundY + 20, this.GW, 40, 0x050510);
        this.physics.add.existing(this.ground, true); 
        this.ground.body.setSize(this.GW, 40);

        // Линия неона сверху земли
        this.neonLine = this.add.rectangle(this.GW / 2, this.groundY, this.GW, 4, 0x00FFFF);

        // Анимации Мии и Собаки
        if (!this.anims.exists('run')) {
            this.anims.create({
                key: 'run',
                frames: [ { key: 'mia0' }, { key: 'mia1' } ],
                frameRate: 8,
                repeat: -1
            });
        }

        if (!this.anims.exists('dog')) {
            this.anims.create({
                key: 'dog',
                frames: [ { key: 'dog0' }, { key: 'dog1' } ],
                frameRate: 10,
                repeat: -1
            });
        }

        if (!this.anims.exists('birdFly')) {
            this.anims.create({
                key: 'birdFly',
                frames: [ { key: 'bird0' }, { key: 'bird1' } ],
                frameRate: 9,
                repeat: -1
            });
        }

        // Игрок (Мия)
        this.mia = this.physics.add.sprite(120, this.groundY - 48, 'mia0');
        this.mia.setScale(1.1);
        this.mia.play('run');
        this.miaReady = false;
        
        this.mia.setGravityY(2300);
        this.mia.setCollideWorldBounds(true);
        this.physics.add.collider(this.mia, this.ground, () => {
            this.miaReady = true;
        });
        
        // Хитбокс Мии (уменьшаем высоту хитбокса, чтобы не застревала при прыжке)
        this.mia.body.setSize(14, 32);
        this.mia.body.setOffset(5, 16);

        // Группы (В Phaser 3.60+ используем обычные группы, а не физические, во избежание дёргания координат)
        this.obstacles = this.add.group();
        this.collectibles = this.add.group();
        this.birds = this.add.group();
        this.superItems = this.add.group();
        this.rainItems = this.add.group(); // Дождь предметов в режиме Мечты

        // Спавнеры
        this.time.addEvent({ delay: 1400, callback: this.spawnObstacle, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 1000, callback: this.spawnCollectible, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 2500, callback: this.spawnBird, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 3600, callback: this.spawnSuperItem, callbackScope: this, loop: true });

        // Спавним Мечту — тепер за очками (через update)

        // Система частиц (Phaser 3.60+) — зі зменшеною кількістю для мобільних
        this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const particleLifespan = this.isMobile ? 300 : 500;
        const particleCount = this.isMobile ? 3 : 5;

        this.emitter = this.add.particles(0, 0, 'particle', {
            speed: { min: -120, max: 120 },
            scale: { start: 1, end: 0 },
            lifespan: particleLifespan,
            quantity: particleCount,
            frequency: -1
        });

        // Хелпер для взрыва частиц с нужным цветом — менше частинок на мобільних
        this.burstParticles = (count, x, y, color) => {
            const actualCount = this.isMobile ? Math.ceil(count * 0.5) : count;
            this.emitter.particleTint = color;
            this.emitter.explode(actualCount, x, y);
        };

        // Счётчики
        this.scoreText = this.add.text(20, 20, 'Очки: 0', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' });
        this.scoreText.setShadow(2, 2, '#000', 4);

        // Відображення життів (на canvas)
        this.livesText = this.add.text(this.GW / 2, 20, '', { fontSize: '22px', fill: '#FF3366', fontStyle: 'bold' });
        this.livesText.setOrigin(0.5, 0);
        this.livesText.setShadow(2, 2, '#000', 4);
        this.updateLivesDisplay();

        this.superJumpText = this.add.text(20, 50, 'Суперстрибок: 0', { fontSize: '18px', fill: '#AAFF00', fontStyle: 'bold' });
        this.superJumpText.setShadow(2, 2, '#000', 4);

        // Анимация пульсации всей области суперпрыжков
        this.tweens.add({
            targets: [this.superJumpText],
            alpha: 0.5,
            yoyo: true,
            repeat: -1,
            duration: 800
        });

        // Супер-предметы: значки слева под суперпрыжком по мере сбора
        this.superItemIcons = {};
        this.superItemCountTexts = {};
        this.superItemsCollected = {
            megaComet: 0,
            energyVitamin: 0,
            angelHeart: 0,
            rainbowCrystal: 0,
            fairyBonus: 0
        };
        this.collectedOrder = []; // Очередь собранных предметов
        this.startIconX = 24; // Начальная точка

        console.log("TEST MONITOR: Game scene initialized. Activating listeners trace.");
        this.events.once('shutdown', () => {
            console.log("TEST MONITOR: Scene shutting down. Cleaning up.");
        });
    }

    initAudioContext() {
        if (!this.synthCtx) {
            this.synthCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.synthCtx.state === 'suspended') {
            this.synthCtx.resume();
        }
    }

    playBuffer(name, volume = 0.5) {
        const audio = this.audioBuffers[name];
        if (!audio) return;
        audio.volume = Math.min(1, Math.max(0, volume));
        audio.currentTime = 0;
        audio.play().catch(e => console.warn('Audio play blocked:', e));
    }

    update(time) {
        if (this.gameOver) return;

        this.gameSpeed += 0.00005; // Замедлил ускорение в 2 раза
        let groundSpeed = this.gameSpeed;

        // Скролл фона
        this.clouds.getChildren().forEach(c => {
            c.x -= this.gameSpeed * 0.4;
            if (c.x < -120) { c.x = this.GW + 120; c.y = Phaser.Math.Between(15, this.GH * 0.2); }
        });

        // Деревья (скроллинг с эффектом параллакса)
        this.trees.getChildren().forEach(t => {
            t.x -= this.gameSpeed * 0.25; 
            if (t.x < -100) t.x = this.GW + 100;
        });

        // Управление позицией Мии
        if (this.cursors.left.isDown) this.mia.setVelocityX(-200);
        else if (this.cursors.right.isDown) this.mia.setVelocityX(200);
        else {
            this.mia.setVelocityX(0); // ИСПРАВЛЕНИЕ: Убрал авто-движение влево
        }

        // Анимация прыжка/бега
        if (!this.mia.body.touching.down && !this.mia.body.blocked.down) {
            this.mia.anims.stop(); 
            this.mia.setTexture('mia1'); 
        } else {
            this.canUseAirSuperJump = true;
            if (!this.mia.anims.isPlaying) {
                this.mia.play('run');
            }
        }

        // ДВИЖЕНИЕ ПРЕПЯТСТВИЙ (РУЧНОЕ без физического дёргания!)
        const obsArray = this.obstacles.getChildren().slice();
        for (let i = obsArray.length - 1; i >= 0; i--) {
            if (this.gameOver) break; // Выходим сразу, если игра окончена
            let obs = obsArray[i];
            if (obs.texture.key.includes('dog')) {
                obs.x -= groundSpeed * 1.5; // Собака
            } else if (obs.texture.key === 'lollipop') {
                obs.x -= groundSpeed * 1.05; // Леденець на 30% повільніше
            } else {
                obs.x -= groundSpeed; // Кусты, леденцы, грибы
            }

            // Проверка столкновения
            if (Math.abs(this.mia.x - obs.x) < 20 && Math.abs(this.mia.y - obs.y) < 30) {
                this.hitObstacle();
                break;
            }

            if (obs.x < -100) obs.destroy();
        }

        // ДВИЖЕНИЕ БОНУСОВ
        const collectArray = this.collectibles.getChildren().slice();
        for (let i = collectArray.length - 1; i >= 0; i--) {
            if (this.gameOver) break; // Выходим сразу, если игра окончена
            let item = collectArray[i];
            
            // Рух "Мрії" в 2 рази повільніше
            if (item.getData('dream')) {
                item.x -= groundSpeed * 0.5;
            } else {
                item.x -= groundSpeed;
            }

            // Проверка сбора
            if (Math.abs(this.mia.x - item.x) < 22 && Math.abs(this.mia.y - item.y) < 25) {
                this.collectItem(item);
                continue;
            }

            if (item.x < -100) {
                // Якщо Мрія пішла за екран — вважаємо спробу використаною
                if (item.getData('dream')) {
                    this.dreamSpawned = false;
                    this.mriyaNextThreshold = this.score + 1000;
                }
                item.destroy();
            }
        }

        // ДВИЖЕНИЕ ПТИЦ
        const birdArray = this.birds.getChildren().slice();
        for (let i = birdArray.length - 1; i >= 0; i--) {
            if (this.gameOver) break; // Выходим сразу, если игра окончена
            let bird = birdArray[i];
            // ИСПРАВЛЕНИЕ: Птицы двигались вправо, должны влево
            bird.x -= groundSpeed * 1.2; 
            bird.y += Math.sin(time / 120) * 1.1;

            // Проверка сбора птицы с учётом размера
            const birdHitX = Math.max(25, bird.displayWidth * 0.42);
            const birdHitY = Math.max(25, bird.displayHeight * 0.42);
            if (Math.abs(this.mia.x - bird.x) < birdHitX && Math.abs(this.mia.y - bird.y) < birdHitY) {
                this.collectBird(bird);
                continue;
            }

            if (bird.x < -100) bird.destroy();
        }

        // ДВИЖЕНИЕ ВЫСОКИХ СУПЕР-ПРЕДМЕТОВ (безопасный итератор)
        this.superItems.getChildren().forEach(item => {
            if (this.gameOver) return;
            item.x -= groundSpeed * 0.86;

            const hitX = Math.max(26, item.displayWidth * 0.45);
            const hitY = Math.max(26, item.displayHeight * 0.45);
            if (Math.abs(this.mia.x - item.x) < hitX && Math.abs(this.mia.y - item.y) < hitY) {
                this.collectSuperItem(item);
                return;
            }

            if (item.x < -120) item.destroy();
        });

        // Перевірка спавну Мрії за очками
        if (!this.dreamMode && !this.dreamSpawned && this.score >= this.mriyaNextThreshold) {
            this.spawnDream();
        }

        // ДОЖДЬ МЕЧТЫ: сбор предметов (коллизия)
        if (this.dreamMode) {
            const rainArray = this.rainItems.getChildren().slice();
            for (let i = rainArray.length - 1; i >= 0; i--) {
                let rItem = rainArray[i];
                if (Math.abs(this.mia.x - rItem.x) < 24 && Math.abs(this.mia.y - rItem.y) < 24) {
                    this.collectItem(rItem);
                }
            }
        }
    }

    jump() {
        if (this.gameOver || !this.miaReady) return;

        const jumpIdx = Math.floor(Math.random() * 2) + 1;
        const onGround = this.mia.body.touching.down || this.mia.body.blocked.down;

        if (onGround) {
            this.canUseAirSuperJump = true;
            this.mia.setVelocityY(-720);
            this.playBuffer('jump' + jumpIdx, 0.6);
            return;
        }

        // Суперпрыжок: второе нажатие в воздухе
        if (this.superJumps > 0 && this.canUseAirSuperJump) {
            this.superJumps -= 1;
            this.canUseAirSuperJump = false;
            this.superJumpText.setText('Суперстрибок: ' + this.superJumps);
            this.mia.setVelocityY(-820);
            this.burstParticles(24, this.mia.x, this.mia.y + 18, 0xAAFF00);
            this.playBuffer('jump' + jumpIdx, 0.6);
        }
    }

    spawnObstacle() {
        if (this.gameOver) return;

        let rand = Math.random();
        let key = 'bush';

        // Не даём двум собакам идти подряд
        if (this.lastWasDog) {
            // Пропускаем собаку, равномерно распределяем остальные
            let r = Math.random();
            if (r > 0.66 && this.lollipopCount < 2) key = 'lollipop';
            else if (r > 0.33) key = 'mushroom';
            else key = 'bush';
        } else {
            if (rand > 0.78) { key = 'dog0'; }
            else if (rand > 0.55 && this.lollipopCount < 2) key = 'lollipop';
            else if (rand > 0.25) key = 'mushroom';
        }

        // Сбрасываем счётчик, если не леденец; иначе увеличиваем
        this.lastWasDog = key.includes('dog');
        if (key === 'lollipop') this.lollipopCount++;
        else this.lollipopCount = 0;

        // Идеальное позиционирование Y относительно поверхности земли
        // Куст (36x36) -> центр y = groundY - 18
        // Гриб (32x38) -> y = groundY - 19
        // Леденец (34x48) -> y = groundY - 24
        // Собака (42x32) -> y = groundY - 16
        let spawnY = this.groundY - 18;
        if (key === 'mushroom') spawnY = this.groundY - 19;
        if (key === 'lollipop') spawnY = this.groundY - 24;
        if (key.includes('dog')) spawnY = this.groundY - 16;

        let obs = this.add.sprite(this.spawnX, spawnY, key);

        if (key.includes('dog')) {
            obs.flipX = true; // Мордой к Мие (влево)
            obs.play('dog');
            this.playBuffer('bark', 0.8); // Гав! (реальный звук)
            this.tweens.add({ targets: obs, y: spawnY - 3, yoyo: true, repeat: -1, duration: 180 });
        } else if (key === 'lollipop') {
            this.tweens.add({ targets: obs, angle: 360, repeat: -1, duration: 1100 });
            this.tweens.add({ targets: obs, scale: 1.12, yoyo: true, repeat: -1, duration: 420 });
        } else if (key === 'mushroom') {
            this.tweens.add({ targets: obs, y: spawnY - 6, yoyo: true, repeat: -1, duration: 520, ease: 'Sine.easeInOut' });
            this.tweens.add({ targets: obs, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 640 });
        } else {
            this.tweens.add({ targets: obs, scaleX: 1.15, scaleY: 0.9, yoyo: true, repeat: -1, duration: 480 });
            this.tweens.add({ targets: obs, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 600 });
        }

        this.obstacles.add(obs);
    }

    spawnSuperItem() {
        if (this.gameOver) return;

        const types = ['megaComet', 'energyVitamin', 'angelHeart', 'rainbowCrystal', 'fairyBonus'];
        const key = Phaser.Utils.Array.GetRandom(types);
        const y = Phaser.Math.Between(this.groundY - 260, this.groundY - 190); // Высота для суперпрыжка
        const item = this.add.sprite(this.spawnX, y, key);
        item.setData('superItem', true);

        if (key === 'megaComet') {
            item.setData('points', 250);
            this.tweens.add({ targets: item, angle: 360, repeat: -1, duration: 650 });
            this.tweens.add({ targets: item, y: y + 34, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
        } else if (key === 'energyVitamin') {
            item.setData('points', 150);
            this.tweens.add({ targets: item, scale: 1.35, yoyo: true, repeat: -1, duration: 220 });
            this.tweens.add({ targets: item, angle: 360, repeat: -1, duration: 780 });
        } else if (key === 'angelHeart') {
            item.setData('points', 300);
            this.tweens.add({ targets: item, y: y - 30, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
            this.tweens.add({ targets: item, scaleX: 1.22, scaleY: 1.12, yoyo: true, repeat: -1, duration: 340 });
        } else if (key === 'rainbowCrystal') {
            item.setData('points', 500);
            this.tweens.add({ targets: item, angle: { from: -18, to: 18 }, yoyo: true, repeat: -1, duration: 260 });
            this.tweens.add({ targets: item, alpha: 0.45, yoyo: true, repeat: -1, duration: 260 });
        } else {
            item.setData('points', 1000);
            this.tweens.add({ targets: item, y: y + 22, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.easeInOut' });
            this.tweens.add({ targets: item, scale: 1.25, yoyo: true, repeat: -1, duration: 240 });
        }

        this.superItems.add(item);
    }

    spawnDream() {
        if (this.gameOver || this.dreamSpawned) return;
        this.dreamSpawned = true;

        const y = Phaser.Math.Between(this.groundY - 170, this.groundY - 150); // Висота стрибка — не на підлозі!
        const item = this.add.sprite(this.spawnX, y, 'dream');
        item.setScale(1.3 * 0.7);
        item.setData('dream', true);

        // Візуалізація: миготіння та ефект хвоста (частинки)
        this.tweens.add({ targets: item, alpha: { from: 1, to: 0.3 }, duration: 200, yoyo: true, repeat: -1 });

        // Частинки для "хвоста" - ЗМЕНШЕНО ЧАСТОТУ (200мс замість 50мс)
        this.time.addEvent({
            delay: 200,
            loop: true,
            callback: () => {
                if (item.active) {
                    this.emitter.particleTint = 0xFFD700;
                    this.emitter.explode(1, item.x, item.y);
                }
            }
        });

        // Анімація: вращение, пульсация. Зроблено рух у 2 рази повільнішим.
        this.tweens.add({ targets: item, angle: 360, repeat: -1, duration: 4000 });

        this.collectibles.add(item);
    }

    collectDream() {
        this.dreamMode = true;

        // Стоп: убираем все преграды с экрана
        this.obstacles.clear(true, true);
        this.birds.clear(true, true);

        // Останавливаем спавнеры препятствий — просто ставим gameOver-подобный флаг
        // Удаляем все существующие таймеры спавна и включаем дождь
        this.time.removeAllEvents();

        // Замедляем скорость до минимума (всё замирает)
        this.gameSpeed = 0.1;

        // Музыка
        this.playBuffer('dreamMusic', 0.5);

        // Текст "Мечта!"
        const dreamText = this.add.text(this.GW / 2, 80, 'Мрія! ✨', {
            fontSize: '42px', fill: '#FFD700', fontStyle: 'bold', fontFamily: 'Arial'
        }).setOrigin(0.5).setShadow(4, 4, '#FFAA00', 8);
        this.tweens.add({ targets: dreamText, alpha: 0.3, yoyo: true, repeat: -1, duration: 600 });

        // Дождь предметов — спавним каждые 250ms
        const rainInterval = this.isMobile ? 350 : 250;
        this.rainTimer = this.time.addEvent({
            delay: rainInterval,
            loop: true,
            callback: this.spawnRainItem,
            callbackScope: this
        });

        // Дождь заканчивается через 30 секунд
        this.time.delayedCall(30000, () => {
            this.endDream();
        });
    }

    spawnRainItem() {
        if (this.gameOver) return;

        // Зменшено швидкість спавну на 30% (було 200, стало ~285)
        if (Math.random() > 0.3) {
            return;
        }

        const allTypes = ['star', 'heart', 'flower', 'vitamin',
            'megaComet', 'energyVitamin', 'angelHeart', 'rainbowCrystal', 'fairyBonus'];
        const key = Phaser.Utils.Array.GetRandom(allTypes);
        const x = Phaser.Math.Between(50, this.GW - 50);
        const y = -40; // Спавн сверху

        let item;
        // Супер-предметы (для них своя текстура)
        if (['megaComet', 'energyVitamin', 'angelHeart', 'rainbowCrystal', 'fairyBonus'].includes(key)) {
            item = this.add.image(x, y, key);
            item.setData('superItem', true);
            const pts = { megaComet: 250, energyVitamin: 150, angelHeart: 300, rainbowCrystal: 500, fairyBonus: 1000 };
            item.setData('points', pts[key] || 100);
        } else {
            item = this.add.image(x, y, key);
            item.setData('bonus', key === 'vitamin' ? 'superjump' : null);
        }

        item.setScale(Phaser.Math.FloatBetween(0.6, 1.2));

        // Падение вниз
        this.tweens.add({
            targets: item,
            y: Phaser.Math.Between(Math.min(this.GH * 0.4, 150), this.groundY - 20),
            duration: Phaser.Math.Between(1500, 3000),
            ease: 'Sine.easeIn',
            onComplete: () => {
                // Замирает на месте
                this.tweens.add({
                    targets: item,
                    alpha: 0.6,
                    yoyo: true,
                    repeat: -1,
                    duration: 400
                });
            }
        });

        // Вращение
        this.tweens.add({
            targets: item,
            angle: Phaser.Math.Between(-360, 360),
            duration: Phaser.Math.Between(1000, 2500),
            repeat: -1
        });

        this.rainItems.add(item);
    }

    endDream() {
        this.dreamMode = false;

        // Останавливаем музыку
        const music = this.audioBuffers.dreamMusic;
        if (music) { music.pause(); music.currentTime = 0; }

        // Убираем дождь
        if (this.rainTimer) this.rainTimer.remove();
        this.rainItems.clear(true, true);

        // Восстанавливаем скорость
        this.gameSpeed = 1.7;

        // Очищаем тексты
        this.children.getAll().forEach(child => {
            if (child.type === 'Text' && child.text === 'Мрія! ✨') child.destroy();
        });

        // Перезапускаем спавнеры
        this.time.removeAllEvents();
        this.time.addEvent({ delay: 1400, callback: this.spawnObstacle, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 1000, callback: this.spawnCollectible, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 2500, callback: this.spawnBird, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 3600, callback: this.spawnSuperItem, callbackScope: this, loop: true });
        // Наступна Мрія: поточний рахунок + 1000 (щоб не спавнилась одразу)
        this.mriyaNextThreshold = this.score + 1000;
        this.dreamSpawned = false;
    }

    spawnBird() {
        if (this.gameOver) return;

        const sizeRoll = Math.random();
        let birdScale = 1.0;
        let birdPoints = 20;
        let y = Phaser.Math.Between(this.groundY - 140, this.groundY - 95);

        if (sizeRoll > 0.82) {
            birdScale = 1.35;
            birdPoints = 80;
            y = Phaser.Math.Between(this.groundY - 165, this.groundY - 120);
        } else if (sizeRoll > 0.55) {
            birdScale = 0.9;
            birdPoints = 40;
            y = Phaser.Math.Between(this.groundY - 150, this.groundY - 105);
        } else {
            birdScale = 0.6;
            birdPoints = 20;
            y = Phaser.Math.Between(this.groundY - 135, this.groundY - 90);
        }

        let bird = this.add.sprite(this.spawnX, y, 'bird0');
        bird.setScale(birdScale);
        bird.setFlipX(false);
        bird.play('birdFly');
        bird.setData('points', birdPoints);
        this.tweens.add({ targets: bird, scaleY: birdScale * 0.72, yoyo: true, repeat: -1, duration: 140 });
        this.tweens.add({ targets: bird, angle: { from: -8, to: 8 }, yoyo: true, repeat: -1, duration: 240 });
        this.birds.add(bird);
    }

    spawnCollectible() {
        if (this.gameOver) return;

        let rand = Math.random();
        
        if (rand > 0.60) {
            let y = Phaser.Math.Between(this.groundY - 150, this.groundY - 80);
            let vitamin = this.add.sprite(this.spawnX, y, 'vitamin');
            vitamin.setData('bonus', 'superjump');
            this.tweens.add({ targets: vitamin, angle: 360, repeat: -1, duration: 800 });
            this.tweens.add({ targets: vitamin, scale: 1.25, yoyo: true, repeat: -1, duration: 260 });
            this.collectibles.add(vitamin);
            return;
        }

        // Бонусы на разной, но досягаемой высоте прыжка
        let key = 'star';
        if (rand > 0.6) key = 'heart';
        else if (rand > 0.3) key = 'flower';

        // Высота прыжка: Мия стабильно достаёт около 80-120px от земли
        let y;
        if (key === 'star') y = Phaser.Math.Between(this.groundY - 130, this.groundY - 85);
        else if (key === 'heart') y = Phaser.Math.Between(this.groundY - 80, this.groundY - 40);
        else y = Phaser.Math.Between(this.groundY - 110, this.groundY - 60);

        let item = this.add.sprite(this.spawnX, y, key);

        if (key === 'star') {
            this.tweens.add({ targets: item, angle: 360, repeat: -1, duration: 900 });
            this.tweens.add({ targets: item, scale: 1.25, yoyo: true, repeat: -1, duration: 320 });
        } else if (key === 'heart') {
            this.tweens.add({ targets: item, scaleX: 1.28, scaleY: 1.18, yoyo: true, repeat: -1, duration: 260 });
            this.tweens.add({ targets: item, y: y - 8, yoyo: true, repeat: -1, duration: 520, ease: 'Sine.easeInOut' });
        } else {
            this.tweens.add({ targets: item, angle: { from: -18, to: 18 }, yoyo: true, repeat: -1, duration: 360 });
            this.tweens.add({ targets: item, scale: 1.18, yoyo: true, repeat: -1, duration: 410 });
        }
        this.collectibles.add(item);
    }

    updateSuperItemsText(collectedKey) {
        // Создаем иконку, если ещё нет
        if (!this.superItemIcons[collectedKey]) {
            this.collectedOrder.push(collectedKey);
            const x = this.startIconX + (this.collectedOrder.length - 1) * 36;
            const y = 84;
            const icon = this.add.sprite(x, y, collectedKey).setScale(0.5);
            const countText = this.add.text(x + 12, y - 8, String(this.superItemsCollected[collectedKey]), { fontSize: '14px', fill: '#FFFFFF', fontStyle: 'bold' });
            countText.setShadow(2, 2, '#000', 4);
            // Анимация появления
            icon.setScale(0);
            this.tweens.add({ targets: icon, scale: 0.5, duration: 300, ease: 'Back.easeOut' });
            this.tweens.add({ targets: icon, angle: { from: -20, to: 20 }, yoyo: true, repeat: 2, duration: 100 });
            this.superItemIcons[collectedKey] = icon;
            this.superItemCountTexts[collectedKey] = countText;
        } else {
            // Обновляем счётчик
            if (this.superItemCountTexts[collectedKey]) {
                this.superItemCountTexts[collectedKey].setText(String(this.superItemsCollected[collectedKey]));
            }
            // Анимация при сборе
            const icon = this.superItemIcons[collectedKey];
            if (icon) {
                this.tweens.killTweensOf(icon);
                icon.setScale(0.5);
                this.tweens.add({ targets: icon, scale: 0.8, yoyo: true, duration: 200 });
                this.tweens.add({ targets: icon, angle: { from: -20, to: 20 }, yoyo: true, repeat: 2, duration: 100 });
            }
        }

        // Обновляем все тексты (на случай визуальной синхронизации)
        Object.keys(this.superItemsCollected).forEach(key => {
            if (this.superItemCountTexts[key]) {
                this.superItemCountTexts[key].setText(String(this.superItemsCollected[key]));
            }
        });
    }

    showFloatingScore(score, x, y) {
        const text = this.add.text(x, y, '+' + score, { fontSize: '20px', fill: '#FFFF00', fontStyle: 'bold' });
        text.setShadow(1, 1, '#000', 2);
        this.tweens.add({
            targets: text,
            y: y - 50,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy()
        });
    }

    collectSuperItem(item) {
        const key = item.texture.key;
        const points = item.getData('points') || 100;
        const colors = {
            megaComet: 0xFFD700,
            energyVitamin: 0x00CCFF,
            angelHeart: 0xFF3366,
            rainbowCrystal: 0x9966FF,
            fairyBonus: 0xFFFF99
        };

        this.showFloatingScore(points, item.x, item.y);
        
        // Эффекты
        this.burstParticles(32, item.x, item.y, colors[key] || 0xFFFFFF);
        this.playSynthSound('superItem');
        // Случайный смех (0-4) при ловле супер-предмета
        if (this.audioBuffers) {
            const laughIdx = Math.floor(Math.random() * 5);
            this.playBuffer('laugh' + laughIdx, 0.6);
        }
        
        // Обновление счета
        this.score += points;
        this.scoreText.setText('Очки: ' + this.score);
        
        // Удаляем объект
        item.destroy();
        
        // Инкремент счётчика и обновление UI
        this.superItemsCollected[key] = (this.superItemsCollected[key] || 0) + 1;
        this.updateSuperItemsText(key);
    }

    collectItem(item) {
        let key = item.texture.key;

        // Мечта!
        if (item.getData('dream')) {
            this.burstParticles(60, item.x, item.y, 0xFFD700);
            item.destroy();
            this.collectDream();
            return;
        }

        // Предметы во время дождя Мечты (висят на месте)
        if (this.dreamMode && this.rainItems.getChildren().includes(item)) {
            if (key === 'vitamin') {
                this.burstParticles(22, item.x, item.y, 0xAAFF00);
                item.destroy();
                this.playSynthSound('vitamin');
                this.superJumps += 1;
                this.superJumpText.setText('Суперстрибок: ' + this.superJumps);
                return;
            }
            // Супер-предметы
            if (item.getData('superItem')) {
                const pts = item.getData('points') || 100;
                this.showFloatingScore(pts, item.x, item.y);
                this.burstParticles(32, item.x, item.y, 0xFFD700);
                item.destroy();
                this.score += pts;
                this.scoreText.setText('Очки: ' + this.score);
                // Трекаємо супер-предмети в режимі Мрії
                this.superItemsCollected[key] = (this.superItemsCollected[key] || 0) + 1;
                this.updateSuperItemsText(key);
                return;
            }
            const pts = key === 'heart' ? 25 : (key === 'flower' ? 15 : 10);
            this.showFloatingScore(pts, item.x, item.y);
            let color = key === 'heart' ? 0xFF1493 : (key === 'flower' ? 0xFF00FF : 0xFFFF00);
            this.burstParticles(12, item.x, item.y, color);
            item.destroy();
            this.score += pts;
            this.scoreText.setText('Очки: ' + this.score);
            return;
        }

        if (key === 'vitamin') {
            this.burstParticles(22, item.x, item.y, 0xAAFF00);
            item.destroy();
            this.playSynthSound('vitamin');
            this.superJumps += 1;
            this.superJumpText.setText('Суперстрибок: ' + this.superJumps);
            return;
        }
        
        const pts = key === 'heart' ? 25 : (key === 'flower' ? 15 : 10);
        this.totalRegularItems += 1;
        this.showFloatingScore(pts, item.x, item.y);

        let color = key === 'heart' ? 0xFF1493 : (key === 'flower' ? 0xFF00FF : 0xFFFF00);
        this.burstParticles(12, item.x, item.y, color);
        
        item.destroy();
        this.playSynthSound(key); // Уникальный звук: star / heart / flower
        
        this.score += pts;
        this.scoreText.setText('Очки: ' + this.score);
    }

    collectBird(bird) {
        const points = bird.getData('points') || 20;
        this.showFloatingScore(points, bird.x, bird.y);

        const particleCount = points === 80 ? 28 : (points === 40 ? 18 : 10);
        this.burstParticles(particleCount, bird.x, bird.y, 0x00FFFF);

        bird.destroy();
        this.playBuffer('vorona', 0.7);

        this.score += points;
        this.totalBirds += 1;
        this.scoreText.setText('Очки: ' + this.score);
    }

    hitObstacle() {
        if (this.gameOver) return;

        // Если в режиме Мечты — выключаем его
        if (this.dreamMode) {
            this.endDream();
        }

        this.burstParticles(40, this.mia.x, this.mia.y, 0xFF00FF);

        this.lives -= 1;
        this.updateLivesDisplay();

        if (this.lives > 0) {
            this.playBuffer('ohno', 0.7);
            // Показуємо повідомлення про втрату життя
            const msgText = this.add.text(this.GW / 2, this.GH / 2 - 20, this.playerName + ', у тебе залишилось ' + this.lives + ' життя!', {
                fontSize: '36px', fill: '#FF3366', fontStyle: 'bold', align: 'center',
                backgroundColor: '#000', padding: { x: 24, y: 16 }
            }).setOrigin(0.5);
            msgText.setShadow(3, 3, '#000', 6);

            this.physics.pause();
            this.gameOver = true;
            this.mia.setTint(0xff0000);
            this.mia.anims.stop();

            // Відновлюємо через 1.5 секунди
            const rs = () => {
                if (this.scene.isActive()) {
                    this.gameOver = false;
                    this.mia.clearTint();
                    this.physics.resume();
                    msgText.destroy();
                    // Видаляємо всі перешкоди, щоб не було повторного зіткнення
                    this.obstacles.clear(true, true);
                    // Видаляємо Мрію з екрану, щоб не висіла
                    this.collectibles.getChildren().forEach(c => {
                        if (c.getData && c.getData('dream')) c.destroy();
                    });
                    this.dreamSpawned = false;
                }
            };
            this.time.delayedCall(1500, rs);
        } else {
            // Гра завершена
            this.physics.pause();
            this.gameOver = true;
            this.mia.setTint(0xff0000);
            this.mia.anims.stop();
            // Очищаємо всі активні об'єкти, щоб не заважали
            this.obstacles.clear(true, true);
            this.collectibles.clear(true, true);
            this.birds.clear(true, true);
            this.superItems.clear(true, true);
            this.rainItems.clear(true, true);
            this.playBuffer('finalSound', 0.7);
            if (currentPlayer) submitScore(this.score);

            // Підрахунок усіх зібраних предметів
            const collectedKeys = [];
            let totalSuperItems = 0;
            if (this.superItemsCollected) {
                Object.keys(this.superItemsCollected).forEach(key => {
                    const count = this.superItemsCollected[key];
                    if (count > 0) {
                        totalSuperItems += count;
                        collectedKeys.push({ key, count });
                    }
                });
            }

            const centerX = this.GW / 2;
            const isPortrait = this.GH > this.GW;

            // Затемнення всього екрану
            const overlay = this.add.rectangle(centerX, this.GH / 2, this.GW, this.GH, 0x000000, 0.75);
            overlay.setOrigin(0.5);
            overlay.setDepth(100);

            // Розраховуємо розмір панелі та позиції елементів динамічно
            const borderPad = isPortrait ? 20 : 80;
            const panelW = Math.min(560, this.GW - borderPad * 2);
            const panelX = centerX;
            const panelY = this.GH / 2;

            // Починаємо з верхнього краю панелі + відступ
            const padTop = 20;
            let lineY = panelY - 170 + padTop;

            // Заголовок
            const titleText = this.add.text(panelX, lineY, 'Гра закінчилася!', {
                fontSize: isPortrait ? '24px' : '32px',
                fill: '#FF3366',
                fontStyle: 'bold',
                fontFamily: 'Arial'
            }).setOrigin(0.5).setShadow(3, 3, '#000', 6).setDepth(103);
            lineY += 32;

            // Ім'я гравця
            this.add.text(panelX, lineY, this.playerName, {
                fontSize: '14px',
                fill: '#AAAAAA',
                fontFamily: 'Arial'
            }).setOrigin(0.5).setDepth(103);
            lineY += 24;

            // Іконки супер-предметів з кількістю
            const iconSize = 30;
            const maxIconsPerRow = isPortrait ? 3 : 5;
            const iconRows = [];
            if (collectedKeys.length > 0) {
                const rowCount = Math.ceil(collectedKeys.length / maxIconsPerRow);
                collectedKeys.forEach((item, i) => {
                    const currentRow = Math.floor(i / maxIconsPerRow);
                    const totalInRow = Math.min(maxIconsPerRow, collectedKeys.length - currentRow * maxIconsPerRow);
                    const rowStartX = panelX - (totalInRow * iconSize) / 2;
                    const col = i % maxIconsPerRow;
                    const ix = rowStartX + col * iconSize + iconSize / 2;
                    const iy = lineY + currentRow * 26;

                    this.add.image(ix, iy, item.key).setScale(0.4).setDepth(103);
                    this.add.text(ix + 10, iy - 4, 'x' + item.count, {
                        fontSize: '12px',
                        fill: '#FFFFFF',
                        fontStyle: 'bold'
                    }).setOrigin(0, 0.5).setShadow(1, 1, '#000', 3).setDepth(103);

                    if (!iconRows[currentRow]) iconRows[currentRow] = 0;
                    iconRows[currentRow]++;
                });
                lineY += iconRows.length * 26 + 4;
            }

            // Очки
            this.add.text(panelX, lineY, 'Очки: ' + this.score, {
                fontSize: '22px',
                fill: '#00FFFF',
                fontStyle: 'bold',
                fontFamily: 'Arial'
            }).setOrigin(0.5).setShadow(3, 3, '#000', 6).setDepth(103);
            lineY += 28;

            // Статистика
            this.add.text(panelX, lineY, '🐦 ' + this.totalBirds + '   ⭐ ' + this.totalRegularItems, {
                fontSize: '13px',
                fill: '#CCCCCC',
                fontFamily: 'Arial'
            }).setOrigin(0.5).setDepth(103);
            lineY += 28;

            // Кнопка "Спробувати знову"
            const restartBtnBg = this.add.rectangle(panelX, lineY, 210, 40);
            restartBtnBg.setFillStyle(0x003344, 0.6);
            restartBtnBg.setStrokeStyle(2, 0x00ffff, 0.9);
            restartBtnBg.setDepth(103);

            const restartText = this.add.text(panelX, lineY, 'Спробувати знову', {
                fontSize: '16px',
                fill: '#00FFFF',
                fontStyle: 'bold',
                fontFamily: 'Arial'
            }).setOrigin(0.5).setDepth(104);

            // Пульсація кнопки
            this.tweens.add({
                targets: [restartBtnBg, restartText],
                alpha: 0.6,
                yoyo: true,
                repeat: -1,
                duration: 800
            });

            // Підказка
            const hintY = lineY + 32;
            this.add.text(panelX, hintY, 'Натисни, щоб почати спочатку', {
                fontSize: '11px',
                fill: '#888888',
                fontFamily: 'Arial'
            }).setOrigin(0.5).setDepth(103);

            // Тепер визначаємо фактичну висоту панелі за вмістом
            const contentTop = panelY - 170;
            const contentBottom = hintY + 14;
            const contentHeight = contentBottom - contentTop;
            const panelH = Math.min(contentHeight + 20, this.GH - 80);
            const newPanelY = (contentTop + contentBottom) / 2;

            // Малюємо рамку ПІД текстом, але НАД затемненням (depth 101 та 102)
            // Внутрішнє світіння рамки (зовні)
            const glow = this.add.rectangle(panelX, newPanelY, panelW + 8, panelH + 8);
            glow.setOrigin(0.5);
            glow.setStrokeStyle(3, 0xff00ff, 0.4);
            glow.setFillStyle(0x000000, 0);
            glow.setDepth(101);

            // Декоративна рамка
            const frame = this.add.rectangle(panelX, newPanelY, panelW, panelH, 0x0a0a2e, 0.95);
            frame.setOrigin(0.5);
            frame.setStrokeStyle(2, 0x00ffff, 0.8);
            frame.setDepth(102);

            const restart = () => {
                this.input.removeAllListeners();
                this.input.keyboard.removeAllListeners();
                this.tweens.killAll();
                this.time.removeAllEvents();
                // Повертаємось на стартовий екран замість scene.restart
                if (window._game) {
                    window._game.destroy(true);
                    window._game = null;
                }
                showStartUI();
            };
            this.input.once('pointerdown', restart);
            this.input.keyboard.once('keydown-SPACE', restart);
            this.input.keyboard.once('keydown-ENTER', restart);
        }
    }

    updateLivesDisplay() {
        if (this.livesText) {
            this.livesText.setText('❤️ '.repeat(this.lives).trim());
        }
        // Оновлюємо HTML індикатор
        const livesEl = document.getElementById('lives-display');
        if (livesEl) {
            livesEl.textContent = '❤️ '.repeat(this.lives).trim();
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 600,
    parent: 'game-container',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    backgroundColor: '#020208',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: MainScene,
    fps: {
        target: 60,
        forceSetTimeOut: false,
        smoothStep: true
    }
};