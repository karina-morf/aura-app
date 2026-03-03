const tg = window.Telegram.WebApp;
tg.expand(); 

// Основные элементы
const regScreen = document.getElementById('registration-screen');
const bottomNav = document.getElementById('bottom-nav');
const btnRegister = document.getElementById('btn-register');
const btnWater = document.getElementById('btn-water');

// Элементы навигации
const navItems = document.querySelectorAll('.nav-item');
const allScreens = document.querySelectorAll('.main-content');

let userData = { weight: 0, waterGoal: 0, waterCurrent: 0 };

if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    document.getElementById('greeting-name').innerText = `Привет, ${tg.initDataUnsafe.user.first_name}!`;
}

// 1. Регистрация и вход в приложение
btnRegister.addEventListener('click', () => {
    const weightInput = document.getElementById('weight').value;
    if(!weightInput || weightInput <= 0) {
        tg.showAlert("Укажи вес, чтобы мы рассчитали воду.");
        return;
    }
    userData.weight = parseFloat(weightInput);
    userData.waterGoal = userData.weight * 35;
    document.getElementById('water-goal').innerText = userData.waterGoal;
    
    // Прячем регистрацию, показываем Орбиту и Нижнее меню
    regScreen.classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
    bottomNav.classList.remove('hidden'); // Показываем меню!
});

// 2. Логика трекера воды
btnWater.addEventListener('click', () => {
    userData.waterCurrent += 250;
    document.getElementById('water-current').innerText = userData.waterCurrent;
    tg.HapticFeedback.impactOccurred('light');
    if (userData.waterCurrent === userData.waterGoal) {
        tg.HapticFeedback.notificationOccurred('success');
    }
});

// 3. Логика переключения нижнего меню
navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Убираем подсветку со всех кнопок
        navItems.forEach(nav => nav.classList.remove('active'));
        // Добавляем подсветку нажатой кнопке
        item.classList.add('active');

        // Прячем все экраны
        allScreens.forEach(screen => screen.classList.add('hidden'));

        // Смотрим, какой экран нужно открыть (data-target), и показываем его
        const targetScreenId = item.getAttribute('data-target');
        document.getElementById(targetScreenId).classList.remove('hidden');
        
        // Легкая вибрация при переключении вкладок
        tg.HapticFeedback.selectionChanged();
    });
});