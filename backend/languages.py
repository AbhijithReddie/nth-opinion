"""
The languages every room (and the persona builder) can use: one shared registry.

Each language has an id, a label, a short example line (shown in the language
picker) and a style guide for the prompts. Mixed languages are always written
in Roman script, never native script, the way people actually text.

The frontend bundles a copy of the public part (frontend/src/config/languages.json),
and tests/test_languages.py checks the two stay identical. GET /api/languages
serves the same list.
"""

from dataclasses import dataclass

ROMAN_ONLY = "Always write in Roman (English) script, never {script}."


@dataclass(frozen=True)
class Language:
    id: str
    label: str
    example: str  # a short, native-flavoured line for the picker
    style: str  # how to write it, for the prompts

    def public(self) -> dict:
        return {"id": self.id, "label": self.label, "example": self.example}


def _mix(name: str, other: str, example: str, words: str, script: str) -> str:
    return (
        f"{name}: a natural, casual mix of {other} and English, the way young people text, e.g. '{example}'. "
        f"Use common words like {words} where they fit, not in every line. {ROMAN_ONLY.format(script=script)}"
    )


LANGUAGES: dict[str, Language] = {
    lang.id: lang
    for lang in [
        Language(
            "english",
            "English",
            "Bro, just tell her. What's the worst that can happen?",
            "Casual English the way young urban Indians text: light Indian slang like 'yaar', 'bro', 'scene', "
            "'arre' used naturally, not in every line.",
        ),
        Language(
            "hinglish",
            "Hinglish",
            "Yaar tu tension mat le, ye scene sort ho jayega.",
            _mix("Hinglish", "Hindi", "yaar tu tension mat le, ye scene sort ho jayega", "yaar, bhai, accha, matlab, bas, chal", "Devanagari"),
        ),
        Language(
            "tenglish",
            "Tenglish",
            "Ra, nuvvu tension padaku, idi sort aipotundi.",
            _mix("Tenglish", "Telugu", "ra, nuvvu tension padaku, idi sort aipotundi", "ra, enti, chala, em kaadu, babu, asalu", "Telugu script"),
        ),
        Language(
            "tanglish",
            "Tanglish",
            "Machan, tension aagatha, idhu sort aayidum.",
            _mix("Tanglish", "Tamil", "machan, tension aagatha, idhu sort aayidum", "machan, da, seri, enna, romba, sema", "Tamil script"),
        ),
        Language(
            "kanglish",
            "Kanglish",
            "Guru, tension togobeda, idu sort agutte.",
            _mix("Kanglish", "Kannada", "guru, tension togobeda, idu sort agutte", "guru, maga, swalpa, sakkath, gothilla", "Kannada script"),
        ),
        Language(
            "manglish",
            "Manglish",
            "Machane, tension adikkenda, ithu sheriyakum.",
            _mix("Manglish", "Malayalam", "machane, tension adikkenda, ithu sheriyakum", "machane, alle, entha, adipoli, pwoli, sheri", "Malayalam script"),
        ),
        Language(
            "marathi_english",
            "Marathi-English",
            "Arre, tension gheu nako, he sort hoil.",
            _mix("Marathi-English", "Marathi", "arre, tension gheu nako, he sort hoil", "arre, kay, mast, khup, bara, chal", "Devanagari"),
        ),
        Language(
            "benglish",
            "Benglish",
            "Dada, tension nish na, eta sort hoye jabe.",
            _mix("Benglish", "Bengali", "dada, tension nish na, eta sort hoye jabe", "dada, ki holo, bhalo, darun, ekdom, chol", "Bengali script"),
        ),
    ]
}

DEFAULT = "english"


def public_languages() -> list[dict]:
    """GET /api/languages: id, label and example for each language, in picker order."""
    return [lang.public() for lang in LANGUAGES.values()]


def is_language(language_id: str) -> bool:
    return language_id in LANGUAGES


def style(language_id: str) -> str:
    return LANGUAGES[language_id].style
