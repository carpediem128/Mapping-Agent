from __future__ import annotations

import os

import web_server_db
from agent import mapping_db_pg


# Keep the existing upload/job implementation and swap only the persistence adapter.
web_server_db.database_status = mapping_db_pg.database_status
web_server_db.register_exported_payload = mapping_db_pg.register_exported_payload


if __name__ == "__main__":
    web_server_db.run_server(int(os.getenv("MAPPING_PORT", "4173")))
