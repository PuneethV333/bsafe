#!/usr/bin/env python3
"""Regenerate docs/er-diagram.png from the Prisma schema models (Phase 1).

Reproducible, offline-friendly (PIL only). Run from repo root:
    python3 docs/generate_er_diagram.py
"""

from PIL import Image, ImageDraw, ImageFont

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
FONT = {
    "title": ImageFont.truetype(f"{FONT_DIR}/DejaVuSans-Bold.ttf", 24),
    "box": ImageFont.truetype(f"{FONT_DIR}/DejaVuSans-Bold.ttf", 17),
    "field": ImageFont.truetype(f"{FONT_DIR}/DejaVuSansMono.ttf", 14),
    "badge": ImageFont.truetype(f"{FONT_DIR}/DejaVuSans-Bold.ttf", 10),
    "label": ImageFont.truetype(f"{FONT_DIR}/DejaVuSans-Bold.ttf", 14),
    "legend": ImageFont.truetype(f"{FONT_DIR}/DejaVuSansMono.ttf", 13),
}

COL = {
    "header": "#2563eb",
    "header_text": "#ffffff",
    "body": "#f8fafc",
    "border": "#94a3b8",
    "text": "#0f172a",
    "type": "#64748b",
    "pk_bg": "#ede9fe", "pk_fg": "#7c3aed",
    "uq_bg": "#fef3c7", "uq_fg": "#b45309",
    "fk_bg": "#cffafe", "fk_fg": "#0e7490",
    "line": "#475569",
    "enum_bg": "#f1f5f9",
}

BOX_W = 470
HEADER_H = 42
ROW_H = 24

# Table: (title, [ (field, type, badge) , ... ], footer constraints)
MODELS = [
    ("User", [
        ("id", "UUID", "PK"),
        ("firebase_uid", "String", "UQ"),
        ("name", "String", ""),
        ("email", "String?", "UQ"),
        ("phone", "String?", "UQ"),
        ("created_at", "DateTime", ""),
        ("updated_at", "DateTime", ""),
    ], ""),
    ("EmergencyContact", [
        ("id", "UUID", "PK"),
        ("user_id", "UUID", "FK"),
        ("name", "String", ""),
        ("phone", "String?", "UQ"),
        ("email", "String?", "UQ"),
        ("relationship", "String?", ""),
        ("created_at", "DateTime", ""),
        ("updated_at", "DateTime", ""),
    ], "UQ (user_id, phone) · UQ (user_id, email)"),
    ("Alert", [
        ("id", "UUID", "PK"),
        ("user_id", "UUID", "FK"),
        ("status", "AlertStatus", ""),
        ("tracking_token", "UUID", "UQ"),
        ("triggered_at", "DateTime", ""),
        ("resolved_at", "DateTime?", ""),
        ("last_location_id", "UUID?", "FK"),
    ], "status: sent | acknowledged | resolved"),
    ("AlertLocation", [
        ("id", "UUID", "PK"),
        ("alert_id", "UUID", "FK"),
        ("latitude", "Float", ""),
        ("longitude", "Float", ""),
        ("accuracy", "Float?", ""),
        ("recorded_at", "DateTime", ""),
    ], ""),
    ("ActivityLog", [
        ("id", "UUID", "PK"),
        ("alert_id", "UUID", "FK"),
        ("event_type", "String", ""),
        ("actor", "String?", ""),
        ("timestamp", "DateTime", ""),
    ], ""),
]

# box positions (x, y) top-left; heights computed from field count
POS = {
    "User": (80, 100),
    "EmergencyContact": (80, 470),
    "Alert": (1010, 100),
    "AlertLocation": (1010, 760),
    "ActivityLog": (1010, 470),
}

# relations: (from_title, from_field_idx, to_title, to_field_idx, from_label, to_label, dashed)
RELATIONS = [
    ("User", 0, "EmergencyContact", 1, "1", "N", False),
    ("User", 0, "Alert", 1, "1", "N", False),
    ("Alert", 0, "ActivityLog", 1, "1", "N", False),
    ("Alert", 0, "AlertLocation", 1, "1", "N", False),
    ("Alert", 6, "AlertLocation", 0, "0..1", "1", True),
]


def box_height(fields):
    return HEADER_H + len(fields) * ROW_H + 6


def draw_badge(d, x, y, text, bg, fg, font):
    w = d.textlength(text, font=font) + 10
    d.rounded_rectangle([x, y, x + w, y + 16], radius=3, fill=bg)
    d.text((x + 5, y + 3), text, font=font, fill=fg)


def draw_box(d, title, fields, footer, x, y, header):
    h = box_height(fields)
    d.rounded_rectangle([x, y, x + BOX_W, y + h], radius=8, outline=COL["border"], width=2, fill=COL["body"])
    d.rounded_rectangle([x, y, x + BOX_W, y + HEADER_H], radius=8, fill=header)
    d.rectangle([x, y + HEADER_H - 8, x + BOX_W, y + HEADER_H], fill=header)  # square bottom of header
    d.text((x + 12, y + 10), title, font=FONT["box"], fill=COL["header_text"])
    yy = y + HEADER_H + 4
    for name, typ, badge in fields:
        d.text((x + 12, yy + 2), name, font=FONT["field"], fill=COL["text"])
        d.text((x + BOX_W - 14, yy + 3), typ, font=FONT["field"], fill=COL["type"], anchor="ra")
        if badge == "PK":
            draw_badge(d, x + BOX_W - 14 - 78, yy + 4, "PK", COL["pk_bg"], COL["pk_fg"], FONT["badge"])
        elif badge == "UQ":
            draw_badge(d, x + BOX_W - 14 - 78, yy + 4, "UQ", COL["uq_bg"], COL["uq_fg"], FONT["badge"])
        elif badge == "FK":
            draw_badge(d, x + BOX_W - 14 - 78, yy + 4, "FK", COL["fk_bg"], COL["fk_fg"], FONT["badge"])
        yy += ROW_H
    if footer:
        d.rectangle([x, y + h - 22, x + BOX_W, y + h], fill=COL["enum_bg"])
        d.rounded_rectangle([x, y + h - 22, x + BOX_W, y + h], radius=6, outline=COL["border"], width=1)
        d.text((x + 12, y + h - 19), footer, font=FONT["legend"], fill=COL["type"])
    return h


