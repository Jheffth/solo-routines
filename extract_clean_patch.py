import sys

log_file = r"C:\Users\jcs88\.gemini\antigravity\brain\4cb81fd2-1dcb-402f-979d-9e1edcaa1234\.system_generated\tasks\task-1654.log"
patch_file = "clean_v4.patch"

with open(log_file, "r", encoding="utf-8", errors="replace") as f:
    lines = f.readlines()

start_idx = -1
for i, line in enumerate(lines):
    if line.startswith("diff --git"):
        start_idx = i
        break

if start_idx != -1:
    with open(patch_file, "w", encoding="utf-8", newline='\n') as f:
        for line in lines[start_idx:]:
            # Ensure proper line endings for git apply
            f.write(line.rstrip('\r\n') + '\n')
    print("Patch created successfully.")
else:
    print("Diff not found.")
