from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Hotspot:
    rank: int
    name: str
    primary_industry: str
    change_pct: str = ""
    limit_up_count: str = ""
    net_inflow_100m: str = ""
    score: int = 0
    catalyst: str = ""
    leaders: list[str] = field(default_factory=list)
    chain_notes: str = ""
    subtopics: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Project:
    sector: str
    company_name: str
    region: str = ""
    founded_at: str = ""
    business: str = ""
    product: str = ""
    round_name: str = ""
    amount: str = ""
    investors: str = ""
    team: str = ""
    description: str = ""
    contact: str = ""


@dataclass
class ContactInfo:
    phones: list[str] = field(default_factory=list)
    websites: list[str] = field(default_factory=list)
    emails: list[str] = field(default_factory=list)
    source_urls: list[str] = field(default_factory=list)
    confidence: str = ""
    note: str = ""

    def to_prd_string(self) -> str:
        parts: list[str] = []
        if self.phones:
            parts.append("电话：" + "；".join(self.phones))
        if self.websites:
            parts.append("官网：" + "；".join(self.websites))
        if self.emails:
            parts.append("邮箱：" + "；".join(self.emails))
        return "；".join(parts)


@dataclass
class RunContext:
    date: str
    run_dir: Path
    config: dict[str, Any]
    offline_demo: bool = False
    manifest: dict[str, Any] = field(default_factory=dict)

    @property
    def mappings_dir(self) -> Path:
        return self.run_dir / "mappings"

    @property
    def reports_dir(self) -> Path:
        return self.run_dir / "reports"

    @property
    def logs_dir(self) -> Path:
        return self.run_dir / "logs"