def field_center(box, field_idx):
    x, y = box
    return x + BOX_W // 2, y + HEADER_H + field_idx * ROW_H + ROW_H // 2


def edge_x(box, side):
    x, _ = box
    return x if side == "left" else x + BOX_W


def dashed_line(d, pts, fill=COL["line"], width=3, dash=10, gap=7):
    for i in range(len(pts) - 1):
        x1, y1 = pts[i]
        x2, y2 = pts[i + 1]
        dist = max(abs(x2 - x1), abs(y2 - y1))
        step = dash + gap
        t = 0
        while t < dist:
            t2 = min(t + dash, dist)
            a = (x1 + (x2 - x1) * t / dist, y1 + (y2 - y1) * t / dist)
            b = (x1 + (x2 - x1) * t2 / dist, y1 + (y2 - y1) * t2 / dist)
            d.line([a, b], fill=fill, width=width)
            t += step


def cardinality(d, x, y, text, anchor="mm"):
    w = d.textlength(text, font=FONT["label"]) + 12
    d.rounded_rectangle([x - w / 2, y - 10, x + w / 2, y + 10], radius=4, fill="#ffffff", outline=COL["line"], width=1)
    d.text((x, y + 1), text, font=FONT["label"], fill=COL["line"], anchor="mm")


def main():
    boxes = {}
    for title, fields, footer in MODELS:
        boxes[title] = (POS[title], box_height(fields))

    canvas_w = 1560
    canvas_h = 1280
    img = Image.new("RGB", (canvas_w, canvas_h), "#ffffff")
    d = ImageDraw.Draw(img)

    d.text((80, 40), "bsafe — ER diagram (Prisma, PostgreSQL)", font=FONT["title"], fill=COL["text"])
    d.text((80, 72), "Phase 1 · PK=primary key · UQ=unique · FK=foreign key (ON DELETE CASCADE)", font=FONT["legend"], fill=COL["type"])

    # draw relation lines first (under boxes)
    for frm, fi, to, ti, fl, tl, dashed in RELATIONS:
        bf, bt = boxes[frm], boxes[to]
        fpos, fh = bf
        tpos, th = bt
        fx, fy = field_center(fpos, fi)
        tx, ty = field_center(tpos, ti)
        fx_side, tx_side = edge_x(fpos, "right"), edge_x(tpos, "left")
        if dashed:
            # elbow route in the right margin
            mid_x = canvas_w - 60
            pts = [(fx_side, fy), (mid_x, fy), (mid_x, ty), (tx_side, ty)]
            dashed_line(d, pts)
            cardinality(d, fx_side + 18, fy, fl)
            cardinality(d, tx_side - 18, ty, tl)
        else:
            if fx == tx:
                # vertical: same-column parent below
                d.line([(fx, fpos[1] + fh), (fx, tpos[1])], fill=COL["line"], width=3)
                cardinality(d, fx, fpos[1] + fh + 14, fl)
                cardinality(d, fx, tpos[1] - 14, tl)
            elif abs(fy - ty) < ROW_H:
                # horizontal
                d.line([(fx_side, fy), (tx_side, ty)], fill=COL["line"], width=3)
                cardinality(d, fx_side + 16, fy, fl)
                cardinality(d, tx_side - 16, ty, tl)
            else:
                # diagonal
                d.line([(fx_side, fy), (tx_side, ty)], fill=COL["line"], width=3)
                mx, my = (fx_side + tx_side) // 2, (fy + ty) // 2
                cardinality(d, fx_side + 16, fy, fl)
                cardinality(d, tx_side - 16, ty, tl)

    for title, fields, footer in MODELS:
        x, y = POS[title]
        draw_box(d, title, fields, footer, x, y, COL["header"])

    # enum / legend box (bottom-left)
    lx, ly = 80, 980
    lh = 130
    d.rounded_rectangle([lx, ly, lx + 560, ly + lh], radius=8, outline=COL["border"], width=2, fill=COL["body"])
    d.rounded_rectangle([lx, ly, lx + 560, ly + HEADER_H], radius=8, fill="#334155")
    d.rectangle([lx, ly + HEADER_H - 8, lx + 560, ly + HEADER_H], fill="#334155")
    d.text((lx + 12, ly + 10), "Legend", font=FONT["box"], fill="#ffffff")
    items = [
        ("AlertStatus (enum)", "sent | acknowledged | resolved"),
        ("Alert.last_location_id →", "AlertLocation.id  (dashed = 0..1, SET NULL)"),
        ("Cascade rules", "User→contacts/alerts · Alert→locations/logs (DELETE CASCADE)"),
    ]
    yy = ly + HEADER_H + 12
    for k, v in items:
        d.text((lx + 12, yy), k, font=FONT["legend"], fill=COL["text"])
        d.text((lx + 250, yy), v, font=FONT["legend"], fill=COL["type"])
        yy += 26

    img.save("docs/er-diagram.png")
    print("wrote docs/er-diagram.png", img.size)


if __name__ == "__main__":
    main()