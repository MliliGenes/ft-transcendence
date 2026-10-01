from pathlib import Path
import json, re, html
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle, Preformatted
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT

ROOT = Path('/work')
OUT = Path('/output/user-service-implementation-guide.pdf')
OUT.parent.mkdir(parents=True, exist_ok=True)
FONTDIR = Path('/usr/share/fonts/truetype/dejavu')
for name, filename in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf'),('Mono','DejaVuSansMono.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTDIR / filename)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
W, H = 595.276, 841.89
M, WIDTH = 48, W-96
NAVY=colors.HexColor('#142B40'); TEAL=colors.HexColor('#087F83'); INK=colors.HexColor('#253C4C')
MUTED=colors.HexColor('#617280'); PALE=colors.HexColor('#EDF6F5'); LINE=colors.HexColor('#D7E3E7'); AMBER=colors.HexColor('#A35A14')
styles={
 'p':ParagraphStyle('p',fontName='Body',fontSize=10.6,leading=15.3,textColor=INK,spaceAfter=7),
 'h':ParagraphStyle('h',fontName='Bold',fontSize=12.1,leading=17,textColor=NAVY,spaceAfter=6,spaceBefore=8),
 'small':ParagraphStyle('small',fontName='Body',fontSize=8.4,leading=11.8,textColor=MUTED),
 'cell':ParagraphStyle('cell',fontName='Body',fontSize=9.1,leading=12.8,textColor=INK),
 'th':ParagraphStyle('th',fontName='Bold',fontSize=9.1,leading=12.8,textColor=colors.white),
 'q':ParagraphStyle('q',fontName='Body',fontSize=10.1,leading=14.5,textColor=INK),
 'code':ParagraphStyle('code',fontName='Mono',fontSize=8.7,leading=12.2,textColor=NAVY),
}

def safe(s):
    s=s.replace('\u2014',' - ').replace('\u2013','-').replace('\u2011','-')
    s=s.replace('\u2019',"'").replace('\u2018',"'").replace('\u201c','"').replace('\u201d','"')
    return s

pages=json.loads((ROOT/'content.json').read_text(encoding='utf-8'))
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('User service - implementation field guide')
c.setAuthor('Implementation review for the project team')
c.setSubject('NestJS, Prisma, PostgreSQL, JWT sessions, Discord login and linking, profiles, media and roles')
overflows=[]

def paragraph(text, x, y, width=WIDTH, style='p'):
    p=Paragraph(safe(text),styles[style]); _,height=p.wrap(width,1000)
    p.drawOn(c,x,y-height)
    return y-height-styles[style].spaceAfter

def table(block,y):
    rows=block['rows']; ratios=block.get('widths',[1]*len(rows[0]))
    widths=[WIDTH*r/sum(ratios) for r in ratios]
    cells=[[Paragraph(safe(v),styles['th' if i==0 else 'cell']) for v in row] for i,row in enumerate(rows)]
    t=Table(cells,colWidths=widths,hAlign='LEFT')
    t.setStyle(TableStyle([
      ('BACKGROUND',(0,0),(-1,0),NAVY),('VALIGN',(0,0),(-1,-1),'TOP'),
      ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
      ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
      ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#F3F7F8'),colors.white]),
      ('LINEBELOW',(0,0),(-1,0),0.4,NAVY),('LINEBELOW',(0,1),(-1,-1),0.35,LINE),
    ]))
    _,height=t.wrap(WIDTH,1000); t.drawOn(c,M,y-height)
    return y-height-12

def flow(block,y):
    nodes=block['nodes']; gap=17; width=(WIDTH-gap*(len(nodes)-1))/len(nodes); height=block.get('height',75)
    for i,node in enumerate(nodes):
      x=M+i*(width+gap)
      c.setFillColor(PALE);c.setStrokeColor(LINE);c.roundRect(x,y-height,width,height,6,fill=1,stroke=1)
      paragraph(node,x+9,y-11,width-18,'cell')
      if i<len(nodes)-1:
        c.setStrokeColor(TEAL); c.setLineWidth(1.1)
        a=x+width+3;b=a+gap-6; yy=y-height/2
        c.line(a,yy,b,yy); c.line(b,yy,b-4,yy+3);c.line(b,yy,b-4,yy-3)
    if block.get('caption'): y=paragraph(block['caption'],M,y-height-7,style='small')
    else:y-=height
    return y-12

def box(block,y):
    content='<b>'+block.get('label','Ask yourself')+'</b><br/>'+block['text']
    p=Paragraph(safe(content),styles['q']);_,hh=p.wrap(WIDTH-26,1000)
    c.setFillColor(PALE);c.roundRect(M,y-hh-24,WIDTH,hh+24,5,fill=1,stroke=0)
    c.setFillColor(TEAL);c.rect(M,y-hh-24,3,hh+24,fill=1,stroke=0)
    p.drawOn(c,M+13,y-12-hh)
    return y-hh-37

def footer(n,source=''):
    c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(M,57,W-M,57)
    c.setFont('Body',7.6);c.setFillColor(MUTED)
    c.drawString(M,40,'USER SERVICE  /  WORKING TREE REVIEW  /  30 SEP 2026')
    c.setFont('Bold',8.8);c.drawRightString(W-M,40,f'{n:02d}')
    if source:
      paragraph('Code: '+html.escape(source),M,83,WIDTH,'small')

