# Кидати помідорами в Тищенка

Легка браузерна пародія на «Хамське Яєчко».

## Запуск

```bash
cd ~/Projects/tyshchenko-tomato-game
python3 -m http.server 8080
```

Відкрий http://localhost:8080

## Ассети (`assets/`)

| Файл | Призначення |
|------|-------------|
| `restaurant.png` | Фон ресторану «Velour» |
| `main-figure.png` | Тищенко (основна фігура) |
| `face-hit-1.png` … `face-hit-5.png` | Реакція на влучання (чергуються) |
| `face-gameover.png` | Обличчя на екрані поразки |
| `office-iqos.png`, `office-stand.png` | Офісники |
| `walker-01.png` … `walker-05.png` | Незнайомець (5 кадрів ходьби на гравця) |
| `throw-pixel-01.png` … `throw-pixel-15.png` | Pixel-art анімація кидка (15 кадрів) |
| `meatball.png` | Мітбол при влучанні |
| `thailand-passport.png` | Паспорт Таїланду (кожне 5-те влучання) |

## Прозорий фон (без «квадратиків»)

Якщо в PNG **немає справжньої прозорості** (режим RGB, а не RGBA), редактор показує сітку — і вона «запікається» в картинку.

**Що потрібно для ідеального результату:** PNG з **alpha-каналом** (прозорий фон), наприклад з Photoshop, Photopea, remove.bg тощо.

**Що вже зроблено в проєкті:** скрипт прибрав сітку з офісників і кадрів кидка:

```bash
.venv/bin/python3 scripts/remove-checkerboard.py
.venv/bin/python3 scripts/extract-throw-spritesheet.py
.venv/bin/python3 scripts/extract-walker-spritesheet.py
```

Не оброблялись (там реальний фон, не сітка): `main-figure.png`, обличчя, `restaurant.png`.

## Керування

- **Десктоп:** приціл мишкою, клік — кинути помідор
- **Мобілка:** торкнись екрана
   