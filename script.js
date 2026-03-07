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

let userData = { 
    weight: 0, waterGoal: 0, waterCurrent: 0, 
    stepsToday: 0, distanceToday: 0, burnedKcalToday: 0, 
    goalKcal: 0, goalProtein: 0, goalFat: 0, goalCarbs: 0, 
    consumedKcalToday: 0, consumedProtein: 0, consumedFat: 0, consumedCarbs: 0, 
    history: {}, customTags: [],
    foodHistory: {} 
};
let selectedSymptoms = [];

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

function updateNutritionUI(totalKcal, totalProtein, totalFat, totalCarbs) {
    let remKcal = userData.goalKcal - totalKcal;
    let remProtein = userData.goalProtein - totalProtein;
    let remFat = userData.goalFat - totalFat;
    let remCarbs = userData.goalCarbs - totalCarbs;

    const setElement = (id, val) => {
        const el = document.getElementById(id);
        el.innerText = val;
        el.style.color = ''; 
    };

    setElement('plan-kcal', remKcal);
    setElement('plan-protein', remProtein);
    setElement('plan-fat', remFat);
    setElement('plan-carbs', remCarbs);
}

function recalculateNutritionForSelectedDate() {
    let totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0;
    const dateStr = focusCurrentDate.toDateString();
    const logs = userData.foodHistory[dateStr] || [];
    
    logs.forEach(food => {
        totalKcal += food.kcal;
        totalProtein += food.protein;
        totalFat += food.fat;
        totalCarbs += food.carbs;
    });

    if (dateStr === new Date().toDateString()) {
        userData.consumedKcalToday = totalKcal;
        userData.consumedProtein = totalProtein;
        userData.consumedFat = totalFat;
        userData.consumedCarbs = totalCarbs;
    }
    
    updateNutritionUI(totalKcal, totalProtein, totalFat, totalCarbs);
}

function checkUser() {
    sendToServer({ action: "check_user", userId: currentUserId })
    .then(data => {
        if (data.exists) {
            userData.weight = parseFloat(data.userData.weight);
            userData.waterGoal = userData.weight * 35;
            userData.waterCurrent = data.userData.waterToday || 0; 
            userData.stepsToday = data.userData.stepsToday || 0;
            userData.distanceToday = data.userData.distanceToday || 0;
            userData.burnedKcalToday = data.userData.caloriesToday || 0; 
            
            userData.goalKcal = data.userData.dailyKcal || 0;
            userData.goalProtein = data.userData.protein || 0;
            userData.goalFat = data.userData.fat || 0;
            userData.goalCarbs = data.userData.carbs || 0;
            
            userData.history = data.userData.history || {};
            userData.customTags = data.userData.customTags ? data.userData.customTags.split(',') : [];
            
            userData.foodHistory = {};
            for (let d in userData.history) {
                if (userData.history[d].foodLog) {
                    userData.foodHistory[d] = userData.history[d].foodLog;
                }
            }
            if (!userData.foodHistory[new Date().toDateString()]) {
                userData.foodHistory[new Date().toDateString()] = [];
            }
            
            document.getElementById('water-goal').innerText = userData.waterGoal;
            document.getElementById('water-current').innerText = userData.waterCurrent;
            document.getElementById('greeting-name').innerText = `Привіт, ${data.userData.nickname}!`;
            document.getElementById('stat-steps').innerText = userData.stepsToday;
            document.getElementById('stat-distance').innerText = userData.distanceToday;
            document.getElementById('stat-kcal').innerText = userData.burnedKcalToday;

            updateFocusDateUI(); 
            renderCustomTags(); 

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
    userData.goalKcal = dailyKcal;
    userData.goalProtein = protein;
    userData.goalFat = fat;
    userData.goalCarbs = carbs;
    
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
        
        recalculateNutritionForSelectedDate();
        
        regScreen.classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        bottomNav.classList.remove('hidden');
        btnRegister.innerText = originalBtnText;
        btnRegister.disabled = false;
        tg.HapticFeedback.notificationOccurred('success');
    });
});

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
    document.getElementById('input-kcal').value = userData.burnedKcalToday || '';
    activityModal.classList.remove('hidden');
    tg.HapticFeedback.impactOccurred('light');
});

btnCloseActivity.addEventListener('click', () => activityModal.classList.add('hidden'));

