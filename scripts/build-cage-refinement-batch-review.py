"""Build full-board before/after sheets for cage refinement batches."""
import argparse
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'docs/art/production/original-character-cage-r1/cage-base3d-v1'
BASE=WORK/'review/full-layout-v1/boards'
CONFIGS={
    'a':(WORK/'review/refinement-batch-a-v1',((12,'field_cm13_01','神殿'),(13,'field_cm14_01','墓地'),(23,'field_cm24_01','寺廟'))),
    'b':(WORK/'review/refinement-batch-b-v1',((5,'field_cm06_01','研究所'),(14,'field_cm15_01','工廠'),(16,'field_cm17_01','醫院'),(21,'field_cm22_01','發電廠'),(22,'field_cm23_01','毒氣室'))),
    'c':(WORK/'review/refinement-batch-c-v1',((7,'field_cm08_01','草原'),(17,'field_cm18_01','花園'),(24,'field_cm25_01','動物園'),(25,'field_cm26_01','牧場'))),
    'e':(WORK/'review/refinement-batch-e-v1',((10,'field_cm11_01','森林'),(24,'field_cm25_01','動物園'),(25,'field_cm26_01','牧場'))),
}

def build(batch='a'):
    out,fields=CONFIGS[batch];refined=out/'full-layout/boards'
    cards=[]
    for index,field_id,name in fields:
        filename=f'{index:02d}-{field_id}.png'
        cards.append((f'BEFORE  {field_id}  {name}',Image.open(BASE/filename).convert('RGB')))
        cards.append((f'AFTER   {field_id}  {name}',Image.open(refined/filename).convert('RGB')))
    width=max(image.width for _,image in cards);height=max(image.height for _,image in cards)+34
    sheet=Image.new('RGB',(width*2,height*len(fields)),(7,13,19));draw=ImageDraw.Draw(sheet)
    font_path=Path('C:/Windows/Fonts/msjh.ttc');font=ImageFont.truetype(str(font_path),20) if font_path.exists() else ImageFont.load_default()
    for card_index,(label,image) in enumerate(cards):
        x=(card_index%2)*width;y=(card_index//2)*height
        draw.text((x+12,y+7),label,font=font,fill=(238,244,241))
        sheet.paste(image,(x,y+34));image.close()
    output=out/'full-board-before-after.jpg';sheet.save(output,quality=92,optimize=True);sheet.close()
    print(output.relative_to(ROOT).as_posix())
    return output

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--batch',choices=sorted(CONFIGS),default='a')
    build(parser.parse_args().batch)
