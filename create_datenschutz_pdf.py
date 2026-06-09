from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import Image as RLImage
import os

OUTPUT = r"C:\Users\eryildiz\Documents\GitHub\fc-niksar\FC_Niksar_Datenschutz.pdf"
LOGO = r"C:\Users\eryildiz\Documents\GitHub\fc-niksar\icon-192.png"

# Farben (App-Design)
DUNKELBLAU = colors.HexColor('#0A2540')
GRUEN      = colors.HexColor('#10B981')
HELLGRUEN  = colors.HexColor('#F0FDF4')
GRUEN_TEXT = colors.HexColor('#065F46')
BLAU_BG    = colors.HexColor('#EFF6FF')
BLAU_TEXT  = colors.HexColor('#1D4ED8')
ROT_BG     = colors.HexColor('#FEF2F2')
ROT_TEXT   = colors.HexColor('#991B1B')
GRAU       = colors.HexColor('#6B7280')
HELLGRAU   = colors.HexColor('#F3F4F6')
DUNKELGRAU = colors.HexColor('#374151')

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    rightMargin=2*cm,
    leftMargin=2*cm,
    topMargin=2*cm,
    bottomMargin=2*cm
)

styles = {
    'h1': ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=22, textColor=DUNKELBLAU, spaceAfter=4, leading=28),
    'h2': ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=13, textColor=DUNKELBLAU, spaceAfter=6, spaceBefore=14),
    'body': ParagraphStyle('body', fontName='Helvetica', fontSize=11, textColor=DUNKELGRAU, leading=17, spaceAfter=4),
    'small': ParagraphStyle('small', fontName='Helvetica', fontSize=9, textColor=GRAU, leading=13),
    'tag_yes': ParagraphStyle('tag_yes', fontName='Helvetica-Bold', fontSize=10, textColor=GRUEN_TEXT),
    'tag_no': ParagraphStyle('tag_no', fontName='Helvetica-Bold', fontSize=10, textColor=ROT_TEXT),
    'green_box': ParagraphStyle('green_box', fontName='Helvetica', fontSize=11, textColor=GRUEN_TEXT, leading=17),
    'blue_box': ParagraphStyle('blue_box', fontName='Helvetica', fontSize=11, textColor=BLAU_TEXT, leading=17),
    'center': ParagraphStyle('center', fontName='Helvetica', fontSize=9, textColor=GRAU, alignment=TA_CENTER),
    'sub': ParagraphStyle('sub', fontName='Helvetica', fontSize=10, textColor=DUNKELBLAU, spaceAfter=2),
}

story = []

# ── HEADER ──
header_data = [[
    RLImage(LOGO, width=1.8*cm, height=1.8*cm) if os.path.exists(LOGO) else Paragraph('⚽', styles['h1']),
    [
        Paragraph('FC Niksar', styles['h1']),
        Paragraph('Datenschutz &amp; Sicherheit', ParagraphStyle('sub2', fontName='Helvetica', fontSize=13, textColor=GRAU)),
    ]
]]
header_table = Table(header_data, colWidths=[2.2*cm, 14*cm])
header_table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ('TOPPADDING', (0,0), (-1,-1), 0),
]))
story.append(header_table)
story.append(Spacer(1, 0.3*cm))
story.append(HRFlowable(width='100%', thickness=2, color=DUNKELBLAU))
story.append(Spacer(1, 0.5*cm))

# ── DSGVO Badge ──
badge = Table([[Paragraph('✅  DSGVO-konform · Google Firebase · Frankfurt, Deutschland', ParagraphStyle('badge', fontName='Helvetica-Bold', fontSize=11, textColor=GRUEN_TEXT))]],
    colWidths=[17.2*cm])
badge.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), HELLGRUEN),
    ('ROUNDEDCORNERS', (0,0), (-1,-1), [8,8,8,8]),
    ('TOPPADDING', (0,0), (-1,-1), 10),
    ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ('LEFTPADDING', (0,0), (-1,-1), 14),
]))
story.append(badge)
story.append(Spacer(1, 0.6*cm))

# ── INTRO TEXT ──
story.append(Paragraph(
    'Diese App dient der internen Kommunikation und Organisation des FC Niksar. '
    'Der Datenschutz Ihrer Kinder liegt uns am Herzen. Im Folgenden erklären wir '
    'transparent, welche Daten gespeichert werden, wo und wie sie geschützt sind.',
    styles['body']
))
story.append(Spacer(1, 0.4*cm))

# ── WO WERDEN DATEN GESPEICHERT ──
story.append(Paragraph('Wo werden die Daten gespeichert?', styles['h2']))
box_text = (
    'Alle Daten — einschliesslich Fotos — werden in <b>Google Firebase</b> gespeichert. '
    'Der Serverstandort ist <b>Frankfurt, Deutschland</b>. Google Firebase ist <b>DSGVO-konform</b> '
    'und unterliegt den strengen europäischen Datenschutzgesetzen. '
    'Google verarbeitet die Daten ausschliesslich zur technischen Bereitstellung '
    'des Dienstes und darf sie <b>nicht für Werbung oder andere Zwecke nutzen</b>.'
)
blue_box = Table([[Paragraph(box_text, styles['blue_box'])]], colWidths=[17.2*cm])
blue_box.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), BLAU_BG),
    ('ROUNDEDCORNERS', (0,0), (-1,-1), [8,8,8,8]),
    ('TOPPADDING', (0,0), (-1,-1), 12),
    ('BOTTOMPADDING', (0,0), (-1,-1), 12),
    ('LEFTPADDING', (0,0), (-1,-1), 14),
    ('RIGHTPADDING', (0,0), (-1,-1), 14),
]))
story.append(blue_box)
story.append(Spacer(1, 0.5*cm))

