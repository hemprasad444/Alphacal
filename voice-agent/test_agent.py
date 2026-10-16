"""Checks the voice text cleaner: .venv/bin/python test_agent.py"""

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


if __name__ == "__main__":
    test_rei_is_spoken_as_a_name()
    test_clean_text()
    test_streaming_matches_whole_text()
    test_units_are_spoken_as_words()
    print("ok")
