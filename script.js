const tg = window.Telegram.WebApp;
tg.expand(); 

const regScreen = document.getElementById('registration-screen');
const bottomNav = document.getElementById('bottom-nav');
const btnRegister = document.getElementById('btn-register');
const btnWater = document.getElementById('btn-water');
const btnSaveCycle = document.getElementById('btn-save-cycle');

const activityModal = document.getElementById('activity-modal');
const btnOpenActivity = document.getElementById('btn-open-activity');
const btnCloseActivity = document.getElementById('btn-close-activity');
const btnSaveActivity = document.getElementById('btn-save-activity');

const navItems = document.querySelectorAll('.nav-item');
const allScreens = document.querySelectorAll('.main-content');

let userData = { weight: 0, waterGoal: 0, waterCurrent: 0, stepsToday: 0, distanceToday: 0, caloriesToday: 0 };

// ⚠️ Твоя ссылка ⚠️
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbwsLFa7b3cwAbh1YpVMYo4nLjyfkOuDKAAaLRQoAsQiRoMwdYwjW3QwVDGGFE4FVu_I/exec"; 

const currentUserId = tg.initDataUnsafe?.user?.id || 'test_user_' + Math.floor(Math.random() * 1000);
regScreen.classList.add('hidden');

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
            
            userData.stepsToday = data.userData.stepsToday || 0;
            userData.distanceToday = data.userData.distanceToday || 0;
            userData.caloriesToday = data.userData.caloriesToday || 0;
            
            document.getElementById('water-goal').innerText = userData.waterGoal;
            document.getElementById('water-current').innerText = userData.waterCurrent;
            document.getElementById('greeting-name').innerText = `Привет, ${data.userData.nickname}!`;

            document.getElementById('stat-steps').innerText = userData.stepsToday;
            document.getElementById('stat-distance').innerText = userData.distanceToday;
            document.getElementById('stat-kcal').innerText = userData.caloriesToday;

            // Выводим КБЖУ
            document.getElementById('plan-kcal').innerText = `${data.userData.dailyKcal} ккал`;
            document.getElementById('plan-protein').innerText = data.userData.protein;
            document.getElementById('plan-fat').innerText = data.userData.fat;
            document.getElementById('plan-carbs').innerText = data.userData.carbs;

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

