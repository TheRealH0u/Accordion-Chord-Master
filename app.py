from flask import Flask, render_template, request, send_from_directory

app = Flask(__name__)

UGLASITVE = [
    "Gis-Cis-Fis", "A-D-G", "B-Es-As", "H-E-A", 
    "C-F-B", "Cis-Fis-H", "D-G-C"
]

RELATIONS = {
    'C': ('G', 'F'), 'F': ('C', 'B'), 'B': ('F', 'Es'),
    'Es': ('B', 'As'), 'As': ('Es', 'Des'), 'Des': ('As', 'Ges'),
    'G': ('D', 'C'), 'D': ('A', 'G'), 'A': ('E', 'D'),
    'E': ('H', 'A'), 'H': ('Fis', 'E'), 'Fis': ('Cis', 'H'),
    'Cis': ('Gis', 'Fis'), 'Gis': ('Dis', 'Cis'), 'Dis': ('Ais', 'Gis'),
    'Ais': ('F', 'Dis')
}

RELATIVE_MINORS = {
    'C': 'Am', 'G': 'Em', 'D': 'Hm', 'A': 'F#m', 'E': 'C#m', 'H': 'G#m',
    'Fis': 'D#m', 'Cis': 'A#m', 'Gis': 'Fm', 'Dis': 'Bbm', 'As': 'Fm',
    'Es': 'Cm', 'B': 'Gm', 'F': 'Dm', 'Des': 'Bbm', 'Ges': 'Ebm', 'Ais': 'Gm'
}

@app.route('/', methods=['GET', 'POST'])
def index():
    selected_uglasitev = request.form.get('uglasitev', 'C-F-B')
    vrste_keys = selected_uglasitev.split('-')
    
    # Definiramo tipke za tipkovnico po vrstah (Dur tipke, Mol tipke)
    kb_layout = [
        (['q', 'w', 'e'], ['r', 't', 'z']),
        (['a', 's', 'd'], ['f', 'g', 'h']),
        (['y', 'x', 'c'], ['v', 'b', 'n'])
    ]
    
    rows = []
    for i, key in enumerate(vrste_keys):
        dom, sub = RELATIONS.get(key, ('?', '?'))
        major_keys, minor_keys = kb_layout[i]
        
        rows.append({
            'label': key,
            'major': [
                {'name': key, 'role': 'Tonika', 'kb': major_keys[0]},
                {'name': dom, 'role': 'Dominanta', 'kb': major_keys[1]},
                {'name': sub, 'role': 'Subdominanta', 'kb': major_keys[2]}
            ],
            'minor': [
                {'name': RELATIVE_MINORS.get(key, '?'), 'role': 'm-Tonika', 'kb': minor_keys[0]},
                {'name': RELATIVE_MINORS.get(dom, '?'), 'role': 'm-Dominanta', 'kb': minor_keys[1]},
                {'name': RELATIVE_MINORS.get(sub, '?'), 'role': 'm-Subdominanta', 'kb': minor_keys[2]}
            ]
        })
        
    return render_template('index.html', uglasitve=UGLASITVE, rows=rows, selected=selected_uglasitev)

@app.route('/manifest.json')
def serve_manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/sw.js')
def serve_sw():
    return send_from_directory('static', 'sw.js', mimetype='application/javascript')