btnSaveActivity.addEventListener('click', () => {
    const steps = parseInt(document.getElementById('input-steps').value) || 0;
    const distance = parseFloat(document.getElementById('input-distance').value) || 0;
    const calories = parseInt(document.getElementById('input-kcal').value) || 0;

    userData.stepsToday = steps; userData.distanceToday = distance; userData.burnedKcalToday = calories;
    document.getElementById('stat-steps').innerText = steps; document.getElementById('stat-distance').innerText = distance; document.getElementById('stat-kcal').innerText = calories;

    activityModal.classList.add('hidden');
    tg.HapticFeedback.notificationOccurred('success');
    sendToServer({ action: "log_activity", userId: currentUserId, steps: steps, distance: distance, calories: calories }).catch(e=>console.error(e));
});

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

    let phaseName = "", phaseDesc = "";
    if (currentDayOfCycle >= 1 && currentDayOfCycle <= periodDuration) {
        phaseName = "Менструальна фаза 🩸"; phaseDesc = "Час очищення та відпочинку. Обирай легкі прогулянки.";
    } else if (currentDayOfCycle > periodDuration && currentDayOfCycle <= 13) {
        phaseName = "Фолікулярна фаза 🌱"; phaseDesc = "Енергія росте! Чудовий час для активних тренувань.";
    } else if (currentDayOfCycle >= 14 && currentDayOfCycle <= 16) {
        phaseName = "Овуляція 🌸"; phaseDesc = "Пік твоєї енергії та привабливості.";
    } else {
        phaseName = "Лютеїнова фаза 🍂"; phaseDesc = "Енергія йде на спад. Додай догляду за собою.";
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
    
    setTimeout(() => { 
        if (todayElement && strip) { 
            const scrollPos = todayElement.offsetLeft - (strip.offsetWidth / 2) + (todayElement.offsetWidth / 2);
            strip.scrollTo({ left: scrollPos, behavior: 'auto' });
        } 
    }, 100);
}

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

let currentSymptomDate = new Date(); 
const symptomsModal = document.getElementById('symptoms-modal');
const dayInfoModal = document.getElementById('day-info-modal');

