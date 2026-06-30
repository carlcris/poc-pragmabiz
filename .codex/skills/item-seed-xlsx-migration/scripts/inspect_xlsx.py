#!/usr/bin/env python3
"""Inspect simple XLSX worksheets without third-party dependencies."""

from __future__ import annotations

import argparse
import collections
import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def column_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    index = 0
    for letter in letters:
        index = index * 26 + ord(letter.upper()) - 64
    return index - 1


def read_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(text.text or "" for text in item.findall(".//a:t", NS))
        for item in root.findall("a:si", NS)
    ]


def read_sheet(archive: zipfile.ZipFile, sheet_path: str) -> list[tuple[int, dict[int, str]]]:
    shared_strings = read_shared_strings(archive)
    root = ET.fromstring(archive.read(sheet_path))
    rows: list[tuple[int, dict[int, str]]] = []
    for row in root.findall(".//a:sheetData/a:row", NS):
        values: dict[int, str] = {}
        for cell in row.findall("a:c", NS):
            value_node = cell.find("a:v", NS)
            if value_node is None or value_node.text is None:
                value = ""
            elif cell.attrib.get("t") == "s":
                value = shared_strings[int(value_node.text)]
            else:
                value = value_node.text
            values[column_index(cell.attrib.get("r", ""))] = value
        rows.append((int(row.attrib["r"]), values))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect a simple XLSX worksheet.")
    parser.add_argument("xlsx", type=Path)
    parser.add_argument("--sheet", default="xl/worksheets/sheet1.xml")
    parser.add_argument("--header-row", type=int, default=1)
    parser.add_argument("--code-column", type=int, default=None, help="Zero-based item-code column.")
    parser.add_argument("--name-column", type=int, default=None, help="Zero-based item-name column.")
    parser.add_argument("--preview", type=int, default=5)
    args = parser.parse_args()

    with zipfile.ZipFile(args.xlsx) as archive:
        sheet_paths = [name for name in archive.namelist() if name.startswith("xl/worksheets/sheet")]
        rows = read_sheet(archive, args.sheet)

    header_values = next((values for row_number, values in rows if row_number == args.header_row), {})
    records = [
        (row_number, values)
        for row_number, values in rows
        if row_number > args.header_row and any((value or "").strip() for value in values.values())
    ]

    result: dict[str, object] = {
        "workbook": str(args.xlsx),
        "sheet_paths": sheet_paths,
        "sheet": args.sheet,
        "header_row": args.header_row,
        "headers": {str(index): header_values.get(index, "") for index in range(max(header_values.keys(), default=-1) + 1)},
        "record_count": len(records),
        "preview": [
            {
                "row": row_number,
                "values": {str(index): values.get(index, "") for index in range(max(values.keys(), default=-1) + 1)},
            }
            for row_number, values in records[: args.preview]
        ],
    }

    if args.code_column is not None:
        codes = [(values.get(args.code_column) or "").strip() for _, values in records]
        duplicate_codes = {code: count for code, count in collections.Counter(code for code in codes if code).items() if count > 1}
        result["missing_code_count"] = sum(1 for code in codes if not code)
        result["duplicate_codes"] = duplicate_codes

    if args.name_column is not None:
        result["missing_name_count"] = sum(
            1 for _, values in records if not (values.get(args.name_column) or "").strip()
        )

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
