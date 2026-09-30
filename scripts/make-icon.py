"""Render the original Monday vector mark to PNG and Windows ICO (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

assets = Path(__file__).resolve().parent.parent / "assets"
assets.mkdir(exist_ok=True)
assets.joinpath("monday.svg").write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="17" y="17" width="478" height="478" rx="108" fill="#ffffff" stroke="#e5e5e9" stroke-width="3"/>
  <circle cx="146" cy="152" r="19" fill="#a895cb"/>
  <path d="M145 273 224 352 369 196" fill="none" stroke="#242429" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
''', encoding="utf-8")

scale = 4
image = Image.new("RGBA", (512 * scale, 512 * scale))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((17*scale, 17*scale, 495*scale, 495*scale), radius=108*scale,
                       fill="#ffffff", outline="#e5e5e9", width=3*scale)
draw.ellipse((127*scale, 133*scale, 165*scale, 171*scale), fill="#a895cb")
points = [(145*scale,273*scale), (224*scale,352*scale), (369*scale,196*scale)]
draw.line(points, fill="#242429", width=48*scale, joint="curve")
for x, y in points:
    radius = 24*scale
    draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill="#242429")
image = image.resize((512,512), Image.Resampling.LANCZOS)
image.save(assets / "monday.png")
image.save(assets / "monday.ico", sizes=[(s,s) for s in (16,20,24,32,40,48,64,128,256)])
print("Saved assets/monday.svg, monday.png, monday.ico")
