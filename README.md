# Пригоди Мії 🌸

Неоновий раннер-аркада, створений спеціально для **Мії з міста Мирнівка**.

## 🎮 Про гру

Класичний раннер у стилі pixel-art з неоновим візуалом:
- 🏃 Біжи, стрибай, збирайте бонуси
- 🌟 Супер-предмети: мега-комети, енерго-вітаміни, серця-янголи, веселкові кристали, бонуси від фей
- 🦅 Ловіть птахів — вони дають очки
- 🐕 Уникайте собак, кущів, грибів, льодяників
- ✨ **Режим "Мрія"** — збирайте зірку-мрію, яка активує режим з повільним рухом та "дощем" предметівutely

## 📱 Оптимізація

- **Мобільні (пріоритет)**: viewport-fit, safe-area-insets, touch-friendly кнопки
- **ПК**: адаптивний масштаб спрайтів, fullscreen підтримка
- **Telegram Mini App**: повна інтеграція з haptic feedback та BackButton

## 🛠️ Технології

- **Phaser 3.60** — ігровий рушій
- **Supabase** — авторизація та лідерборд
- **Vanilla JavaScript** — без фреймворків
- **HTML/CSS** — без білдерів, чистий веб

## 🚀 Запуск локально

```bash
# Відкрийте index.html через локальний сервер (наприклад):
python -m http.server 8000
# або
npx serve .
```

## 📁 Структура

- `index.html` — UI та Telegram інтеграція
- `game.js` — ігрова логіка (Phaser Scene)
- `assets/` — аудіо та PNG ресурси
- `vercel.json` — конфігурація для деплою на Vercel

## 🔐 Налаштування Supabase

1. Створіть проект на [supabase.com](https://supabase.com)
2. Створіть таблиці:
   ```sql
   CREATE TABLE profiles (
     id UUID PRIMARY KEY,
     player_name TEXT NOT NULL
   );

   CREATE TABLE scores (
     id SERIAL PRIMARY KEY,
     user_id UUID REFERENCES profiles(id),
     player_name TEXT,
     score INTEGER,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```
3. Оновіть `SUPABASE_URL` та `SUPABASE_ANON_KEY` в `game.js`

## 📜 Ліцензія

MIT License — використовуйте вільно!