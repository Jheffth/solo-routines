import sys

log_file = r"C:\Users\jcs88\.gemini\antigravity\brain\4cb81fd2-1dcb-402f-979d-9e1edcaa1234\.system_generated\tasks\task-1654.log"
out_file = "v4.patch"

with open(log_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if line.startswith("diff --git"):
        start_idx = i
        break

if start_idx != -1:
    with open(out_file, "w", encoding="utf-8") as f:
        f.writelines(lines[start_idx:])
    print("Patch extracted successfully")
else:
    print("Diff not found")
