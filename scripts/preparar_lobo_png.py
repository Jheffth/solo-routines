"""
Remove o fundo preto da imagem do lobo e salva como PNG com transparência.
Depois gera a string base64 para embutir diretamente no SVG.
"""
from PIL import Image
import base64
import io

# 1. Abrir a imagem original
img = Image.open(r'C:\Users\jcs88\.gemini\antigravity\brain\c4ddb023-5be6-4ea9-aed8-8d80216db450\shadow_wolf_emblem_1785585171158.jpg')
img = img.convert('RGBA')
w, h = img.size
print(f"Imagem original: {w}x{h}")

# 2. Remover fundo preto (threshold adaptativo)
pixels = img.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        # Luminosidade do pixel
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        
        if lum < 35:
            # Pixel muito escuro -> totalmente transparente
            pixels[x, y] = (0, 0, 0, 0)
        elif lum < 55:
            # Zona de transição -> semi-transparente (anti-aliasing suave)
            alpha = int((lum - 35) / 20 * 255)
            pixels[x, y] = (r, g, b, alpha)
        # else: mantém opaco

# 3. Crop para centralizar no conteúdo real (bounding box do conteúdo não-transparente)
bbox = img.getbbox()
if bbox:
    print(f"Bounding box do conteúdo: {bbox}")
    # Adicionar margem pequena
    margin = 10
    left = max(0, bbox[0] - margin)
    top = max(0, bbox[1] - margin)
    right = min(w, bbox[2] + margin)
    bottom = min(h, bbox[3] + margin)
    img = img.crop((left, top, right, bottom))
    print(f"Após crop: {img.size[0]}x{img.size[1]}")

# 4. Salvar como PNG com transparência
output_path = r'C:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\frontend\assets\badges\lobo-sombrio.png'
img.save(output_path, 'PNG', optimize=True)
print(f"PNG salvo: {output_path}")

# 5. Gerar base64
buffer = io.BytesIO()
img.save(buffer, format='PNG', optimize=True)
b64 = base64.b64encode(buffer.getvalue()).decode('ascii')
print(f"Base64 size: {len(b64)} chars ({len(b64)/1024:.0f} KB)")

# 6. Verificar se tem crases (que quebrariam o JS template literal)
if '`' in b64:
    print("ALERTA: base64 contém crase!")
else:
    print("OK: base64 limpo (sem crases)")

# 7. Salvar a string base64 para uso no Python
b64_path = r'C:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\backend\motors\forja\pecas\lobo_sombrio_b64.py'
with open(b64_path, 'w', encoding='utf-8') as f:
    f.write('# -*- coding: utf-8 -*-\n')
    f.write('"""Base64 da imagem PNG do Lobo Sombrio com fundo removido."""\n\n')
    f.write(f'LOBO_PNG_B64 = "{b64}"\n')
print(f"Base64 Python module salvo: {b64_path}")
