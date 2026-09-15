#!/usr/bin/env python3
import os
import re
import json
import zipfile
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
CORE_DIR = ROOT_DIR / "Core"
MODULES_DIR = ROOT_DIR / "Modules"
SERVER_DIR = ROOT_DIR / "Server"
RELEASE_DIR = ROOT_DIR / "Release"
VERSION_FILE = ROOT_DIR / "version.json"
CONNECTOR_FILE = ROOT_DIR / "omniNexus.user.js"

IGNORE_EXTENSIONS = {".git", ".DS_Store", "Thumbs.db"}
IGNORE_DIRS = {"__pycache__", ".pytest_cache", "venv", ".venv", ".env", "db.sqlite3", ".idea", ".vscode"}

def bump_version():
    today = datetime.now().strftime("%Y.%m.%d")
    current_version = ""

    if VERSION_FILE.exists():
        try:
            with open(VERSION_FILE, "r", encoding="utf-8") as f:
                current_version = json.load(f).get("version", "")
        except Exception:
            current_version = ""

    if current_version.startswith(today):
        parts = current_version.split(".")
        if len(parts) == 3:
            new_version = f"{today}.1"
        elif len(parts) == 4 and parts[3].isdigit():
            new_version = f"{today}.{int(parts[3]) + 1}"
        else:
            new_version = f"{today}.1"
    else:
        new_version = today

    payload = {
        "version": new_version,
        "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=4, ensure_ascii=False)
    print(f"[Version] Bumped root version.json -> v{new_version}")

    sync_userscript_version(new_version)
    return new_version

def sync_userscript_version(new_version):
    if CONNECTOR_FILE.exists():
        try:
            content = CONNECTOR_FILE.read_text(encoding="utf-8")
            updated = re.sub(
                r"(//\s*@version\s+)[^\r\n]+",
                rf"\g<1>{new_version}",
                content
            )
            CONNECTOR_FILE.write_text(updated, encoding="utf-8")
            print(f"[Sync] Updated @version in {CONNECTOR_FILE.name} -> v{new_version}")
        except Exception as e:
            print(f"[Warning] Failed to sync userscript @version: {e}")

def package_client(output_zip):
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
        if VERSION_FILE.exists():
            zipf.write(VERSION_FILE, arcname=VERSION_FILE.name)

        if CONNECTOR_FILE.exists():
            zipf.write(CONNECTOR_FILE, arcname=CONNECTOR_FILE.name)

        for folder in [CORE_DIR, MODULES_DIR]:
            if folder.exists():
                for root, dirs, files in os.walk(folder):
                    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith(".")]
                    for file in files:
                        if file in IGNORE_EXTENSIONS:
                            continue
                        file_path = Path(root) / file
                        arcname = file_path.relative_to(ROOT_DIR)
                        zipf.write(file_path, arcname=arcname)

    size_kb = output_zip.stat().st_size / 1024
    print(f"[OK] Created Client Archive: {output_zip.name} ({size_kb:.1f} KB)")

def package_server(output_zip):
    if not SERVER_DIR.exists():
        print("[Skip] Server/ directory does not exist. Skipping server package.")
        return

    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(SERVER_DIR):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith(".")]
            for file in files:
                if file in IGNORE_EXTENSIONS or file.endswith(".pyc"):
                    continue
                file_path = Path(root) / file
                arcname = file_path.relative_to(SERVER_DIR)
                zipf.write(file_path, arcname=arcname)

    size_kb = output_zip.stat().st_size / 1024
    print(f"[OK] Created Server Archive: {output_zip.name} ({size_kb:.1f} KB)")

def main():
    version = bump_version()
    print(f"=== omniNexus Release Packaging (v{version}) ===")

    RELEASE_DIR.mkdir(parents=True, exist_ok=True)

    client_zip = RELEASE_DIR / f"omniNexus-Client-{version}.zip"
    package_client(client_zip)

    server_zip = RELEASE_DIR / f"omniNexus-Server-{version}.zip"
    package_server(server_zip)

    print(f"=== Build finished! Artifacts available in: {RELEASE_DIR.name}/ ===")

if __name__ == "__main__":
    main()