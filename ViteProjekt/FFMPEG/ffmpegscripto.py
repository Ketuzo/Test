#!/usr/bin/env python3
"""
Parse 'full_ffmpeg.txt' (Ausgabe von 'ffmpeg -h full') und erzeuge:
  * ffmpeg_full_commands_and_filters.json       (--outfile / -o)
  * ffmpeg_full_commands_and_filters.sqlite     (--sqlite)
  * ffmpeg_viewer.html                          (--html / -H)

Benötigt nur Python‑Standardbibliothek.
"""

import re, json, argparse, pathlib, sqlite3, textwrap

FLAG_RE = re.compile(r"[.A-Z]{11}")        # z. B. '..FV.....T.'


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #
def parse_ffmpeg(txt_path: pathlib.Path):
    """Liest full_ffmpeg.txt → (commands_list, filters_list)"""
    commands, filters = [], {}
    state = None                 # None | "avoptions"
    curr_cat = None
    curr_filter = curr_opts = curr_opt = None

    with txt_path.open(encoding="utf-8", errors="ignore") as fh:
        lines = fh.readlines()

    i = 0
    while i < len(lines):
        raw = lines[i].rstrip("\n")
        if not raw.strip():
            i += 1
            continue

        # -------------------- AVOPTIONS‑Block ------------------------------ #
        if state == "avoptions":
            if not raw.startswith((" ", "\t")):            # Block endet
                filters[curr_filter] = {
                    "filter": curr_filter,
                    "category": curr_cat,
                    "options": curr_opts,
                }
                state = curr_filter = curr_opts = curr_opt = None
                continue

            # Neue Optionzeile (enthält <type>)
            if "<" in raw and ">" in raw:
                parts = re.split(r"\s{2,}", raw.strip(), maxsplit=2)
                name, typepart, rest = (parts + [""] * 3)[:3]
                typepart = typepart.strip("<>")
                flags = rest[:11] if FLAG_RE.fullmatch(rest[:11]) else None
                desc = rest[11:].strip() if flags else rest.strip()
                curr_opt = {
                    "name": name,
                    "type": typepart,
                    "flags": flags,
                    "description": desc,
                    "choices": [],
                }
                curr_opts.append(curr_opt)
            # Choice‑Zeile (keine <type>)
            else:
                tokens = re.split(r"\s{2,}", raw.strip())
                if not tokens:
                    i += 1
                    continue
                choice_name = tokens[0]
                flags = tokens.pop() if (len(tokens[-1]) == 11
                                         and FLAG_RE.fullmatch(tokens[-1])) else None
                value = tokens[1] if len(tokens) > 1 else None
                desc = " ".join(tokens[2:]) if len(tokens) > 2 else ""
                curr_opt["choices"].append({
                    "choice": choice_name,
                    "value": value,
                    "flags": flags,
                    "description": desc
                })
            i += 1
            continue
        # ------------------------------------------------------------------- #

        # Neuer AVOptions‑Header?
        m = re.match(r"\s*([^\s].*?)\s+AVOptions:", raw)
        if m:
            curr_filter = m.group(1).strip()
            state, curr_opts = "avoptions", []
            i += 1
            continue

        # Kapitel‑Header
        if not raw.startswith("-") and raw.strip().endswith(":"):
            curr_cat = raw.strip()[:-1]
            i += 1
            continue

        # Normale -Option
        if raw.lstrip().startswith("-"):
            parts = re.split(r"\s{2,}", raw.strip(), maxsplit=2)
            flag_args = parts[0].split()
            flag, args = flag_args[0], " ".join(flag_args[1:])
            maybe_type = maybe_rest = ""
            if len(parts) == 2:
                maybe_rest = parts[1]
            elif len(parts) == 3:
                maybe_type, maybe_rest = parts[1], parts[2]
            typepart = maybe_type.strip("<>") if maybe_type.startswith("<") else None
            rest = maybe_rest if typepart else f"{maybe_type} {maybe_rest}".strip()
            flags = rest[:11] if FLAG_RE.fullmatch(rest[:11]) else None
            desc = rest[11:].strip() if flags else rest.strip()
            commands.append({
                "command": flag,
                "args": args,
                "type": typepart,
                "flags": flags,
                "description": desc,
                "category": curr_cat
            })
        i += 1

    # Offenen AVOptions‑Block flushen
    if state == "avoptions":
        filters[curr_filter] = {
            "filter": curr_filter,
            "category": curr_cat,
            "options": curr_opts
        }
    return commands, list(filters.values())


