"""
Remove o fundo preto da imagem da Pena do Punidor e salva como PNG com transparência.
Depois gera a string base64 para embutir diretamente no SVG.
"""
from PIL import Image
import base64
import io

# 1. Abrir a imagem original
img = Image.open(r'C:\Users\jcs88\.gemini\antigravity\brain\c4ddb023-5be6-4ea9-aed8-8d80216db450\pena_punidor_notext_1785590529058.jpg')
img = img.convert('RGBA')
w, h = img.size
print(f"Imagem original: {w}x{h}")

# 2. Remover fundo com Flood Fill (Magic Wand)
# A imagem tem um fundo uniforme escuro (geralmente #111111).
# Se usarmos threshold global, apagamos o metal da lâmina.
# O Flood Fill apaga apenas os pixels escuros CONECTADOS às bordas.
pixels = img.load()
visited = set()
queue = []

# Adicionar bordas à fila inicial
for x in range(w):
    queue.append((x, 0))
    queue.append((x, h - 1))
for y in range(h):
    queue.append((0, y))
    queue.append((w - 1, y))

# Ponto de referência de cor da borda (0,0)
bg_r, bg_g, bg_b, _ = pixels[0, 0]

while queue:
    x, y = queue.pop()
    if (x, y) in visited:
        continue
    visited.add((x, y))
    
    r, g, b, a = pixels[x, y]
    # Calcular distância de cor do fundo
    dist = max(abs(r - bg_r), abs(g - bg_g), abs(b - bg_b))
    
    if dist < 25: # Tolerância para variações no fundo do DALL-E
        pixels[x, y] = (0, 0, 0, 0) # Fica transparente
        
        # Expandir para vizinhos
        if x > 0: queue.append((x - 1, y))
        if x < w - 1: queue.append((x + 1, y))
        if y > 0: queue.append((x, y - 1))
        if y < h - 1: queue.append((x, y + 1))
    elif dist < 40:
        # Borda suave (anti-aliasing)
        alpha = int((dist - 25) / 15 * 255)
        pixels[x, y] = (r, g, b, alpha)
        # Não expande mais a partir de pixels de transição

# 3. Crop rígido.
# A imagem do DALL-E tem 1024x1024, mas a arte útil (a pena) está centralizada
# e não ocupa as bordas de verdade. O fundo preto do DALL-E nunca é 0 absoluto,
# então o getbbox() achou (0,0,1024,1024). Vamos fazer um crop manual da área útil
# para remover o ruído das bordas.
# Crop fixo: margem de 160px de cada lado e 130px cima/baixo.
left = 160
top = 130
right = 1024 - 160
bottom = 1024 - 130
img = img.crop((left, top, right, bottom))
print(f"Após crop manual: {img.size[0]}x{img.size[1]}")

# 4. Salvar como PNG com transparência
output_path = r'C:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\frontend\assets\badges\pena-punidor.png'
img.save(output_path, 'PNG', optimize=True)
print(f"PNG salvo: {output_path}")

# 5. Gerar base64
buffer = io.BytesIO()
img.save(buffer, format='PNG', optimize=True)
b64 = base64.b64encode(buffer.getvalue()).decode('ascii')
print(f"Base64 size: {len(b64)} chars ({len(b64)/1024:.0f} KB)")

# 6. Salvar a string base64 para uso no Python
b64_path = r'C:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\backend\motors\forja\pecas\pena_punidor_b64.py'
with open(b64_path, 'w', encoding='utf-8') as f:
    f.write('# -*- coding: utf-8 -*-\n')
    f.write('"""Base64 da imagem PNG da Pena do Punidor com fundo removido."""\n\n')
    f.write(f'PENA_PNG_B64 = "{b64}"\n')
print(f"Base64 Python module salvo: {b64_path}")
