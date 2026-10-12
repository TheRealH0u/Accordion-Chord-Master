import json
import os
from functools import wraps

from flask import Flask, jsonify, redirect, render_template, request, session, send_from_directory, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-this-secret")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL",
    "sqlite:///accordion_chord_master.db",
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class User(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(db.String(32), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(db.String(255), nullable=False)
    sequences: Mapped[list["Sequence"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )


class Sequence(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(db.String(100), nullable=False)
    state_json: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"), nullable=False)
    owner: Mapped[User] = relationship(back_populates="sequences")
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_sequence_user_name"),)


with app.app_context():
    db.create_all()

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
    'Fis': 'D#m', 'Cis': 'A#m', 'Gis': 'Fm', 'Dis': 'Bm', 'As': 'Fm',
    'Es': 'Cm', 'B': 'Gm', 'F': 'Dm', 'Des': 'Bm', 'Ges': 'Ebm', 'Ais': 'Gm'
}


def current_user():
    user_id = session.get("user_id")
    return db.session.get(User, user_id) if user_id else None


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if current_user() is None:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Za to dejanje se moraš prijaviti."}), 401
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapped


@app.context_processor
def inject_user():
    return {"user": current_user()}

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/chords', methods=['GET', 'POST'])
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

@app.route('/sequence-test')
def sequence_test():
    return render_template('sequence_test.html', uglasitve=UGLASITVE)


@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user():
        return redirect(url_for("home"))
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        if len(username) < 3 or len(username) > 32:
            error = "Uporabniško ime mora imeti od 3 do 32 znakov."
        elif len(password) < 8:
            error = "Geslo mora imeti vsaj 8 znakov."
        elif User.query.filter_by(username=username).first():
            error = "To uporabniško ime je že zasedeno."
        else:
            user = User(username=username, password_hash=generate_password_hash(password))
            db.session.add(user)
            db.session.commit()
            session["user_id"] = user.id
            return redirect(url_for("home"))
    return render_template("register.html", error=error)


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user():
        return redirect(url_for("home"))
    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = User.query.filter_by(username=username).first()
        if user is None or not check_password_hash(user.password_hash, password):
            error = "Napačno uporabniško ime ali geslo."
        else:
            session["user_id"] = user.id
            return redirect(request.args.get("next") or url_for("home"))
    return render_template("login.html", error=error)


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))


def parse_sequence_state(raw_state):
    if not isinstance(raw_state, dict):
        raise ValueError("Neveljavno stanje sekvence.")
    if raw_state.get("version") not in (1, 2):
        raise ValueError("Nepodprta različica sekvence.")
    if raw_state.get("tuning") not in UGLASITVE:
        raise ValueError("Neveljavna uglasitev.")
    if raw_state.get("timeSignature") not in ("3/4", "4/4"):
        raise ValueError("Neveljaven takt.")
    if not isinstance(raw_state.get("notes"), list):
        raise ValueError("Neveljavni toni sekvence.")
    return raw_state


@app.get("/api/sequences")
@login_required
def list_sequences():
    rows = Sequence.query.filter_by(user_id=current_user().id).order_by(Sequence.name.asc()).all()
    return jsonify({"sequences": [{"id": row.id, "name": row.name} for row in rows]})


@app.post("/api/sequences")
@login_required
def save_sequence():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    if not name or len(name) > 100:
        return jsonify({"error": "Ime sekvence mora imeti od 1 do 100 znakov."}), 400
    try:
        state = parse_sequence_state(payload.get("state"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    owner = current_user()
    sequence = Sequence.query.filter_by(user_id=owner.id, name=name).first()
    if sequence is None:
        sequence = Sequence(name=name, user_id=owner.id, state_json=json.dumps(state))
        db.session.add(sequence)
    else:
        sequence.state_json = json.dumps(state)
    db.session.commit()
    return jsonify({"id": sequence.id, "name": sequence.name})


@app.get("/api/sequences/<int:sequence_id>")
@login_required
def load_sequence(sequence_id):
    sequence = db.session.get(Sequence, sequence_id)
    if sequence is None or sequence.user_id != current_user().id:
        return jsonify({"error": "Sekvenca ne obstaja."}), 404
    return jsonify({"id": sequence.id, "name": sequence.name, "state": json.loads(sequence.state_json)})


@app.delete("/api/sequences/<int:sequence_id>")
@login_required
def delete_sequence(sequence_id):
    sequence = db.session.get(Sequence, sequence_id)
    if sequence is None or sequence.user_id != current_user().id:
        return jsonify({"error": "Sekvenca ne obstaja."}), 404
    db.session.delete(sequence)
    db.session.commit()
    return jsonify({"ok": True})

# ! LOCAL RUN ONLY
if __name__ == '__main__':
    app.run(debug=True, port=5000)