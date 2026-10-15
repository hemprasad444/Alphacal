"""Live call with the deployed REI agent, the way the phone does it: join with the session token,
speak recorded lines, answer REI's tool calls like the app, and record what happened."""
import asyncio, json, sys, time, wave
from livekit import rtc

TOKEN = json.load(open(sys.argv[1]))
LINES = sys.argv[2:]
events = []
t0 = time.time()
def ev(kind, **kw):
    kw["t"] = round(time.time() - t0, 2)
    events.append({"kind": kind, **kw})
    print(json.dumps({"kind": kind, **kw})[:400], flush=True)

async def main():
    room = rtc.Room()
    agent_text = {}
    first_audio = {"at": None, "frames": 0}

    async def on_text(reader, who):
        attrs = reader.info.attributes or {}
        txt = ""
        async for chunk in reader:
            txt += chunk
        final = attrs.get("lk.transcription_final") == "true"
        ev("transcript", who="rei" if who != room.local_participant.identity else "me", text=txt.strip(), final=final)
    room.register_text_stream_handler("lk.transcription", lambda reader, who: asyncio.ensure_future(on_text(reader, who)))

    @room.on("track_subscribed")
    def on_track(track, pub, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            async def pull():
                import array, math
                quiet = 100
                async for e in rtc.AudioStream(track):
                    f = e.frame
                    first_audio["frames"] += 1
                    if first_audio["at"] is None:
                        first_audio["at"] = time.time() - t0
                        ev("first_audio")
                    a = array.array("h", bytes(f.data))
                    rms = math.sqrt(sum(x * x for x in a) / max(1, len(a)))
                    if rms > 300:
                        if quiet >= 40:
                            ev("rei_voice_starts")
                        quiet = 0
                    else:
                        quiet += 1
            asyncio.ensure_future(pull())

    await room.connect(TOKEN["url"], TOKEN["token"])
    ev("connected", room=room.name)
    for name in ["log_meal", "remove_meal", "log_workout", "update_vow", "remember", "rebuild_program", "forget"]:
        def make(n):
            async def handler(data: rtc.RpcInvocationData):
                ev("tool", name=n, payload=json.loads(data.payload))
                return "Logged. Before talking about the food, react to anything else they just said (an answer to your question included)."
            return handler
        room.local_participant.register_rpc_method(name, make(name))


    source = rtc.AudioSource(48000, 1)
    track = rtc.LocalAudioTrack.create_audio_track("mic", source)
    await room.local_participant.publish_track(track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
    silence = rtc.AudioFrame(b"\x00\x00" * 480, 48000, 1, 480)

    async def quiet(sec):
        for _ in range(int(sec * 100)):
            await source.capture_frame(silence)

    async def speak(path):
        w = wave.open(path)
        data = w.readframes(w.getnframes())
        ev("say", file=path, seconds=round(len(data) / 2 / 48000, 1))
        for i in range(0, len(data), 960):
            chunk = data[i:i + 960]
            if len(chunk) < 960:
                chunk += b"\x00" * (960 - len(chunk))
            await source.capture_frame(rtc.AudioFrame(chunk, 48000, 1, 480))
        ev("said")

    await quiet(12)  # REI's greeting
    for path in LINES:
        await speak(path)
        await quiet(14)
    ev("audio_frames", frames=first_audio["frames"])
    await room.disconnect()
    json.dump(events, open(sys.argv[1].replace(".json", "-events.json"), "w"), indent=1)

asyncio.run(main())
