"""Checks the voice text cleaner and the early end-of-turn signal: .venv/bin/python test_agent.py"""

import random
import re

from agent import TextCleaner, clean_text

# Real replies from calls: spaced tags, grouped numbers and a "… ... …" breakdown.
SAMPLES = [
    "[ warm] All set, bro. Still got 1 650 calories left—let’s crush those macros.",
    "[ laughs] Gotcha, chill. You're at 1 250 kcal, 55 protein. [ sighs] Fine.",
    "[  ] You’re got… …… ...…   …  … … ...  ... …\n\n[ ?] Sorry…\n\n[laughs] You just dropped a chicken fried rice, 750 calories.",
    "Wait... what? 12 reps, 3 sets. Okay … so",
]


def words(text: str) -> str:
    return " ".join(re.sub(r"[.…]+", " ", text).split())


def test_clean_text() -> None:
    assert clean_text("[ warm] Cool.") == "[warm] Cool."
    assert clean_text("You're at 1 250 kcal, 1 150 left") == "You're at 1250 kcal, 1150 left"
    assert clean_text("[  ] hi [ ?] there") == " hi  there"
    assert clean_text("Wait... what?") == "Wait... what?"


def test_streaming_matches_whole_text() -> None:
    rng = random.Random(7)
    for sample in SAMPLES:
        want = words(clean_text(sample))
        for _ in range(1000):
            cleaner, i, out = TextCleaner(), 0, ""
            while i < len(sample):
                n = rng.randint(1, 6)
                out += cleaner.push(sample[i : i + n])
                i += n
            out += cleaner.flush()
            assert words(out) == want, (out, want)
            assert "[ " not in out and not re.search(r"\d \d{3}\b", out), out


def test_rei_is_spoken_as_a_name():
    from agent import for_speech

    assert for_speech("I'm REI. REI's got you.") == "I'm Rei. Rei's got you."
    assert for_speech("REIGN and BREI stay") == "REIGN and BREI stay"


def test_units_are_spoken_as_words():
    from agent import TextCleaner, for_speech

    assert for_speech("160 kcal, 13 g protein, 13g carbs at 83.5 kg") == "160 calories, 13 grams protein, 13 grams carbs at 83.5 kilos"
    assert for_speech("go to the gym, 2 eggs") == "go to the gym, 2 eggs"
    # Streamed token by token, a number and its unit still reach the voice together.
    cleaner, said = TextCleaner(), []
    for tok in ["That's ", "160", " ", "kcal", " and ", "13", "g", " protein."]:
        said.append(for_speech(cleaner.push(tok)))
    said.append(for_speech(cleaner.flush()))
    assert "".join(said) == "That's 160 calories and 13 grams protein.", said



def test_swears_only_back():
    from livekit.agents.llm import ChatContext

    from agent import swear_only_back, user_swore

    assert swear_only_back("Zero excuses, zero bullshit. A fuckload of cheese.", False) == "Zero excuses, zero BS. A ton of cheese."
    assert swear_only_back("Fuck you too, now go lift.", True) == "Fuck you too, now go lift."
    calm, salty = ChatContext(), ChatContext()
    calm.add_message(role="user", content="had shiitake and rice")
    salty.add_message(role="user", content="this cut is bullshit")
    assert not user_swore(calm) and user_swore(salty)

def test_sentence_end_sends_preflight_once():
    from livekit.agents import stt
    from agent import _SentenceEndPreflight

    class Chan:
        def __init__(self):
            self.sent, self.closed = [], False

        def send_nowait(self, ev):
            self.sent.append(ev)

    def ev(kind, text=""):
        return stt.SpeechEvent(type=kind, alternatives=[stt.SpeechData(language="en", text=text)] if text else [])

    I, P, F, E = (stt.SpeechEventType.INTERIM_TRANSCRIPT, stt.SpeechEventType.PREFLIGHT_TRANSCRIPT,
                  stt.SpeechEventType.FINAL_TRANSCRIPT, stt.SpeechEventType.END_OF_SPEECH)
    ch = Chan()
    wrapped = _SentenceEndPreflight(ch)
    for e in [ev(I, "I had a plate"), ev(I, "I had a plate of rice."), ev(I, "I had a plate of rice."),
              ev(F, "I had a plate of rice."), ev(E), ev(I, "आज दो रोटी खाई।"), ev(I, "Did you get that?")]:
        wrapped.send_nowait(e)
    assert [e.type for e in ch.sent] == [I, P, I, F, E, P, P], [e.type for e in ch.sent]
    assert ch.sent[1].alternatives[0].text == "I had a plate of rice."
    assert wrapped.closed is False  # everything else reaches the real channel


if __name__ == "__main__":
    test_rei_is_spoken_as_a_name()
    test_clean_text()
    test_streaming_matches_whole_text()
    test_units_are_spoken_as_words()
    test_swears_only_back()
    test_sentence_end_sends_preflight_once()
    print("ok")