function openSymptomsModal(dateObj) {
    currentSymptomDate = dateObj; 
    const dateStr = dateObj.toDateString();
    
    let displayDate = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    document.getElementById('symptoms-modal-title').innerText = dateObj.toDateString() === new Date().toDateString() ? "Як ти сьогодні?" : displayDate;

    selectedSymptoms = [];
    document.querySelectorAll('.symptom-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('symptom-note').value = "";

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

document.getElementById('btn-open-symptoms-today').addEventListener('click', () => openSymptomsModal(new Date()));
document.getElementById('btn-close-symptoms').addEventListener('click', () => symptomsModal.classList.add('hidden'));

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

document.querySelectorAll('.symptom-chip:not(.custom)').forEach(chip => {
    chip.addEventListener('click', () => toggleSymptom(chip, chip.getAttribute('data-sym')));
});

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

document.getElementById('btn-save-symptoms').addEventListener('click', () => {
    const note = document.getElementById('symptom-note').value;
    const btn = document.getElementById('btn-save-symptoms');
    btn.innerText = "Зберігаємо...";
    
    const dateStr = currentSymptomDate.toDateString();
    if (!userData.history[dateStr]) userData.history[dateStr] = {};
    userData.history[dateStr].symptoms = selectedSymptoms.join(',');
    userData.history[dateStr].note = note;

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

let calendarMode = 'view';
const fullCalModal = document.getElementById('full-calendar-modal');
const btnOpenInteractiveCal = document.getElementById('btn-open-interactive-cal');
const btnOpenFullCal = document.getElementById('btn-open-full-cal');
let viewedDateObj = new Date(); 

if(btnOpenInteractiveCal) {
    btnOpenInteractiveCal.addEventListener('click', () => {
        calendarMode = 'edit'; document.getElementById('full-cal-month').innerText = "Відміть дні місячних";
        document.getElementById('btn-save-calendar-dates').classList.remove('hidden'); renderFullCalendar();
        fullCalModal.classList.remove('hidden'); tg.HapticFeedback.impactOccurred('light');
    });
}
if(btnOpenFullCal) {
    btnOpenFullCal.addEventListener('click', () => {
        calendarMode = 'view'; document.getElementById('full-cal-month').innerText = "Історія циклу";
        document.getElementById('btn-save-calendar-dates').classList.add('hidden'); renderFullCalendar();
        fullCalModal.classList.remove('hidden'); tg.HapticFeedback.impactOccurred('light');
    });
}

document.getElementById('btn-close-full-cal').addEventListener('click', () => fullCalModal.classList.add('hidden'));

function renderFullCalendar() {
    const grid = document.getElementById('full-calendar-grid'); grid.innerHTML = "";
    const today = new Date(); const year = today.getFullYear(); const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDay = firstDay === 0 ? 6 : firstDay - 1; 

    for (let i = 0; i < startDay; i++) {
        let emptyDiv = document.createElement('div'); emptyDiv.className = 'cal-grid-day empty'; grid.appendChild(emptyDiv);
    }

    let start = userData.cycleStart ? new Date(userData.cycleStart) : today;
    start.setHours(0,0,0,0);
    let cDur = userData.cycleDuration || 28; let pDur = userData.periodDuration || 5;

    for (let i = 1; i <= daysInMonth; i++) {
        let dayDiv = document.createElement('div'); dayDiv.className = 'cal-grid-day'; dayDiv.innerText = i;
        
        let currentDate = new Date(year, month, i);
        let localDateStr = new Date(currentDate.getTime() - (currentDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        dayDiv.setAttribute('data-date', localDateStr);

        let diffTime = currentDate.getTime() - start.getTime();
        let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        let cDay = (diffDays % cDur) + 1;
        if (cDay <= 0) cDay += cDur;

        if (i === today.getDate()) dayDiv.classList.add('today');

        if (userData.cycleStart) {
            if (cDay >= 1 && cDay <= pDur) {
                if(calendarMode === 'edit') dayDiv.classList.add('user-selected');
                else dayDiv.classList.add('period');
            } else if (cDay >= 13 && cDay <= 15) {
                dayDiv.classList.add('ovulation');
            }
        }

        dayDiv.addEventListener('click', () => {
            if (calendarMode === 'edit') {
                dayDiv.classList.toggle('user-selected'); tg.HapticFeedback.selectionChanged();
            } else {
                openDayInfo(currentDate, cDay, pDur);
            }
        });
        grid.appendChild(dayDiv);
    }
}

function openDayInfo(dateObj, cycleDay, pDur) {
    viewedDateObj = dateObj; 
    const dateStr = dateObj.toDateString();
    const dayData = userData.history[dateStr] || { symptoms: "", note: "" };

    document.getElementById('day-info-title').innerText = dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    let phaseText = `День циклу ${cycleDay}`;
    if (cycleDay >= 1 && cycleDay <= pDur) phaseText += " (🩸 Місячні)";
    else if (cycleDay >= 13 && cycleDay <= 15) phaseText += " (🌸 Овуляція)";
    document.getElementById('day-info-phase').innerText = phaseText;

    const symContainer = document.getElementById('day-info-symptoms'); symContainer.innerHTML = "";
    if (dayData.symptoms) {
        dayData.symptoms.split(',').forEach(sym => {
            let originalChip = document.querySelector(`.symptom-chip[data-sym="${sym}"]`);
            let symName = originalChip ? originalChip.innerText : sym;
            let chip = document.createElement('div'); chip.className = 'symptom-chip active'; chip.style.pointerEvents = 'none'; chip.innerText = symName;
            symContainer.appendChild(chip);
        });
    } else {
        symContainer.innerHTML = '<span style="font-size: 13px; color: var(--text-muted);">Нічого не відмічено</span>';
    }

    document.getElementById('day-info-note').innerText = dayData.note || "Немає записів";
    document.getElementById('day-info-modal').classList.remove('hidden'); tg.HapticFeedback.impactOccurred('light');
}

document.getElementById('btn-close-day-info').addEventListener('click', () => document.getElementById('day-info-modal').classList.add('hidden'));
document.getElementById('btn-edit-past-symptoms').addEventListener('click', () => {
    document.getElementById('day-info-modal').classList.add('hidden'); openSymptomsModal(viewedDateObj); 
});

document.getElementById('btn-save-calendar-dates').addEventListener('click', () => {
    const selectedElements = document.querySelectorAll('.cal-grid-day.user-selected');
    if (selectedElements.length === 0) return tg.showAlert("Відміть хоча б один день!");

    const btn = document.getElementById('btn-save-calendar-dates'); btn.innerText = "Оновлення..."; tg.HapticFeedback.impactOccurred('medium');

    let earliestDateStr = null; let earliestDateObj = null;
    selectedElements.forEach(el => {
        const dateStr = el.getAttribute('data-date'); const dateObj = new Date(dateStr);
        if (!earliestDateObj || dateObj < earliestDateObj) { earliestDateObj = dateObj; earliestDateStr = dateStr; }
    });

    let newPeriodDuration = selectedElements.length;
    let currentCycleDuration = userData.cycleDuration || 28; 

    sendToServer({
        action: "update_cycle", userId: currentUserId, cycleStart: earliestDateStr, 
        cycleDuration: currentCycleDuration, periodDuration: newPeriodDuration
    }).then(() => {
        btn.innerText = "Зберегти дати"; fullCalModal.classList.add('hidden'); 
        userData.cycleStart = earliestDateStr; userData.periodDuration = newPeriodDuration;
        renderRhythmDashboard(earliestDateStr, currentCycleDuration, newPeriodDuration); tg.HapticFeedback.notificationOccurred('success');
    });
});

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        allScreens.forEach(screen => screen.classList.add('hidden'));
        
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
        tg.HapticFeedback.selectionChanged();

        if (targetId === 'calendar-screen') {
            setTimeout(() => {
                const strip = document.getElementById('calendar-strip');
                const todayEl = document.querySelector('.calendar-day.today');
                if (strip && todayEl) {
                    const scrollPos = todayEl.offsetLeft - (strip.offsetWidth / 2) + (todayEl.offsetWidth / 2);
                    strip.scrollTo({ left: scrollPos, behavior: 'auto' });
                }
            }, 50); 
        }
    });
});

let focusCurrentDate = new Date(); 
let selectedMealTag = "Сніданок"; 
let currentScanMode = 'food';

const focusDatePicker = document.getElementById('focus-date-picker');
const scanHint = document.getElementById('scan-hint');

if (focusDatePicker) {
    focusDatePicker.valueAsDate = new Date();
}

function updateFocusDateUI() {
    const todayStr = new Date().toDateString();
    const focusStr = focusCurrentDate.toDateString();
    
    if (todayStr === focusStr) {
        document.getElementById('focus-date-text').innerText = "📅 Сьогодні ▾";
    } else {
        const options = { day: 'numeric', month: 'long' };
        document.getElementById('focus-date-text').innerText = `📅 ${focusCurrentDate.toLocaleDateString('uk-UA', options)} ▾`;
    }
    renderFoodHistory();
    recalculateNutritionForSelectedDate(); 
}

if (focusDatePicker) {
    focusDatePicker.addEventListener('change', (e) => {
        if (e.target.value) {
            focusCurrentDate = new Date(e.target.value);
            updateFocusDateUI(); 
            tg.HapticFeedback.selectionChanged();
        }
    });
}

document.querySelectorAll('#meal-tags-container .symptom-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
        document.querySelectorAll('#meal-tags-container .symptom-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedMealTag = chip.getAttribute('data-meal');
        tg.HapticFeedback.selectionChanged();
    });
});

