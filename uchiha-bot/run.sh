#!/bin/bash
# Бір команда: ./run.sh  — орнатады, токенді сұрайды, ботты қосады
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null; then
  echo "Python3 жоқ. https://www.python.org/downloads/ сайтынан орнат."; exit 1
fi

if [ ! -d venv ]; then
  echo "📦 Бірінші рет: орнатып жатырмын..."
  python3 -m venv venv || exit 1
fi
source venv/bin/activate
pip install -q -r requirements.txt || exit 1

# токенді .env файлынан алады, жоқ болса сұрайды
if [ -f .env ]; then
  TOKEN=$(grep -E '^BOT_TOKEN=' .env | head -1 | cut -d= -f2-)
fi
while true; do
  TOKEN=$(printf '%s' "$TOKEN" | tr -d " \t\r\n'\"")
  if [[ "$TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]{30,}$ ]]; then break; fi
  [ -n "$TOKEN" ] && echo "❌ Токен дұрыс емес. BotFather-дегі Copy батырмасымен толық көшір."
  read -rsp "🔑 BotFather токенін қой (көрінбейді) және Enter бас: " TOKEN; echo
done
printf 'BOT_TOKEN=%s\n' "$TOKEN" > .env
export BOT_TOKEN="$TOKEN"
[ -f .env.key ] && export ANTHROPIC_API_KEY="$(cat .env.key)"

echo "🔥 Бот қосылды! Тоқтату үшін Ctrl+C. Терминалды жаппа."
exec python bot.py
