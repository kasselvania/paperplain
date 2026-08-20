"""Generate the fictional PDF corpus and first-page preview images."""

from pathlib import Path
import os
import shutil
import subprocess

from PIL import Image, ImageDraw
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, LETTER, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas


ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DIR = ROOT / "public" / "samples"
PREVIEW_DIR = ROOT / "public" / "previews"

INK = HexColor("#17221F")
MUTED = HexColor("#65716A")
CREAM = HexColor("#F4F0E4")
PAPER = HexColor("#FFFDF8")
MOSS = HexColor("#536B5A")
MOSS_PALE = HexColor("#DCE4D7")
COPPER = HexColor("#A84F32")
COPPER_PALE = HexColor("#F1D8CC")
SUN = HexColor("#E7B650")
SUN_PALE = HexColor("#F5E8C7")
LINE = HexColor("#D8D8D0")


def draw_wrapped(
    pdf: Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    font: str = "Helvetica",
    size: float = 10,
    leading: float | None = None,
    color=INK,
    max_lines: int | None = None,
) -> float:
    """Draw a plain paragraph and return the next baseline."""
    leading = leading or size * 1.42
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if stringWidth(candidate, font, size) <= width or not line:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    if max_lines is not None:
        lines = lines[:max_lines]

    pdf.setFont(font, size)
    pdf.setFillColor(color)
    for value in lines:
        pdf.drawString(x, y, value)
        y -= leading
    return y


def metadata(pdf: Canvas, title: str) -> None:
    pdf.setTitle(title)
    pdf.setAuthor("Paperplain demo fixture generator")
    pdf.setSubject("Fictional, rights-cleared PDF fixture for a portfolio demo")
    pdf.setCreator("Paperplain")


def fiction_footer(pdf: Canvas, page_width: float, text_color=MUTED) -> None:
    pdf.setFillColor(text_color)
    pdf.setFont("Helvetica", 6.5)
    pdf.drawCentredString(
        page_width / 2,
        18,
        "FICTIONAL DEMO FIXTURE - ALL CONTENT AND LAYOUT CREATED FOR PAPERPLAIN",
    )


def generate_field_brief() -> Path:
    target = SAMPLE_DIR / "alder-creek-field-brief.pdf"
    width, height = landscape(LETTER)
    pdf = Canvas(str(target), pagesize=(width, height), pageCompression=1)
    metadata(pdf, "Alder Creek Field Brief")

    pdf.setFillColor(CREAM)
    pdf.rect(0, 0, width, height, stroke=0, fill=1)
    pdf.setFillColor(INK)
    pdf.rect(0, height - 56, width, 56, stroke=0, fill=1)
    pdf.setFillColor(PAPER)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(42, height - 35, "ALDER CREEK / FIELD NOTE 07")
    pdf.setFont("Helvetica", 8)
    pdf.drawRightString(width - 42, height - 35, "OBSERVATION WINDOW: 06:20-10:40")

    pdf.setFillColor(MOSS)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(42, 518, "RIPARIAN WALKTHROUGH")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 30)
    pdf.drawString(42, 480, "Alder Creek Field Brief")
    draw_wrapped(
        pdf,
        "A compact record of shade, stream clarity, and foot-traffic observations across three marked stations.",
        43,
        454,
        470,
        size=10.5,
        leading=15,
        color=MUTED,
    )

    card_y = 440
    cards = [
        ("03", "stations"),
        ("4.2 C", "air change"),
        ("LOW", "surface haze"),
    ]
    for index, (value, label) in enumerate(cards):
        x = 560 + (index % 2) * 96
        y = card_y - (index // 2) * 76
        card_width = 86 if index < 2 else 182
        pdf.setFillColor(PAPER)
        pdf.roundRect(x, y, card_width, 62, 8, stroke=0, fill=1)
        pdf.setFillColor(MOSS)
        pdf.setFont("Helvetica-Bold", 17)
        pdf.drawString(x + 12, y + 32, value)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 7)
        pdf.drawString(x + 12, y + 15, label.upper())

    pdf.setStrokeColor(HexColor("#B8C0B4"))
    pdf.setLineWidth(1)
    pdf.line(44, 347, 518, 347)
    timeline = [
        (50, "06:20", "North gate"),
        (190, "07:35", "Fern bend"),
        (338, "09:10", "Footbridge"),
        (505, "10:40", "Close"),
    ]
    for x, time, label in timeline:
        pdf.setFillColor(MOSS)
        pdf.circle(x, 347, 4, stroke=0, fill=1)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(x, 328, time)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 7)
        pdf.drawString(x, 316, label)

    observations = [
        (
            "01 / SHADE",
            "Canopy cover stayed continuous along the north bank. The open bend warmed first, with a clear temperature shift after 08:30.",
            "Watch the exposed bend during the next noon visit.",
        ),
        (
            "02 / WATER",
            "Flow remained clear above the footbridge. A faint surface film appeared below the crossing but dispersed within five meters.",
            "Photograph the same reach after rainfall.",
        ),
        (
            "03 / TRAFFIC",
            "Nine walkers and two bicycles passed the marked route. Most visitors paused at the bridge and stayed on the packed path.",
            "Repeat the count on a weekend morning.",
        ),
    ]
    column_width = 224
    for index, (heading, body, action) in enumerate(observations):
        x = 42 + index * 250
        pdf.setFillColor(PAPER)
        pdf.roundRect(x, 76, column_width, 202, 9, stroke=0, fill=1)
        pdf.setFillColor(MOSS)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(x + 15, 250, heading)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(x + 15, 226, ["Continuous canopy", "Clear above bridge", "Path use stayed light"][index])
        body_end = draw_wrapped(pdf, body, x + 15, 202, column_width - 30, size=8.2, leading=12)
        pdf.setStrokeColor(LINE)
        pdf.line(x + 15, body_end - 3, x + column_width - 15, body_end - 3)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica-Bold", 6.5)
        pdf.drawString(x + 15, body_end - 20, "NEXT CHECK")
        draw_wrapped(
            pdf,
            action,
            x + 15,
            body_end - 34,
            column_width - 30,
            size=7.4,
            leading=10.5,
            color=MUTED,
        )

    fiction_footer(pdf, width)
    pdf.save()
    return target


