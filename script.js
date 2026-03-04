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

let userData = { weight: 0, waterGoal: 0, waterCurrent: 0, stepsToday: 0, distanceToday: 0, caloriesToday: 0, history: {}, customTags: [] };
let selectedSymptoms = [];

// ⚠️ Твоє посилання на Google Apps Script ⚠️
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

// --- 1. ПЕРЕВІРКА КОРИСТУВАЧА ---
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
            
            // Зберігаємо історію та власні теги
            userData.history = data.userData.history || {};
            userData.customTags = data.userData.customTags ? data.userData.customTags.split(',') : [];
            
            document.getElementById('water-goal').innerText = userData.waterGoal;
            document.getElementById('water-current').innerText = userData.waterCurrent;
            document.getElementById('greeting-name').innerText = `Привіт, ${data.userData.nickname}!`;
            document.getElementById('stat-steps').innerText = userData.stepsToday;
            document.getElementById('stat-distance').innerText = userData.distanceToday;
            document.getElementById('stat-kcal').innerText = userData.caloriesToday;
            document.getElementById('plan-kcal').innerText = `${data.userData.dailyKcal} ккал`;
            document.getElementById('plan-protein').innerText = data.userData.protein;
            document.getElementById('plan-fat').innerText = data.userData.fat;
            document.getElementById('plan-carbs').innerText = data.userData.carbs;

            renderCustomTags(); // Відмальовуємо теги

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

