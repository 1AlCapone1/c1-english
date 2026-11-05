import importlib, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import _lib
for p in sorted(pathlib.Path(__file__).parent.glob("l*.py")): importlib.import_module(p.stem)
lessons, exercises = [], []
for L in _lib.LESSONS:
    for i, ex in enumerate(L.pop("practice")): exercises.append(dict(module="grammar", level="C1", topic=L["title"], lesson_slug=L["slug"], position=i, distractor_notes=ex.pop("distractor_notes", None), **ex))
    for i, ex in enumerate(L.pop("test")): exercises.append(dict(module="grammar", level="C1", topic=L["title"], lesson_slug=L["slug"], position=100 + i, distractor_notes=ex.pop("distractor_notes", None), **ex))
    lessons.append(L)
seed = pathlib.Path(__file__).parent.parent / "seed"
(seed / "grammar_lessons.json").write_text(json.dumps(lessons, ensure_ascii=False, indent=1))
(seed / "exercises_grammar.json").write_text(json.dumps(exercises, ensure_ascii=False, indent=1))
print(len(lessons), "lessons,", len(exercises), "exercises")
