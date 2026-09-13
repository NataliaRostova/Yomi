"""Encode recorded PNG frames into optimized GIFs; needs Pillow (dev tool only)."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path('.test-output/gif-deps').resolve()))
from PIL import Image
root=Path('.test-output/showcase')
data=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
out=Path('assets/demo');out.mkdir(parents=True,exist_ok=True)
stats=[]
for clip in data['manifest']:
    frames=[];durations=[]
    samples=Image.new('RGB',(1200,820*3))
    for row,index in enumerate([0,len(clip['frames'])//2,len(clip['frames'])-1]):
        with Image.open(root/clip['name']/clip['frames'][index]['file']) as im:
            samples.paste(im.convert('RGB'),(0,row*820))
    palette=samples.quantize(colors=128,method=Image.Quantize.MEDIANCUT)
    for i, f in enumerate(clip['frames']):
        with Image.open(root/clip['name']/f['file']) as im:
            frames.append(im.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE))
        end=clip['frames'][i+1]['t'] if i+1<len(clip['frames']) else clip['duration']
        durations.append(max(20,round((end-f['t'])/10)*10))
    target=out/(clip['name']+'.gif')
    frames[0].save(target,save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True,disposal=1)
    with Image.open(target) as check:
        stats.append(dict(file=target.as_posix(),frames=check.n_frames,size=check.size,bytes=target.stat().st_size,durationMs=sum(durations)))
    print(stats[-1])
(out/'recording-info.json').write_text(json.dumps(dict(createdAt=data['createdAt'],browser=data['browser'],source='Production userscript on demo/showcase.html; real UI interactions and local dictionary; no AI transport',clips=stats),ensure_ascii=False,indent=2),encoding='utf-8')
