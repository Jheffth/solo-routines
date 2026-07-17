from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from config import APP_NAME, APP_VERSION
from database import criar_tabelas
from seed import popular_banco

# Routers
from auth.router import router as auth_router
from routers.rotinas import router as rotinas_router
from routers.tarefas import router as tarefas_router
from routers.execucoes import router as execucoes_router
from routers.dashboard import router as dashboard_router
from routers.perfil import router as perfil_router
from routers.recompensas import router as recompensas_router
from routers.conquistas import router as conquistas_router
from routers.configuracoes import router as configuracoes_router
from routers.gerencial import router as gerencial_router
from routers.bot_telegram import router as bot_router
from routers.dungeons import router as dungeons_router

# ==============================================================================
# APP
# ==============================================================================
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Solo Routines — Sistema Gamificado de Rotinas Pessoais",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# API ROUTES
# ==============================================================================
@app.get("/api/health", tags=["sistema"])
def health():
    return {"status": "ok", "app": APP_NAME, "version": APP_VERSION}

app.include_router(auth_router,          prefix="/api")
app.include_router(rotinas_router,       prefix="/api")
app.include_router(tarefas_router,       prefix="/api")
app.include_router(execucoes_router,     prefix="/api")
app.include_router(dashboard_router,     prefix="/api")
app.include_router(perfil_router,        prefix="/api")
app.include_router(recompensas_router,   prefix="/api")
app.include_router(conquistas_router,    prefix="/api")
app.include_router(configuracoes_router, prefix="/api")
app.include_router(gerencial_router,     prefix="/api")
app.include_router(bot_router,           prefix="/api")
app.include_router(dungeons_router,      prefix="/api")

# ==============================================================================
# STATIC FILES (FRONTEND)
# ==============================================================================
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if not os.path.exists(frontend_path):
    frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend"))

print(f"[STATIC] frontend_path = {frontend_path} (exists={os.path.exists(frontend_path)})")

if os.path.exists(frontend_path):
    for subdir in ("css", "js", "assets", "img", "fonts"):
        full = os.path.join(frontend_path, subdir)
        if os.path.exists(full):
            app.mount(f"/{subdir}", StaticFiles(directory=full), name=f"static-{subdir}")

    @app.get("/favicon.png", include_in_schema=False)
    def favicon():
        f = os.path.join(frontend_path, "favicon.png")
        idx = os.path.join(frontend_path, "index.html")
        return FileResponse(f) if os.path.exists(f) else FileResponse(idx)

    @app.get("/", include_in_schema=False)
    def serve_root():
        idx = os.path.join(frontend_path, "index.html")
        return FileResponse(idx) if os.path.exists(idx) else {"msg": "Frontend não encontrado."}

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str = ""):
        # Não intercepta rotas da API
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="API route not found")
        idx = os.path.join(frontend_path, "index.html")
        return FileResponse(idx) if os.path.exists(idx) else {"msg": "Frontend não encontrado."}

# ==============================================================================
# SCHEDULER — Notificações Telegram automáticas
# ==============================================================================
from apscheduler.schedulers.background import BackgroundScheduler
from routers.bot_telegram import notificar_manha, notificar_tarde, notificar_noite
from database import SessionLocal

scheduler = BackgroundScheduler()

def _job(fn):
    db = SessionLocal()
    try:
        fn(db)
    finally:
        db.close()

scheduler.add_job(lambda: _job(notificar_manha), 'cron', hour=7,  minute=0)
scheduler.add_job(lambda: _job(notificar_tarde), 'cron', hour=14, minute=0)
scheduler.add_job(lambda: _job(notificar_noite), 'cron', hour=21, minute=0)

# ==============================================================================
# STARTUP / SHUTDOWN
# ==============================================================================
@app.on_event("startup")
async def startup():
    try:
        criar_tabelas()
        popular_banco()
        print("[STARTUP] ✅ Banco inicializado.")
    except Exception as e:
        print(f"[STARTUP WARNING] {e}")

    try:
        scheduler.start()
        print("[STARTUP] ✅ Scheduler iniciado (07h, 14h, 21h).")
    except Exception as e:
        print(f"[STARTUP WARNING] Scheduler: {e}")

    print(f"\n{'='*60}")
    print(f"  {APP_NAME} v{APP_VERSION} — Iniciado!")
    print(f"  Docs:  /api/docs")
    print(f"  Bot:   /api/bot/status")
    print(f"{'='*60}\n")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