// --- 2. РЕГИСТРАЦИЯ И РАСЧЕТ КБЖУ ---
btnRegister.addEventListener('click', () => {
    const gender = document.getElementById('gender').value;
    const age = parseInt(document.getElementById('age').value);
    const height = parseInt(document.getElementById('height').value);
    const weight = parseFloat(document.getElementById('weight').value);
    const targetWeight = parseFloat(document.getElementById('target-weight').value);
    const weeks = parseInt(document.getElementById('weeks').value);
    
    if(!weight || !height || !targetWeight || !age || !weeks) return tg.showAlert("Заполни все поля, чтобы ИИ смог всё рассчитать!");

    // 1. Считаем Базовый метаболизм (BMR) по Миффлину-Сан Жеору
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = gender === 'female' ? bmr - 161 : bmr + 5;

    // 2. Считаем Общий расход энергии (TDEE). Берем коэффициент 1.2 (сидячий образ жизни как база)
    const tdee = bmr * 1.2;

    // 3. Считаем необходимый дефицит калорий
    const weightToLose = weight - targetWeight;
    const totalDeficit = weightToLose * 7700; // 1 кг жира = ~7700 ккал
    const dailyDeficit = totalDeficit / (weeks * 7);

    // 4. Дневная норма калорий
    let dailyKcal = Math.round(tdee - dailyDeficit);
    
    // Защита от экстремального голодания
    const minKcal = gender === 'female' ? 1200 : 1500;
    if (dailyKcal < minKcal) dailyKcal = minKcal;

    // 5. Расчет Макронутриентов (БЖУ)
    const protein = Math.round(weight * 1.8); // 1.8г белка на кг
    const fat = Math.round(weight * 1.0);     // 1г жира на кг
    const remainingKcal = dailyKcal - (protein * 4) - (fat * 9);
    const carbs = Math.max(0, Math.round(remainingKcal / 4)); // Остаток уходит в углеводы

    userData.weight = weight;
    userData.waterGoal = weight * 35;
    
    const originalBtnText = btnRegister.innerText;
    btnRegister.innerText = "Создаем профиль... ✨";
    btnRegister.disabled = true;

    sendToServer({
        action: "register", userId: currentUserId, nickname: tg.initDataUnsafe?.user?.first_name || 'Гость',
        gender: gender, age: age, height: height, weight: weight, targetWeight: targetWeight, weeks: weeks,
        dailyKcal: dailyKcal, protein: protein, fat: fat, carbs: carbs
    }).then(() => {
        // Заполняем интерфейс перед показом
        document.getElementById('water-goal').innerText = userData.waterGoal;
        document.getElementById('water-current').innerText = 0;
        document.getElementById('greeting-name').innerText = `Привет, ${tg.initDataUnsafe?.user?.first_name || 'Гость'}!`;
        document.getElementById('plan-kcal').innerText = `${dailyKcal} ккал`;
        document.getElementById('plan-protein').innerText = protein;
        document.getElementById('plan-fat').innerText = fat;
        document.getElementById('plan-carbs').innerText = carbs;

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
    sendToServer({ action: "log_water", userId: currentUserId, waterAmount: userData.waterCurrent }).catch(e=>console.error(e));
});

// --- 4. ТРЕКЕР АКТИВНОСТИ ---
btnOpenActivity.addEventListener('click', () => {
    document.getElementById('input-steps').value = userData.stepsToday || '';
    document.getElementById('input-distance').value = userData.distanceToday || '';
    document.getElementById('input-kcal').value = userData.caloriesToday || '';
    activityModal.classList.remove('hidden');
    tg.HapticFeedback.impactOccurred('light');
});

btnCloseActivity.addEventListener('click', () => activityModal.classList.add('hidden'));

btnSaveActivity.addEventListener('click', () => {
    const steps = parseInt(document.getElementById('input-steps').value) || 0;
    const distance = parseFloat(document.getElementById('input-distance').value) || 0;
    const calories = parseInt(document.getElementById('input-kcal').value) || 0;

    userData.stepsToday = steps; userData.distanceToday = distance; userData.caloriesToday = calories;
    document.getElementById('stat-steps').innerText = steps; document.getElementById('stat-distance').innerText = distance; document.getElementById('stat-kcal').innerText = calories;

    activityModal.classList.add('hidden');
    tg.HapticFeedback.notificationOccurred('success');

    sendToServer({ action: "log_activity", userId: currentUserId, steps: steps, distance: distance, calories: calories }).catch(e=>console.error(e));
});

// --- 5. ЖЕНСКИЙ КАЛЕНДАРЬ ---
function calculatePhase() {
    const startDate = document.getElementById('cycle-start').value;
    const duration = parseInt(document.getElementById('cycle-duration').value);
    if (!startDate || !duration) return; 

    const start = new Date(startDate);
    const today = new Date();
    const diffDays = Math.floor(Math.abs(today - start) / (1000 * 60 * 60 * 24));
    const currentDayOfCycle = (diffDays % duration) + 1;

    let phaseName = "", phaseDesc = "", isLuteal = false;

    if (currentDayOfCycle >= 1 && currentDayOfCycle <= 5) {
        phaseName = "Менструальная фаза 🩸";
        phaseDesc = "Время очищения и отдыха. Выбирай легкие прогулки.";
    } else if (currentDayOfCycle >= 6 && currentDayOfCycle <= 13) {
        phaseName = "Фолликулярная фаза 🌱";
        phaseDesc = "Энергия растет! Отличное время для интенсивных нагрузок.";
    } else if (currentDayOfCycle >= 14 && currentDayOfCycle <= 16) {
        phaseName = "Овуляция 🌸";
        phaseDesc = "Пик твоей энергии и привлекательности.";
    } else {
        phaseName = "Лютеиновая фаза 🍂";
        phaseDesc = "Энергия идет на спад. Снизь темп и добавь ухода за собой.";
        isLuteal = true; 
    }

    document.getElementById('phase-name').innerText = phaseName;
    document.getElementById('phase-desc').innerText = phaseDesc;
    document.getElementById('phase-result').classList.remove('hidden');

    const adviceBlock = document.getElementById('phase-advice');
    isLuteal ? adviceBlock.classList.remove('hidden') : adviceBlock.classList.add('hidden');
}

btnSaveCycle.addEventListener('click', () => {
    const startDate = document.getElementById('cycle-start').value;
    const duration = document.getElementById('cycle-duration').value;
    if (!startDate || !duration) return tg.showAlert("Укажи дату и длину цикла.");

    calculatePhase();
    tg.HapticFeedback.notificationOccurred('success');
    btnSaveCycle.innerText = "Сохраняем...";
    
    sendToServer({ action: "update_cycle", userId: currentUserId, cycleStart: startDate, cycleDuration: duration })
    .then(() => btnSaveCycle.innerText = "Рассчитать фазу");
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