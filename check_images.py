import sys
import os
from PIL import Image

folder = r"C:\Users\jcs88\.gemini\antigravity\brain\c4ddb023-5be6-4ea9-aed8-8d80216db450\.user_uploaded"

for file in os.listdir(folder):
    if file.endswith(".png") or file.endswith(".jpg"):
        try:
            path = os.path.join(folder, file)
            img = Image.open(path)
            w, h = img.size
            print(f"{file}: {w}x{h}")
        except:
            pass
