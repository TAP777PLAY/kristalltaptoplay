/**
 * Деплой на GitHub Pages → https://tap777play.github.io/kristalltaptoplay/
 * Запуск: npm run deploy
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REMOTE = "https://github.com/tap777play/kristalltaptoplay.git";
const PAGES = "https://tap777play.github.io/kristalltaptoplay/";

function runArgs(file, args, opts = {}) {
  const r = spawnSync(file, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.silent ? "pipe" : "inherit",
  });
  if (r.status !== 0) {
    if (opts.silent) throw new Error(String(r.stderr || r.status));
    process.exit(r.status || 1);
  }
  return r.stdout?.trim() || "";
}

function hasGit() {
  return spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function defaultMsg() {
  const d = new Date();
  return `Deploy ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const commitMsg = process.argv.slice(2).join(" ").trim() || defaultMsg();

if (!hasGit()) {
  console.error("Git не установлен. Скачай: https://git-scm.com/download/win");
  process.exit(1);
}

if (!existsSync(join(ROOT, ".git"))) {
  console.log("Инициализация git...");
  runArgs("git", ["init", "-b", "main"]);
}

let remote = "";
try {
  remote = runArgs("git", ["remote", "get-url", "origin"], { silent: true });
} catch {}

if (!remote) {
  console.log("Добавляю remote origin ->", REMOTE);
  runArgs("git", ["remote", "add", "origin", REMOTE]);
} else if (remote !== REMOTE) {
  console.log("Remote origin:", remote);
  console.log("Ожидался:", REMOTE);
  console.log("Меняю origin...");
  runArgs("git", ["remote", "set-url", "origin", REMOTE]);
}

runArgs("git", ["add", "-A"]);
let hasChanges = false;
try {
  hasChanges = runArgs("git", ["status", "--porcelain"], { silent: true }).length > 0;
} catch {}

if (hasChanges) {
  runArgs("git", ["commit", "-m", commitMsg]);
  console.log("Коммит:", commitMsg);
} else {
  console.log("Нет изменений для коммита.");
}

console.log("Отправка на GitHub...");
const push = spawnSync("git", ["push", "-u", "origin", "main"], {
  cwd: ROOT,
  encoding: "utf8",
});
if (push.status !== 0) {
  const err = (push.stderr || push.stdout || "").toLowerCase();
  console.error("");
  if (err.includes("repository not found")) {
    console.error("Репозиторий на GitHub не найден или нет доступа.");
    console.error("");
    console.error("Сделай так:");
    console.error("  1. Открой https://github.com/new");
    console.error("  2. Owner: tap777play (твой аккаунт GitHub)");
    console.error("  3. Repository name: kristalltaptoplay");
    console.error("  4. Public, БЕЗ README / .gitignore — пустой репозиторий");
    console.error("  5. Create repository");
    console.error("  6. Settings → Pages → Build and deployment → GitHub Actions");
    console.error("  7. Снова: npm run deploy");
    console.error("");
    console.error("Если аккаунт другой — напиши, поменяем URL в scripts/deploy.mjs");
  } else {
    console.error("Push не удался. Проверь вход в GitHub (токен вместо пароля).");
  }
  process.exit(1);
}

console.log("");
console.log("Готово! Через 1–3 минуты игра будет здесь:");
console.log(PAGES);
console.log("");
console.log("Pages: GitHub → Settings → Pages → Source: GitHub Actions");
