import subprocess
import re
import os
import datetime
import html as html_escape  # Umbenennung des Moduls
import time

def run_command(cmd, timeout=10):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True, 
                               encoding='utf-8', errors='ignore', timeout=timeout)
        return result.stdout
    except subprocess.TimeoutExpired:
        print(f"Timeout bei Befehl: {' '.join(cmd)}")
        return ""
    except Exception as e:
        print(f"Fehler beim Ausführen von {' '.join(cmd)}: {str(e)}")
        return ""

def parse_global_options():
    output = run_command(['ffmpeg', '-h', 'full'])
    options = []
    
    for line in output.split('\n'):
        line = line.strip()
        
        if line.endswith(':'):
            continue
            
        if line.startswith('-'):
            # Verbessertes Parsing für verschiedene Formatierungen
            if "  " in line:
                parts = re.split(r'\s{2,}', line, maxsplit=2)
                option = parts[0].strip()
                params = parts[1].strip() if len(parts) > 1 else ""
                desc = parts[2].strip() if len(parts) > 2 else ""
            else:
                parts = line.split(maxsplit=2)
                option = parts[0]
                params = parts[1] if len(parts) > 1 else ""
                desc = parts[2] if len(parts) > 2 else ""
            
            param_type = "string"
            if '<int>' in params:
                param_type = "integer"
            elif '<float>' in params:
                param_type = "float"
            elif '<bool>' in params:
                param_type = "boolean"
                
            options.append({
                "option": option,
                "params": params,
                "type": param_type,
                "description": desc
            })
    
    return options

def parse_filters():
    output = run_command(['ffmpeg', '-filters'])
    filters = {}
    
    current_filter = None
    
    for line in output.split('\n'):
        # Filterzeilen erkennen (flexiblere Erkennung)
        if re.match(r'^[ T.S.CVA]{3,}', line):
            parts = re.split(r'\s+', line.strip(), maxsplit=3)  # maxsplit als Keyword-Argument
            if len(parts) < 4:
                continue
                
            flags = parts[0]
            name = parts[1]
            
            # Korrekte Kategorieerkennung
            category = "video" if 'V' in flags else "audio" if 'A' in flags else "other"
            desc = parts[3]
            
            filters[name] = {
                "description": desc,
                "options": [],
                "category": category
            }
            current_filter = name
            continue
        
        # Optionen für Filter erkennen
        if current_filter and line.strip().startswith('-'):
            # Robustes Parsing für Filteroptionen
            match = re.search(
                r'(\w+)\s*:\s*<([^>]+)>\s+\(([^)]+)\)\s+(.*)$', 
                line.strip()
            )
            if match:
                opt_name = match.group(1)
                opt_type = match.group(2)
                default_val = match.group(3)
                desc = match.group(4)
                
                filters[current_filter]["options"].append({
                    "name": opt_name,
                    "type": opt_type,
                    "default": default_val,
                    "description": desc
                })
    
    return filters

def get_ffmpeg_version():
    output = run_command(['ffmpeg', '-version'], timeout=5)
    if output:
        first_line = output.split('\n')[0]
        version_match = re.search(r'ffmpeg version (\S+)', first_line)
        if version_match:
            return version_match.group(1)
    return "Unbekannt"

