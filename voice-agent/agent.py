"""REI live voice on LiveKit: Deepgram Flux listens (and decides when you've finished), OpenRouter thinks, Fish Audio speaks.

The app's `voiceSession` Cloud Function dispatches this agent into a fresh room with the
session's job metadata: REI's prompt (personality, memory, today's numbers), greeting, voice,
models and the tool schemas. Tools run on the phone over LiveKit RPC, through the same code
the ElevenLabs agent uses (app/src/components/LiveVoice.tsx), so there is one source of truth.
"""

import asyncio
import base64
import gzip
import json
import logging
import os
import re
from typing import Any

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import Agent, AgentServer, AgentSession, ChatContext, JobContext, JobProcess, MetricsCollectedEvent, RunContext, cli, metrics
from livekit.agents import llm as lkllm
from livekit.agents.llm import function_tool
from livekit.plugins import deepgram, fishaudio, openai

load_dotenv(".env.local")
log = logging.getLogger("rei")

# Voice activity detection (for snappier cut-ins) needs onnxruntime, which has no build for Intel Macs.
# LiveKit Cloud (Linux) has it; without it Flux's own start-of-speech events handle interruptions.
try:
    from livekit.plugins import silero
except ImportError:
    silero = None

AGENT_NAME = "rei"
DEFAULT_MODELS = ["openai/gpt-oss-120b", "openai/gpt-6-luna"]
FISH_MODEL = os.environ.get("FISH_MODEL", "s2.1-pro-free")
DEFAULT_FISH_VOICE = os.environ.get("FISH_VOICE_ID", "")
# Logs each line said and each action at INFO, so calls can be reviewed from `lk agent logs` while testing.
# It records what people say: turn it off before real users.
LOG_TURNS = os.environ.get("REI_LOG_TURNS") == "1"


def prewarm(proc: JobProcess) -> None:
    if silero:
        proc.userdata["vad"] = silero.VAD.load()


# Keep a process warm so a call doesn't wait ~8 s for one to boot.
server = AgentServer(setup_fnc=prewarm, num_idle_processes=1)


def session_data(raw: str) -> dict[str, Any]:
    """The job metadata from voiceSession: JSON, gzipped and base64'd with a "gz:" prefix to keep the join token small."""
    if raw.startswith("gz:"):
        raw = gzip.decompress(base64.b64decode(raw[3:])).decode()
    return json.loads(raw or "{}")


_TAG = re.compile(r"\[\s*([^\[\]]*?)\s*\]")
_DOTS = re.compile(r"(?:\s*(?:\.{2,}|…)+){2,}\s*")
_GROUPED = re.compile(r"(?<=\d)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))")


_MARKDOWN = re.compile(r"`+|\*{1,3}|_{2,}|^#+\s*|^\s*[-•]\s+", re.M)


_REI = re.compile(r"\bREI\b")


def for_speech(text: str) -> str:
    """"REI" is a name ("Rei"), not three letters. Only for what's spoken: the transcript keeps REI."""
    return _REI.sub("Rei", text)


def clean_text(text: str) -> str:
    """What fast models get wrong for a voice: "[ warm]" tags, "1 250" numbers, runs of "… ... …" and markdown."""
    text = _MARKDOWN.sub("", text)
    text = _TAG.sub(lambda m: f"[{m.group(1)}]" if re.search(r"[a-zA-Z]", m.group(1)) else "", text)
    text = _GROUPED.sub("", text)
    text = _DOTS.sub(" ", text)
    return re.sub(r"\s*\n\s*", " ", text)


class TextCleaner:
    """Cleans streamed text, holding back only an unfinished word, tag or number until the next chunk."""

    def __init__(self) -> None:
        self.buf = ""

    def push(self, chunk: str) -> str:
        self.buf += chunk
        cut = self._cut()
        if cut < 0:
            return ""
        out, self.buf = self.buf[: cut + 1], self.buf[cut + 1 :]
        return clean_text(out)

    def _cut(self) -> int:
        """The last whitespace that splits no [tag], number like "1 250" or run of "… ... …"; -1 if none yet."""
        buf = self.buf
        end = len(buf)
        if buf.rfind("[") > buf.rfind("]"):
            end = buf.rfind("[")  # an unfinished tag: hold it whole
        cut = max(buf.rfind(" ", 0, end), buf.rfind("\n", 0, end))
        while cut > 0:
            opened = buf.rfind("[", 0, cut)
            if opened != -1 and buf.find("]", opened) > cut:
                cut = max(buf.rfind(" ", 0, opened), buf.rfind("\n", 0, opened))  # inside a tag: cut before it
            elif re.fullmatch(r"[.…]+", buf[max(buf.rfind(" ", 0, cut), buf.rfind("\n", 0, cut)) + 1 : cut].strip() or "x"):
                cut = max(buf.rfind(" ", 0, cut), buf.rfind("\n", 0, cut))  # a run of dots: wait to see if it keeps going
            elif buf[cut - 1].isdigit():
                start = cut - 1
                while start > 0 and buf[start - 1].isdigit():
                    start -= 1
                cut = max(buf.rfind(" ", 0, start), buf.rfind("\n", 0, start))  # after a number: it may continue
            else:
                break
        return cut

    def flush(self) -> str:
        out, self.buf = clean_text(self.buf), ""
        return out


class Rei(Agent):
    async def llm_node(self, chat_ctx, tools, model_settings):
        cleaner = TextCleaner()
        async for chunk in Agent.default.llm_node(self, chat_ctx, tools, model_settings):
            if isinstance(chunk, str):
                chunk = cleaner.push(chunk)
                if not chunk:
                    continue
            elif isinstance(chunk, lkllm.ChatChunk) and chunk.delta and chunk.delta.content:
                chunk.delta.content = cleaner.push(chunk.delta.content) or None
                if not chunk.delta.content and not chunk.delta.tool_calls and not chunk.usage:
                    continue
            yield chunk
        tail = cleaner.flush()
        if tail.strip():
            yield tail

    async def tts_node(self, text, model_settings):
        async def spoken():
            async for chunk in text:
                yield for_speech(chunk)

        async for frame in Agent.default.tts_node(self, spoken(), model_settings):
            yield frame