# ── WAS WIRD GESPEICHERT ──
story.append(Paragraph('Was wird gespeichert?', styles['h2']))
items = [
    ('👤', 'Name des Kindes', 'Spielerprofil'),
    ('✅', 'Rückmeldungen', 'Zu- und Absagen bei Training und Spielen'),
    ('📷', 'Spieler-Profilfotos', 'Freiwillig, kann weggelassen werden'),
    ('🖼', 'Vereins-Galerie', 'Fotos werden nur vom Trainer hochgeladen'),
    ('🔔', 'Push-Benachrichtigungs-ID', 'Technische ID — enthält keine Personendaten'),
]
for icon, title, desc in items:
    row_data = [[
        Paragraph(icon, ParagraphStyle('icon', fontName='Helvetica', fontSize=14)),
        [Paragraph(f'<b>{title}</b>', styles['sub']),
         Paragraph(desc, styles['small'])],
    ]]
    row_table = Table(row_data, colWidths=[1*cm, 16.2*cm])
    row_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(row_table)

story.append(Spacer(1, 0.5*cm))

# ── WAS PASSIERT MIT FOTOS ──
story.append(Paragraph('Was passiert mit den Fotos?', styles['h2']))
foto_points = [
    'Fotos sind <b>nicht öffentlich</b> — nur Vereinsmitglieder mit persönlichem PIN-Code können sie sehen.',
    'Google darf Fotos <b>nicht für Werbung oder andere Zwecke</b> verwenden.',
    'Fotos können jederzeit <b>vom Trainer gelöscht</b> werden.',
    'Es gibt <b>keinen öffentlichen Zugang</b> und keine öffentliche Registrierung.',
]
for pt in foto_points:
    story.append(Paragraph(f'•  {pt}', ParagraphStyle('bullet', fontName='Helvetica', fontSize=11, textColor=DUNKELGRAU, leading=17, leftIndent=10, spaceAfter=4)))

story.append(Spacer(1, 0.5*cm))

# ── WAS WIRD NICHT GESPEICHERT ──
story.append(Paragraph('Was wird NICHT gespeichert?', styles['h2']))
not_stored = ['Passwörter', 'E-Mail-Adressen', 'Standortdaten', 'Zahlungsdaten', 'Gerätekennungen']
tags = [[Paragraph(f'✗  {t}', ParagraphStyle('notag', fontName='Helvetica-Bold', fontSize=10, textColor=ROT_TEXT))] for t in not_stored]
not_table = Table([[Paragraph(f'✗  {t}', ParagraphStyle('notag', fontName='Helvetica-Bold', fontSize=10, textColor=ROT_TEXT)) for t in not_stored]],
    colWidths=[17.2/len(not_stored)*cm]*len(not_stored))
not_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), ROT_BG),
    ('ROUNDEDCORNERS', (0,0), (-1,-1), [6,6,6,6]),
    ('TOPPADDING', (0,0), (-1,-1), 8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ('LEFTPADDING', (0,0), (-1,-1), 10),
    ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
]))
story.append(not_table)
story.append(Spacer(1, 0.5*cm))

# ── ZUGRIFF ──
story.append(Paragraph('Wer hat Zugriff?', styles['h2']))
story.append(Paragraph(
    'Ausschliesslich Vereinsmitglieder mit persönlichem PIN-Code. '
    'Es gibt keine öffentliche Registrierung und keinen offenen Zugang. '
    'Trainer haben zusätzliche Verwaltungsrechte.',
    styles['body']
))
story.append(Spacer(1, 0.5*cm))

# ── LÖSCHEN ──
del_box = Table([[Paragraph(
    '🗑️  <b>Daten löschen lassen?</b><br/>'
    'Jederzeit möglich — einfach beim Trainer melden. '
    'Alle Daten inkl. Fotos werden dann vollständig und dauerhaft entfernt.',
    ParagraphStyle('del', fontName='Helvetica', fontSize=11, textColor=BLAU_TEXT, leading=17)
)]], colWidths=[17.2*cm])
del_box.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), BLAU_BG),
    ('ROUNDEDCORNERS', (0,0), (-1,-1), [8,8,8,8]),
    ('TOPPADDING', (0,0), (-1,-1), 12),
    ('BOTTOMPADDING', (0,0), (-1,-1), 12),
    ('LEFTPADDING', (0,0), (-1,-1), 14),
    ('RIGHTPADDING', (0,0), (-1,-1), 14),
]))
story.append(del_box)
story.append(Spacer(1, 0.8*cm))

# ── FOOTER ──
story.append(HRFlowable(width='100%', thickness=1, color=HELLGRAU))
story.append(Spacer(1, 0.3*cm))
story.append(Paragraph('Verantwortlich: FC Niksar · Kontakt über den Trainer · Stand: Juni 2026', styles['center']))

doc.build(story)
print(f"PDF erstellt: {OUTPUT}")