def create_html(global_options, filters):
    current_date = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    ffmpeg_version = get_ffmpeg_version()
    
    # HTML-Template als String
    html_template = f"""<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FFmpeg Kommandoreferenz</title>
    <style>
        :root {{
            --primary: #2563eb;
            --secondary: #1e40af;
            --video: #7e22ce;
            --audio: #0d9488;
            --other: #ea580c;
        }}
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', system-ui, sans-serif;
        }}
        
        body {{
            background-color: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }}
        
        header {{
            background: linear-gradient(135deg, var(--secondary), #1a202c);
            color: white;
            padding: 2.5rem 1rem;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem 3rem;
        }}
        
        .tabs {{
            display: flex;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }}
        
        .tab-btn {{
            flex: 1;
            padding: 1.2rem 1rem;
            text-align: center;
            background: white;
            border: none;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            color: var(--dark);
            min-width: 150px;
        }}
        
        .tab-btn:hover {{
            background: #f1f5f9;
        }}
        
        .tab-btn.active {{
            background: var(--primary);
            color: white;
        }}
        
        .tab-content {{
            display: none;
            background: white;
            border-radius: 10px;
            padding: 2rem;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
            margin-top: -1px;
        }}
        
        .tab-content.active {{
            display: block;
        }}
        
        .section-title {{
            font-size: 1.8rem;
            color: var(--secondary);
            margin-bottom: 1.8rem;
            padding-bottom: 0.8rem;
            border-bottom: 2px solid #e2e8f0;
        }}
        
        .grid {{
            display: grid;
            gap: 1.8rem;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        }}
        
        .card {{
            background: white;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            height: 100%;
            display: flex;
            flex-direction: column;
        }}
        
        .card-header {{
            padding: 1.4rem;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }}
        
        .filter-name {{
            font-family: 'Courier New', monospace;
            font-weight: 700;
            font-size: 1.3rem;
            color: var(--dark);
            margin-bottom: 0.5rem;
        }}
        
        .meta-info {{
            display: flex;
            flex-wrap: wrap;
            gap: 0.8rem;
        }}
        
        .meta-item {{
            display: inline-flex;
            align-items: center;
            padding: 0.35rem 0.8rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
        }}
        
        .category-video {{
            background: #ede9fe;
            color: var(--video);
        }}
        
        .category-audio {{
            background: #dcfce7;
            color: var(--audio);
        }}
        
        .category-other {{
            background: #ffedd5;
            color: var(--other);
        }}
        
        .card-body {{
            padding: 1.4rem;
            flex-grow: 1;
        }}
        
        .description {{
            color: #475569;
            line-height: 1.7;
            margin-bottom: 1.5rem;
        }}
        
        .options-title {{
            font-size: 1.2rem;
            color: var(--dark);
            margin: 1.8rem 0 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #e2e8f0;
        }}
        
        .option-item {{
            padding: 1rem;
            background: #f8fafc;
            border-radius: 8px;
            margin-bottom: 1rem;
        }}
        
        .option-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }}
        
        .option-name {{
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--dark);
        }}
        
        .option-type {{
            font-size: 0.85rem;
            background: #dbeafe;
            color: var(--primary);
            padding: 0.25rem 0.7rem;
            border-radius: 20px;
        }}
        
        .option-default {{
            color: #166534;
            font-size: 0.9rem;
            margin: 0.3rem 0;
            font-style: italic;
        }}
        
        .option-desc {{
            color: #475569;
            line-height: 1.6;
        }}
        
        footer {{
            text-align: center;
            padding: 2.5rem 1rem;
            color: #64748b;
            font-size: 0.95rem;
            background: #f1f5f9;
            margin-top: 3rem;
        }}
        
        @media (max-width: 768px) {{
            .grid {{
                grid-template-columns: 1fr;
            }}
            
            .tabs {{
                flex-direction: column;
            }}
            
            .tab-btn {{
                width: 100%;
            }}
        }}
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>FFmpeg Kommandoreferenz</h1>
            <p style="margin-top: 0.5rem; opacity: 0.9;">Vollständige Übersicht aller Optionen und Filter</p>
        </div>
    </header>
    
    <div class="container">
        <div class="tabs">
            <button class="tab-btn active" onclick="openTab('global')">Globale Optionen</button>
            <button class="tab-btn" onclick="openTab('filters')">Filter</button>
        </div>
        
        <div id="global" class="tab-content active">
            <h2 class="section-title">Globale Optionen</h2>
            <div class="grid">
                {generate_global_options_html(global_options)}
            </div>
        </div>
        
        <div id="filters" class="tab-content">
            <h2 class="section-title">Video- und Audiofilter</h2>
            <div class="grid">
                {generate_filters_html(filters)}
            </div>
        </div>
    </div>
    
    <footer>
        <p>FFmpeg Version: {ffmpeg_version} | Generiert am {current_date}</p>
    </footer>
    
    <script>
        function openTab(tabName) {{
            document.querySelectorAll('.tab-content').forEach(tab => {{
                tab.classList.remove('active');
            }});
            document.querySelectorAll('.tab-btn').forEach(btn => {{
                btn.classList.remove('active');
            }});
            document.getElementById(tabName).classList.add('active');
            event.currentTarget.classList.add('active');
        }}
    </script>
</body>
</html>
"""

    return html_template