def generate_invoice() -> Path:
    target = SAMPLE_DIR / "copper-and-pine-invoice.pdf"
    width, height = A4
    pdf = Canvas(str(target), pagesize=A4, pageCompression=1)
    metadata(pdf, "Copper & Pine Invoice 1048")

    pdf.setFillColor(PAPER)
    pdf.rect(0, 0, width, height, stroke=0, fill=1)
    pdf.setFillColor(COPPER)
    pdf.rect(0, 0, 16, height, stroke=0, fill=1)

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(52, 784, "COPPER & PINE")
    pdf.setFont("Helvetica", 7.5)
    pdf.setFillColor(MUTED)
    pdf.drawString(52, 769, "Fictional brand and editorial studio")

    pdf.setFillColor(COPPER)
    pdf.setFont("Helvetica-Bold", 31)
    pdf.drawRightString(543, 780, "INVOICE")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawRightString(543, 756, "#1048")

    pdf.setFillColor(COPPER_PALE)
    pdf.roundRect(52, 625, 491, 89, 9, stroke=0, fill=1)
    pdf.setFillColor(COPPER)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(68, 691, "BILL TO")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(68, 670, "Juniper House Press")
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(MUTED)
    pdf.drawString(68, 653, "Attn: Editorial Operations")
    pdf.drawString(68, 639, "14 Lantern Lane, Port Mason")

    info = [
        ("Issued", "August 20, 2026"),
        ("Due", "September 3, 2026"),
        ("Terms", "Net 14"),
    ]
    for index, (label, value) in enumerate(info):
        x = 310 + index * 76
        pdf.setFillColor(COPPER)
        pdf.setFont("Helvetica-Bold", 6.5)
        pdf.drawString(x, 687, label.upper())
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica", 7.2)
        draw_wrapped(pdf, value, x, 669, 66, size=7.2, leading=10)

    table_left = 52
    table_right = 543
    row_top = 585
    row_height = 44
    columns = [52, 352, 410, 468, 543]
    pdf.setFillColor(INK)
    pdf.rect(table_left, row_top, table_right - table_left, 30, stroke=0, fill=1)
    pdf.setFillColor(PAPER)
    pdf.setFont("Helvetica-Bold", 7)
    headers = [(64, "DESCRIPTION"), (365, "QTY"), (423, "RATE"), (481, "AMOUNT")]
    for x, value in headers:
        pdf.drawString(x, row_top + 11, value)

    items = [
        ("Editorial system audit", "Content inventory and decision map", "1", "$680", "$680"),
        ("Field guide layout", "Twelve-page production-ready document", "1", "$940", "$940"),
        ("Reusable page templates", "Cover, section, table, and callout", "4", "$125", "$500"),
        ("Delivery handoff", "Source package and annotated walkthrough", "1", "$180", "$180"),
    ]
    for index, (title, detail, quantity, rate, amount) in enumerate(items):
        y_top = row_top - index * row_height
        y_bottom = y_top - row_height
        if index % 2:
            pdf.setFillColor(HexColor("#F7F4ED"))
            pdf.rect(table_left, y_bottom, table_right - table_left, row_height, stroke=0, fill=1)
        pdf.setStrokeColor(LINE)
        pdf.line(table_left, y_bottom, table_right, y_bottom)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(64, y_top - 17, title)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 6.8)
        pdf.drawString(64, y_top - 30, detail)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica", 8)
        pdf.drawString(365, y_top - 23, quantity)
        pdf.drawString(423, y_top - 23, rate)
        pdf.drawString(481, y_top - 23, amount)

    bottom = row_top - len(items) * row_height
    for x in columns:
        pdf.setStrokeColor(LINE)
        pdf.line(x, bottom, x, row_top)

    total_y = bottom - 37
    totals = [("Subtotal", "$2,300"), ("Tax", "$0"), ("Total due", "$2,300")]
    for index, (label, value) in enumerate(totals):
        y = total_y - index * 27
        pdf.setFillColor(COPPER if index == 2 else MUTED)
        pdf.setFont("Helvetica-Bold" if index == 2 else "Helvetica", 9 if index == 2 else 8)
        pdf.drawRightString(464, y, label)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold" if index == 2 else "Helvetica", 11 if index == 2 else 8)
        pdf.drawRightString(543, y, value)
    pdf.setStrokeColor(COPPER)
    pdf.setLineWidth(1.5)
    pdf.line(389, total_y - 65, 543, total_y - 65)

    note_y = 232
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(52, note_y, "Payment notes")
    draw_wrapped(
        pdf,
        "Please include invoice 1048 with payment. This fixture contains no real account, client, or payment details.",
        52,
        note_y - 22,
        330,
        size=8.3,
        leading=12,
        color=MUTED,
    )
    pdf.setFillColor(COPPER_PALE)
    pdf.roundRect(405, 165, 138, 70, 8, stroke=0, fill=1)
    pdf.setFillColor(COPPER)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(420, 216, "PROJECT STATUS")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(420, 194, "Delivered")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7)
    pdf.drawString(420, 179, "Final package accepted")

    fiction_footer(pdf, width)
    pdf.save()
    return target


