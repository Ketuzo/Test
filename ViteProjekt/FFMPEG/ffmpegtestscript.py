#!/usr/bin/env python3
"""
parse_ffmpeg_nodes.py
=====================

* liest die von `ffmpeg -h full` gespeicherte Datei `full_ffmpeg.txt`
* erzeugt drei Ausgabedateien (Basisname per -o/--out, Standard: ffmpeg_full):
    1. <basis>.html   –   eigenständige HTML‑App (JSON inline)
    2. <basis>.json   –   dieselben Daten als JSON
    3. <basis>.sqlite –   optional (--sqlite) relationale DB

Die HTML‑Datei funktioniert direkt per Doppelklick (kein lokaler Web‑Server nötig).
Nur Python‑Standardbibliothek erforderlich.
"""

import re
import json
import argparse
import pathlib
import sqlite3
import textwrap
import html

FLAG_RE = re.compile(r"[.A-Z]{11}")   # z. B. '..FV.....T.'


# --------------------------------------------------------------------------- #
# Parser
# --------------------------------------------------------------------------- #
def parse_ffmpeg(path: pathlib.Path):
    """Gibt (commands_list, filters_list) zurück."""
    commands, filters = [], {}
    state = None                         # None | "av"  (innerhalb AVOptions‑Block)
    category = current_filter = current_opts = current_opt = None

    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            i += 1
            continue

        # ------------- Innerhalb eines AVOptions‑Blocks ------------------- #
        if state == "av":
            if not line.startswith((" ", "\t")):          # Block endet
                filters[current_filter] = {
                    "filter": current_filter,
                    "category": category,
                    "options": current_opts,
                }
                state = current_filter = current_opts = current_opt = None
                continue

            if "<" in line and ">" in line:               # neue Option
                parts = re.split(r"\s{2,}", line.strip(), maxsplit=2)
                name, type_part, rest = (parts + ["", ""])[:3]
                type_part = type_part.strip("<>")
                flags = rest[:11] if FLAG_RE.fullmatch(rest[:11]) else None
                desc = rest[11:].strip() if flags else rest.strip()
                current_opt = {
                    "name": name,
                    "type": type_part,
                    "flags": flags,
                    "description": desc,
                    "choices": [],
                }
                current_opts.append(current_opt)
            else:                                         # Choice‑Zeile
                tokens = re.split(r"\s{2,}", line.strip())
                if not tokens:
                    i += 1
                    continue
                choice_name = tokens[0]
                flags = (
                    tokens.pop()
                    if len(tokens[-1]) == 11 and FLAG_RE.fullmatch(tokens[-1])
                    else None
                )
                value = tokens[1] if len(tokens) > 1 else None
                desc = " ".join(tokens[2:]) if len(tokens) > 2 else ""
                current_opt["choices"].append(
                    {
                        "choice": choice_name,
                        "value": value,
                        "flags": flags,
                        "description": desc,
                    }
                )
            i += 1
            continue
        # ------------------------------------------------------------------ #

        # Neuer AVOptions‑Block?
        m = re.match(r"\s*([^\s].+?)\s+AVOptions:", line)
        if m:
            current_filter = m.group(1).strip()
            state, current_opts = "av", []
            i += 1
            continue

        # Kapitel‑Überschrift
        if not line.startswith("-") and line.strip().endswith(":"):
            category = line.strip()[:-1]
            i += 1
            continue

        # Normale -Option
        if line.lstrip().startswith("-"):
            parts = re.split(r"\s{2,}", line.strip(), maxsplit=2)
            flag_args = parts[0].split()
            flag, args = flag_args[0], " ".join(flag_args[1:])
            maybe_type = maybe_rest = ""
            if len(parts) == 2:
                maybe_rest = parts[1]
            elif len(parts) == 3:
                maybe_type, maybe_rest = parts[1], parts[2]

            type_part = (
                maybe_type.strip("<>") if maybe_type.startswith("<") else None
            )
            rest = (
                maybe_rest
                if type_part
                else f"{maybe_type} {maybe_rest}".strip()
            )
            flags = rest[:11] if FLAG_RE.fullmatch(rest[:11]) else None
            desc = rest[11:].strip() if flags else rest.strip()

            commands.append(
                {
                    "command": flag,
                    "args": args,
                    "type": type_part,
                    "flags": flags,
                    "description": desc,
                    "category": category,
                }
            )
        i += 1

    # Offener AVOptions‑Block am Ende?
    if state == "av":
        filters[current_filter] = {
            "filter": current_filter,
            "category": category,
            "options": current_opts,
        }

    return commands, list(filters.values())


# --------------------------------------------------------------------------- #
# Writer
# --------------------------------------------------------------------------- #
def write_sqlite(data: dict, db_path: pathlib.Path):
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    cur.execute(
        """CREATE TABLE IF NOT EXISTS commands(
              id INTEGER PRIMARY KEY,
              command TEXT, args TEXT, type TEXT, flags TEXT,
              description TEXT, category TEXT)"""
    )
    cur.executemany(
        """INSERT INTO commands
           (command,args,type,flags,description,category)
           VALUES (?,?,?,?,?,?)""",
        [
            (
                c["command"],
                c["args"],
                c["type"],
                c["flags"],
                c["description"],
                c["category"],
            )
            for c in data["commands"]
        ],
    )

    cur.execute(
        """CREATE TABLE IF NOT EXISTS filters(
              id INTEGER PRIMARY KEY, filter TEXT, category TEXT)"""
    )
    cur.execute(
        """CREATE TABLE IF NOT EXISTS options(
              id INTEGER PRIMARY KEY, filter_id INTEGER,
              name TEXT, type TEXT, flags TEXT, description TEXT)"""
    )
    cur.execute(
        """CREATE TABLE IF NOT EXISTS choices(
              id INTEGER PRIMARY KEY, option_id INTEGER,
              choice TEXT, value TEXT, flags TEXT, description TEXT)"""
    )

    for f in data["filters"]:
        cur.execute(
            "INSERT INTO filters(filter,category) VALUES (?,?)",
            (f["filter"], f["category"]),
        )
        fid = cur.lastrowid
        for o in f["options"]:
            cur.execute(
                """INSERT INTO options(filter_id,name,type,flags,description)
                   VALUES (?,?,?,?,?)""",
                (
                    fid,
                    o["name"],
                    o["type"],
                    o["flags"],
                    o["description"],
                ),
            )
            oid = cur.lastrowid
            cur.executemany(
                """INSERT INTO choices(option_id,choice,value,flags,description)
                   VALUES (?,?,?,?,?)""",
                [
                    (
                        oid,
                        ch["choice"],
                        ch["value"],
                        ch["flags"],
                        ch["description"],
                    )
                    for ch in o["choices"]
                ],
            )

    con.commit()
    con.close()


