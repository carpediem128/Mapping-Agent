from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class GLMClient:
    """Optional GLM client using the OpenAI-compatible Chat Completions API."""

    base_url: str
    api_key: str
    model: str
    timeout_seconds: int = 60

    @classmethod
    def from_config(cls, config: dict[str, Any]) -> "GLMClient | None":
        settings = config.get("glm", {}) or {}
        env_name = str(settings.get("api_key_env") or "GLM_API_KEY")
        api_key = str(os.getenv(env_name) or "").strip()
        if not api_key or settings.get("enabled", True) is False:
            return None
        return cls(
            base_url=str(settings.get("base_url") or "https://open.bigmodel.cn/api/paas/v4").rstrip("/"),
            api_key=api_key,
            model=str(os.getenv(str(settings.get("model_env") or "GLM_MODEL")) or settings.get("model") or "glm-4.5"),
            timeout_seconds=int(settings.get("timeout_seconds") or 60),
        )

    @staticmethod
    def status(config: dict[str, Any]) -> dict[str, Any]:
        settings = config.get("glm", {}) or {}
        env_name = str(settings.get("api_key_env") or "GLM_API_KEY")
        configured = bool(str(os.getenv(env_name) or "").strip())
        return {
            "provider": "glm",
            "enabled": bool(settings.get("enabled", True)),
            "configured": configured,
            "model": str(os.getenv(str(settings.get("model_env") or "GLM_MODEL")) or settings.get("model") or "glm-4.5"),
            "model_env": str(settings.get("model_env") or "GLM_MODEL"),
            "base_url": str(settings.get("base_url") or "https://open.bigmodel.cn/api/paas/v4"),
            "api_key_env": env_name,
        }

    def complete_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        payload = {
            "model": self.model,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        request = urllib.request.Request(
            self.base_url + "/chat/completions",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": "Bearer " + self.api_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                body = json.loads(response.read().decode("utf-8"))
            content = body["choices"][0]["message"]["content"]
            if isinstance(content, list):
                content = "".join(str(part.get("text", "")) if isinstance(part, dict) else str(part) for part in content)
            return json.loads(content)
        except (urllib.error.URLError, TimeoutError, KeyError, IndexError, json.JSONDecodeError) as exc:
            raise RuntimeError("GLM request failed") from exc
