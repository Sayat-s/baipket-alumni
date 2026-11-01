import asyncio
import hashlib
import json
import logging
import os
import random
import re
from datetime import date
from pathlib import Path

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandObject
from aiogram.types import Message

import content as C

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("uchiha")

MEMBERS: dict = json.loads((Path(__file__).parent / "members.json").read_text(encoding="utf-8"))
RANDOM_PERCENT = float(os.getenv("RANDOM_REPLY_PERCENT", "4"))

# --- необязательная генерация через Claude ---------------------------------
_llm = None
if os.getenv("ANTHROPIC_API_KEY"):
    import anthropic
    _llm = anthropic.AsyncAnthropic()

SYSTEM = (
    "Ты — бот в телеграм-чате друзей «Клан Учих» (казахстанская компания парней, юмор в стиле "
    "аниме Наруто, чёрный юмор, дружеские подколы, можно мат и грязные шутки). "
    "Пиши по-русски, коротко (1-3 предложения), смешно, как стендап-комик или Расул/Нурлан Сабуров-стайл "
    "подкол между своими. Подкалывай по поступкам и ситуациям (лень, опоздания, шаурма, понты), "
    "но НЕ трогай национальность, религию, внешность-уродство, болезни, семью. Без объяснений, только шутка."
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


# --- хелперы ----------------------------------------------------------------
def find_member(text: str) -> str | None:
    t = text.lower().strip()
    for name, info in MEMBERS.items():
        if t == name.lower() or t in info.get("aliases", []):
            return name
    return None


def display(msg: Message) -> str:
    u = msg.from_user
    return find_member(u.first_name or "") or (u.first_name if u else "брат")


def target_name(msg: Message, args: str | None) -> str:
    if args and args.strip():
        return find_member(args) or args.strip().lstrip("@")
    if msg.reply_to_message and msg.reply_to_message.from_user:
        u = msg.reply_to_message.from_user
        return find_member(u.first_name or "") or u.first_name
    return display(msg)


def facts_for(name: str) -> str:
    facts = [f for f in MEMBERS.get(name, {}).get("facts", []) if "допиши" not in f]
    return "; ".join(facts)


def seeded(*parts) -> random.Random:
    """Один и тот же результат в течение дня для одного человека."""
    h = hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()
    return random.Random(int(h, 16))


async def roast_for(name: str) -> str:
    facts = facts_for(name)
    prompt = f"Придумай одну жёсткую, но дружескую прожарку для участника клана по имени {name}."
    if facts:
        prompt += f" Что о нём известно (используй): {facts}."
    return await llm_joke(prompt) or random.choice(C.ROASTS).format(name=name)


# --- команды ----------------------------------------------------------------
dp = Dispatcher()


@dp.message(Command("start", "help"))
async def cmd_help(m: Message):
    await m.answer(C.HELP)


@dp.message(Command("clan"))
async def cmd_clan(m: Message):
    await m.answer("🔥 <b>Клан Учиха:</b>\n" + "\n".join(f"• {n}" for n in MEMBERS))


@dp.message(Command("roast"))
async def cmd_roast(m: Message, command: CommandObject):
    name = target_name(m, command.args)
    await m.answer("🔥 " + await roast_for(name))


@dp.message(Command("duel"))
async def cmd_duel(m: Message, command: CommandObject):
    parts = (command.args or "").split()
    if len(parts) < 2:
        a, b = random.sample(list(MEMBERS), 2)
    else:
        a, b = (find_member(parts[0]) or parts[0]), (find_member(parts[1]) or parts[1])
    ra, rb = await roast_for(b), await roast_for(a)
    winner = random.choice([a, b])
    await m.answer(f"⚔️ <b>{a}</b> vs <b>{b}</b>\n\n{a} → {ra}\n\n{b} → {rb}\n\n🏆 Победил: <b>{winner}</b> (судья пьян, решение окончательное)")


@dp.message(Command("predict"))
async def cmd_predict(m: Message):
    name = display(m)
    rng = seeded(date.today(), m.from_user.id, "predict")
    await m.answer(f"🔮 <b>{name}</b>, твоё предсказание на сегодня:\n\n{rng.choice(C.PREDICTIONS)}")


@dp.message(Command("rate"))
async def cmd_rate(m: Message, command: CommandObject):
    name = target_name(m, command.args)
    rng = seeded(date.today(), name, "rate")
    topic = rng.choice(C.RATE_TOPICS)
    await m.answer(f"📊 {name}: {topic} — <b>{rng.randint(0, 100)}%</b>")


@dp.message(Command("who"))
async def cmd_who(m: Message):
    rng = seeded(date.today(), m.chat.id, "who")
    name = rng.choice(list(MEMBERS))
    await m.answer(f"🏅 Сегодня {rng.choice(C.TITLES)} — <b>{name}</b>. Поздравляем, ты это заслужил.")


@dp.message(Command("itachi"))
async def cmd_itachi(m: Message):
    await m.answer("👁 " + random.choice(C.ITACHI).format(name=display(m)))


# --- реакции на обычные сообщения ------------------------------------------
@dp.message(F.text & ~F.text.startswith("/"))
async def on_text(m: Message):
    text = m.text.lower()
    words = set(re.findall(r"[\wёа-я]+", text))
    name = display(m)

    # бота упомянули или ответили ему — отвечаем всегда
    me = await m.bot.me()
    mentioned = f"@{me.username}".lower() in text
    replied = bool(m.reply_to_message and m.reply_to_message.from_user and m.reply_to_message.from_user.id == me.id)
    if mentioned or replied:
        ans = await llm_joke(f"{name} написал тебе в чате: «{m.text}». Ответь смешно, в тему.") \
            or random.choice(C.RANDOM_REPLIES).format(name=name)
        return await m.reply(ans)

    # слова-триггеры (с шансом 35%)
    for trig, replies in C.TRIGGERS.items():
        if trig in words and random.random() < 0.35:
            return await m.reply(random.choice(replies).format(name=random.choice(list(MEMBERS))))

    # случайное вмешательство
    if random.random() * 100 < RANDOM_PERCENT:
        ans = await llm_joke(f"{name} написал в чате: «{m.text}». Вклинься с короткой смешной репликой.") \
            or random.choice(C.RANDOM_REPLIES).format(name=name)
        await m.reply(ans)


async def main():
    token = os.environ["BOT_TOKEN"]
    bot = Bot(token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
