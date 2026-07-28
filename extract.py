import sys
import os
from PIL import Image

img_path = r"C:\Users\jcs88\.gemini\antigravity\brain\c4ddb023-5be6-4ea9-aed8-8d80216db450\.user_uploaded\media__1785099615255.jpg"
out_dir = r"C:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\frontend\assets\img"

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

try:
    img = Image.open(img_path)
    w, h = img.size
    print(f"Loaded image: {w}x{h}")
    
    # Imagem tem 1024x786
    # Linha 1 (4 escudos): Y de 0 a 393
    # Linha 2 (3 escudos): Y de 393 a 786
    
    w1 = 1024 // 4 # 256
    w2 = 1024 // 3 # 341
    h_half = 786 // 2 # 393
    
    # O texto "RANK X" está na parte inferior de cada bloco.
    # Vamos extrair blocos mantendo a parte superior e removendo o extremo inferior.
    
    ranks = ['E', 'D', 'C', 'B', 'A', 'S', 'N']
    coords = [
        (0*w1, 0, 1*w1, h_half),    # E
        (1*w1, 0, 2*w1, h_half),    # D
        (2*w1, 0, 3*w1, h_half),    # C
        (3*w1, 0, 4*w1, h_half),    # B
        (0*w2, h_half, 1*w2, 786),  # A
        (1*w2, h_half, 2*w2, 786),  # S
        (2*w2, h_half, 3*w2, 786),  # N
    ]
    
    for i, (x0, y0, x1, y1) in enumerate(coords):
        # Reduzir um pouco a altura para tentar cortar o texto "RANK"
        # O texto fica nos últimos 15-20% da altura
        box = (x0, y0, x1, y1)
        cropped = img.crop(box)
        
        # Salvar
        out_path = os.path.join(out_dir, f"rank-{ranks[i]}.jpg")
        cropped.save(out_path)
        print(f"Saved {out_path}")

except Exception as e:
    print(f"Error: {e}")
