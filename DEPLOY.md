# Деплой «Кристаллы три в ряд»

Игра публикуется на **GitHub Pages**:  
https://tap777play.github.io/kristalltaptoplay/

## Один раз (настройка)

1. Создай пустой репозиторий на GitHub:  
   https://github.com/new → имя **`kristalltaptoplay`** → организация/аккаунт **`tap777play`**

2. В репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions**

3. Авторизация Git на компьютере (один из вариантов):
   - **GitHub Desktop** — войти в аккаунт tap777play
   - или в терминале: `gh auth login`
   - или Personal Access Token при первом `git push`

## Каждый деплой (из папки `gem-brawl`)

```bash
npm run deploy
```

Или двойной клик по `scripts/deploy.bat`.

Скрипт сам: `git add` → `commit` → `push` → GitHub Actions заливает сайт.

С сообщением коммита:

```bash
npm run deploy -- "Обновил уровни и звёзды"
```

## Проверка

- Actions: https://github.com/tap777play/kristalltaptoplay/actions  
- Игра: https://tap777play.github.io/kristalltaptoplay/

## API (Vercel) — отдельно

Тот же репозиторий можно подключить к Vercel для `/api/*` и KV-базы.  
Секреты VK только в Vercel → Environment Variables, не в git.
