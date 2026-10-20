# Card authoring guide for AI (Bio kartičky)

**How to use (for the human):** give an AI this file together with the course material (text, slides, notes – ideally including the learning outcomes under the heading **„Cíle“**). Ask it: *„Follow AI_CARD_AUTHORING.md and create the card package for the attached material.“* Save the CSV into `data/`, add the `packages.json` entry, run `npm run validate`, then edit by hand.

---

## 0. Your task

You are creating flashcards for Czech high-school students from the course material you are given. The flashcards are studied with spaced repetition. **Success criterion: a student who learns every standard card in the deck can pass every learning outcome („Cíle“) of the material.** Cards are written in **Czech**.

Produce exactly three deliverables (section 7): the CSV, the `packages.json` entry, and a coverage report.

## 1. Reading the source material

### 1.1 Learning outcomes („Cíle“) are the backbone
- If the material has outcomes (a section called „Cíle“, „Cíle výuky“, „Žák dokáže…“, „Dokážu…“), they define what the cards must achieve. Number them `C1, C2, …` in the order given (use the material's own numbering if it has one).
- If there are no outcomes, build the backbone from the headings of the material (one pseudo-outcome per heading), and **say so in the coverage report**.
- Outcomes are usually too vague to turn into cards directly. "Dokážu charakterizovat tři bakteriální nemoci" cannot become one card. Your job is to **decompose each outcome into the concrete knowledge a student needs to demonstrate it**, by reading the material and finding that knowledge. Example for that outcome: the material mentions five bacterial diseases → create cards for **all five** (e.g. one card per disease asking for causative agent, transmission and main symptoms), plus **one overview card** such as „Vyjmenuj bakteriální onemocnění z látky.“ Cover more than the minimum the outcome names, so the student has choices and can still demonstrate the outcome.
- Use the outcome's verb to choose the card pattern:

| Outcome verb (cs) | Card patterns to create |
|---|---|
| vyjmenuje, uvede příklady | one card per item (item → its key facts) + one overview/list card |
| charakterizuje, popíše | several single-fact cards on the characteristic features; one summary card if short |
| definuje, vysvětlí pojem | definition card (term → definition), and a reverse card (definition → term) when the term is key |
| rozliší, porovná | one comparison card per pair ("Čím se liší X od Y?") + single-fact cards for each side |
| vysvětlí princip, proč | a "why / how" card, plus the cause–effect steps as separate small cards |
| zařadí, klasifikuje | cards asking which category an example belongs to, and which examples belong to a category |
| aplikuje, určí, vyřeší | short scenario cards ("Student zjistí… Co z toho plyne?") |

### 1.2 `&&` marks extra material
- Any text in the source wrapped in **`&&`** … **`&&`** is **extra material**: optional, harder or enrichment content. Example: `&&Bakterie jsou prokaryota.&&`.
- Treat `@@ … @@` as the same marker (the author sometimes writes it that way).
- Cards made **only** from extra material get `type = extra`. Never put anything a „Cíl“ requires into `extra` – if an outcome needs it, it is `standard` even if the source marked it as extra (mention this in the report).
- If an outcome itself is wrapped in `&&`, it is an extra outcome: its cards are `extra`.
- Never copy the `&&` / `@@` markers into the cards.
- Unmarked material that no outcome needs but is still taught (details, side notes) is `standard` only if it is clearly part of the lesson; if unsure, make it `extra` and list it under "Judgement calls".

## 2. Package structure

- One CSV = one **package** (a lesson/topic, e.g. „Bakterie“).
- A package has **parts** (integers `1, 2, 3, …`, contiguous, no gaps). The student unlocks parts one by one as the course progresses, so a part should correspond to a natural teaching unit (a chapter/section of the material, or a group of related outcomes). Aim for 10–40 cards per part; use 2–5 parts per package. Cards in part N must only rely on knowledge from parts ≤ N.
- Every card has one **type**:
  - `standard` – normal cards needed for the outcomes.
  - `extra` – from `&&` material (see 1.2).
  - `permanent` – a **small** set (about 5–15 % of the cards) of foundational terms/facts that later parts keep relying on (core definitions, key vocabulary). They keep being reviewed even after the student deactivates the part. Place each in the earliest part where it is needed. Do not use `permanent` for ordinary details.

## 3. Writing good cards

1. **Atomic**: one fact or one idea per card. If the answer has more than ~5 items or more than 2 sentences, split it. Exception: overview/list cards (see 1.1), which should stay short (≤ 7 items).
2. **Self-contained front**: the question must make sense alone, without seeing neighbouring cards ("Který typ buňky mají bakterie?" not "Jaký je to typ?"). Include the topic word when the question would otherwise be ambiguous.
3. **No yes/no questions.** Ask what, why, how, which, compare.
4. **Short, precise back**: the shortest answer that is fully correct. Use the terminology of the source material.
5. **Plain text only.** No Markdown, no HTML, no emojis. A line break inside a field is allowed (use it for short enumerations, one item per line). No images, no cloze deletions.
6. **Do not invent facts.** Use only the source material (plus trivially certain connecting knowledge). If the material is missing something an outcome needs, do not make it up – list it under "Gaps" in the coverage report.
7. **No duplicates**, and no two cards that give away each other's answer in the front.
8. Language: Czech, correct spelling and diacritics, the same level of formality as the source.

## 4. CSV format (strict)

UTF-8, comma-separated, first line is exactly this header:

```
id,front,back,part,type,tags
```

| column | rules |
|---|---|
| `id` | Unique in the package. Format `<prefix><number>`, prefix = 1–3 letters from the package id, number zero-padded to 3 digits: `bak001`, `bak002`, … Ids are **permanent**: never renumber; when cards are added later, continue with new numbers. |
| `front` | The question. |
| `back` | The answer. |
| `part` | Integer ≥ 1. |
| `type` | Exactly `standard`, `extra` or `permanent`. |
| `tags` | Space-separated tokens, no diacritics, no spaces inside a tag. **Always include the outcome(s) the card serves**, e.g. `C1` or `C2 C5`. Optionally add a topic tag (`nemoci`, `stavba`). Cards that serve no outcome get no `C` tag (only allowed for `extra` cards or when there are no outcomes). |

Quoting: a field containing a comma, a double quote or a line break must be wrapped in double quotes; a double quote inside it is written as `""`. Rows are ordered by part, then in a sensible teaching order. No blank lines, no comments, no trailing spaces.

## 5. Procedure (follow in this order)

1. List all outcomes `C1…Cn` (mark extra ones). State whether the material has outcomes.
2. Split the material into parts and assign each outcome to the part(s) where it is taught.
3. For each outcome, list the concrete knowledge items that demonstrate it (decomposition, section 1.1). Pull them from the material.
4. Write the cards. Tag each with its outcome(s). Mark `&&` content as `extra`.
5. Choose the `permanent` cards.
6. Self-check (section 6).
7. Output the deliverables (section 7).

## 6. Self-check before answering

- [ ] Every outcome has at least 3 `standard` cards (more for broad ones), or is listed under "Gaps".
- [ ] For every outcome, a student who answers all its cards correctly could fulfil the outcome's verb (list, characterize, compare, …) – not just recall a fragment.
- [ ] No `&&` / `@@` markers remain in any card; everything from `&&` material is `extra`; nothing required by an outcome is `extra`.
- [ ] Ids are unique, parts are contiguous integers from 1, types are valid, every row has 6 columns, quoting is correct.
- [ ] Parts only depend on earlier parts.
- [ ] `permanent` cards are about 5–15 % of the deck.
- [ ] If you can run commands: `npm run validate` passes without errors.

## 7. Deliverables

**A. The CSV** in one code block (language `csv`), complete, ready to save as `data/<package-id>.csv`.

**B. The `data/packages.json` entry** to add to the `packages` array:

```json
{
  "id": "bakterie",
  "title": "Bakterie",
  "description": "One short Czech sentence.",
  "file": "bakterie.csv",
  "parts": [
    { "n": 1, "title": "Short Czech title of part 1" },
    { "n": 2, "title": "…" }
  ]
}
```

`id` is lowercase ASCII without spaces and never changes later.

**C. Coverage report** (Czech or English, for the human editor), with:
1. A table: `Cíl | card ids | what the cards cover | confidence (high/medium/low)`.
2. **Gaps** – outcomes or parts of outcomes the material does not support well enough.
3. **Judgement calls** – material you classified as `extra` or `permanent` on your own, outcomes you tagged although the material was vague, anything the human should check.
4. Counts: cards per part and per type.

---

## Worked example (shortened)

Source material:

```
Cíle:
1. Dokážu charakterizovat tři bakteriální nemoci.
2. Rozliším grampozitivní a gramnegativní bakterie.

Část A – Nemoci
Bakterie způsobují např. angínu (Streptococcus pyogenes, kapénky, bolest v krku),
tetanus (Clostridium tetani, rána s hlínou, svalové křeče), …
&&Bakterie jsou prokaryota.&&
```

Decomposition of outcome 1: material names five diseases → five disease cards + one overview card. The `&&` sentence becomes an extra card.

```csv
id,front,back,part,type,tags
bak001,"Angína: Jaký je původce, jak se přenáší a jaký je hlavní příznak?","Původce: Streptococcus pyogenes.
Přenos: kapénky.
Příznak: bolest v krku.",1,standard,C1 nemoci
bak002,"Tetanus: Jaký je původce, jak se do těla dostává a jaký je hlavní příznak?","Původce: Clostridium tetani.
Vstup: poranění s hlínou.
Příznak: svalové křeče.",1,standard,C1 nemoci
bak006,Vyjmenuj bakteriální onemocnění z látky.,"Angína, tetanus, …",1,standard,C1 nemoci
bak007,Jaký typ buněk mají bakterie?,Prokaryotické.,1,extra,
```
