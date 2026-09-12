#!/usr/bin/env python3
import os
import re
import json
import zipfile
from datetime import datetime
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
EXTENSION_DIR = ROOT_DIR / "Extension"
SERVER_DIR = ROOT_DIR / "Server"
RELEASE_DIR = ROOT_DIR / "Release"
VERSION_FILE = EXTENSION_DIR / "version.json"

IGNORE_EXTENSIONS = {".git", ".DS_Store", "Thumbs.db"}
IGNORE_DIRS = {"__pycache__", ".pytest_cache", "venv", ".env", "db.sqlite3"}


def bump_version():
	"""
	Automatically increments version based on CalVer (YYYY.MM.DD).
	If building multiple times on the same day, appends .1, .2, etc.
	"""
	today = datetime.now().strftime("%Y.%m.%d")
	current_version = ""

	if VERSION_FILE.exists():
		try:
			with open(VERSION_FILE, "r", encoding="utf-8") as f:
				current_version = json.load(f).get("version", "")
		except Exception:
			current_version = ""

	# Determine next version
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

	# 1. Update Extension/version.json
	VERSION_FILE.parent.mkdir(parents=True, exist_ok=True)
	payload = {
		"version": new_version,
		"updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
	}
	with open(VERSION_FILE, "w", encoding="utf-8") as f:
		json.dump(payload, f, indent=4, ensure_ascii=False)
	print(f"[Version] Bumped Extension/version.json -> v{new_version}")

	# 2. Sync @version in omniNexus.user.js if present
	sync_userscript_version(new_version)

	return new_version


def sync_userscript_version(new_version):
	"""Automatically keeps Tampermonkey @version header in sync"""
	candidates = [
		ROOT_DIR / "omniNexus.user.js",
		EXTENSION_DIR / "omniNexus.user.js"
	]
	for script_file in candidates:
		if script_file.exists():
			try:
				content = script_file.read_text(encoding="utf-8")
				updated = re.sub(
					r"(//\s*@version\s+)[^\r\n]+",
					rf"\g<1>{new_version}",
					content
				)
				script_file.write_text(updated, encoding="utf-8")
				print(f"[Sync] Updated @version in {script_file.name} -> v{new_version}")
			except Exception as e:
				print(f"[Warning] Failed to sync userscript @version: {e}")


def zip_folder(source_dir, output_zip, extra_files=None):
	if not source_dir.exists():
		print(f"[Skip] Directory not found: {source_dir.name}")
		return False

	with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
		if extra_files:
			for extra in extra_files:
				if extra.exists():
					zipf.write(extra, arcname=extra.name)

		for root, dirs, files in os.walk(source_dir):
			dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith(".")]

			for file in files:
				if file in IGNORE_EXTENSIONS or file.endswith(".pyc"):
					continue

				file_path = Path(root) / file
				arcname = file_path.relative_to(ROOT_DIR)
				zipf.write(file_path, arcname=arcname)

	size_kb = output_zip.stat().st_size / 1024
	print(f"[OK] Created: {output_zip.name} ({size_kb:.1f} KB)")
	return True


def main():
	# Automatically bump version on every build run
	version = bump_version()
	print(f"=== omniNexus Release Builder (v{version}) ===")

	RELEASE_DIR.mkdir(parents=True, exist_ok=True)

	# 1. Package Extension (Offline / Local deployment)
	ext_zip_name = f"omniNexus-Extension-{version}.zip"
	ext_zip_path = RELEASE_DIR / ext_zip_name

	connector_file = ROOT_DIR / "omniNexus.user.js"
	extra_files = [connector_file] if connector_file.exists() else []

	zip_folder(EXTENSION_DIR, ext_zip_path, extra_files=extra_files)

	# 2. Package Server (Django / Docker deployment)
	if SERVER_DIR.exists():
		server_zip_name = f"omniNexus-Server-{version}.zip"
		server_zip_path = RELEASE_DIR / server_zip_name
		zip_folder(SERVER_DIR, server_zip_path)
	else:
		print("[Info] Server/ directory is not ready yet. Skipping server package.")

	print(f"=== Build finished! Artifacts saved to: {RELEASE_DIR.name}/ ===")


if __name__ == "__main__":
	main()