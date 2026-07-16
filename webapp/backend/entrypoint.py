import os
import uvicorn

port = int(os.environ.get("PORT", 8080))
print(f"[ENTRYPOINT] Solo Routines iniciando na porta {port}")

uvicorn.run(
    "main:app",
    host="0.0.0.0",
    port=port,
    log_level="info",
)
