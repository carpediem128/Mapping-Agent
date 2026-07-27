from __future__ import annotations

from pathlib import Path

from agent.models import RunContext
from agent.settings import save_manifest
from agent.stages.bd_followup import BdFollowupStage
from agent.stages.contacts import ContactStage
from agent.stages.hotspot import HotspotStage
from agent.stages.mapping import MappingStage


class InvestmentPipeline:
    def __init__(self) -> None:
        self.hotspot_stage = HotspotStage()
        self.mapping_stage = MappingStage()
        self.contact_stage = ContactStage()
        self.bd_stage = BdFollowupStage()

    def run_all(self, ctx: RunContext, qmp_excel: str | None = None) -> dict:
        hotspots = self.hotspot_stage.run(ctx)
        mapping_files = self.mapping_stage.run(ctx, hotspots, qmp_excel=qmp_excel)
        self.contact_stage.run(ctx, mapping_files)
        self.bd_stage.run(ctx, mapping_files)
        save_manifest(ctx.run_dir, ctx.manifest)
        return ctx.manifest

    def run_contacts(self, ctx: RunContext, mapping_dir: Path, progress_callback=None) -> dict:
        mapping_files = sorted(mapping_dir.glob("*.xlsx"))
        self.contact_stage.run(ctx, mapping_files, progress_callback=progress_callback)
        save_manifest(ctx.run_dir, ctx.manifest)
        return ctx.manifest

    def run_merge(self, ctx: RunContext, mapping_dir: Path) -> dict:
        mapping_files = sorted(mapping_dir.glob("*.xlsx"))
        self.bd_stage.run(ctx, mapping_files)
        save_manifest(ctx.run_dir, ctx.manifest)
        return ctx.manifest





