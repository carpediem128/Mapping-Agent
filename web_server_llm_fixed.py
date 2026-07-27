from __future__ import annotations

import json
import os
from functools import partial
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse

import web_server_db as database_server
from agent import mapping_db_pg
from agent.settings import load_config
from agent.sources.glm import GLMClient


database_server.database_status = mapping_db_pg.database_status
database_server.register_exported_payload = mapping_db_pg.register_exported_payload
MAX_LLM_BODY_BYTES = 256 * 1024


class LLMDatabaseMappingDashboardHandler(database_server.DatabaseMappingDashboardHandler):
    server_version = "HardtechMappingServer/0.5-llm"

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/llm/complete-json":
            super().do_POST()
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > MAX_LLM_BODY_BYTES:
                raise ValueError("请求体为空或超过 256 KB 限制")
            body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            system_prompt = str(body.get("system_prompt") or "").strip()
            user_prompt = str(body.get("user_prompt") or "").strip()
            if not system_prompt or not user_prompt:
                raise ValueError("需要提供 system_prompt 和 user_prompt")
            client = GLMClient.from_config(load_config())
            if client is None:
                self._send_json(503, {"ok": False, "error": "GLM 尚未配置或已禁用"})
                return
            result = client.complete_json(system_prompt, user_prompt)
            self._send_json(200, {"ok": True, "model": client.model, "result": result})
        except json.JSONDecodeError:
            self._send_json(400, {"ok": False, "error": "请求体必须是合法 JSON"})
        except ValueError as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})
        except RuntimeError:
            self._send_json(502, {"ok": False, "error": "GLM 请求失败，请检查 API 状态、额度和网络"})


def run_server(port: int = 4173) -> None:
    handler = partial(LLMDatabaseMappingDashboardHandler, directory=str(database_server.WEB_DIR))
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