// --- 2. РЕЄСТРАЦІЯ ТА РОЗРАХУНОК КБЖВ ---
btnRegister.addEventListener('click', () => {
    const gender = document.getElementById('gender').value;
    const age = parseInt(document.getElementById('age').value);
    const height = parseInt(document.getElementById('height').value);
    const weight = parseFloat(document.getElementById('weight').value);
    const targetWeight = parseFloat(document.getElementById('target-weight').value);
    const weeks = parseInt(document.getElementById('weeks').value);
    
    if(!weight || !height || !targetWeight || !age || !weeks) return tg.showAlert("Будь ласка, заповни всі поля!");

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = gender === 'female' ? bmr - 161 : bmr + 5;
    const tdee = bmr * 1.2;
    const dailyKcal = Math.max((gender === 'female' ? 1200 : 1500), Math.round(tdee - ((weight - targetWeight) * 7700 / (weeks * 7))));
    const protein = Math.round(weight * 1.8);
    const fat = Math.round(weight * 1.0);     
    const carbs = Math.max(0, Math.round((dailyKcal - (protein * 4) - (fat * 9)) / 4));

    userData.weight = weight;
    userData.waterGoal = weight * 35;
    
    const originalBtnText = btnRegister.innerText;
    btnRegister.innerText = "Створюємо... ✨";
    btnRegister.disabled = true;

    sendToServer({
        action: "register", userId: currentUserId, nickname: tg.initDataUnsafe?.user?.first_name || 'Гість',
        gender: gender, age: age, height: height, weight: weight, targetWeight: targetWeight, weeks: weeks,
        dailyKcal: dailyKcal, protein: protein, fat: fat, carbs: carbs
    }).then(() => {
        document.getElementById('water-goal').innerText = userData.waterGoal;
        document.getElementById('water-current').innerText = 0;
        document.getElementById('greeting-name').innerText = `Привіт, ${tg.initDataUnsafe?.user?.first_name || 'Гість'}!`;
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

// --- 3. ВОДА ТА АКТИВНІСТЬ ---
btnWater.addEventListener('click', () => {
    userData.waterCurrent += 250;
    document.getElementById('water-current').innerText = userData.waterCurrent;
    tg.HapticFeedback.impactOccurred('light');
    if (userData.waterCurrent === userData.waterGoal) tg.HapticFeedback.notificationOccurred('success');
    sendToServer({ action: "log_water", userId: currentUserId, waterAmount: userData.waterCurrent }).catch(e=>console.error(e));
});

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

// --- 5. ЖІНОЧИЙ КАЛЕНДАР (Ритм) ---
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
        circleText.innerText = "місячних";
        cycleCircle.style.borderColor = "rgba(236, 72, 153, 0.6)"; 
        cycleCircle.style.boxShadow = "0 0 50px rgba(236, 72, 153, 0.3)";
    } else {
        const daysLeft = cycleDuration - currentDayOfCycle + 1;
        circleValue.innerText = daysLeft;
        circleText.innerText = "днів до\nмісячних";
        
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
        phaseName = "Менструальна фаза 🩸";
        phaseDesc = "Час очищення та відпочинку. Обирай легкі прогулянки.";
    } else if (currentDayOfCycle > periodDuration && currentDayOfCycle <= 13) {
        phaseName = "Фолікулярна фаза 🌱";
        phaseDesc = "Енергія росте! Чудовий час для активних тренувань.";
    } else if (currentDayOfCycle >= 14 && currentDayOfCycle <= 16) {
        phaseName = "Овуляція 🌸";
        phaseDesc = "Пік твоєї енергії та привабливості.";
    } else {
        phaseName = "Лютеїнова фаза 🍂";
        phaseDesc = "Енергія йде на спад. Додай догляду за собою.";
        isLuteal = true; 
    }
    document.getElementById('phase-name').innerText = phaseName;
    document.getElementById('phase-desc').innerText = phaseDesc;

    const strip = document.getElementById('calendar-strip');
    strip.innerHTML = ""; 
    const daysNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    let todayElement = null;

    for (let i = -10; i <= 30; i++) {
        let date = new Date(today);
        date.setDate(today.getDate() + i);
        let dDiff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        let cDay = (dDiff % cycleDuration) + 1;
        if (cDay <= 0) cDay += cycleDuration;

        let div = document.createElement('div');
        div.className = 'calendar-day';
        if (i === 0) { div.classList.add('today'); todayElement = div; }
        if (cDay >= 1 && cDay <= periodDuration) div.classList.add('period');
        else if (cDay >= 13 && cDay <= 15) div.classList.add('ovulation');

        div.innerHTML = `<span class="day-name">${daysNames[date.getDay()]}</span><span class="day-number">${date.getDate()}</span>`;
        strip.appendChild(div);
    }
    setTimeout(() => { if (todayElement) todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 100);
}

// Початкове налаштування циклу
btnSaveCycle.addEventListener('click', () => {
    const c1Start = new Date(document.getElementById('c1-start').value);
    const c1End = new Date(document.getElementById('c1-end').value);
    const c2Start = new Date(document.getElementById('c2-start').value);
    
    if (isNaN(c1Start) || isNaN(c1End) || isNaN(c2Start)) return tg.showAlert("Заповни дати циклів!");

    let periodDur = Math.round((c1End - c1Start) / (1000 * 60 * 60 * 24)) + 1;
    if (periodDur < 3 || periodDur > 10) periodDur = 5; 
    let avgCycle = Math.abs(Math.round((c1Start - c2Start) / (1000 * 60 * 60 * 24)));
    if (avgCycle < 21 || avgCycle > 35) avgCycle = 28; 

    const latestStartStr = document.getElementById('c1-start').value;
    tg.HapticFeedback.notificationOccurred('success');
    btnSaveCycle.innerText = "Зберігаємо...";
    
    sendToServer({ action: "update_cycle", userId: currentUserId, cycleStart: latestStartStr, cycleDuration: avgCycle, periodDuration: periodDur
    }).then(() => {
        btnSaveCycle.innerText = "Створити мій календар 🪄";
        userData.cycleStart = latestStartStr; userData.cycleDuration = avgCycle; userData.periodDuration = periodDur;
        renderRhythmDashboard(latestStartStr, avgCycle, periodDur);
    });
});

// --- СИМПТОМИ ТА ТЕГИ ---
let currentSymptomDate = new Date(); 
const symptomsModal = document.getElementById('symptoms-modal');
const dayInfoModal = document.getElementById('day-info-modal');

// Функція відкриття вікна симптомів на конкретну дату
function openSymptomsModal(dateObj) {
    currentSymptomDate = dateObj; 
    const dateStr = dateObj.toDateString();
    
    let displayDate = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    document.getElementById('symptoms-modal-title').innerText = dateObj.toDateString() === new Date().toDateString() ? "Як ти сьогодні?" : displayDate;

    // Скидаємо теги
    selectedSymptoms = [];
    document.querySelectorAll('.symptom-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('symptom-note').value = "";

    // Підтягуємо історію
    if (userData.history[dateStr]) {
        if (userData.history[dateStr].symptoms) {
            selectedSymptoms = userData.history[dateStr].symptoms.split(',');
            selectedSymptoms.forEach(sym => {
                let chip = document.querySelector(`.symptom-chip[data-sym="${sym}"]`);
                if (chip) chip.classList.add('active');
            });
        }
        document.getElementById('symptom-note').value = userData.history[dateStr].note || "";
    }

    symptomsModal.classList.remove('hidden');
    tg.HapticFeedback.impactOccurred('light');
}

// Кнопка "+" на головному екрані
document.getElementById('btn-open-symptoms-today').addEventListener('click', () => {
    openSymptomsModal(new Date()); 
});

document.getElementById('btn-close-symptoms').addEventListener('click', () => {
    symptomsModal.classList.add('hidden');
});

// Логіка кліків по тегах
function toggleSymptom(chip, sym) {
    chip.classList.toggle('active');
    if (selectedSymptoms.includes(sym)) selectedSymptoms = selectedSymptoms.filter(s => s !== sym);
    else selectedSymptoms.push(sym);
    tg.HapticFeedback.selectionChanged();
}

function renderCustomTags() {
    const container = document.getElementById('symptoms-container');
    document.querySelectorAll('.symptom-chip.custom').forEach(el => el.remove());
    if (userData.customTags) {
        userData.customTags.forEach(tag => {
            let div = document.createElement('div');
            div.className = 'symptom-chip custom'; div.setAttribute('data-sym', tag); div.innerText = tag;
            div.addEventListener('click', () => toggleSymptom(div, tag));
            container.appendChild(div);
        });
    }
}

// Вішаємо кліки на стандартні теги
document.querySelectorAll('.symptom-chip:not(.custom)').forEach(chip => {
    chip.addEventListener('click', () => toggleSymptom(chip, chip.getAttribute('data-sym')));
});

// Додавання власного тегу
document.getElementById('btn-add-custom-tag').addEventListener('click', () => {
    const input = document.getElementById('input-custom-tag');
    const newTag = input.value.trim();
    if(!newTag) return;
    if (!userData.customTags.includes(newTag)) {
        userData.customTags.push(newTag);
        renderCustomTags();
        let newChip = document.querySelector(`.symptom-chip[data-sym="${newTag}"]`);
        if(newChip) toggleSymptom(newChip, newTag);
        
        sendToServer({ action: "save_custom_tags", userId: currentUserId, tags: userData.customTags.join(',') });
    }
    input.value = "";
    tg.HapticFeedback.impactOccurred('light');
});

// ЗБЕРЕЖЕННЯ СИМПТОМІВ
document.getElementById('btn-save-symptoms').addEventListener('click', () => {
    const note = document.getElementById('symptom-note').value;
    const btn = document.getElementById('btn-save-symptoms');
    btn.innerText = "Зберігаємо...";
    
    const dateStr = currentSymptomDate.toDateString();
    userData.history[dateStr] = { symptoms: selectedSymptoms.join(','), note: note };

    sendToServer({ 
        action: "log_symptoms", 
        userId: currentUserId, 
        dateStr: currentSymptomDate.toISOString(), 
        symptoms: selectedSymptoms.join(','), 
        note: note
    }).then(() => {
        btn.innerText = "Зберегти симптоми"; 
        symptomsModal.classList.add('hidden'); 
        tg.HapticFeedback.notificationOccurred('success');
    });
});

// --- ІНТЕРАКТИВНИЙ КАЛЕНДАР (РЕДАГУВАННЯ ТА ІСТОРІЯ) ---
let calendarMode = 'view'; // 'view' або 'edit'
const fullCalModal = document.getElementById('full-calendar-modal');
const btnOpenInteractiveCal = document.getElementById('btn-open-interactive-cal');
const btnOpenFullCal = document.getElementById('btn-open-full-cal');
let viewedDateObj = new Date(); // Дата для вікна інфо

if(btnOpenInteractiveCal) {
    btnOpenInteractiveCal.addEventListener('click', () => {
        calendarMode = 'edit';
        document.getElementById('full-cal-month').innerText = "Відміть дні місячних";
        document.getElementById('btn-save-calendar-dates').classList.remove('hidden');
        renderFullCalendar();
        fullCalModal.classList.remove('hidden');
        tg.HapticFeedback.impactOccurred('light');
    });
}

if(btnOpenFullCal) {
    btnOpenFullCal.addEventListener('click', () => {
        calendarMode = 'view';
        document.getElementById('full-cal-month').innerText = "Історія циклу";
        document.getElementById('btn-save-calendar-dates').classList.add('hidden');
        renderFullCalendar();
        fullCalModal.classList.remove('hidden');
        tg.HapticFeedback.impactOccurred('light');
    });
}

document.getElementById('btn-close-full-cal').addEventListener('click', () => fullCalModal.classList.add('hidden'));

function renderFullCalendar() {
    const grid = document.getElementById('full-calendar-grid');
    grid.innerHTML = "";
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDay = firstDay === 0 ? 6 : firstDay - 1; 

    for (let i = 0; i < startDay; i++) {
        let emptyDiv = document.createElement('div'); emptyDiv.className = 'cal-grid-day empty'; grid.appendChild(emptyDiv);
    }

    let start = userData.cycleStart ? new Date(userData.cycleStart) : today;
    start.setHours(0,0,0,0);
    let cDur = userData.cycleDuration || 28;
    let pDur = userData.periodDuration || 5;

    for (let i = 1; i <= daysInMonth; i++) {
        let dayDiv = document.createElement('div');
        dayDiv.className = 'cal-grid-day';
        dayDiv.innerText = i;
        
        let currentDate = new Date(year, month, i);
        let localDateStr = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        dayDiv.setAttribute('data-date', localDateStr);

        let diffTime = currentDate.getTime() - start.getTime();
        let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        let cDay = (diffDays % cDur) + 1;
        if (cDay <= 0) cDay += cDur;

        if (i === today.getDate()) dayDiv.classList.add('today');

        // Розмальовуємо
        if (userData.cycleStart) {
            if (cDay >= 1 && cDay <= pDur) {
                if(calendarMode === 'edit') dayDiv.classList.add('user-selected');
                else dayDiv.classList.add('period');
            } else if (cDay >= 13 && cDay <= 15) {
                dayDiv.classList.add('ovulation');
            }
        }

        // Клік по дню
        dayDiv.addEventListener('click', () => {
            if (calendarMode === 'edit') {
                dayDiv.classList.toggle('user-selected');
                tg.HapticFeedback.selectionChanged();
            } else {
                openDayInfo(currentDate, cDay, pDur);
            }
        });
        grid.appendChild(dayDiv);
    }
}

// ВІКНО ІНФОРМАЦІЇ ПРО ДЕНЬ
function openDayInfo(dateObj, cycleDay, pDur) {
    viewedDateObj = dateObj; 
    const dateStr = dateObj.toDateString();
    const dayData = userData.history[dateStr] || { symptoms: "", note: "" };

    document.getElementById('day-info-title').innerText = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    
    let phaseText = `День циклу ${cycleDay}`;
    if (cycleDay >= 1 && cycleDay <= pDur) phaseText += " (🩸 Місячні)";
    else if (cycleDay >= 13 && cycleDay <= 15) phaseText += " (🌸 Овуляція)";
    document.getElementById('day-info-phase').innerText = phaseText;

    const symContainer = document.getElementById('day-info-symptoms');
    symContainer.innerHTML = "";
    if (dayData.symptoms) {
        dayData.symptoms.split(',').forEach(sym => {
            let originalChip = document.querySelector(`.symptom-chip[data-sym="${sym}"]`);
            let symName = originalChip ? originalChip.innerText : sym;
            let chip = document.createElement('div');
            chip.className = 'symptom-chip active';
            chip.style.pointerEvents = 'none';
            chip.innerText = symName;
            symContainer.appendChild(chip);
        });
    } else {
        symContainer.innerHTML = '<span style="font-size: 13px; color: var(--text-muted);">Нічого не відмічено</span>';
    }

    document.getElementById('day-info-note').innerText = dayData.note || "Немає записів";
    document.getElementById('day-info-modal').classList.remove('hidden');
    tg.HapticFeedback.impactOccurred('light');
}

document.getElementById('btn-close-day-info').addEventListener('click', () => {
    document.getElementById('day-info-modal').classList.add('hidden');
});

// Кнопка "Редагувати цей день" всередині вікна інформації
document.getElementById('btn-edit-past-symptoms').addEventListener('click', () => {
    document.getElementById('day-info-modal').classList.add('hidden'); 
    openSymptomsModal(viewedDateObj); 
});

// Кнопка збереження для режиму 'edit' (місячні)
document.getElementById('btn-save-calendar-dates').addEventListener('click', () => {
    const selectedElements = document.querySelectorAll('.cal-grid-day.user-selected');
    if (selectedElements.length === 0) return tg.showAlert("Відміть хоча б один день!");

    const btn = document.getElementById('btn-save-calendar-dates');
    btn.innerText = "Оновлення...";
    tg.HapticFeedback.impactOccurred('medium');

    let earliestDateStr = null;
    let earliestDateObj = null;

    selectedElements.forEach(el => {
        const dateStr = el.getAttribute('data-date');
        const dateObj = new Date(dateStr);
        if (!earliestDateObj || dateObj < earliestDateObj) { earliestDateObj = dateObj; earliestDateStr = dateStr; }
    });

    let newPeriodDuration = selectedElements.length;
    let currentCycleDuration = userData.cycleDuration || 28; 

    sendToServer({
        action: "update_cycle", userId: currentUserId, cycleStart: earliestDateStr, 
        cycleDuration: currentCycleDuration, periodDuration: newPeriodDuration
    }).then(() => {
        btn.innerText = "Зберегти дати";
        fullCalModal.classList.add('hidden'); 
        userData.cycleStart = earliestDateStr; userData.periodDuration = newPeriodDuration;
        renderRhythmDashboard(earliestDateStr, currentCycleDuration, newPeriodDuration);
        tg.HapticFeedback.notificationOccurred('success');
    });
});

// --- 6. НАВІГАЦІЯ ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        allScreens.forEach(screen => screen.classList.add('hidden'));
        
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
        tg.HapticFeedback.selectionChanged();

        // ФІКС КАЛЕНДАРЯ: Скролимо до "Сьогодні", коли відкриваємо екран "Ритм"
        if (targetId === 'calendar-screen') {
            setTimeout(() => {
                const todayEl = document.querySelector('.calendar-day.today');
                if (todayEl) {
                    todayEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }, 50); // Затримка 50мс, щоб екран встиг стати видимим
        }
    });
});