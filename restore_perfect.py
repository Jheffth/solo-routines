import os

patch_file = "clean_v4.patch"
css_file = r"c:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\frontend\css\estandarte.css"

with open(patch_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_css = []
# Lines 10 to 219 (1-indexed) are lines[9:219]
for i in range(9, 219):
    line = lines[i]
    if line.startswith("+"):
        new_css.append(line[1:])

# Inject the edit button CSS globally!
edit_btn_css = """
/* Botão de Editar Epígrafe */
.est-btn-editar-epigrafe {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  opacity: 0;
  transform: translateX(-5px);
}
.est-btn-editar-epigrafe svg {
  width: 12px;
  height: 12px;
}
.pt-v4-epigrafe:hover .est-btn-editar-epigrafe {
  opacity: 1;
  transform: translateX(0);
}
.est-btn-editar-epigrafe:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}
"""
new_css.append(edit_btn_css)

# Then we resume from line 327 (1-indexed) which is lines[326] (LAYOUT MOBILE 900px)
# We go up to line 414 (1-indexed) which is lines[413] (closing brace of keyframes)
for i in range(326, 414):
    line = lines[i]
    if line.startswith("+"):
        new_css.append(line[1:])

# We must ADD the missing closing brace for the 900px media query!
new_css.append("}\n\n")

# Now append lines 415 to 429 (1-indexed) which is lines[414:428]
for i in range(414, 428):
    line = lines[i]
    if line.startswith("+"):
        new_css.append(line[1:])

with open(css_file, "a", encoding="utf-8") as f:
    f.writelines(new_css)

print("V4 Perfect State Restored Correctly.")
