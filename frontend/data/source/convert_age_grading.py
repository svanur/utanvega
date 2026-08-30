#!/usr/bin/env python3
"""Convert the 2025 USATF MLDR road age-grading workbooks into
frontend/data/ageGradingFactors.generated.ts.

Source: maleRoad2025.xlsx / femaleRoad2025.xlsx (see README.md in this
directory for provenance). Reads only the `Age Factors` sheet — per-year
age factors (rows) per distance (columns) — and its `OC sec` row (open
class standards, in seconds). Deliberately does NOT read the per-distance
sheets (`5K`, `H.Marathon`, `50K`, ...), which hold the parametric model
(Youth/Masters coefficients) that *generates* the Age Factors table, not
the table itself.

No third-party xlsx library is used (none is a project dependency) — an
.xlsx file is a zip of XML, read here with the stdlib `zipfile` and
`xml.etree.ElementTree`.

Usage (from repo root):
    python frontend/data/source/convert_age_grading.py

Regenerate this whenever a new edition of the workbooks is dropped into
this directory — do not hand-edit ageGradingFactors.generated.ts.
"""
import re
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
RNS = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

SOURCE_DIR = Path(__file__).parent
OUTPUT_PATH = SOURCE_DIR.parent / 'ageGradingFactors.generated.ts'

# Our six existing AG_DISTANCES keys, mapped to the header text used in the
# workbooks' `Age Factors` sheet. Do not add entries here for the workbook's
# other distances (Mile, 6K, 8K, 10MI, 20K, 25K, 30K, ...) — out of scope.
DISTANCE_HEADERS = [
    ('5K', '5 km'),
    ('10K', '10 km'),
    ('Half Marathon', 'H. Mar'),
    ('Marathon', 'Marathon'),
    ('50K', '50 km'),
    ('100K', '100 km'),
]

MIN_AGE = 5
MAX_AGE = 100


def load_shared_strings(z: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    return [''.join(t.text or '' for t in si.iter(NS + 't')) for si in root]


def col_to_num(col: str) -> int:
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - ord('A') + 1)
    return n


def find_sheet_path(z: zipfile.ZipFile, sheet_name: str) -> str:
    """Resolve a sheet name to its worksheetN.xml path via workbook.xml +
    workbook.xml.rels, rather than assuming a fixed sheetN — sheet order and
    numbering differ between the male and female workbooks."""
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rid = None
    for sheet in wb.find(NS + 'sheets'):
        if sheet.attrib['name'] == sheet_name:
            rid = sheet.attrib[RNS + 'id']
            break
    if rid is None:
        raise ValueError(f'Sheet "{sheet_name}" not found in workbook')
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    for rel in rels:
        if rel.attrib['Id'] == rid:
            return 'xl/' + rel.attrib['Target']
    raise ValueError(f'Relationship {rid} not found')


def parse_sheet(z: zipfile.ZipFile, sheet_path: str, shared: list[str]) -> dict[tuple[int, int], object]:
    root = ET.fromstring(z.read(sheet_path))
    grid: dict[tuple[int, int], object] = {}
    for row in root.find(NS + 'sheetData'):
        r = int(row.attrib['r'])
        for c in row:
            m = re.match(r'([A-Z]+)(\d+)', c.attrib['r'])
            col = col_to_num(m.group(1))
            t = c.attrib.get('t')
            v_el = c.find(NS + 'v')
            if v_el is None:
                continue
            v = v_el.text
            if t == 's':
                v = shared[int(v)]
            else:
                try:
                    v = float(v)
                except ValueError:
                    pass
            grid[(r, col)] = v
    return grid