def cover():
    c.setFillColor(NAVY);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(TEAL);c.rect(48,741,65,7,fill=1,stroke=0)
    c.setFillColor(colors.HexColor('#90DAD5'));c.setFont('Bold',11)
    c.drawString(48,714,'IMPLEMENTATION FIELD GUIDE')
    c.setFillColor(colors.white);c.setFont('Bold',45)
    c.drawString(45,636,'YOUR USER')
    c.drawString(45,581,'SERVICE')
    cs=ParagraphStyle('cover',fontName='Body',fontSize=17,leading=25,textColor=colors.white)
    p=Paragraph('Understand how the pieces work together.<br/>Learn where to question the design.',cs)
    p.wrap(WIDTH,200);p.drawOn(c,48,487)
    c.setFillColor(colors.HexColor('#A7BBC8'));c.setFont('Body',10.5)
    for i,line in enumerate(['NestJS + Prisma + PostgreSQL','Passwords, JWTs, refresh sessions and Discord','Profiles, images, roles and the testing frontend']):c.drawString(48,413-i*22,line)
    c.setFillColor(colors.HexColor('#203D52'));c.roundRect(48,174,WIDTH,122,8,fill=1,stroke=0)
    p=Paragraph('<b>Snapshot: 30 September 2026</b><br/>Branch: user-service. Base commit: d2aabf3.<br/>Includes the uncommitted frontend, backend updates and newly implemented Discord linking endpoints.<br/>A code-grounded learning guide, not a production readiness certificate.',ParagraphStyle('covermeta',fontName='Body',fontSize=10,leading=16,textColor=colors.white))
    p.wrap(WIDTH-28,150);p.drawOn(c,62,193)
    c.setFillColor(colors.HexColor('#A7BBC8'));c.setFont('Body',9)
    c.drawString(48,75,f'{len(pages)+2} pages  /  explanations, flow diagrams, experiments and review questions')
    c.bookmarkPage('cover'); c.addOutlineEntry('Cover','cover',0,False);c.showPage()

cover()
# Contents: two columns, with PDF-internal links.
c.bookmarkPage('contents');c.addOutlineEntry('Reading map','contents',0,False)
c.setFillColor(TEAL);c.setFont('Bold',10);c.drawString(M,H-57,'READING MAP')
c.setFillColor(NAVY);c.setFont('Bold',26);c.drawString(M,H-95,'Read it in layers')
y=H-120
y=paragraph('First trace a normal request. Then follow identity and session lifetimes. Finally try to break the assumptions with the exercises. Questions throughout are invitations to investigate, not claims that a feature is broken.',M,y)
top=y-10; colw=(WIDTH-22)/2; split=(len(pages)+1)//2
for j,page in enumerate(pages):
    col=j//split; row=j%split; xx=M+col*(colw+22); yy=top-row*25
    label=f'{j+3:02d}  '+page['title']
    p=Paragraph(f'<link href="#p{j+3}" color="#142B40">{html.escape(label)}</link>',ParagraphStyle('toc',fontName='Body',fontSize=9.2,leading=12))
    _,hh=p.wrap(colw,50);p.drawOn(c,xx,yy-hh)
y=top-split*25-16
y=box({'label':'How to use this guide','text':'<b>Explain:</b> tell a teammate what happens without opening the code.<br/><b>Trace:</b> locate the named methods and check every claim.<br/><b>Predict:</b> write the expected result before a test request.<br/><b>Verify:</b> observe the response and database effect, then revise your model.'},y)
footer(2);c.showPage()

for idx,page in enumerate(pages,3):
    c.bookmarkPage(f'p{idx}');c.addOutlineEntry(page['title'],f'p{idx}',0,False)
    c.setFillColor(TEAL);c.setFont('Bold',9.2);c.drawString(M,H-48,page.get('part','IMPLEMENTATION').upper())
    title=Paragraph(html.escape(page['title']),ParagraphStyle('title',fontName='Bold',fontSize=23,leading=28,textColor=NAVY))
    _,th=title.wrap(WIDTH,100);title.drawOn(c,M,H-67-th)
    y=H-79-th
    if page.get('deck'): y=paragraph(page['deck'],M,y,style='small')-8
    for b in page['blocks']:
      kind=b['type']
      if kind in ('p','h'):
        if kind=='h':y-=6
        y=paragraph(b['text'],M,y,style=kind)
      elif kind=='table': y=table(b,y)
      elif kind=='flow':y=flow(b,y)
      elif kind=='box':y=box(b,y)
      elif kind=='code':
        text=safe(b['text']);pre=Preformatted(text,styles['code'])
        _,hh=pre.wrap(WIDTH-24,1000)
        for line in text.splitlines():
          if pdfmetrics.stringWidth(line,'Mono',8.7)>WIDTH-24:
            raise ValueError(f'Code line too wide on page {idx}: {line}')
        c.setFillColor(colors.HexColor('#F0F3F6'));c.roundRect(M,y-hh-20,WIDTH,hh+20,4,fill=1,stroke=0)
        pre.drawOn(c,M+12,y-hh-10);y-=hh+32
    if y<99:overflows.append((idx,page['title'],round(y,1)))
    footer(idx,page.get('source',''));c.showPage()
c.save()
print(json.dumps({'pdf':str(OUT),'pages':len(pages)+2,'overflows':overflows}))
if overflows:raise SystemExit(1)
