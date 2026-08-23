# Деплой игры на GitHub → https://tap777play.github.io/kristalltaptoplay/
# Запуск из корня проекта:  npm run deploy
# или:  node scripts/deploy.mjs

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$RemoteUrl = "https://github.com/tap777play/kristalltaptoplay.git"
$PagesUrl = "https://tap777play.github.io/kristalltaptoplay/"

function Require-Git {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git не установлен. Скачай: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
  }
}

Require-Git

if (-not (Test-Path ".git")) {
  Write-Host "Инициализация git..."
  git init -b main
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  Write-Host "Добавляю remote origin -> $RemoteUrl"
  git remote add origin $RemoteUrl
} elseif ($remote -ne $RemoteUrl) {
  Write-Host "Remote origin: $remote"
  Write-Host "Ожидался: $RemoteUrl"
  $ans = Read-Host "Заменить origin? (y/N)"
  if ($ans -eq "y" -or $ans -eq "Y") {
    git remote set-url origin $RemoteUrl
  }
}

git add -A
$status = git status --porcelain
if ($status) {
  $msg = if ($args.Count -gt 0) { $args -join " " } else { "Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
  git commit -m $msg
  Write-Host "Коммит: $msg" -ForegroundColor Green
} else {
  Write-Host "Нет изменений для коммита." -ForegroundColor Yellow
}

Write-Host "Отправка на GitHub..."
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Push не удался. Проверь:" -ForegroundColor Red
  Write-Host "  1. Репозиторий создан: https://github.com/tap777play/kristalltaptoplay"
  Write-Host "  2. Ты залогинен в Git (GitHub Desktop или: gh auth login)"
  Write-Host "  3. Есть права на запись в репозиторий"
  exit 1
}

Write-Host ""
Write-Host "Готово! Через 1–3 минуты игра будет здесь:" -ForegroundColor Green
Write-Host $PagesUrl
Write-Host ""
Write-Host "Если Pages ещё не включены: GitHub → Settings → Pages → Source: GitHub Actions"
