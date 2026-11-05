import json, pathlib, sys
here = pathlib.Path(__file__).parent; sys.path.insert(0, str(here))
import texts1, texts2  # noqa
texts, exs = [], []
for t in texts1.T:
    qs = t.pop("questions"); texts.append(t)
    for i, q in enumerate(qs): exs.append(dict(module="reading", level="C1", topic=t["topic"], reading_title=t["title"], position=i, distractor_notes=q.pop("distractor_notes", None), **q))
seed = here.parent / "seed"
(seed / "reading_materials.json").write_text(json.dumps(texts, ensure_ascii=False, indent=1))
(seed / "exercises_reading.json").write_text(json.dumps(exs, ensure_ascii=False, indent=1))
print(len(texts), "texts", len(exs), "questions", [len(t["body"].split()) for t in texts])