document.querySelectorAll('#scan-modes-container .symptom-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('#scan-modes-container .symptom-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        currentScanMode = chip.getAttribute('data-mode');
        tg.HapticFeedback.selectionChanged();

        if (currentScanMode === 'food') {
            scanHint.innerText = "ШІ проаналізує страву та розрахує порцію.";
        } else if (currentScanMode === 'label') {
            scanHint.innerText = "Сфотографуй таблицю КБЖВ на етикетці (ШІ знайде дані на 100г).";
        } else if (currentScanMode === 'barcode') {
            scanHint.innerText = "Сфотографуй штрихкод або упаковку продукту.";
        }
    });
});

function renderFoodHistory() {
    const list = document.getElementById('food-history-list');
    list.innerHTML = ''; 
    const dateStr = focusCurrentDate.toDateString();
    const logs = userData.foodHistory[dateStr] || [];

    if (logs.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 20px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1);">
                <span style="font-size: 24px; display: block; margin-bottom: 5px;">🍽</span>
                <p style="color: var(--text-muted); font-size: 13px; margin: 0;">Поки що нічого не додано.<br>Відскануй свою першу страву!</p>
            </div>
        `;
        return;
    }

    logs.forEach(food => {
        let div = document.createElement('div');
        div.className = 'card';
        div.style.padding = '15px'; div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center'; div.style.cursor = 'pointer'; div.style.border = '1px solid rgba(255,255,255,0.05)';

        div.innerHTML = `
            <div>
                <h4 style="margin: 0 0 4px 0; font-size: 16px;">${food.name}</h4>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-size: 10px; background: rgba(59,130,246,0.2); color: #3B82F6; padding: 2px 6px; border-radius: 6px;">${food.meal}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${food.weight} г • ${food.protein}Б / ${food.fat}Ж / ${food.carbs}В</span>
                </div>
            </div>
            <div style="text-align: right;">
                <span class="highlight-number" style="font-size: 20px;">${food.kcal}</span>
                <span style="font-size: 10px; color: var(--text-muted); display: block;">ккал</span>
            </div>
        `;
        div.addEventListener('click', () => openEditFoodModal(food.id));
        list.appendChild(div);
    });
}

function syncFoodWithServer() {
    const dateStr = focusCurrentDate.toDateString();
    const logs = userData.foodHistory[dateStr] || [];
    let dailySum = logs.reduce((sum, f) => sum + f.kcal, 0);

    sendToServer({ 
        action: "log_food", 
        userId: currentUserId, 
        dateStr: focusCurrentDate.toISOString(), 
        consumedKcal: dailySum,
        foodLog: JSON.stringify(logs)
    }).catch(e => console.error(e));
}

const cameraInput = document.getElementById('camera-input');
const uploadArea = document.getElementById('scanner-upload-area');
const loadingArea = document.getElementById('scanner-loading-area');
const resultArea = document.getElementById('scanner-result-area');
const foodPreview = document.getElementById('food-preview');
const btnRetakePhoto = document.getElementById('btn-retake-photo');
const btnAddFood = document.getElementById('btn-add-food');
const weightInput = document.getElementById('food-weight-input');

let baseWeight = 150; let baseKcal = 0; let baseProtein = 0; let baseFat = 0; let baseCarbs = 0;
let baseIngredients = []; 

function compressImageAndSend(file) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
        foodPreview.src = event.target.result; 
        
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; 
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            const b64Data = compressedBase64.split(',')[1]; 
            
            baseIngredients = [];
            
            sendToServer({ 
                action: "analyze_food", 
                imageB64: b64Data,
                scanMode: currentScanMode
            })
            .then(res => {
                if (res.status === 'success') {
                    baseWeight = res.data.weight || 150;
                    baseKcal = res.data.kcal || 0;
                    baseProtein = res.data.protein || 0;
                    baseFat = res.data.fat || 0;
                    baseCarbs = res.data.carbs || 0;
                    
                    baseIngredients = res.data.ingredients || [];
                    
                    document.getElementById('food-name').innerText = res.data.name || "Невідома страва";
                    weightInput.value = baseWeight;
                    
                    updateFoodUI();
                    
                    loadingArea.classList.add('hidden');
                    resultArea.classList.remove('hidden');
                    tg.HapticFeedback.notificationOccurred('success');
                } else {
                    alert("Помилка розпізнавання: " + res.message);
                    loadingArea.classList.add('hidden');
                    uploadArea.classList.remove('hidden');
                    cameraInput.value = '';
                }
            }).catch(err => {
                alert("Помилка з'єднання з сервером.");
                loadingArea.classList.add('hidden');
                uploadArea.classList.remove('hidden');
                cameraInput.value = '';
            });
        };
    };
}

if (cameraInput) {
    cameraInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (!file) return;

        uploadArea.classList.add('hidden'); 
        loadingArea.classList.remove('hidden'); 
        tg.HapticFeedback.impactOccurred('medium');
        
        compressImageAndSend(file);
    });
}

function updateFoodUI() {
    let currentWeight = parseInt(weightInput.value) || 0;
    let safeBaseWeight = baseWeight > 0 ? baseWeight : 1; 
    const calc = (baseVal) => Math.round((baseVal / safeBaseWeight) * currentWeight);
    
    document.getElementById('food-kcal').innerText = calc(baseKcal);
    document.getElementById('food-protein').innerText = calc(baseProtein);
    document.getElementById('food-fat').innerText = calc(baseFat);
    document.getElementById('food-carbs').innerText = calc(baseCarbs);
    
    const ingSection = document.getElementById('ingredients-section');
    const ingList = document.getElementById('food-ingredients-list');
    
    ingSection.classList.remove('hidden'); 
    ingList.innerHTML = '';
    
    if (baseIngredients && baseIngredients.length > 0) {
        baseIngredients.forEach((ing, index) => {
            // Відображаємо вагу інгредієнта, або текстову порцію
            let displayPortion = ing.weight ? ing.weight + ' г' : ing.portion;
            let scaledIngKcal = Math.round((ing.kcal / safeBaseWeight) * currentWeight) || ing.kcal;
            
            let div = document.createElement('div');
            div.style.background = 'rgba(255,255,255,0.03)';
            div.style.border = '1px solid rgba(255,255,255,0.05)';
            div.style.borderRadius = '16px';
            div.style.padding = '12px 16px';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.cursor = 'pointer';
            
            div.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 15px; font-weight: 600; color: white;">${ing.name}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${displayPortion}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: #3B82F6; font-weight: 600; font-size: 15px;">🔥 ${scaledIngKcal} <span style="font-size:10px; font-weight:normal; color:var(--text-muted);">ккал</span></span>
                    <span style="font-size: 14px; color: var(--text-muted); opacity: 0.7;">✏️</span>
                </div>
            `;
            div.addEventListener('click', () => openEditIngredientModal(index, 'scanner'));
            ingList.appendChild(div);
        });
    } else {
        ingList.innerHTML = '<p style="font-size:12px; color:var(--text-muted); margin: 0;">Немає деталей інгредієнтів</p>';
    }
}

