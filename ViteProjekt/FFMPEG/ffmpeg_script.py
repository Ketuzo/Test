#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parse FFmpeg-Hilfedatei → SQLite + JSON (für VueFlow).
Erkennt AVOptions-Blöcke, Filterketten und Unteroptionen.
"""

import re
import json
import sqlite3
from dataclasses import dataclass
from typing import List, Dict, Optional

# ------------------------------------------------------------
# Datenklassen für strukturierte Speicherung
# ------------------------------------------------------------
@dataclass
class SubOption:
    name: str
    id: Optional[int]
    flags: str
    description: str

@dataclass
class Command:
    option: str
    argument: str
    flags: str
    default_value: Optional[str]
    description: str
    group: Optional[str]
    suboptions: List[SubOption] = None

@dataclass
class Filter:
    name: str
    description: str
    parameters: List[Dict] = None

@dataclass
class AVOptionBlock:
    title: str
    options: List[Command]

# ------------------------------------------------------------
# Parser
# ------------------------------------------------------------
def parse_ffmpeg_commands(text: str):
    commands = []
    av_blocks = []
    filters = []
    current_block = None
    current_command = None
    current_indent = 0
    current_group = None
    in_av_block = False
    in_filter = False

    # Verbesserte Regex für komplexe Strukturen
    flag_re = re.compile(r'([A-Z\.]{3,11})')
    sub_re = re.compile(
        r'^\s+(?P<name>\S+)'                         # Bezeichner
        r'(?:\s+(?P<id>-?\d+))?'                     # optionale ID
        r'\s+(?P<flags>[A-Z\.]{3,11})'               # Flags
        r'(?:\s+(?P<desc>.*))?$',                    # Beschreibung
    )
    
    av_block_re = re.compile(r'^([\w\s]+) AVOptions:$')
    filter_re = re.compile(r'^-vf\s+filter_graph\s+set video filters$')

    lines = text.splitlines()
    for line in lines:
        if not line.strip():
            continue

        stripped = line.rstrip()
        indent_len = len(line) - len(line.lstrip(' '))

        # AVOptions-Block erkennen (z.B. "AVCodecContext AVOptions:")
        av_match = av_block_re.match(stripped)
        if av_match:
            in_av_block = True
            current_block = AVOptionBlock(title=av_match.group(1), options=[])
            av_blocks.append(current_block)
            current_group = f"AVOptions: {current_block.title}"
            continue

        # Filter erkennen (z.B. "-vf filter_graph  set video filters")
        if filter_re.search(line):
            in_filter = True
            current_group = "Video Filters"
            continue

        # Ende eines AVOptions-Blocks
        if in_av_block and not line.startswith(' '):
            in_av_block = False

        # ---------- Gruppenüberschrift ----------
        if stripped.endswith(':') and not stripped.startswith('-') and not in_av_block:
            current_group = stripped[:-1]
            in_filter = False
            continue

        # ---------- Sub-Option (Enum / Mapping) ----------
        if current_command and indent_len > current_indent:
            m = sub_re.match(line)
            if m:
                gd = m.groupdict()
                suboption = SubOption(
                    name=gd['name'],
                    id=int(gd['id']) if gd['id'] else None,
                    flags=gd['flags'],
                    description=gd['desc'] or '',
                )
                
                if in_av_block and current_block:
                    current_block.options[-1].suboptions.append(suboption)
                elif current_command:
                    current_command.suboptions.append(suboption)
                continue

        # ---------- Kommando / AVOption-Zeile ----------
        if stripped.startswith('-') or flag_re.search(line):
            # Vorherigen Befehl abschließen
            if current_command:
                if in_av_block and current_block:
                    current_block.options.append(current_command)
                else:
                    commands.append(current_command)
            
            # Neues Kommando erstellen
            current_command = Command(
                option='',
                argument='',
                flags='',
                default_value=None,
                description='',
                group=current_group,
                suboptions=[]
            )
            current_indent = indent_len

            # Zeile zerlegen
            opt_part, right_desc, flags_str = _split_command_line(line, flag_re)
            _fill_command_dict(current_command, opt_part, right_desc, flags_str)
            continue

        # ---------- Mehrzeilige Beschreibung ----------
        if current_command:
            current_command.description += ' ' + stripped

    # Letzten Befehl verarbeiten
    if current_command:
        if in_av_block and current_block:
            current_block.options.append(current_command)
        else:
            commands.append(current_command)

    return commands, av_blocks

# ------------------------------------------------------------
# Hilfsfunktionen (unverändert)
# ------------------------------------------------------------
def _split_command_line(line: str, flag_re):
    """Teilt eine Zeile in Option-Teil, Flags, Beschreibung."""
    m = flag_re.search(line)
    if m:
        flags_str = m.group(1)
        opt_part = line[:m.start()]
        right_desc = line[m.end():].strip()
    else:
        flags_str = ''
        opt_part = line
        right_desc = ''
    return opt_part, right_desc, flags_str

def _fill_command_dict(cmd: Command, opt_part: str, right_desc: str, flags_str: str):
    """Befüllt Command-Objekt mit zerlegten Segmenten."""
    split = list(re.finditer(r'\s{2,}', opt_part))
    if split:
        left_part = opt_part[:split[-1].start()]
        right_part = opt_part[split[-1].end():].strip()
        right_desc = f"{right_part} {right_desc}".strip() if right_desc else right_part
    else:
        left_part = opt_part

    tokens = left_part.strip().split()
    if not tokens:
        return
    
    cmd.option = tokens[0]
    cmd.argument = tokens[1] if len(tokens) >= 2 else ''
    left_desc = '' if len(tokens) <= 2 else ' '.join(tokens[2:])
    desc_text = f"{left_desc} {right_desc}".strip()

    # Default-Wert extrahieren
    m_def = re.search(r'\(default\s+(.+?)\)$', desc_text)
    if m_def:
        cmd.default_value = m_def.group(1)
        desc_text = desc_text[:m_def.start()].strip()

    cmd.flags = flags_str
    cmd.description = desc_text

# ------------------------------------------------------------
# Datenbankerstellung
# ------------------------------------------------------------
def create_database(commands, av_blocks):
    conn = sqlite3.connect('ffmpeg.db')
    c = conn.cursor()

    # Tabellen erstellen
    c.execute('DROP TABLE IF EXISTS commands')
    c.execute('DROP TABLE IF EXISTS suboptions')
    c.execute('DROP TABLE IF EXISTS av_blocks')
    c.execute('DROP TABLE IF EXISTS av_options')

    c.execute('''CREATE TABLE commands(
                   id INTEGER PRIMARY KEY,
                   option TEXT,
                   argument TEXT,
                   flags TEXT,
                   default_value TEXT,
                   description TEXT,
                   group_name TEXT)''')

    c.execute('''CREATE TABLE suboptions(
                   id INTEGER PRIMARY KEY,
                   cmd_id INTEGER,
                   name TEXT,
                   sub_id INTEGER,
                   flags TEXT,
                   description TEXT,
                   FOREIGN KEY (cmd_id) REFERENCES commands(id))''')

    c.execute('''CREATE TABLE av_blocks(
                   id INTEGER PRIMARY KEY,
                   title TEXT)''')

    c.execute('''CREATE TABLE av_options(
                   id INTEGER PRIMARY KEY,
                   block_id INTEGER,
                   option TEXT,
                   argument TEXT,
                   flags TEXT,
                   default_value TEXT,
                   description TEXT,
                   FOREIGN KEY (block_id) REFERENCES av_blocks(id))''')

    # Kommandos speichern
    for cmd in commands:
        c.execute('''INSERT INTO commands
                     (option, argument, flags, default_value, description, group_name)
                     VALUES (?,?,?,?,?,?)''',
                  (cmd.option, cmd.argument, cmd.flags, 
                   cmd.default_value, cmd.description, cmd.group))
        cmd_id = c.lastrowid
        
        for sub in cmd.suboptions:
            c.execute('''INSERT INTO suboptions
                         (cmd_id, name, sub_id, flags, description)
                         VALUES (?,?,?,?,?)''',
                      (cmd_id, sub.name, sub.id, sub.flags, sub.description))

    # AVOptions-Blöcke speichern
    for block in av_blocks:
        c.execute('INSERT INTO av_blocks (title) VALUES (?)', (block.title,))
        block_id = c.lastrowid
        
        for opt in block.options:
            c.execute('''INSERT INTO av_options
                         (block_id, option, argument, flags, default_value, description)
                         VALUES (?,?,?,?,?,?)''',
                      (block_id, opt.option, opt.argument, opt.flags,
                       opt.default_value, opt.description))
            
            # Suboptions für AVOptions
            # (Hier müsste eine zusätzliche Tabelle für AVOption-Suboptions erstellt werden)
    
    conn.commit()
    conn.close()

# ------------------------------------------------------------
# VueFlow JSON Generator
# ------------------------------------------------------------
def generate_vueflow_data(commands, av_blocks):
    nodes = []
    links = []
    node_id = 1
    
    # Basis-Knoten erstellen
    base_node = {
        'id': str(node_id),
        'type': 'ffmpegBase',
        'position': { 'x': 100, 'y': 100 },
        'data': { 'label': 'FFmpeg Start' }
    }
    nodes.append(base_node)
    base_id = node_id
    node_id += 1
    
    # Optionen als Knoten hinzufügen
    for cmd in commands:
        node = {
            'id': str(node_id),
            'type': 'ffmpegOption',
            'position': { 'x': 300, 'y': 100 + (node_id * 100) },
            'data': {
                'label': cmd.option,
                'argument': cmd.argument,
                'description': cmd.description,
                'default': cmd.default_value
            }
        }
        nodes.append(node)
        
        # Verbindung zur Basis
        links.append({
            'id': f'link-{base_id}-{node_id}',
            'source': str(base_id),
            'target': str(node_id)
        })
        node_id += 1
    
    # AVOptions als Gruppen hinzufügen
    for block in av_blocks:
        group_node = {
            'id': str(node_id),
            'type': 'avOptionGroup',
            'position': { 'x': 600, 'y': 100 + (node_id * 100) },
            'data': { 'label': block.title },
            'style': { 'width': 400, 'height': 200 + (20 * len(block.options)) }
        }
        nodes.append(group_node)
        group_id = node_id
        node_id += 1
        
        # Optionen innerhalb der Gruppe
        for opt in block.options:
            opt_node = {
                'id': str(node_id),
                'type': 'avOption',
                'position': { 'x': 20, 'y': 30 + (node_id * 30) },
                'parentNode': str(group_id),
                'data': {
                    'label': opt.option,
                    'argument': opt.argument,
                    'description': opt.description
                }
            }
            nodes.append(opt_node)
            node_id += 1
    
    return { 'nodes': nodes, 'edges': links }

# ------------------------------------------------------------
# Main
# ------------------------------------------------------------
if __name__ == '__main__':
    with open('full_ffmpeg.txt', 'r', encoding='utf-8') as f:
        content = f.read()

    commands, av_blocks = parse_ffmpeg_commands(content)
    create_database(commands, av_blocks)
    
    # VueFlow-Daten generieren
    vueflow_data = generate_vueflow_data(commands, av_blocks)
    with open('ffmpeg_vueflow.json', 'w', encoding='utf-8') as f:
        json.dump(vueflow_data, f, indent=2)

    print("Erfolgreich erstellt:")
    print(" - ffmpeg.db          (SQLite-Datenbank)")
    print(" - ffmpeg_vueflow.json (VueFlow-Konfiguration)")