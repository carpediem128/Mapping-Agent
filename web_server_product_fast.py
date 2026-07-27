from __future__ import annotations

import cgi
import os
import threading
import uuid
from datetime import datetime
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import web_server_db
import web_server_product_fixed as base
from agent.models import RunContext
from agent.pipeline import InvestmentPipeline
from agent.settings import ROOT, load_config
from agent.utils.fs import create_run_dir
from scripts.merge_mapping_files import merge_mapping_files


def _run_import_job_fast(job_id: str, run_dir: Path, files: list[tuple[str, bytes]], date: str, config: dict) -> None:
    mapping_dir = run_dir / "mappings"
    paths = [mapping_dir / filename for filename, _ in files]
    try:
        web_server_db._update_job(job_id, status="running", stage="mapping", progress={"current": 1, "total": 1}, message="正在整理项目数据")
        ctx = RunContext(date=date, run_dir=run_dir, config=config)
        ctx.manifest["mapping"] = {"status": "imported", "source": "web_upload", "outputs": [str(path) for path in paths], "sector_count": len(files)}
        mapping_result = merge_mapping_files(paths, run_dir.name)
        web_server_db._update_job(job_id, stage="contacts", progress={"current": 0, "total": 0}, message="项目已入库，正在后台补充联系方式", result={"mapping": mapping_result})

        def on_progress(progress: dict) -> None:
            web_server_db._update_job(job_id, stage="contacts", progress={"current": int(progress.get("current") or 0), "total": int(progress.get("total") or 0)}, message=str(progress.get("message") or ""))

        pipeline = InvestmentPipeline()
        pipeline.run_contacts(ctx, mapping_dir, progress_callback=on_progress)
        merge_mapping_files(paths, run_dir.name)
        web_server_db._update_job(job_id, status="completed", stage="completed", message="项目数据已入库，联系方式补充完成", finished_at=web_server_db._now(), result={"run_id": run_dir.name, "file_count": len(files), "mapping": mapping_result, "web_url": "/"})
    except Exception as exc:  # noqa: BLE001
        web_server_db._update_job(job_id, status="failed", stage="failed", message="导入任务失败", finished_at=web_server_db._now(), error=f"{type(exc).__name__}: {exc}")


class ProductFastDashboardHandler(base.ProductDashboardHandler):
    server_version = "HardtechMappingServer/1.1-product-fast"

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/import-mappings":
            super().do_POST()
            return
        try:
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                raise ValueError("请使用 multipart/form-data 上传 XLSX 文件")
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type})
            raw_files = form["files"] if "files" in form else []
            fields = raw_files if isinstance(raw_files, list) else [raw_files]
            files: list[tuple[str, bytes]] = []
            for field in fields:
                filename = Path(str(getattr(field, "filename", "") or "")).name
                if filename.lower().endswith(".xlsx") and getattr(field, "file", None):
                    content = field.file.read()
                    if content:
                        files.append((filename, content))
            if not files:
                raise ValueError("没有收到有效的 XLSX Mapping 文件")
            date = datetime.now().strftime("%Y%m%d")
            run_dir = create_run_dir(ROOT, f"import{date}")
            mapping_dir = run_dir / "mappings"
            for filename, content in files:
                (mapping_dir / filename).write_bytes(content)
            job_id = f"job-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
            with web_server_db.JOBS_LOCK:
                web_server_db.JOBS[job_id] = {"job_id": job_id, "run_id": run_dir.name, "status": "queued", "stage": "queued", "progress": {"current": 0, "total": 0}, "message": "文件已上传", "created_at": web_server_db._now(), "result": {}}
            threading.Thread(target=_run_import_job_fast, args=(job_id, run_dir, files, date, load_config()), daemon=True).start()
            self._send_json(202, {"ok": True, "accepted": True, "job_id": job_id, "run_id": run_dir.name, "file_count": len(files), "message": "项目数据会先入库，联系方式随后在后台补充", "web_url": "/"})
        except Exception as exc:  # noqa: BLE001
            self._send_json(500, {"ok": False, "error": str(exc)})


def run_server(port: int = 4173) -> None:
    import web_server_customer

    threading.Thread(target=web_server_customer.base._refresh_when_stale, daemon=True).start()
    handler = partial(ProductFastDashboardHandler, directory=str(ROOT / "web"))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Hardtech Mapping dashboard: http://127.0.0.1:{port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server(int(os.getenv("MAPPING_PORT", "4173")))