if (weightInput) weightInput.addEventListener('input', updateFoodUI);

if (btnRetakePhoto) {
    btnRetakePhoto.addEventListener('click', () => {
        resultArea.classList.add('hidden'); uploadArea.classList.remove('hidden'); cameraInput.value = ''; 
        tg.HapticFeedback.selectionChanged();
    });
}

if (btnAddFood) {
    btnAddFood.addEventListener('click', () => {
        const dateStr = focusCurrentDate.toDateString();
        if(!userData.foodHistory[dateStr]) userData.foodHistory[dateStr] = [];

        let currentWeight = parseInt(weightInput.value) || 0;
        let safeBaseWeight = baseWeight > 0 ? baseWeight : 1; 

        let scaledIngredients = baseIngredients.map(ing => {
            return {
                name: ing.name,
                portion: ing.weight ? ing.weight + ' г' : ing.portion,
                weight: ing.weight || 0,
                protein: ing.protein || 0,
                fat: ing.fat || 0,
                carbs: ing.carbs || 0,
                kcal: Math.round((ing.kcal / safeBaseWeight) * currentWeight) || ing.kcal
            };
        });

        const newFood = {
            id: Date.now(), 
            name: document.getElementById('food-name').innerText,
            weight: currentWeight,
            kcal: parseInt(document.getElementById('food-kcal').innerText) || 0,
            protein: parseInt(document.getElementById('food-protein').innerText) || 0,
            fat: parseInt(document.getElementById('food-fat').innerText) || 0,
            carbs: parseInt(document.getElementById('food-carbs').innerText) || 0,
            meal: selectedMealTag,
            ingredients: scaledIngredients 
        };
        
        userData.foodHistory[dateStr].push(newFood);
        
        recalculateNutritionForSelectedDate(); 
        renderFoodHistory(); 
        syncFoodWithServer(); 
        
        resultArea.classList.add('hidden'); uploadArea.classList.remove('hidden'); cameraInput.value = '';
        document.getElementById('food-history-container').scrollIntoView({behavior: "smooth"});
        tg.HapticFeedback.notificationOccurred('success');
    });
}

