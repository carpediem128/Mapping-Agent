from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


@dataclass
class KimiClient:
    """Optional Kimi/Moonshot-compatible client.

    The workflow does not call Kimi unless KIMI_API_KEY is configured.
    This keeps local/offline runs deterministic while leaving a clear
    enrichment slot for topic classification and company research.
    """

    base_url: str
    api_key: str
    model: str
    timeout_seconds: int = 60

    @classmethod
    def from_config(cls, config: dict[str, Any]) -> "KimiClient | None":
        settings = config.get("kimi", {}) or {}
        env_name = str(settings.get("api_key_env") or "KIMI_API_KEY")
        api_key = str(settings.get("api_key") or os.getenv(env_name) or "").strip()
        if not api_key or settings.get("enabled", True) is False:
            return None
        return cls(
            base_url=str(settings.get("base_url") or "https://api.moonshot.cn/v1").rstrip("/"),
            api_key=api_key,
            model=str(settings.get("model") or "kimi-k2-0711-preview"),
            timeout_seconds=int(settings.get("timeout_seconds") or 60),
        )

    @staticmethod
    def status(config: dict[str, Any]) -> dict[str, Any]:
        settings = config.get("kimi", {}) or {}
        env_name = str(settings.get("api_key_env") or "KIMI_API_KEY")
        configured = bool(str(settings.get("api_key") or os.getenv(env_name) or "").strip())
        return {
            "provider": "kimi",
            "enabled": bool(settings.get("enabled", True)),
            "configured": configured,
            "model": str(settings.get("model") or "kimi-k2-0711-preview"),
            "base_url": str(settings.get("base_url") or "https://api.moonshot.cn/v1"),
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
            return json.loads(content)
        except (urllib.error.URLError, TimeoutError, KeyError, IndexError, json.JSONDecodeError) as exc:
            raise RuntimeError("Kimi request failed") from exc

