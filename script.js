const tg = window.Telegram.WebApp;
tg.expand(); 

const regScreen = document.getElementById('registration-screen');
const bottomNav = document.getElementById('bottom-nav');
const btnRegister = document.getElementById('btn-register');
const btnWater = document.getElementById('btn-water');
const btnSaveCycle = document.getElementById('btn-save-cycle');

// Элементы активности
const activityModal = document.getElementById('activity-modal');
const btnOpenActivity = document.getElementById('btn-open-activity');
const btnCloseActivity = document.getElementById('btn-close-activity');
const btnSaveActivity = document.getElementById('btn-save-activity');

const navItems = document.querySelectorAll('.nav-item');
const allScreens = document.querySelectorAll('.main-content');

let userData = { weight: 0, waterGoal: 0, waterCurrent: 0, stepsToday: 0, distanceToday: 0, caloriesToday: 0 };

// ⚠️ Твоя ссылка (сохранена) ⚠️
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbwsLFa7b3cwAbh1YpVMYo4nLjyfkOuDKAAaLRQoAsQiRoMwdYwjW3QwVDGGFE4FVu_I/exec"; 

const currentUserId = tg.initDataUnsafe?.user?.id || 'test_user_' + Math.floor(Math.random() * 1000);
regScreen.classList.add('hidden');

// --- Функция отправки запросов ---
function sendToServer(payload) {
    return fetch(GOOGLE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }).then(res => res.json());
}

// --- 1. ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ ---
function checkUser() {
    sendToServer({ action: "check_user", userId: currentUserId })
    .then(data => {
        if (data.exists) {
            userData.weight = parseFloat(data.userData.weight);
            userData.waterGoal = userData.weight * 35;
            userData.waterCurrent = data.userData.waterToday || 0; 
            
            // Подтягиваем активность из базы!
            userData.stepsToday = data.userData.stepsToday || 0;
            userData.distanceToday = data.userData.distanceToday || 0;
            userData.caloriesToday = data.userData.caloriesToday || 0;
            
            document.getElementById('water-goal').innerText = userData.waterGoal;
            document.getElementById('water-current').innerText = userData.waterCurrent;
            document.getElementById('greeting-name').innerText = `Привет, ${data.userData.nickname}!`;

            // Обновляем дашборд активности на экране
            document.getElementById('stat-steps').innerText = userData.stepsToday;
            document.getElementById('stat-distance').innerText = userData.distanceToday;
            document.getElementById('stat-kcal').innerText = userData.caloriesToday;

            if (data.userData.cycleStart && data.userData.cycleDuration) {
                const dateObj = new Date(data.userData.cycleStart);
                const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                
                document.getElementById('cycle-start').value = localDateStr;
                document.getElementById('cycle-duration').value = data.userData.cycleDuration;
                calculatePhase(); 
            }

            document.getElementById('main-screen').classList.remove('hidden');
            bottomNav.classList.remove('hidden');
        } else {
            regScreen.classList.remove('hidden');
        }
    }).catch(err => regScreen.classList.remove('hidden'));
}
checkUser();

// --- 2. РЕГИСТРАЦИЯ ---
btnRegister.addEventListener('click', () => {
    const heightInput = document.getElementById('height').value;
    const weightInput = document.getElementById('weight').value;
    const targetWeightInput = document.getElementById('target-weight').value;
    const protocolInput = document.getElementById('diet-protocol').value;
    
    if(!weightInput || !heightInput || !targetWeightInput) return tg.showAlert("Заполни все поля");

    userData.weight = parseFloat(weightInput);
    userData.waterGoal = userData.weight * 35;
    document.getElementById('water-goal').innerText = userData.waterGoal;
    
    const originalBtnText = btnRegister.innerText;
    btnRegister.innerText = "Создаем профиль... ✨";
    btnRegister.disabled = true;

    sendToServer({
        action: "register", userId: currentUserId, nickname: tg.initDataUnsafe?.user?.first_name || 'Гость',
        height: heightInput, weight: weightInput, targetWeight: targetWeightInput, protocol: protocolInput
    }).then(() => {
        regScreen.classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        bottomNav.classList.remove('hidden');
        btnRegister.innerText = originalBtnText;
        btnRegister.disabled = false;
        tg.HapticFeedback.notificationOccurred('success');
    });
});

// --- 3. ТРЕКЕР ВОДЫ ---
btnWater.addEventListener('click', () => {
    userData.waterCurrent += 250;
    document.getElementById('water-current').innerText = userData.waterCurrent;
    tg.HapticFeedback.impactOccurred('light');
    if (userData.waterCurrent === userData.waterGoal) tg.HapticFeedback.notificationOccurred('success');

    sendToServer({
        action: "log_water",
        userId: currentUserId,
        waterAmount: userData.waterCurrent
    }).catch(err => console.error("Ошибка сохранения воды:", err));
});