// --- ЛОГІКА РЕДАГУВАННЯ ЗАГАЛЬНОЇ СТРАВИ (З ЖУРНАЛУ) ---
let editingFoodId = null;
let tempEditFood = null; 
const editFoodModal = document.getElementById('edit-food-modal');
const editNameInput = document.getElementById('edit-food-name'); 
const editWeightInput = document.getElementById('edit-food-weight');
const editKcalInput = document.getElementById('edit-food-kcal');
const editProteinInput = document.getElementById('edit-food-protein');
const editFatInput = document.getElementById('edit-food-fat');
const editCarbsInput = document.getElementById('edit-food-carbs');

function renderJournalIngredients() {
    const list = document.getElementById('edit-journal-ingredients-list');
    list.innerHTML = '';
    if (!tempEditFood.ingredients || tempEditFood.ingredients.length === 0) {
        list.innerHTML = '<p style="font-size:12px; color:var(--text-muted); margin: 0;">Немає деталей інгредієнтів</p>';
        return;
    }
    tempEditFood.ingredients.forEach((ing, index) => {
        let displayPortion = ing.weight ? ing.weight + ' г' : ing.portion;
        let div = document.createElement('div');
        div.style.background = 'rgba(255,255,255,0.03)';
        div.style.border = '1px solid rgba(255,255,255,0.05)';
        div.style.borderRadius = '12px';
        div.style.padding = '10px 14px';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.cursor = 'pointer';
        
        div.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 14px; font-weight: 600; color: white;">${ing.name}</span>
                <span style="font-size: 11px; color: var(--text-muted);">${displayPortion}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #3B82F6; font-weight: 600; font-size: 14px;">🔥 ${ing.kcal} <span style="font-size:10px; font-weight:normal; color:var(--text-muted);">ккал</span></span>
                <span style="font-size: 12px; color: var(--text-muted); opacity: 0.7;">✏️</span>
            </div>
        `;
        div.addEventListener('click', () => openEditIngredientModal(index, 'journal'));
        list.appendChild(div);
    });
}

function openEditFoodModal(id) {
    const dateStr = focusCurrentDate.toDateString();
    const food = userData.foodHistory[dateStr].find(f => f.id === id);
    if (!food) return;

    editingFoodId = id;
    tempEditFood = JSON.parse(JSON.stringify(food)); 
    if(!tempEditFood.ingredients) tempEditFood.ingredients = [];
    
    editNameInput.value = tempEditFood.name; 
    editWeightInput.value = tempEditFood.weight;
    
    editKcalInput.value = tempEditFood.kcal;
    editProteinInput.value = tempEditFood.protein;
    editFatInput.value = tempEditFood.fat;
    editCarbsInput.value = tempEditFood.carbs;

    renderJournalIngredients();

    editFoodModal.classList.remove('hidden');
    tg.HapticFeedback.impactOccurred('light');
}

editWeightInput.addEventListener('input', () => {
    let newWeight = parseInt(editWeightInput.value) || 0;
    let origWeight = tempEditFood.weight || 1;
    let ratio = newWeight / origWeight;
    
    editKcalInput.value = Math.round(tempEditFood.kcal * ratio);
    editProteinInput.value = Math.round(tempEditFood.protein * ratio);
    editFatInput.value = Math.round(tempEditFood.fat * ratio);
    editCarbsInput.value = Math.round(tempEditFood.carbs * ratio);
});

document.getElementById('btn-close-edit-food').addEventListener('click', () => editFoodModal.classList.add('hidden'));

document.getElementById('btn-delete-food').addEventListener('click', () => {
    const dateStr = focusCurrentDate.toDateString();
    userData.foodHistory[dateStr] = userData.foodHistory[dateStr].filter(f => f.id !== editingFoodId);
    
    recalculateNutritionForSelectedDate(); renderFoodHistory(); syncFoodWithServer(); 
    editFoodModal.classList.add('hidden'); tg.HapticFeedback.notificationOccurred('success');
});

document.getElementById('btn-save-edit-food').addEventListener('click', () => {
    const dateStr = focusCurrentDate.toDateString();
    const foodIndex = userData.foodHistory[dateStr].findIndex(f => f.id === editingFoodId);
    if (foodIndex !== -1) {
        let food = userData.foodHistory[dateStr][foodIndex];
        
        const finalWeight = parseInt(editWeightInput.value) || 0;
        const weightRatio = finalWeight / (tempEditFood.weight || 1);

        food.name = editNameInput.value.trim() || "Невідома страва";
        food.weight = finalWeight; 
        
        food.kcal = parseInt(editKcalInput.value) || 0; 
        food.protein = parseInt(editProteinInput.value) || 0;
        food.fat = parseInt(editFatInput.value) || 0; 
        food.carbs = parseInt(editCarbsInput.value) || 0;
        
        food.ingredients = tempEditFood.ingredients.map(ing => ({
            ...ing,
            kcal: Math.round((ing.kcal || 0) * weightRatio),
            weight: Math.round((ing.weight || 0) * weightRatio)
        }));
    }
    recalculateNutritionForSelectedDate(); renderFoodHistory(); syncFoodWithServer(); 
    editFoodModal.classList.add('hidden'); tg.HapticFeedback.notificationOccurred('success');
});

// --- ЛОГІКА РЕДАГУВАННЯ ОДНОГО ІНГРЕДІЄНТА ---
let currentIngContext = 'scanner'; 
let editingIngIndex = null;
const editIngModal = document.getElementById('edit-ingredient-modal');

// Зберігаємо початкові значення, щоб рахувати пропорцію
let origIngBase = { weight: 100, kcal: 0, protein: 0, fat: 0, carbs: 0 };

function openEditIngredientModal(index, context = 'scanner') {
    currentIngContext = context;
    editingIngIndex = index;
    
    document.getElementById('btn-delete-ingredient').classList.remove('hidden');
    document.getElementById('edit-ingredient-title').innerText = "Редагувати інгредієнт";

    let currentList = currentIngContext === 'scanner' ? baseIngredients : tempEditFood.ingredients;

    if (index === -1) {
        document.getElementById('edit-ing-name').value = "";
        document.getElementById('edit-ing-weight').value = "100";
        document.getElementById('edit-ing-kcal').value = "";
        document.getElementById('edit-ing-protein').value = "";
        document.getElementById('edit-ing-fat').value = "";
        document.getElementById('edit-ing-carbs').value = "";
        document.getElementById('btn-delete-ingredient').classList.add('hidden');
        document.getElementById('edit-ingredient-title').innerText = "Додати інгредієнт";
        
        origIngBase = { weight: 100, kcal: 0, protein: 0, fat: 0, carbs: 0 };
    } else {
        let ing = currentList[index];
        document.getElementById('edit-ing-name').value = ing.name;
        
        // Витягуємо вагу з числа або зі старого текстового 'portion'
        let w = parseFloat(ing.weight) || parseFloat(ing.portion) || 100;
        let k = ing.kcal || 0;
        let p = ing.protein || 0;
        let f = ing.fat || 0;
        let c = ing.carbs || 0;

        document.getElementById('edit-ing-weight').value = w;
        document.getElementById('edit-ing-kcal').value = k;
        document.getElementById('edit-ing-protein').value = p;
        document.getElementById('edit-ing-fat').value = f;
        document.getElementById('edit-ing-carbs').value = c;

        origIngBase = { weight: w, kcal: k, protein: p, fat: f, carbs: c };
    }

    editIngModal.classList.remove('hidden');
    tg.HapticFeedback.impactOccurred('light');
}

// Автоматичний перерахунок при зміні ваги інгредієнта
document.getElementById('edit-ing-weight').addEventListener('input', (e) => {
    if (editingIngIndex === -1) return; // Для нових інгредієнтів не перераховуємо автоматично
    
    let newWeight = parseFloat(e.target.value) || 0;
    let safeOrigWeight = origIngBase.weight > 0 ? origIngBase.weight : 1;
    let ratio = newWeight / safeOrigWeight;

    document.getElementById('edit-ing-kcal').value = Math.round(origIngBase.kcal * ratio);
    document.getElementById('edit-ing-protein').value = Math.round(origIngBase.protein * ratio);
    document.getElementById('edit-ing-fat').value = Math.round(origIngBase.fat * ratio);
    document.getElementById('edit-ing-carbs').value = Math.round(origIngBase.carbs * ratio);
});

document.getElementById('btn-add-new-ingredient').addEventListener('click', () => openEditIngredientModal(-1, 'scanner'));
document.getElementById('btn-add-journal-ingredient').addEventListener('click', () => openEditIngredientModal(-1, 'journal'));

document.getElementById('btn-close-edit-ingredient').addEventListener('click', () => {
    editIngModal.classList.add('hidden');
});

document.getElementById('btn-save-edit-ingredient').addEventListener('click', () => {
    let newName = document.getElementById('edit-ing-name').value.trim() || "Інгредієнт";
    let newWeight = parseFloat(document.getElementById('edit-ing-weight').value) || 0;
    let newKcal = parseInt(document.getElementById('edit-ing-kcal').value) || 0;
    let newProtein = parseInt(document.getElementById('edit-ing-protein').value) || 0;
    let newFat = parseInt(document.getElementById('edit-ing-fat').value) || 0;
    let newCarbs = parseInt(document.getElementById('edit-ing-carbs').value) || 0;

    if (currentIngContext === 'scanner') {
        if (editingIngIndex === -1) {
            baseIngredients.push({ name: newName, weight: newWeight, portion: newWeight + " г", kcal: newKcal, protein: newProtein, fat: newFat, carbs: newCarbs });
            baseKcal += newKcal; 
            baseProtein += newProtein;
            baseFat += newFat;
            baseCarbs += newCarbs;
        } else {
            let ing = baseIngredients[editingIngIndex];
            baseKcal += (newKcal - (ing.kcal || 0)); 
            baseProtein += (newProtein - (ing.protein || 0));
            baseFat += (newFat - (ing.fat || 0));
            baseCarbs += (newCarbs - (ing.carbs || 0));
            
            ing.name = newName;
            ing.weight = newWeight;
            ing.portion = newWeight + " г";
            ing.kcal = newKcal;
            ing.protein = newProtein;
            ing.fat = newFat;
            ing.carbs = newCarbs;
        }
        updateFoodUI();

    } else if (currentIngContext === 'journal') {
        if (editingIngIndex === -1) {
            tempEditFood.ingredients.push({ name: newName, weight: newWeight, portion: newWeight + " г", kcal: newKcal, protein: newProtein, fat: newFat, carbs: newCarbs });
            tempEditFood.kcal += newKcal;
            tempEditFood.protein += newProtein;
            tempEditFood.fat += newFat;
            tempEditFood.carbs += newCarbs;
        } else {
            let ing = tempEditFood.ingredients[editingIngIndex];
            tempEditFood.kcal += (newKcal - (ing.kcal || 0));
            tempEditFood.protein += (newProtein - (ing.protein || 0));
            tempEditFood.fat += (newFat - (ing.fat || 0));
            tempEditFood.carbs += (newCarbs - (ing.carbs || 0));
            
            ing.name = newName;
            ing.weight = newWeight;
            ing.portion = newWeight + " г";
            ing.kcal = newKcal;
            ing.protein = newProtein;
            ing.fat = newFat;
            ing.carbs = newCarbs;
        }
        
        // Оновлюємо інпути в модалці самої страви
        editKcalInput.value = tempEditFood.kcal;
        editProteinInput.value = tempEditFood.protein;
        editFatInput.value = tempEditFood.fat;
        editCarbsInput.value = tempEditFood.carbs;
        
        renderJournalIngredients();
    }

    editIngModal.classList.add('hidden');
    tg.HapticFeedback.notificationOccurred('success');
});

document.getElementById('btn-delete-ingredient').addEventListener('click', () => {
    if (editingIngIndex !== -1 && editingIngIndex !== null) {
        if (currentIngContext === 'scanner') {
            let ing = baseIngredients[editingIngIndex];
            baseKcal = Math.max(0, baseKcal - (ing.kcal || 0));
            baseProtein = Math.max(0, baseProtein - (ing.protein || 0));
            baseFat = Math.max(0, baseFat - (ing.fat || 0));
            baseCarbs = Math.max(0, baseCarbs - (ing.carbs || 0));
            baseIngredients.splice(editingIngIndex, 1);
            updateFoodUI();
        } else if (currentIngContext === 'journal') {
            let ing = tempEditFood.ingredients[editingIngIndex];
            tempEditFood.kcal = Math.max(0, tempEditFood.kcal - (ing.kcal || 0));
            tempEditFood.protein = Math.max(0, tempEditFood.protein - (ing.protein || 0));
            tempEditFood.fat = Math.max(0, tempEditFood.fat - (ing.fat || 0));
            tempEditFood.carbs = Math.max(0, tempEditFood.carbs - (ing.carbs || 0));
            
            editKcalInput.value = tempEditFood.kcal;
            editProteinInput.value = tempEditFood.protein;
            editFatInput.value = tempEditFood.fat;
            editCarbsInput.value = tempEditFood.carbs;
            
            tempEditFood.ingredients.splice(editingIngIndex, 1);
            renderJournalIngredients();
        }
    }
    editIngModal.classList.add('hidden');
    tg.HapticFeedback.notificationOccurred('success');
});