def generate_global_options_html(options):
    if not options:
        return '<div class="card"><div class="card-body">Keine globalen Optionen gefunden</div></div>'
    
    html_parts = []
    for opt in options:
        safe_desc = html_escape.escape(opt.get('description', ''))
        safe_params = html_escape.escape(opt.get('params', ''))
        
        html_parts.append(f"""
            <div class="card">
                <div class="card-header">
                    <div class="filter-name">{opt['option']}</div>
                </div>
                <div class="card-body">
                    <div class="description">
                        <strong>Typ:</strong> {opt.get('type', 'string')}<br>
                        <strong>Parameter:</strong> {safe_params}<br><br>
                        {safe_desc}
                    </div>
                </div>
            </div>
        """)
    
    return ''.join(html_parts)

def generate_filters_html(filters):
    if not filters:
        return '<div class="card"><div class="card-body">Keine Filter gefunden</div></div>'
    
    html_parts = []
    for name, details in filters.items():
        # Kategorie-Stil
        category_class = "category-video" if details['category'] == "video" else "category-audio"
        category_class = "category-other" if details['category'] == "other" else category_class
        
        # Optionen generieren
        options_html = []
        for opt in details.get('options', []):
            safe_desc = html_escape.escape(opt.get('description', ''))
            safe_default = html_escape.escape(opt.get('default', ''))
            
            options_html.append(f"""
                <div class="option-item">
                    <div class="option-header">
                        <div class="option-name">{opt['name']}</div>
                        <div class="option-type">{opt.get('type', 'string')}</div>
                    </div>
                    {f'<div class="option-default">Standard: {safe_default}</div>' if safe_default else ''}
                    <div class="option-desc">{safe_desc}</div>
                </div>
            """)
        
        safe_desc = html_escape.escape(details.get('description', ''))
        
        html_parts.append(f"""
            <div class="card">
                <div class="card-header">
                    <div class="filter-name">{name}</div>
                    <div class="meta-info">
                        <div class="meta-item {category_class}">{details['category']}</div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="description">{safe_desc}</div>
                    
                    {f'<div class="options-title">Optionen ({len(details["options"])})</div>' if details.get('options') else ''}
                    {''.join(options_html) if details.get('options') else '<div class="option-desc">Keine spezifischen Optionen</div>'}
                </div>
            </div>
        """)
    
    return ''.join(html_parts)

if __name__ == "__main__":
    print("Extrahiere FFmpeg-Daten...")
    
    start_time = time.time()
    
    print(" - Globale Optionen...")
    global_options = parse_global_options()
    
    print(" - Filter...")
    filters = parse_filters()
    
    print(f"Datenextraktion abgeschlossen in {time.time() - start_time:.2f} Sekunden")
    
    print("Erstelle HTML-Dokument...")
    html_content = create_html(global_options, filters)
    
    output_file = 'ffmpeg_referenz.html'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"Fertig! {output_file} wurde erstellt.")
    
    # Automatisch im Browser öffnen
    try:
        abs_path = os.path.abspath(output_file)
        os.startfile(abs_path)
    except:
        print("Öffne die Datei manuell in deinem Browser.")