// --- 4. ТРЕКЕР АКТИВНОСТИ (НОВОЕ) ---
btnOpenActivity.addEventListener('click', () => {
    // Подставляем текущие значения в поля модалки
    document.getElementById('input-steps').value = userData.stepsToday || '';
    document.getElementById('input-distance').value = userData.distanceToday || '';
    document.getElementById('input-kcal').value = userData.caloriesToday || '';
    activityModal.classList.remove('hidden');
    tg.HapticFeedback.impactOccurred('light');
});

btnCloseActivity.addEventListener('click', () => {
    activityModal.classList.add('hidden');
});

btnSaveActivity.addEventListener('click', () => {
    const steps = parseInt(document.getElementById('input-steps').value) || 0;
    const distance = parseFloat(document.getElementById('input-distance').value) || 0;
    const calories = parseInt(document.getElementById('input-kcal').value) || 0;

    // Обновляем локальные данные
    userData.stepsToday = steps;
    userData.distanceToday = distance;
    userData.caloriesToday = calories;

    // Обновляем интерфейс
    document.getElementById('stat-steps').innerText = steps;
    document.getElementById('stat-distance').innerText = distance;
    document.getElementById('stat-kcal').innerText = calories;

    activityModal.classList.add('hidden');
    tg.HapticFeedback.notificationOccurred('success');

    // Отправляем в базу
    sendToServer({
        action: "log_activity",
        userId: currentUserId,
        steps: steps,
        distance: distance,
        calories: calories
    }).catch(err => console.error("Ошибка сохранения активности:", err));
});

// --- 5. ЖЕНСКИЙ КАЛЕНДАРЬ ---
function calculatePhase() {
    const startDate = document.getElementById('cycle-start').value;
    const duration = parseInt(document.getElementById('cycle-duration').value);

    if (!startDate || !duration) return; 

    const start = new Date(startDate);
    const today = new Date();
    
    const diffTime = Math.abs(today - start);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const currentDayOfCycle = (diffDays % duration) + 1;

    let phaseName = "";
    let phaseDesc = "";
    let isLuteal = false;

    if (currentDayOfCycle >= 1 && currentDayOfCycle <= 5) {
        phaseName = "Менструальная фаза 🩸";
        phaseDesc = "Время очищения и отдыха. Будь бережна к себе, выбирай легкие прогулки вместо тяжелых тренировок.";
    } else if (currentDayOfCycle >= 6 && currentDayOfCycle <= 13) {
        phaseName = "Фолликулярная фаза 🌱";
        phaseDesc = "Энергия растет! Отличное время для новых привычек и интенсивных нагрузок.";
    } else if (currentDayOfCycle >= 14 && currentDayOfCycle <= 16) {
        phaseName = "Овуляция 🌸";
        phaseDesc = "Пик твоей энергии и привлекательности. Ты готова свернуть горы!";
    } else {
        phaseName = "Лютеиновая фаза 🍂";
        phaseDesc = "Энергия идет на спад. Могут появиться перепады настроения. Снизь темп и добавь ухода за собой.";
        isLuteal = true; 
    }

    document.getElementById('phase-name').innerText = phaseName;
    document.getElementById('phase-desc').innerText = phaseDesc;
    document.getElementById('phase-result').classList.remove('hidden');

    const adviceBlock = document.getElementById('phase-advice');
    if (isLuteal) {
        adviceBlock.classList.remove('hidden');
    } else {
        adviceBlock.classList.add('hidden');
    }
}

btnSaveCycle.addEventListener('click', () => {
    const startDate = document.getElementById('cycle-start').value;
    const duration = document.getElementById('cycle-duration').value;

    if (!startDate || !duration) {
        tg.showAlert("Укажи дату и длину цикла.");
        return;
    }

    calculatePhase();
    tg.HapticFeedback.notificationOccurred('success');

    const originalText = btnSaveCycle.innerText;
    btnSaveCycle.innerText = "Сохраняем...";
    
    sendToServer({
        action: "update_cycle",
        userId: currentUserId,
        cycleStart: startDate,
        cycleDuration: duration
    }).then(() => {
        btnSaveCycle.innerText = "Рассчитать фазу";
    });
});

// --- 6. МЕНЮ НАВИГАЦИИ ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        allScreens.forEach(screen => screen.classList.add('hidden'));
        document.getElementById(item.getAttribute('data-target')).classList.remove('hidden');
        tg.HapticFeedback.selectionChanged();
    });
});