import os

log_file = r"C:\Users\jcs88\.gemini\antigravity\brain\4cb81fd2-1dcb-402f-979d-9e1edcaa1234\.system_generated\tasks\task-1654.log"
css_file = r"c:\JEFFERSON\PROJETOS\01 - SOLO ROTINAS\webapp\frontend\css\estandarte.css"

with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

new_css = []
in_diff = False
for line in lines:
    if line.startswith("@@"):
        in_diff = True
        continue
    if in_diff:
        if line.startswith("+") and not line.startswith("+++"):
            new_css.append(line[1:])

with open(css_file, "a", encoding="utf-8") as f:
    f.writelines(new_css)

print("Appended successfully.")
