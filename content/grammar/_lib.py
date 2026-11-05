# helpers for writing grammar lessons compactly
def G(q, answers, expl):  # typed gap
    return dict(task_type="gap", instruction="Uzupełnij lukę poprawną formą.", prompt=dict(question=q), answers=answers if isinstance(answers, list) else [answers], explanation=expl)
def M(q, options, answer, expl, notes=None):
    return dict(task_type="mc", instruction="Wybierz poprawną odpowiedź.", prompt=dict(question=q, options=options), answers=[answer], explanation=expl, distractor_notes=notes)
def K(s1, kw, s2, answers, expl):
    return dict(task_type="kwt", instruction="Uzupełnij drugie zdanie tak, aby miało podobne znaczenie. Użyj słowa kluczowego (bez zmiany), 3–6 słów.", prompt=dict(question=s1, keyword=kw, sentence2=s2), answers=answers if isinstance(answers, list) else [answers], explanation=expl)
def E(sentence, answers, expl):  # error correction: rewrite the sentence
    return dict(task_type="error", instruction="Zdanie zawiera błąd. Wpisz poprawne zdanie.", prompt=dict(question=sentence), answers=answers if isinstance(answers, list) else [answers], explanation=expl)
def T(pl, answers, expl):
    return dict(task_type="translation", instruction="Przetłumacz na angielski, używając struktury z lekcji.", prompt=dict(question=pl), answers=answers if isinstance(answers, list) else [answers], explanation=expl)
def X(en, pl, why): return dict(en=en, pl=pl, why=why)
def C(vs, difference, when): return dict(vs=vs, difference=difference, when=when)
def W(wrong, right, why): return dict(wrong=wrong, right=right, why=why)
LESSONS = []
def lesson(slug, area, title, position, explanation, usage, structure, examples, comparison, mistakes, exceptions, advanced, practice, test):
    LESSONS.append(dict(slug=slug, area=area, title=title, position=position, published=True, content=dict(
        explanation=explanation, usage=usage, structure=structure, examples=examples, comparison=comparison, mistakes=mistakes, exceptions=exceptions, advanced=advanced),
        practice=practice, test=test))