# --------------------------------------------------------------------------- #
# Writer‑Utilities
# --------------------------------------------------------------------------- #
def write_json(data, out_path: pathlib.Path):
    with out_path.open("w", encoding="utf-8") as fp:
        json.dump(data, fp, indent=2)


def write_sqlite(data, out_path: pathlib.Path):
    con = sqlite3.connect(out_path)
    cur = con.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS commands(
                      id INTEGER PRIMARY KEY,
                      command TEXT, args TEXT, type TEXT, flags TEXT,
                      description TEXT, category TEXT)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS filters(
                      id INTEGER PRIMARY KEY,
                      filter TEXT, category TEXT)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS options(
                      id INTEGER PRIMARY KEY,
                      filter_id INTEGER,
                      name TEXT, type TEXT, flags TEXT, description TEXT,
                      FOREIGN KEY(filter_id) REFERENCES filters(id))""")
    cur.execute("""CREATE TABLE IF NOT EXISTS choices(
                      id INTEGER PRIMARY KEY,
                      option_id INTEGER,
                      choice TEXT, value TEXT, flags TEXT, description TEXT,
                      FOREIGN KEY(option_id) REFERENCES options(id))""")

    # Insert commands
    cur.executemany("""INSERT INTO commands(command,args,type,flags,description,category)
                       VALUES (?,?,?,?,?,?)""",
                    [(c["command"], c["args"], c["type"], c["flags"],
                      c["description"], c["category"]) for c in data["commands"]])

    # Insert filters + options + choices
    for flt in data["filters"]:
        cur.execute("INSERT INTO filters(filter,category) VALUES (?,?)",
                    (flt["filter"], flt["category"]))
        filter_id = cur.lastrowid
        for opt in flt["options"]:
            cur.execute("""INSERT INTO options(filter_id,name,type,flags,description)
                           VALUES (?,?,?,?,?)""",
                        (filter_id, opt["name"], opt["type"], opt["flags"],
                         opt["description"]))
            option_id = cur.lastrowid
            for ch in opt["choices"]:
                cur.execute("""INSERT INTO choices(option_id,choice,value,flags,description)
                               VALUES (?,?,?,?,?)""",
                            (option_id, ch["choice"], ch["value"], ch["flags"],
                             ch["description"]))
    con.commit()
    con.close()


HTML_TEMPLATE = textwrap.dedent("""\
    <!DOCTYPE html>
    <html lang="de">
    <head>
    <meta charset="utf-8">
    <title>FFmpeg Commands &amp; Filters Explorer</title>
    <style>
    body{font-family:sans-serif;margin:0;padding:1rem;background:#fafafa;}
    h1,h2{margin-top:1.4rem;}
    table{border-collapse:collapse;width:100%;font-size:0.9rem;}
    th,td{border:1px solid #ccc;padding:4px 6px;vertical-align:top;}
    th{background:#eee;position:sticky;top:0;}
    details{margin-top:1rem;background:#fff;border:1px solid #ddd;
            padding:0.5rem;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.1);}
    summary{font-weight:bold;cursor:pointer;outline:none;}
    input{margin:0.5rem 0 1rem 0;padding:6px 8px;width:100%;
          border:1px solid #bbb;border-radius:4px;}
    tr:nth-child(even){background:#f6f6f6;}
    </style>
    </head>
    <body>
    <h1>FFmpeg Commands &amp; Filters Explorer</h1>
    <p>Tippe in das Suchfeld, um die Befehlsliste zu filtern. Die AVOptions‑Blöcke lassen sich auf‑ und zuklappen.</p>
    <input id="search" placeholder="Suche …">
    <table id="cmdTable"><thead><tr>
      <th>Befehl</th><th>Argumente</th><th>Beschreibung</th><th>Kategorie</th>
    </tr></thead><tbody></tbody></table>

    <h2>AVOptions‑Blöcke (Filter, Encoder, Demuxer …)</h2>
    <div id="filterContainer"></div>

    <script>
    async function loadData(){
      const data = await fetch('%JSONFILE%').then(r => r.json());
      const {{commands, filters}} = data;

      const tbody = document.querySelector('#cmdTable tbody');
      commands.forEach(c => {{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${{c.command}}</td>
          <td>${{c.args || ''}}</td>
          <td>${{c.description || ''}}</td>
          <td>${{c.category || ''}}</td>`;
        tbody.appendChild(tr);
      }});

      document.getElementById('search').addEventListener('input', e => {{
        const q = e.target.value.toLowerCase();
        tbody.querySelectorAll('tr').forEach(tr => {{
          tr.style.display = tr.textContent.toLowerCase().includes(q)?'':'none';
        }});
      }});

      const container = document.getElementById('filterContainer');
      filters.forEach(f => {{
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = `${{f.filter}} (${{f.category || 'AVOptions'}})`;
        details.appendChild(summary);

        const table = document.createElement('table');
        table.innerHTML = `<thead><tr>
          <th>Name</th><th>Typ</th><th>Flags</th><th>Beschreibung</th><th>Choices</th>
        </tr></thead>`;
        const tb = document.createElement('tbody');
        f.options.forEach(o => {{
          const choices = o.choices.length
              ? o.choices.map(ch => ch.choice + (ch.value!==null&&ch.value!==undefined?`=${{ch.value}}`:'')).join(', ')
              : '';
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${{o.name}}</td><td>${{o.type}}</td><td>${{o.flags || ''}}</td>
            <td>${{o.description || ''}}</td><td>${{choices}}</td>`;
          tb.appendChild(row);
        }});
        table.appendChild(tb);
        table.style.marginTop = '0.5rem';
        details.appendChild(table);
        container.appendChild(details);
      }});
    }}
    loadData();
    </script>
    </body></html>
    """)


def write_html(json_filename: str, out_path: pathlib.Path):
    html_code = HTML_TEMPLATE.replace("%JSONFILE%", json_filename)
    with out_path.open("w", encoding="utf-8") as fp:
        fp.write(html_code)


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("infile", type=pathlib.Path,
                    help="full_ffmpeg.txt (von 'ffmpeg -h full')")
    ap.add_argument("-o", "--outfile", default="ffmpeg_full_commands_and_filters.json",
                    help="Name der auszugebenden JSON‑Datei")
    ap.add_argument("--sqlite", action="store_true",
                    help="zusätzlich SQLite‑DB schreiben")
    ap.add_argument("-H", "--html", action="store_true",
                    help="zusätzlich ffmpeg_viewer.html schreiben")
    ns = ap.parse_args()

    cmds, flts = parse_ffmpeg(ns.infile)
    data = {"commands": cmds, "filters": flts}

    out_json = pathlib.Path(ns.outfile)
    write_json(data, out_json)

    if ns.sqlite:
        write_sqlite(data, out_json.with_suffix(".sqlite"))

    if ns.html:
        write_html(out_json.name, out_json.with_suffix(".html"))

    print(f"Fertig: {len(cmds)} commands, {len(flts)} AVOption‑Blöcke")


if __name__ == "__main__":
    main()
