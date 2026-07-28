import os
from PIL import Image

def process_image(filepath):
    print(f"Processing {filepath}...")
    try:
        img = Image.open(filepath).convert("RGBA")
        width, height = img.size
        
        pixels = img.load()
        
        # We will do a BFS flood fill from the corners
        visited = set()
        queue = []
        
        # Threshold for considering a pixel "black background"
        # Since it's generated, it might have slight compression artifacts, so allow up to ~20.
        threshold = 20
        
        def is_bg(x, y):
            if x < 0 or x >= width or y < 0 or y >= height:
                return False
            r, g, b, a = pixels[x, y]
            return r < threshold and g < threshold and b < threshold
            
        # Add corners to queue if they are background
        corners = [(0,0), (width-1, 0), (0, height-1), (width-1, height-1)]
        for cx, cy in corners:
            if is_bg(cx, cy):
                queue.append((cx, cy))
                visited.add((cx, cy))
                
        # To avoid jagged edges, we will do a soft blend for the boundary, but simple transparent is okay for now.
        while queue:
            x, y = queue.pop(0)
            
            # Make it transparent
            r, g, b, a = pixels[x, y]
            pixels[x, y] = (r, g, b, 0)
            
            # Check neighbors
            for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in visited:
                        if is_bg(nx, ny):
                            visited.add((nx, ny))
                            queue.append((nx, ny))
                            
        # Save as PNG
        out_path = filepath.replace(".jpg", ".png")
        img.save(out_path)
        print(f"Saved {out_path}")
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

folder = r"C:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\frontend\assets\img"
for f in os.listdir(folder):
    if f.startswith("rank-") and f.endswith(".jpg"):
        process_image(os.path.join(folder, f))