def extract_workbook(path: Path) -> tuple[dict[str, float], dict[str, list[float]]]:
    """Returns (open_standards, factors_by_distance) for one workbook.
    factors_by_distance[key] is a list of length (MAX_AGE - MIN_AGE + 1),
    index 0 == age MIN_AGE."""
    z = zipfile.ZipFile(path)
    shared = load_shared_strings(z)
    sheet_path = find_sheet_path(z, 'Age Factors')
    grid = parse_sheet(z, sheet_path, shared)

    header_row = 2
    oc_sec_row = 4

    # Locate the "Age" column and each distance's column by matching the
    # header row text — column positions differ between the male and
    # female workbooks (the female sheet has a duplicate leading "Age"
    # column), so we look these up by name rather than assuming letters.
    max_col = max(c for (r, c) in grid if r == header_row)
    headers = {grid.get((header_row, c)): c for c in range(1, max_col + 1)}

    age_col = headers.get('Age')
    if age_col is None:
        raise ValueError(f'No "Age" column found in {path.name}')

    open_standards: dict[str, float] = {}
    dist_cols: dict[str, int] = {}
    for key, header_text in DISTANCE_HEADERS:
        col = headers.get(header_text)
        if col is None:
            raise ValueError(f'No "{header_text}" column found in {path.name}')
        dist_cols[key] = col
        open_standards[key] = grid[(oc_sec_row, col)]

    # Age rows start right after the header block (row 6 in both workbooks)
    # and run one row per year until the footer text; stop as soon as the
    # Age column stops holding a plain number.
    factors_by_distance: dict[str, list[float]] = {key: [] for key, _ in DISTANCE_HEADERS}
    r = header_row + 4  # row 6
    while True:
        age_val = grid.get((r, age_col))
        if not isinstance(age_val, float):
            break
        age = int(age_val)
        if age < MIN_AGE:
            r += 1
            continue
        if age > MAX_AGE:
            break
        for key, col in dist_cols.items():
            factors_by_distance[key].append(grid[(r, col)])
        r += 1

    for key, _ in DISTANCE_HEADERS:
        expected = MAX_AGE - MIN_AGE + 1
        if len(factors_by_distance[key]) != expected:
            raise ValueError(
                f'{path.name}: expected {expected} age rows for {key}, got {len(factors_by_distance[key])}'
            )

    return open_standards, factors_by_distance


def format_factor_row(values: list[float]) -> str:
    return '[' + ', '.join(f'{v:.4g}' for v in values) + ']'


def main() -> None:
    male_open, male_factors = extract_workbook(SOURCE_DIR / 'maleRoad2025.xlsx')
    female_open, female_factors = extract_workbook(SOURCE_DIR / 'femaleRoad2025.xlsx')

    lines = []
    lines.append('// AUTO-GENERATED — do not edit by hand.')
    lines.append('// Regenerate with: python frontend/data/source/convert_age_grading.py')
    lines.append('//')
    lines.append('// Source: 2025 USATF MLDR Road Age Grading Tables, approved 2025-01-10 by the')
    lines.append('// USATF Masters Long Distance Running (MLDR) council. Compiled by Alan Jones')
    lines.append('// (https://github.com/AlanLyttonJones/Age-Grade-Tables). See frontend/data/source/README.md')
    lines.append('// for provenance and frontend/data/source/maleRoad2025.xlsx / femaleRoad2025.xlsx for the')
    lines.append('// source workbooks (`Age Factors` sheet).')
    lines.append('//')
    lines.append(f'// Age factors cover ages {MIN_AGE}-{MAX_AGE} inclusive (the full range published in the')
    lines.append('// source workbooks) for the six distances this tool supports: 5K, 10K, Half Marathon,')
    lines.append('// Marathon, 50K, 100K. Open standards ("OC sec" row) are world-best road times at peak')
    lines.append('// age, in seconds.')
    lines.append('')
    lines.append("export const MIN_AGE = 5;")
    lines.append("export const MAX_AGE = 100;")
    lines.append('')
    lines.append('// Index 0 == age MIN_AGE, index (MAX_AGE - MIN_AGE) == age MAX_AGE.')
    lines.append('export const MALE_FACTORS: Record<string, number[]> = {')
    for key, _ in DISTANCE_HEADERS:
        lines.append(f"    '{key}': {format_factor_row(male_factors[key])},")
    lines.append('};')
    lines.append('')
    lines.append('export const FEMALE_FACTORS: Record<string, number[]> = {')
    for key, _ in DISTANCE_HEADERS:
        lines.append(f"    '{key}': {format_factor_row(female_factors[key])},")
    lines.append('};')
    lines.append('')
    lines.append('export const OPEN_STANDARDS: { male: Record<string, number>; female: Record<string, number> } = {')
    lines.append('    male: {')
    for key, _ in DISTANCE_HEADERS:
        lines.append(f"        '{key}': {male_open[key]:.0f},")
    lines.append('    },')
    lines.append('    female: {')
    for key, _ in DISTANCE_HEADERS:
        lines.append(f"        '{key}': {female_open[key]:.0f},")
    lines.append('    },')
    lines.append('};')
    lines.append('')

    OUTPUT_PATH.write_text('\n'.join(lines), encoding='utf-8', newline='\n')
    print(f'Wrote {OUTPUT_PATH}')
    print('Male open standards:', male_open)
    print('Female open standards:', female_open)


if __name__ == '__main__':
    main()
