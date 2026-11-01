import asyncio
import hashlib
import json
import logging
import os
import random
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandObject
from aiogram.types import Message

import content as C

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("uchiha")

BASE = Path(__file__).parent
STATE_FILE = BASE / "state.json"
MEMBERS: dict = json.loads((BASE / "members.json").read_text(encoding="utf-8"))
RANDOM_PERCENT = float(os.getenv("RANDOM_REPLY_PERCENT", "4"))

# Жұма түнгі хабарлама уақыты (Алматы уақыты). Өзгерту: HOUSE_TIME=23:30
HOUSE_HM = tuple(int(x) for x in os.getenv("HOUSE_TIME", "22:00").split(":"))
try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo(os.getenv("TIMEZONE", "Asia/Almaty"))
except Exception:  # noqa: BLE001
    TZ = timezone(timedelta(hours=5))

# --- Claude арқылы жаңа әзіл (міндетті емес) -------------------------------
_llm = None
if os.getenv("ANTHROPIC_API_KEY"):
    import anthropic
    _llm = anthropic.AsyncAnthropic()

SYSTEM = (
    "Сен — Ричи, бір үйде тұратын жігіттердің (монтажерлер мен сатушылар) мысығысың. Олардың "
    "«Клан Учих» Telegram чатында мысық болып жазасың: «мяу», «мрр», *тырнап қарайды*, "
    "тамақ, лоток, диван, жүн туралы айтасың. Тек қазақ тілінде жаз (кейде орыс сленгі қосылады: "
    "«че там», «ублюдок», «далбаң», «черт екенсің»). Қысқа (1-3 сөйлем), күлкілі, достарша тиіс. "
    "Жұмысына, жалқаулығына, кешігуіне, ыдыс жумауына, шаурмаға тиіс. "
    "Ұлтына, дініне, ауруына, отбасына, сыртқы келбетіне тимеу. Түсіндірме жоқ, тек әзіл."
)


async def llm_joke(prompt: str) -> str | None:
    if not _llm:
        return None
    try:
        r = await _llm.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
            max_tokens=200,
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        return r.content[0].text.strip()
    except Exception as e:  # noqa: BLE001
        log.warning("LLM failed: %s", e)
        return None


# --- күй (чаттар, соңғы жіберілген жұма) ------------------------------------
def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {"chats": [], "last_sent": ""}


def save_state(st: dict) -> None:
    STATE_FILE.write_text(json.dumps(st), encoding="utf-8")


# --- көмекші функциялар -----------------------------------------------------
def find_member(text: str) -> str | None:
    t = text.lower().strip()
    for name, info in MEMBERS.items():
        if t == name.lower() or t in info.get("aliases", []):
            return name
    return None


def display(msg: Message) -> str:
    u = msg.from_user
    return find_member(u.first_name or "") or (u.first_name if u else "аға")


def target_name(msg: Message, args: str | None) -> str:
    if args and args.strip():
        return find_member(args) or args.strip().lstrip("@")
    if msg.reply_to_message and msg.reply_to_message.from_user:
        u = msg.reply_to_message.from_user
        return find_member(u.first_name or "") or u.first_name
    return display(msg)


def seeded(*parts) -> random.Random:
    """Бір күнде бір адамға бір нәтиже."""
    h = hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()
    return random.Random(int(h, 16))


async def roast_for(name: str) -> str:
    info = MEMBERS.get(name, {})
    role = info.get("role", "")
    facts = "; ".join(f for f in info.get("facts", []) if f)
    prompt = f"{name} деген досыңа бір қатты, бірақ достық тиісу жаз."
    if role:
        prompt += f" Оның жұмысы: {role}."
    if facts:
        prompt += f" Ол туралы мәлімет (қолдан): {facts}."
    pool = C.ROASTS + C.ROLE_ROASTS.get(role, []) * 2
    return await llm_joke(prompt) or random.choice(pool).format(name=name)


def house_message() -> str:
    names = list(MEMBERS)
    random.shuffle(names)
    chores = random.sample(C.CHORES, k=min(len(C.CHORES), len(names)))
    lines = [f"• <b>{n}</b> — {chores[i % len(chores)]}" for i, n in enumerate(names)]
    return (
        f"{random.choice(C.FRIDAY_INTROS)}\n\nБүгінгі кезек:\n" + "\n".join(lines)
        + f"\n\n{random.choice(C.FRIDAY_OUTROS)}"
    )


# --- жұма түнгі жоспарлаушы -------------------------------------------------
async def friday_loop(bot: Bot) -> None:
    while True:
        try:
            now = datetime.now(TZ)
            st = load_state()
            today = now.date().isoformat()
            due = now.weekday() == 4 and (now.hour, now.minute) >= HOUSE_HM
            if due and st.get("last_sent") != today and st["chats"]:
                for chat_id in st["chats"]:
                    try:
                        await bot.send_message(chat_id, house_message())
                    except Exception:  # noqa: BLE001
                        log.exception("send failed for %s", chat_id)
                st["last_sent"] = today
                save_state(st)
        except Exception:  # noqa: BLE001
            log.exception("friday_loop error")
        await asyncio.sleep(30)


# --- командалар -------------------------------------------------------------
dp = Dispatcher()