def write_files(data: dict, base: pathlib.Path, sqlite_flag: bool = False):
    """
    schreibt
      • base.html  (Daten inline als <script type="application/json">)
      • base.json
      • base.sqlite (optional)
    """
    # 1) JSON separat
    json_path = base.with_suffix(".json")
    json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    # 2) HTML erzeugen
    json_inline = json.dumps(data).replace("</script>", "</scr\"+\"ipt>")
    html_code = textwrap.dedent(
        f"""\
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <title>FFmpeg Commands & Filters Explorer</title>
      <style>
        body{{font-family:sans-serif;margin:0;padding:1rem;background:#fafafa;}}
        h1,h2{{margin-top:1.4rem;}}
        table{{border-collapse:collapse;width:100%;font-size:.9rem;}}
        th,td{{border:1px solid #ccc;padding:4px 6px;vertical-align:top;}}
        th{{background:#eee;position:sticky;top:0;}}
        tr:nth-child(even){{background:#f6f6f6;}}
        details{{margin-top:1rem;background:#fff;border:1px solid #ddd;
                padding:.5rem;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.1);}}
        summary{{font-weight:bold;cursor:pointer;outline:none;}}
        input{{margin:.5rem 0 1rem 0;padding:6px 8px;width:100%;
              border:1px solid #bbb;border-radius:4px;}}
      </style>
    </head>
    <body>
      <h1>FFmpeg Commands &amp; Filters Explorer</h1>
      <input id="s" placeholder="Suche …">
      <table id="t"><thead><tr>
        <th>Befehl</th><th>Argumente</th><th>Beschreibung</th><th>Kategorie</th>
      </tr></thead><tbody></tbody></table>
      <h2>AVOptions‑Blöcke</h2><div id="f"></div>

      <!-- Datenblock -->
        <script id="ffdata" type="application/json">{html.escape(json_inline, quote=False)}</script>

      <script>
        const data = JSON.parse(document.getElementById('ffdata').textContent);
        const tbody = document.querySelector('#t tbody');

        // Tabelle füllen
        data.commands.forEach(c => {{
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${{c.command}}</td><td>${{c.args || ''}}</td>
                          <td>${{c.description || ''}}</td><td>${{c.category || ''}}</td>`;
          tbody.appendChild(tr);
        }});

        // Suchfeld
        document.getElementById('s').addEventListener('input', e => {{
          const q = e.target.value.toLowerCase();
          [...tbody.rows].forEach(r =>
            r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none');
        }});

        // AVOptions‑Blöcke
        const fd = document.getElementById('f');
        data.filters.forEach(f => {{
          const d = document.createElement('details');
          d.innerHTML = `<summary>${{f.filter}} (${{f.category || 'AVOptions'}})</summary>`;
          const t = document.createElement('table');
          t.innerHTML = '<thead><tr><th>Name</th><th>Typ</th><th>Flags</th>\
                         <th>Beschreibung</th><th>Choices</th></tr></thead>';
          const tb = document.createElement('tbody');
          f.options.forEach(o => {{
            const ch = o.choices.map(x => x.choice + (x.value!=null?`=${{x.value}}`:'')).join(', ');
            const r = document.createElement('tr');
            r.innerHTML = `<td>${{o.name}}</td><td>${{o.type}}</td><td>${{o.flags || ''}}</td>\
                           <td>${{o.description || ''}}</td><td>${{ch}}</td>`;
            tb.appendChild(r);
          }});
          t.appendChild(tb);
          d.appendChild(t);
          fd.appendChild(d);
        }});
      </script>
    </body>
    </html>
    """
    )

    html_path = base.with_suffix(".html")
    html_path.write_text(html_code, encoding="utf-8")

    # 3) SQLite optional
    if sqlite_flag:
        write_sqlite(data, base.with_suffix(".sqlite"))

    # Log
    print("✓ HTML  :", html_path)
    print("✓ JSON  :", json_path)
    if sqlite_flag:
        print("✓ SQLite:", base.with_suffix('.sqlite'))


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("infile", type=pathlib.Path, help="full_ffmpeg.txt")
    ap.add_argument(
        "-o",
        "--out",
        default="ffmpeg_full",
        help="Basisname der Ausgabedateien (ohne Endung)",
    )
    ap.add_argument(
        "--sqlite", action="store_true", help="zusätzlich SQLite‑DB schreiben"
    )
    ns = ap.parse_args()

    commands, filters = parse_ffmpeg(ns.infile)
    write_files({"commands": commands, "filters": filters},
                pathlib.Path(ns.out),
                sqlite_flag=ns.sqlite)


if __name__ == "__main__":
    main()