def generate_bulletin() -> Path:
    target = SAMPLE_DIR / "juniper-block-bulletin.pdf"
    width, height = LETTER
    pdf = Canvas(str(target), pagesize=LETTER, pageCompression=1)
    metadata(pdf, "Juniper Block Bulletin - Late Summer")

    pdf.setFillColor(CREAM)
    pdf.rect(0, 0, width, height, stroke=0, fill=1)
    pdf.setFillColor(SUN)
    pdf.rect(0, height - 126, width, 126, stroke=0, fill=1)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 7.5)
    pdf.drawString(46, 758, "ISSUE 08 / LATE SUMMER")
    pdf.drawRightString(width - 46, 758, "FICTIONAL NEIGHBORHOOD EDITION")
    pdf.setFont("Times-Bold", 33)
    pdf.drawString(44, 709, "Juniper Block Bulletin")
    pdf.setFont("Helvetica", 9)
    pdf.drawString(46, 687, "Small news, useful dates, and one good reason to step outside.")

    gutter = 22
    margin = 46
    column_width = (width - margin * 2 - gutter) / 2
    left_x = margin
    right_x = margin + column_width + gutter

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(left_x, 632, "ON THE CORNER")
    pdf.setFont("Times-Bold", 22)
    pdf.drawString(left_x, 601, "The library cart returns")
    left_y = draw_wrapped(
        pdf,
        "After a month in the repair shop, the little blue book cart rolls back to the plaza this Saturday. Volunteers added a weatherproof lid, brighter wheels, and a shelf reserved for local zines.",
        left_x,
        576,
        column_width,
        font="Times-Roman",
        size=10,
        leading=14,
    )
    left_y = draw_wrapped(
        pdf,
        "Bring one book or simply browse. The cart runs on trust: take what you will read, leave what a neighbor might love.",
        left_x,
        left_y - 8,
        column_width,
        font="Times-Roman",
        size=10,
        leading=14,
    )

    pdf.setFillColor(SUN_PALE)
    pdf.roundRect(left_x, 340, column_width, 86, 8, stroke=0, fill=1)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(left_x + 15, 402, "A SMALL REQUEST")
    draw_wrapped(
        pdf,
        "Please keep donations to two clean books per household so the cart can close safely.",
        left_x + 15,
        382,
        column_width - 30,
        size=8.5,
        leading=12,
    )

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(left_x, 307, "BACKYARD NOTE")
    pdf.setFont("Times-Bold", 17)
    pdf.drawString(left_x, 283, "Tomatoes after the heat")
    draw_wrapped(
        pdf,
        "Water deeply in the morning, leave damaged leaves until the hottest week passes, and harvest split fruit early. The seed swap table has paper bags by the sign-in sheet.",
        left_x,
        260,
        column_width,
        font="Times-Roman",
        size=9.5,
        leading=13.5,
    )

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(right_x, 632, "THIS WEEK")
    events = [
        ("THU 20", "Porch concert", "7:00 PM / Maple steps"),
        ("SAT 22", "Book cart return", "10:00 AM / East plaza"),
        ("SUN 23", "Seed swap", "2:00 PM / Garden gate"),
    ]
    for index, (date, title, detail) in enumerate(events):
        y = 590 - index * 76
        pdf.setStrokeColor(HexColor("#C8C3B7"))
        pdf.setLineWidth(0.75)
        pdf.line(right_x, y - 21, right_x + column_width, y - 21)
        pdf.setFillColor(SUN)
        pdf.roundRect(right_x, y, 49, 29, 5, stroke=0, fill=1)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 7)
        pdf.drawCentredString(right_x + 24.5, y + 11, date)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(right_x + 63, y + 16, title)
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 7.5)
        pdf.drawString(right_x + 63, y + 2, detail)

    pdf.setFillColor(INK)
    pdf.roundRect(right_x, 264, column_width, 112, 8, stroke=0, fill=1)
    pdf.setFillColor(SUN)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(right_x + 16, 349, "ONE GOOD REASON")
    pdf.setFillColor(PAPER)
    pdf.setFont("Times-Bold", 16)
    draw_wrapped(
        pdf,
        "The evenings are finally cool enough for the long way home.",
        right_x + 16,
        323,
        column_width - 32,
        font="Times-Bold",
        size=16,
        leading=19,
        color=PAPER,
    )

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(right_x, 229, "NOTICE BOARD")
    notices = [
        "Lost: one red garden glove near Juniper and Third.",
        "Found: brass key on a blue cord at the plaza bench.",
        "Needed: two folding tables for the seed swap.",
    ]
    y = 207
    for notice in notices:
        pdf.setFillColor(SUN)
        pdf.circle(right_x + 3, y + 2, 2.5, stroke=0, fill=1)
        y = draw_wrapped(pdf, notice, right_x + 13, y, column_width - 13, size=8.2, leading=11.5)
        y -= 7

    fiction_footer(pdf, width)
    pdf.save()
    return target