@dp.message(Command("start", "help"))
async def cmd_help(m: Message):
    await m.answer(C.HELP)


@dp.message(Command("clan"))
async def cmd_clan(m: Message):
    await m.answer("🔥 <b>Клан Учих:</b>\n" + "\n".join(f"• {n}" for n in MEMBERS))


@dp.message(Command("roast"))
async def cmd_roast(m: Message, command: CommandObject):
    name = target_name(m, command.args)
    await m.answer("🔥 " + await roast_for(name))


@dp.message(Command("chetam"))
async def cmd_chetam(m: Message):
    names = list(MEMBERS)
    random.shuffle(names)
    lines = random.sample(C.TEASE, k=min(len(C.TEASE), len(names)))
    for name, line in zip(names, lines):
        await m.bot.send_chat_action(m.chat.id, "typing")
        await asyncio.sleep(random.uniform(1.0, 2.2))
        await m.answer(line.format(name=name))


@dp.message(Command("duel"))
async def cmd_duel(m: Message, command: CommandObject):
    parts = (command.args or "").split()
    if len(parts) < 2:
        a, b = random.sample(list(MEMBERS), 2)
    else:
        a, b = (find_member(parts[0]) or parts[0]), (find_member(parts[1]) or parts[1])
    ra, rb = await roast_for(b), await roast_for(a)
    winner = random.choice([a, b])
    await m.answer(
        f"⚔️ <b>{a}</b> vs <b>{b}</b>\n\n{a} → {ra}\n\n{b} → {rb}\n\n"
        f"🏆 Жеңімпаз: <b>{winner}</b> (төреші мас, шешім өзгермейді)"
    )


@dp.message(Command("predict"))
async def cmd_predict(m: Message):
    rng = seeded(date.today(), m.from_user.id, "predict")
    await m.answer(f"🔮 <b>{display(m)}</b>, бүгінгі болжамың:\n\n{rng.choice(C.PREDICTIONS)}")


@dp.message(Command("rate"))
async def cmd_rate(m: Message, command: CommandObject):
    name = target_name(m, command.args)
    rng = seeded(date.today(), name, "rate")
    await m.answer(f"📊 {name}: {rng.choice(C.RATE_TOPICS)} — <b>{rng.randint(0, 100)}%</b>")


@dp.message(Command("who"))
async def cmd_who(m: Message):
    rng = seeded(date.today(), m.chat.id, "who")
    await m.answer(f"🏅 Бүгін {rng.choice(C.TITLES)} — <b>{rng.choice(list(MEMBERS))}</b>. Құттықтаймыз, лайықты болдың.")


@dp.message(Command("itachi"))
async def cmd_itachi(m: Message):
    await m.answer("👁 " + random.choice(C.ITACHI).format(name=display(m)))


@dp.message(Command("uy"))
async def cmd_uy(m: Message):
    await m.answer(house_message())


@dp.message(Command("sethome"))
async def cmd_sethome(m: Message):
    if m.chat.type not in ("group", "supergroup"):
        return await m.answer("Бұл команданы топта жаз, далбаң 🙂")
    st = load_state()
    if m.chat.id not in st["chats"]:
        st["chats"].append(m.chat.id)
        save_state(st)
    await m.answer(f"✅ Енді әр жұма түні ({HOUSE_HM[0]:02d}:{HOUSE_HM[1]:02d}) осында «үй жинайық» деп жазамын.")


@dp.message(Command("unsethome"))
async def cmd_unsethome(m: Message):
    st = load_state()
    if m.chat.id in st["chats"]:
        st["chats"].remove(m.chat.id)
        save_state(st)
    await m.answer("Жарайды, жұма түнгі хабарламаны өшірдім. Үйді өздерің жинаңдар, ублюдоктар.")


# --- қарапайым хабарламаларға реакция ----------------------------------------
@dp.message(F.text & ~F.text.startswith("/"))
async def on_text(m: Message):
    text = m.text.lower()
    words = set(re.findall(r"[\wёа-яәіңғүұқөһ]+", text))
    name = display(m)

    me = await m.bot.me()
    mentioned = f"@{me.username}".lower() in text
    replied = bool(m.reply_to_message and m.reply_to_message.from_user and m.reply_to_message.from_user.id == me.id)
    if mentioned or replied:
        ans = await llm_joke(f"{name} саған чатта жазды: «{m.text}». Қазақша күлкілі, орынды жауап бер.") \
            or random.choice(C.RANDOM_REPLIES).format(name=name)
        return await m.reply(ans)

    for trig, replies in C.TRIGGERS.items():
        if trig in words and random.random() < 0.35:
            return await m.reply(random.choice(replies).format(name=random.choice(list(MEMBERS))))

    if random.random() * 100 < RANDOM_PERCENT:
        ans = await llm_joke(f"{name} чатта жазды: «{m.text}». Қазақша қысқа күлкілі репликамен араласып кет.") \
            or random.choice(C.RANDOM_REPLIES).format(name=name)
        await m.reply(ans)


async def main():
    token = os.environ["BOT_TOKEN"]
    bot = Bot(token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    task = asyncio.create_task(friday_loop(bot))  # noqa: F841
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
