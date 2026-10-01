from pathlib import Path
import subprocess, json
from PIL import Image, ImageOps, ImageDraw
from pypdf import PdfReader
root=Path('/work'); out=root/'rendered';out.mkdir(exist_ok=True)
pdf=Path('/output/user-service-implementation-guide.pdf')
reader=PdfReader(pdf)
assert len(reader.pages)==34
texts=[page.extract_text() or '' for page in reader.pages]
assert all(len(t)>150 for t in texts)
assert all('USER SERVICE' in t for t in texts[1:])
for forbidden in ['turn19search','BEGIN PRIVATE KEY','discord-private-token']:
    assert all(forbidden not in t for t in texts)
subprocess.run(['pdftoppm','-r','105','-png',str(pdf),str(out/'page')],check=True)
images=sorted(out.glob('page-*.png'))
for start in range(0,len(images),6):
    sheet=Image.new('RGB',(960,960),'#dce4e9');draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(images[start:start+6]):
        image=Image.open(path).convert('RGB');image.thumbnail((302,435))
        x=9+(i%3)*320;y=23+(i//3)*476
        sheet.paste(image,(x,y));draw.text((x,y-17),path.stem,fill='black')
    sheet.save(out/f'contact-{start//6+1}.jpg',quality=92)
print(json.dumps({'pages':len(reader.pages),'words':sum(len(t.split()) for t in texts),'links':sum(len(p.get('/Annots',[])) for p in reader.pages),'contact_sheets':6}))