def generate_favicon() -> None:
    image = Image.new("RGB", (64, 64), "#17221F")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((6, 6, 58, 58), radius=18, fill="#F4F0E4")
    draw.rectangle((20, 17, 44, 22), fill="#536B5A")
    draw.rectangle((20, 29, 41, 34), fill="#17221F")
    draw.rectangle((20, 41, 36, 46), fill="#A84F32")
    image.save(ROOT / "public" / "favicon.png")


def render_previews(paths: list[Path]) -> None:
    renderer = shutil.which("pdftoppm")
    if renderer is None:
        raise RuntimeError("pdftoppm is required to render the sample previews")

    environment = os.environ.copy()
    cache_root = ROOT / "work" / "fontconfig-cache"
    cache_root.mkdir(parents=True, exist_ok=True)
    environment["XDG_CACHE_HOME"] = str(cache_root)

    # Codex's bundled Poppler is relocatable, but fontconfig's compiled default
    # still points at its build machine. Supply the relocated config when found.
    dependency_root = Path(renderer).parents[2]
    bundled_config = (
        dependency_root / "native" / "poppler" / "poppler" / "etc" / "fonts" / "fonts.conf"
    )
    if bundled_config.exists():
        environment["FONTCONFIG_FILE"] = str(bundled_config)

    for path in paths:
        output_prefix = PREVIEW_DIR / f"{path.stem}-1"
        subprocess.run(
            [
                renderer,
                "-png",
                "-f",
                "1",
                "-singlefile",
                "-r",
                "144",
                str(path),
                str(output_prefix),
            ],
            check=True,
            env=environment,
            capture_output=True,
            text=True,
        )


def main() -> None:
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    paths = [generate_field_brief(), generate_invoice(), generate_bulletin()]
    generate_favicon()
    render_previews(paths)
    for path in paths:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
