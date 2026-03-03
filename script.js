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

// Твоя ссылка на базу данных
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbwsLFa7b3cwAbh1YpVMYo4nLjyfkOuDKAAaLRQoAsQiRoMwdYwjW3QwVDGGFE4FVu_I/exec";

// Получаем ID пользователя из Telegram
const currentUserId = tg.initDataUnsafe?.user?.id || 'test_user_' + Math.floor(Math.random() * 1000);

// СРАЗУ прячем экран регистрации, чтобы он не мелькал, пока идет проверка
regScreen.classList.add('hidden');

// --- НОВАЯ ФУНКЦИЯ: Проверка пользователя в базе ---
function checkUser() {
    fetch(GOOGLE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: "check_user", userId: currentUserId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.exists) {
            // 🌟 Пользователь уже есть в базе!
            userData.weight = parseFloat(data.userData.weight);
            userData.waterGoal = userData.weight * 35;
            document.getElementById('water-goal').innerText = userData.waterGoal;
            document.getElementById('greeting-name').innerText = `Привет, ${data.userData.nickname}!`;

            // Открываем Орбиту и нижнее меню
            document.getElementById('main-screen').classList.remove('hidden');
            bottomNav.classList.remove('hidden');
        } else {
            // 🆕 Новый пользователь — показываем экран регистрации
            regScreen.classList.remove('hidden');
            if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                // Если нет имени в базе, но есть в ТГ, покажем хотя бы его (опционально)
            }
        }
    })
    .catch(error => {
        console.error("Ошибка проверки:", error);
        // Если что-то сломалось, на всякий случай показываем регистрацию
        regScreen.classList.remove('hidden'); 
    });
}

// Запускаем проверку при открытии приложения
checkUser();


// --- 1. Регистрация нового пользователя ---
btnRegister.addEventListener('click', () => {
    // Собираем данные из полей ввода
    const heightInput = document.getElementById('height').value;
    const weightInput = document.getElementById('weight').value;
    const targetWeightInput = document.getElementById('target-weight').value;
    const protocolInput = document.getElementById('diet-protocol').value;
    
    // Проверка, всё ли заполнено
    if(!weightInput || !heightInput || !targetWeightInput) {
        tg.showAlert("Пожалуйста, заполни все поля, чтобы мы могли настроить Ауру.");
        return;
    }

    // Сохраняем локально для расчетов
    userData.weight = parseFloat(weightInput);
    userData.waterGoal = userData.weight * 35;
    document.getElementById('water-goal').innerText = userData.waterGoal;
    
    // Показываем пользователю, что идет загрузка (меняем текст на кнопке)
    const originalBtnText = btnRegister.innerText;
    btnRegister.innerText = "Создаем профиль... ✨";
    btnRegister.disabled = true;

    // Подготавливаем данные для отправки в базу
    const payload = {
        action: "register",
        userId: currentUserId, // Используем константу с ID
        nickname: tg.initDataUnsafe?.user?.first_name || 'Гость',
        height: heightInput,
        weight: weightInput,
        targetWeight: targetWeightInput,
        protocol: protocolInput
    };

    // Отправляем данные в Google Таблицу!
    fetch(GOOGLE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8', // Обновили на правильный формат
        },
        body: JSON.stringify(payload)
    }).then(response => response.json()) // Теперь мы читаем ответ сервера!
      .then((data) => {
        if(data.status === "success") {
            // Успешно: Прячем регистрацию, показываем Орбиту и Нижнее меню
            regScreen.classList.add('hidden');
            document.getElementById('main-screen').classList.remove('hidden');
            bottomNav.classList.remove('hidden');
            
            // Если регистрация прошла успешно, обновим и приветствие
            document.getElementById('greeting-name').innerText = `Привет, ${payload.nickname}!`;
            
            // Возвращаем кнопку в нормальное состояние
            btnRegister.innerText = originalBtnText;
            btnRegister.disabled = false;
            
            tg.HapticFeedback.notificationOccurred('success');
        } else {
            throw new Error("Ошибка записи на сервере");
        }
    }).catch((error) => {
        console.error("Ошибка сохранения:", error);
        tg.showAlert("Ой, что-то пошло не так при сохранении. Попробуй еще раз.");
        btnRegister.innerText = originalBtnText;
        btnRegister.disabled = false;
    });
});


// --- 2. Логика трекера воды ---
btnWater.addEventListener('click', () => {
    userData.waterCurrent += 250;
    document.getElementById('water-current').innerText = userData.waterCurrent;
    tg.HapticFeedback.impactOccurred('light');
    
    if (userData.waterCurrent === userData.waterGoal) {
        tg.HapticFeedback.notificationOccurred('success');
    }
});


// --- 3. Логика переключения нижнего меню ---
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