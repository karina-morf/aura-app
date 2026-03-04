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

            document.getElementById('plan-kcal').innerText = `${data.userData.dailyKcal} ккал`;
            document.getElementById('plan-protein').innerText = data.userData.protein;
            document.getElementById('plan-fat').innerText = data.userData.fat;
            document.getElementById('plan-carbs').innerText = data.userData.carbs;

            // БЛОК РИТМА
            if (data.userData.cycleStart && data.userData.cycleDuration) {
                const periodDuration = data.userData.periodDuration || 5; 
                userData.cycleStart = data.userData.cycleStart;
                userData.cycleDuration = data.userData.cycleDuration;
                userData.periodDuration = periodDuration;
                renderRhythmDashboard(data.userData.cycleStart, data.userData.cycleDuration, periodDuration);
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

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = gender === 'female' ? bmr - 161 : bmr + 5;
    const tdee = bmr * 1.2;
    const weightToLose = weight - targetWeight;
    const totalDeficit = weightToLose * 7700;
    const dailyDeficit = totalDeficit / (weeks * 7);

    let dailyKcal = Math.round(tdee - dailyDeficit);
    const minKcal = gender === 'female' ? 1200 : 1500;
    if (dailyKcal < minKcal) dailyKcal = minKcal;

    const protein = Math.round(weight * 1.8);
    const fat = Math.round(weight * 1.0);     
    const remainingKcal = dailyKcal - (protein * 4) - (fat * 9);
    const carbs = Math.max(0, Math.round(remainingKcal / 4));

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

// --- 5. ЖЕНСКИЙ КАЛЕНДАРЬ (AURA x FLO) ---
function renderRhythmDashboard(startDateStr, cycleDuration, periodDuration) {
    document.getElementById('rhythm-setup').classList.add('hidden');
    document.getElementById('rhythm-dashboard').classList.remove('hidden');

    const start = new Date(startDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - start.getTime();
    let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    let currentDayOfCycle = (diffDays % cycleDuration) + 1;
    if (currentDayOfCycle <= 0) currentDayOfCycle += cycleDuration; 

    const circleValue = document.getElementById('cycle-days-main');
    const circleText = document.getElementById('cycle-text-main');
    const cycleCircle = document.getElementById('cycle-circle');

    if (currentDayOfCycle <= periodDuration) {
        circleValue.innerText = `День ${currentDayOfCycle}`;
        circleText.innerText = "месячных";
        cycleCircle.style.borderColor = "rgba(236, 72, 153, 0.6)"; 
        cycleCircle.style.boxShadow = "0 0 50px rgba(236, 72, 153, 0.3)";
    } else {
        const daysLeft = cycleDuration - currentDayOfCycle + 1;
        circleValue.innerText = daysLeft;
        circleText.innerText = "дней до\nмесячных";
        
        if (currentDayOfCycle >= 12 && currentDayOfCycle <= 16) {
            cycleCircle.style.borderColor = "rgba(45, 212, 191, 0.6)"; 
            cycleCircle.style.boxShadow = "0 0 50px rgba(45, 212, 191, 0.3)";
        } else {
            cycleCircle.style.borderColor = "rgba(255, 255, 255, 0.2)"; 
            cycleCircle.style.boxShadow = "none";
        }
    }

    let phaseName = "", phaseDesc = "", isLuteal = false;
    if (currentDayOfCycle >= 1 && currentDayOfCycle <= periodDuration) {
        phaseName = "Менструальная фаза 🩸";
        phaseDesc = "Время очищения и отдыха. Выбирай легкие прогулки.";
    } else if (currentDayOfCycle > periodDuration && currentDayOfCycle <= 13) {
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
    const adviceBlock = document.getElementById('phase-advice');
    isLuteal ? adviceBlock.classList.remove('hidden') : adviceBlock.classList.add('hidden');

    const strip = document.getElementById('calendar-strip');
    strip.innerHTML = ""; 
    const daysNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    let todayElement = null;

    for (let i = -10; i <= 30; i++) {
        let date = new Date(today);
        date.setDate(today.getDate() + i);
        
        let dDiff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        let cDay = (dDiff % cycleDuration) + 1;
        if (cDay <= 0) cDay += cycleDuration;

        let div = document.createElement('div');
        div.className = 'calendar-day';
        
        if (i === 0) {
            div.classList.add('today');
            todayElement = div;
        }

        if (cDay >= 1 && cDay <= periodDuration) {
            div.classList.add('period');
        } else if (cDay >= 13 && cDay <= 15) { 
            div.classList.add('ovulation');
        }

        div.innerHTML = `<span class="day-name">${daysNames[date.getDay()]}</span><span class="day-number">${date.getDate()}</span>`;
        strip.appendChild(div);
    }

    setTimeout(() => {
        if (todayElement) todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
}

// Первоначальная настройка циклов
btnSaveCycle.addEventListener('click', () => {
    const c1Start = new Date(document.getElementById('c1-start').value);
    const c1End = new Date(document.getElementById('c1-end').value);
    const c2Start = new Date(document.getElementById('c2-start').value);
    const c3Start = new Date(document.getElementById('c3-start').value);

    if (isNaN(c1Start) || isNaN(c1End) || isNaN(c2Start) || isNaN(c3Start)) {
        return tg.showAlert("Заполни даты начала всех 3 циклов и конец последнего!");
    }

    let periodDur = Math.round((c1End - c1Start) / (1000 * 60 * 60 * 24)) + 1;
    if (periodDur < 3 || periodDur > 10) periodDur = 5; 

    const len1 = Math.abs(Math.round((c1Start - c2Start) / (1000 * 60 * 60 * 24)));
    const len2 = Math.abs(Math.round((c2Start - c3Start) / (1000 * 60 * 60 * 24)));
    
    let avgCycle = Math.round((len1 + len2) / 2);
    if (avgCycle < 21 || avgCycle > 35) avgCycle = 28; 

    const latestStartStr = document.getElementById('c1-start').value;

    tg.HapticFeedback.notificationOccurred('success');
    btnSaveCycle.innerText = "Сохраняем...";
    
    sendToServer({ 
        action: "update_cycle", userId: currentUserId, cycleStart: latestStartStr, 
        cycleDuration: avgCycle, periodDuration: periodDur
    }).then(() => {
        btnSaveCycle.innerText = "Создать мой календарь 🪄";
        userData.cycleStart = latestStartStr; userData.cycleDuration = avgCycle; userData.periodDuration = periodDur;
        renderRhythmDashboard(latestStartStr, avgCycle, periodDur);
    });
});

// --- ЛОГИКА СИМПТОМОВ ---
let selectedSymptoms = [];
document.querySelectorAll('.symptom-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        const sym = chip.getAttribute('data-sym');
        if (selectedSymptoms.includes(sym)) {
            selectedSymptoms = selectedSymptoms.filter(s => s !== sym);
        } else {
            selectedSymptoms.push(sym);
        }
        tg.HapticFeedback.selectionChanged();
    });
});

document.getElementById('btn-save-symptoms').addEventListener('click', () => {
    const note = document.getElementById('symptom-note').value;
    const btn = document.getElementById('btn-save-symptoms');
    
    btn.innerText = "Сохраняем...";
    sendToServer({
        action: "log_symptoms",
        userId: currentUserId,
        symptoms: selectedSymptoms.join(','),
        note: note
    }).then(() => {
        btn.innerText = "Сохранено ✓";
        tg.HapticFeedback.notificationOccurred('success');
        setTimeout(() => btn.innerText = "Сохранить симптомы", 2000);
    });
});

// --- ІНТЕРАКТИВНИЙ КАЛЕНДАР (ЛОГІКА FLO) ---
const fullCalModal = document.getElementById('full-calendar-modal');
const btnOpenInteractiveCal = document.getElementById('btn-open-interactive-cal');

// Відкриття календаря
if(btnOpenInteractiveCal) {
    btnOpenInteractiveCal.addEventListener('click', () => {
        renderFullCalendar();
        fullCalModal.classList.remove('hidden');
        tg.HapticFeedback.impactOccurred('light');
    });
}

// Закриття
document.getElementById('btn-close-full-cal').addEventListener('click', () => {
    fullCalModal.classList.add('hidden');
});

// Малюємо календар і робимо його клікабельним
function renderFullCalendar() {
    const grid = document.getElementById('full-calendar-grid');
    grid.innerHTML = "";

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const monthNames = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
    document.getElementById('full-cal-month').innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let startDay = firstDay === 0 ? 6 : firstDay - 1; // Понеділок = 0

    // Порожні клітинки на початку
    for (let i = 0; i < startDay; i++) {
        let emptyDiv = document.createElement('div');
        emptyDiv.className = 'cal-grid-day empty';
        grid.appendChild(emptyDiv);
    }

    let start = userData.cycleStart ? new Date(userData.cycleStart) : today;
    start.setHours(0,0,0,0);
    let cDur = userData.cycleDuration || 28;
    let pDur = userData.periodDuration || 5;

    for (let i = 1; i <= daysInMonth; i++) {
        let dayDiv = document.createElement('div');
        dayDiv.className = 'cal-grid-day';
        dayDiv.innerText = i;
        
        // Зберігаємо справжню дату в елементі, щоб потім її прочитати
        let currentDate = new Date(year, month, i);
        // Зсув часового поясу, щоб дата не "з'їхала" на день назад
        let localDateStr = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        dayDiv.setAttribute('data-date', localDateStr);

        let diffTime = currentDate.getTime() - start.getTime();
        let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let cDay = (diffDays % cDur) + 1;
        if (cDay <= 0) cDay += cDur;

        if (i === today.getDate()) dayDiv.classList.add('today');

        // Відмальовуємо поточні прогнози
        if (userData.cycleStart) {
            if (cDay >= 1 && cDay <= pDur) {
                // Це день місячних за прогнозом. Робимо його одразу "вибраним" користувачем!
                dayDiv.classList.add('user-selected'); 
            } else if (cDay >= 13 && cDay <= 15) {
                dayDiv.classList.add('ovulation');
            }
        }

        // ЛОГІКА КЛІКУ ПО ДНЮ (Виділення)
        dayDiv.addEventListener('click', () => {
            dayDiv.classList.toggle('user-selected');
            tg.HapticFeedback.selectionChanged();
        });

        grid.appendChild(dayDiv);
    }
}

// КНОПКА ЗБЕРЕЖЕННЯ (Магія розрахунку)
document.getElementById('btn-save-calendar-dates').addEventListener('click', () => {
    // Знаходимо всі дні, які користувач виділив рожевим
    const selectedElements = document.querySelectorAll('.cal-grid-day.user-selected');
    
    if (selectedElements.length === 0) {
        return tg.showAlert("Відміть хоча б один день місячних у календарі!");
    }

    const btn = document.getElementById('btn-save-calendar-dates');
    btn.innerText = "Оновлення прогнозів...";
    tg.HapticFeedback.impactOccurred('medium');

    // Шукаємо найранішу дату серед виділених (це і є початок циклу)
    let earliestDateStr = null;
    let earliestDateObj = null;

    selectedElements.forEach(el => {
        const dateStr = el.getAttribute('data-date');
        const dateObj = new Date(dateStr);
        if (!earliestDateObj || dateObj < earliestDateObj) {
            earliestDateObj = dateObj;
            earliestDateStr = dateStr;
        }
    });

    // Тривалість місячних — це просто кількість виділених кружечків!
    let newPeriodDuration = selectedElements.length;
    let currentCycleDuration = userData.cycleDuration || 28; // Тривалість циклу не чіпаємо

    // Відправляємо в базу
    sendToServer({
        action: "update_cycle", 
        userId: currentUserId, 
        cycleStart: earliestDateStr, 
        cycleDuration: currentCycleDuration, 
        periodDuration: newPeriodDuration
    }).then(() => {
        btn.innerText = "Зберегти дати";
        fullCalModal.classList.add('hidden'); // Ховаємо календар
        
        // Оновлюємо локальні дані та перемальовуємо головний екран
        userData.cycleStart = earliestDateStr;
        userData.periodDuration = newPeriodDuration;
        renderRhythmDashboard(earliestDateStr, currentCycleDuration, newPeriodDuration);
        
        tg.HapticFeedback.notificationOccurred('success');
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