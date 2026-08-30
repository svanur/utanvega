# Age-grading source tables

Source workbooks for the age-grading tool (`frontend/data/ageGrading.ts`).

## Provenance

**2025 USATF MLDR Road Age Grading Tables**, maintained by Alan Jones for the USATF
Masters Long Distance Running Council. Approved 10 January 2025.

- Repository: https://github.com/AlanLyttonJones/Age-Grade-Tables (`2025 Files`)
- Road-specific standards, as opposed to the WMA track-and-field tables

These are committed deliberately. The generated data in `ageGrading.ts` is derived from
them, so keeping the source in the repo makes the conversion auditable and re-runnable
when the next edition is published, rather than a one-off manual transcription.

## What to read

| Sheet | Contents |
|---|---|
| `Age Factors` | **107 rows, per-year from age 5, one column per distance.** The factors to extract. |
| `Age Factors` → `OC sec` row | Open-class standards per distance, in seconds. |
| `AgeStanSec` | Age standards in seconds. |

**Do not read the per-distance sheets (`5K`, `H.Marathon`, `50K`, …) for factors.** Those
hold the parametric model — `Youth Coefficient`, `Masters Coefficient`, `Maximum Youth age`,
`Minimum Masters age` — that *generates* the tables. `Age Factors` and `AgeStanSec` are the
computed outputs.

## Distances available

```
Mile, 5K, 6K, 4MI, 8K, 5MI, 10K, 7MI, 12K, 15K, 10MI,
20K, H.Marathon, 25K, 30K, Marathon, 50K, 100K, 200K
```

Female open standards, for spot-checking a conversion: 5K 834 s, 10K 1726 s,
Half Marathon 3772 s (62:52).

## Reading these files

`openpyxl` is not a project dependency and does not need to be. `.xlsx` is a zip of XML and
can be read with `zipfile` plus `xml.etree.ElementTree` from the standard library.

Tracked in #504.
