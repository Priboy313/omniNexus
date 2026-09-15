var ModuleClass = (function(NexusBehaviour) {

	return class NexusDashboard extends NexusBehaviour {

		moduleIcon = '⚡';

		defaults = {
			title: 'omniNexus'
		};

		awake() {
			document.documentElement.innerHTML = `<head><title>${this.env.workspace} Hub</title></head><body><div class="container" id="app"></div></body>`;
			
			this.addCSS(`
				* { box-sizing: border-box; }
				body { margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #f8fafc; min-height: 100vh; padding: 40px 20px; display: flex; justify-content: center; }
				.container { width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 32px; }
				
				header { border-bottom: 1px solid #1e293b; padding-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
				.brand-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0; color: #f8fafc; display: flex; align-items: center; gap: 10px; }
				.brand-title span { color: #38bdf8; }
				.brand-subtitle { font-size: 14px; color: #64748b; margin-top: 6px; }
				.meta-pill { font-family: monospace; font-size: 12px; background: #1e293b; border: 1px solid #334155; padding: 6px 12px; border-radius: 20px; color: #94a3b8; }

				.section-title { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin: 0 0 16px 0; font-weight: 600; }
				.modules-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
				.module-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; text-decoration: none; color: inherit; transition: border-color 0.2s, transform 0.15s; }
				.module-card:hover { border-color: #38bdf8; transform: translateY(-2px); }
				.module-card h3 { margin: 0 0 8px 0; font-size: 16px; color: #f8fafc; }
				.module-card p { margin: 0 0 16px 0; font-size: 13px; color: #94a3b8; line-height: 1.4; flex-grow: 1; }
				.module-btn { background: #334155; border: 1px solid #475569; color: #38bdf8; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-align: center; }
				.module-card:hover .module-btn { background: #0284c7; color: #fff; border-color: #0284c7; }

				details { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-size: 14px; }
				summary { cursor: pointer; color: #94a3b8; font-weight: 600; user-select: none; }
				textarea { width: 100%; height: 160px; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 6px; padding: 10px; margin-top: 12px; font-family: monospace; font-size: 12px; }
				
				.btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
				.action-btn { background: #334155; border: 1px solid #475569; color: #f8fafc; padding: 8px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.15s; }
				.action-btn:hover { background: #475569; }
				.action-btn.primary { background: #0284c7; border-color: #0284c7; color: white; }
				.action-btn.primary:hover { background: #0369a1; }
				.action-btn.success { background: #10b981; border-color: #10b981; color: white; }
				.action-btn.success:hover { background: #059669; }
				.action-btn.btn-copied { background: #10b981 !important; border-color: #10b981 !important; color: white !important; }
			`);
		}

		start() {
			this.render();
		}

		render() {
			const app = document.getElementById('app');
			
			const manifest = this.storage.getGlobal ? this.storage.getGlobal('router', { routes: [] }) : { routes: [] };
			const globalSettings = this.storage.getGlobal ? this.storage.getGlobal('settings', {}) : {};
			const version = this.env.version || '1.0.0';
			const provider = (this.env.provider || 'local').toUpperCase();

			const routes = manifest.routes || [];
			let modulesHTML = '';

			if (routes.length === 0) {
				modulesHTML = '<div style="color:#64748b;font-size:14px;">No registered modules found in this workspace.</div>';
			} else {
				routes.forEach(m => {
					let targetUrl = m.launchUrl;
					if (m.subpath) {
						const cleanSub = m.subpath.replace(/^\/+|\/+$/g, '');
						targetUrl = `https://${this.env.dashboardHost}${this.env.dashboardPath}/${cleanSub}`;
					}

					modulesHTML += `
						<a class="module-card" href="${targetUrl || '#'}" target="${targetUrl?.startsWith('http') ? '_self' : '_blank'}">
							<div>
								<h3>${m.name || m.moduleId}</h3>
								<p>${m.desc || 'omniNexus Workspace Module'}</p>
							</div>
							<div class="module-btn">Launch ➔</div>
						</a>
					`;
				});
			}

			app.innerHTML = `
				<header>
					<div>
						<h1 class="brand-title">⚡ ${this.config?.title || 'omniNexus'} <span>// ${this.env.workspace}</span></h1>
						<div class="brand-subtitle">Environment Hub & Launcher</div>
					</div>
					<div class="meta-pill">${provider} : v${version}</div>
				</header>

				<div>
					<div class="section-title">Available Modules</div>
					<div class="modules-grid">
						${modulesHTML}
					</div>
				</div>

				<!-- Блок бэкапа и переноса данных -->
				<details>
					<summary>📦 Backup & Data Transfer (${this.env.workspace})</summary>
					<p style="color:#94a3b8;font-size:13px;margin:8px 0 0 0;">
						Copy the payload below to transfer data, or paste an existing backup to restore.
					</p>
					
					<textarea id="backup-text" placeholder="Click 'Generate Export' or paste backup payload here..."></textarea>
					
					<div class="btn-row">
						<button class="action-btn primary" id="btn-export-text">Generate Export</button>
						<button class="action-btn" id="btn-copy-text">Copy to Clipboard</button>
						<button class="action-btn success" id="btn-import-text">Apply from Input</button>
						<button class="action-btn" id="btn-export-file">Download .json</button>
						<button class="action-btn" id="btn-import-file">Upload .json</button>
						<input type="file" id="file-input" accept=".json" style="display:none;" />
					</div>
				</details>

				<!-- Блок настроек -->
				<details>
					<summary>⚙️ Workspace Configuration (${this.env.workspace})</summary>
					<textarea id="settings-area">${JSON.stringify(globalSettings, null, 2)}</textarea>
					<div class="btn-row">
						<button class="action-btn primary" id="save-settings-btn">Save Configuration</button>
					</div>
				</details>
			`;

			this.initBackupHandlers();

			document.getElementById('save-settings-btn').onclick = () => {
				try {
					const val = JSON.parse(document.getElementById('settings-area').value);
					if (this.storage.setGlobal) {
						this.storage.setGlobal('settings', val);
					}
					alert('Configuration saved successfully.');
				} catch (e) {
					alert('JSON validation error: ' + e.message);
				}
			};
		}

		initBackupHandlers() {
			const area = document.getElementById('backup-text');
			const fileInput = document.getElementById('file-input');
			const copyBtn = document.getElementById('btn-copy-text');

			// Экспорт данных через Storage Adapter
			document.getElementById('btn-export-text').onclick = () => {
				const data = this.storage.exportAll ? this.storage.exportAll() : {};
				area.value = JSON.stringify(data, null, 2);
			};

			copyBtn.onclick = () => {
				if (!area.value.trim()) {
					const data = this.storage.exportAll ? this.storage.exportAll() : {};
					area.value = JSON.stringify(data, null, 2);
				}
				navigator.clipboard.writeText(area.value).then(() => {
					const prevText = copyBtn.textContent;
					copyBtn.textContent = '✓ Copied!';
					copyBtn.classList.add('btn-copied');
					setTimeout(() => {
						copyBtn.textContent = prevText;
						copyBtn.classList.remove('btn-copied');
					}, 1500);
				});
			};

			// Импорт данных через Storage Adapter
			document.getElementById('btn-import-text').onclick = () => {
				let raw = area.value.trim();
				if (!raw) return alert('Input field is empty.');

				raw = raw
					.replace(/\uFEFF/g, '')
					.replace(/[\u200B-\u200D\u2060]/g, '')
					.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
					.replace(/[“”]/g, '"')
					.replace(/[‘’]/g, "'");

				try {
					const parsed = JSON.parse(raw);
					if (!confirm('Apply backup? Current workspace data will be overwritten.')) return;
					
					if (this.storage.importAll) {
						this.storage.importAll(parsed);
					}
					alert('Workspace data restored successfully. The page will reload.');
					window.location.reload();
				} catch (e) {
					alert(`JSON Parse Error: ${e.message}\n\nPlease ensure the full payload was copied.`);
				}
			};

			document.getElementById('btn-export-file').onclick = () => {
				const data = this.storage.exportAll ? this.storage.exportAll() : {};
				const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `nexus_backup_${this.env.workspace}_${Date.now()}.json`;
				a.click();
				URL.revokeObjectURL(url);
			};

			document.getElementById('btn-import-file').onclick = () => fileInput.click();

			fileInput.onchange = (e) => {
				const file = e.target.files[0];
				if (!file) return;

				const reader = new FileReader();
				reader.onload = (ev) => {
					try {
						const parsed = JSON.parse(ev.target.result);
						if (!confirm('Load data from file? Current workspace data will be overwritten.')) return;
						if (this.storage.importAll) {
							this.storage.importAll(parsed);
						}
						alert('Data loaded successfully. The page will reload.');
						window.location.reload();
					} catch (err) {
						alert('File read error: Invalid JSON format.');
					}
				};
				reader.readAsText(file);
			};
		}
	};

})(NexusBehaviour);