def rpc_tool(room: rtc.Room, user: str, schema: dict[str, Any]):
    """One tool from the app's schema; the phone carries it out and returns what REI hears back."""
    name = schema["name"]

    async def call(ctx: RunContext, raw_arguments: dict[str, Any]) -> str:
        try:
            result = await room.local_participant.perform_rpc(
                destination_identity=user, method=name, payload=json.dumps(raw_arguments), response_timeout=10
            )
            if LOG_TURNS:
                log.info("REI action · %s %s → %s", name, json.dumps(raw_arguments)[:200], result[:200])
            return result
        except Exception as e:  # The phone dropped or the tool threw: REI says it didn't save.
            log.warning("tool %s failed: %s", name, e)
            return "That didn't save. Tell them to try again in a bit."

    return function_tool(call, raw_schema=schema)


@server.rtc_session(agent_name=AGENT_NAME)
async def entry(ctx: JobContext) -> None:
    meta = session_data(ctx.job.metadata or "")
    ctx.log_context_fields = {"room": ctx.room.name}
    await ctx.connect()
    user = await ctx.wait_for_participant()

    models = meta.get("models") or DEFAULT_MODELS
    llm = openai.LLM(
        model=models[0],
        api_key=os.environ["OPENROUTER_API_KEY"],
        base_url="https://openrouter.ai/api/v1",
        # Lower than chat: at 0.8 GPT-OSS once trailed off into a stream of "… ... …".
        temperature=0.6,
        # Groq first: GPT-OSS starts answering there in ~0.4 s; other hosts took 2 s and once replied empty.
        # Low effort is the least every model in the list accepts.
        extra_body={"models": models, "reasoning": {"effort": "low", "exclude": True}, "provider": {"order": ["groq", "cerebras"], "allow_fallbacks": True}},
        extra_headers={"X-Title": "REI live"},
    )
    vad = ctx.proc.userdata.get("vad")
    session = AgentSession(
        # Flux is built for voice agents: it hears when a turn is really over, not just a pause.
        # English only for now (flux-general-multi adds Hindi and 8 more, but not Telugu or Tamil).
        # A higher end-of-turn bar so "Do you remember…" isn't answered before the rest of the sentence.
        stt=deepgram.STTv2(model="flux-general-en", eot_threshold=0.85, eager_eot_threshold=0.6, eot_timeout_ms=4000),
        llm=llm,
        tts=fishaudio.TTS(model=FISH_MODEL, voice_id=meta.get("voice") or DEFAULT_FISH_VOICE, latency_mode="balanced", output_format="pcm", sample_rate=24000),
        vad=vad,
        turn_handling={
            "turn_detection": "stt",
            # Flux has already decided the turn is over; don't wait the default 0.5 s on top.
            "endpointing": {"min_delay": 0.2},
            "interruption": {"min_duration": 0.4},
            "preemptive_generation": {"enabled": True},
        },
    )

    # One line per reply with where the time went: end of your turn, first words from the model, first audio.
    timing: dict[str, float] = {}

    @session.on("metrics_collected")
    def _on_metrics(ev: MetricsCollectedEvent) -> None:
        m = ev.metrics
        if isinstance(m, metrics.EOUMetrics):
            timing["turn"] = m.end_of_utterance_delay
        elif isinstance(m, metrics.LLMMetrics):
            timing["llm"] = m.ttft
        elif isinstance(m, metrics.TTSMetrics) and "llm" in timing:
            t = {**timing, "voice": m.ttfb}
            log.info("REI timing · turn end %.2fs · model %.2fs · voice %.2fs · total ≈ %.2fs", t.get("turn", 0), t["llm"], t["voice"], sum(t.values()))
            timing.clear()

    if LOG_TURNS:

        @session.on("conversation_item_added")
        def _on_item(ev) -> None:
            item = ev.item
            if getattr(item, "type", "") == "message" and item.text_content:
                log.info("REI said · %s: %s", "REI" if item.role == "assistant" else "them", item.text_content[:400])

    # Recent chat (text and earlier calls), so REI picks up where you left off.
    history = ChatContext()
    for turn in meta.get("history", []):
        history.add_message(role=turn["role"], content=turn["content"])
    if meta.get("history"):
        # Without this, REI acted on an old request from history the moment the call opened.
        history.add_message(role="system", content="The call starts now. Everything above happened before it and was already handled: never call a tool for it again. Act only on what they ask during this call.")

    tools = [rpc_tool(ctx.room, user.identity, s) for s in meta.get("tools", [])]
    await session.start(room=ctx.room, agent=Rei(instructions=meta.get("prompt", "You are REI, a fitness coach."), tools=tools, chat_ctx=history))
    session.say(meta.get("greeting") or "Yo, what's good?")

    # Hard cap per call, like the ElevenLabs agent's max duration.
    async def cap() -> None:
        await asyncio.sleep(int(meta.get("maxSeconds") or 600))
        await session.say("Gotta cut it here, we hit the time limit. Hit me up again.").wait_for_playout()
        ctx.shutdown("time limit")

    # Keep a reference (bare tasks can be garbage-collected) and cancel it if the call ends first.
    timer = asyncio.create_task(cap())

    async def stop_timer() -> None:
        timer.cancel()

    ctx.add_shutdown_callback(stop_timer)


if __name__ == "__main__":
    cli.run_app(server)
