from __future__ import annotations

import cgi
import os
import threading
import uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from agent.mapping_db import database_status, register_exported_payload
from agent.models import RunContext
from agent.pipeline import InvestmentPipeline
from agent.settings import ROOT, load_config
from agent.sources.akshare import AKShareClient
from agent.sources.glm import GLMClient
from agent.utils.fs import create_run_dir
from agent.web_export import export_run_to_web
from web_server import JOBS, JOBS_LOCK, MappingDashboardHandler, _now, _update_job


WEB_DIR = ROOT / "web"


def _run_import_job_db(job_id: str, run_dir: Path, mapping_dir: Path, files: list[tuple[str, bytes]], date: str, config: dict) -> None:
    _update_job(job_id, status="running", stage="contacts", message="正在准备联系方式采集", started_at=_now())

    def on_progress(progress: dict) -> None:
        _update_job(job_id, stage=str(progress.get("stage") or "contacts"), progress={"current": int(progress.get("current") or 0), "total": int(progress.get("total") or 0)}, message=str(progress.get("message") or ""))

    try:
        ctx = RunContext(date=date, run_dir=run_dir, config=config)
        ctx.manifest["mapping"] = {"status": "imported", "source": "web_upload_database", "outputs": [str(mapping_dir / filename) for filename, _ in files], "sector_count": len(files), "self_check": {"columns_pending": True, "contact_blank_in_stage2": False}}
        pipeline = InvestmentPipeline()
        pipeline.run_contacts(ctx, mapping_dir, progress_callback=on_progress)
        _update_job(job_id, stage="bd_followup", message="联系方式完成，正在汇总 BD 总表")
        pipeline.run_merge(ctx, mapping_dir)
        _update_job(job_id, stage="export", message="正在生成看板数据并写入数据库")
        payload = export_run_to_web(run_dir)
        db_result = register_exported_payload(payload, run_dir)
        _update_job(job_id, status="completed", stage="completed", progress={"current": 1, "total": 1}, message="导入、产出和数据库登记已完成", finished_at=_now(), result={"run_id": run_dir.name, "file_count": len(files), "stats": payload["stats"], "database": db_result, "web_url": "/"})
    except Exception as exc:  # noqa: BLE001
        _update_job(job_id, status="failed", stage="failed", message="后台任务失败", finished_at=_now(), error=f"{type(exc).__name__}: {exc}")


class DatabaseMappingDashboardHandler(MappingDashboardHandler):
    server_version = "HardtechMappingServer/0.4-db"

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/status":
            config = load_config()
            self._send_json(200, {"ok": True, "web_dir": str(WEB_DIR), "data_file": str(WEB_DIR / "data" / "site_data.json"), "database": database_status(), "glm": GLMClient.status(config), "market_data": AKShareClient.status(config), "jobs": len(JOBS)})
            return
        super().do_GET()

    def _enqueue_import(self) -> dict:
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            raise ValueError("请使用 multipart/form-data 上传 .xlsx 文件。")
        form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type})
        raw_files = form["files"] if "files" in form else []
        fields = raw_files if isinstance(raw_files, list) else [raw_files]
        files: list[tuple[str, bytes]] = []
        for field in fields:
            filename = Path(str(getattr(field, "filename", "") or "")).name
            if filename.lower().endswith(".xlsx") and getattr(field, "file", None):
                data = field.file.read()
                if data:
                    files.append((filename, data))
        if not files:
            raise ValueError("没有收到有效的 .xlsx Mapping 文件。")
        date = datetime.now().strftime("%Y%m%d")
        run_dir = create_run_dir(ROOT, f"import{date}")
        mapping_dir = run_dir / "mappings"
        for filename, data in files:
            (mapping_dir / filename).write_bytes(data)
        job_id = f"job-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        with JOBS_LOCK:
            JOBS[job_id] = {"job_id": job_id, "run_id": run_dir.name, "status": "queued", "stage": "queued", "progress": {"current": 0, "total": 0}, "message": "文件已上传，等待后台执行", "created_at": _now(), "result": {}}
        thread = threading.Thread(target=_run_import_job_db, args=(job_id, run_dir, mapping_dir, files, date, load_config()), daemon=True)
        thread.start()
        return {"ok": True, "accepted": True, "job_id": job_id, "run_id": run_dir.name, "file_count": len(files), "message": "任务已提交，完成后会写入 Mapping 数据库", "web_url": "/"}


def run_server(port: int = 4173) -> None:
    from functools import partial
    from http.server import ThreadingHTTPServer

    handler = partial(DatabaseMappingDashboardHandler, directory=str(WEB_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Hardtech Mapping database dashboard: http://127.0.0.1:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server(int(os.getenv("MAPPING_PORT", "4173")))
