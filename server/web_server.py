from __future__ import annotations

import cgi
import json
import os
import threading
import uuid
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from agent.models import RunContext
from agent.pipeline import InvestmentPipeline
from agent.settings import ROOT, load_config
from agent.sources.glm import GLMClient

from agent.sources.akshare import AKShareClient
from agent.utils.fs import create_run_dir
from agent.web_export import export_run_to_web


WEB_DIR = ROOT / "web"
JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.RLock()


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _update_job(job_id: str, **changes: Any) -> None:
    with JOBS_LOCK:
        if job_id in JOBS:
            JOBS[job_id].update(changes)


def _run_import_job(job_id: str, run_dir: Path, mapping_dir: Path, files: list[tuple[str, bytes]], date: str, config: dict[str, Any]) -> None:
    _update_job(job_id, status="running", stage="contacts", message="正在准备联系方式采集", started_at=_now())

    def on_progress(progress: dict[str, Any]) -> None:
        current = int(progress.get("current") or 0)
        total = int(progress.get("total") or 0)
        _update_job(job_id, stage=str(progress.get("stage") or "contacts"), progress={"current": current, "total": total}, message=str(progress.get("message") or ""))

    try:
        ctx = RunContext(date=date, run_dir=run_dir, config=config)
        ctx.manifest["mapping"] = {
            "status": "imported",
            "source": "web_upload",
            "outputs": [str(mapping_dir / filename) for filename, _ in files],
            "sector_count": len(files),
            "self_check": {"columns_pending": True, "contact_blank_in_stage2": False},
        }
        pipeline = InvestmentPipeline()
        pipeline.run_contacts(ctx, mapping_dir, progress_callback=on_progress)
        _update_job(job_id, stage="bd_followup", message="联系方式完成，正在汇总 BD 总表")
        pipeline.run_merge(ctx, mapping_dir)
        _update_job(job_id, stage="export", message="正在生成看板数据")
        payload = export_run_to_web(run_dir)
        _update_job(job_id, status="completed", stage="completed", progress={"current": 1, "total": 1}, message="导入和产出已完成", finished_at=_now(), result={"run_id": run_dir.name, "file_count": len(files), "stats": payload["stats"], "web_url": "/"})
    except Exception as exc:  # noqa: BLE001 - expose a readable job error in the UI.
        _update_job(job_id, status="failed", stage="failed", message="后台任务失败", finished_at=_now(), error=f"{type(exc).__name__}: {exc}")


class MappingDashboardHandler(SimpleHTTPRequestHandler):
    server_version = "HardtechMappingServer/0.3"

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/status":
            config = load_config()
            self._send_json(200, {"ok": True, "web_dir": str(WEB_DIR), "data_file": str(WEB_DIR / "data" / "site_data.json"), "glm": GLMClient.status(config), "market_data": AKShareClient.status(config), "jobs": len(JOBS)})
            return
        if path.startswith("/api/import-jobs/"):
            job_id = path.rsplit("/", 1)[-1]
            with JOBS_LOCK:
                job = dict(JOBS.get(job_id) or {})
            if not job:
                self._send_json(404, {"ok": False, "error": "找不到该后台任务"})
            else:
                self._send_json(200, {"ok": True, **job})
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/import-mappings":
            self._send_json(404, {"ok": False, "error": "unknown endpoint"})
            return
        try:
            result = self._enqueue_import()
            self._send_json(202, result)
        except Exception as exc:  # noqa: BLE001 - return a readable UI error.
            self._send_json(500, {"ok": False, "error": str(exc)})

    def _enqueue_import(self) -> dict[str, Any]:
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            raise ValueError("请使用 multipart/form-data 上传 .xlsx 文件。")
        form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type})
        raw_files = form["files"] if "files" in form else []
        fields = raw_files if isinstance(raw_files, list) else [raw_files]
        files: list[tuple[str, bytes]] = []
        for field in fields:
            filename = Path(str(getattr(field, "filename", "") or "")).name
            if not filename.lower().endswith(".xlsx"):
                continue
            data = field.file.read() if getattr(field, "file", None) else b""
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
        thread = threading.Thread(target=_run_import_job, args=(job_id, run_dir, mapping_dir, files, date, load_config()), daemon=True)
        thread.start()
        return {"ok": True, "accepted": True, "job_id": job_id, "run_id": run_dir.name, "file_count": len(files), "message": "任务已提交，前端可通过 job_id 查询进度", "web_url": "/"}

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def run_server(port: int = 4173) -> None:
    handler = partial(MappingDashboardHandler, directory=str(WEB_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Hardtech Mapping dashboard: http://127.0.0.1:{port}/")
    print(f"GLM API key env: {GLMClient.status(load_config())['api_key_env']}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server(int(os.getenv("MAPPING_PORT", "4173")))


