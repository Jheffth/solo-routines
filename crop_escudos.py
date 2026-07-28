import sys
import os
from PIL import Image

img_path = r"C:\Users\jcs88\.gemini\antigravity\brain\c4ddb023-5be6-4ea9-aed8-8d80216db450\.user_uploaded\media__1785087684621.jpg"
out_dir = r"C:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\frontend\assets\img\escudos"

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

try:
    img = Image.open(img_path)
    w, h = img.size
    print(f"Loaded image: {w}x{h}")
    
    # We don't know the exact coordinates without seeing it.
    # But usually a grid like this is cut into equal chunks.
    # Let's save the whole image to the assets folder first so we can use it.
    img.save(os.path.join(out_dir, "escudos-master.jpg"))
    print("Master image saved to assets.")
except Exception as e:
    print(f"Error: {e}")
