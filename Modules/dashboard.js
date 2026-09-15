var ModuleClass = (function(NexusBehaviour) {

	return class NexusDashboard extends NexusBehaviour {

		defaults = {
			title: 'omniNexus'
		};

		awake() {
			document.documentElement.innerHTML = `<head><title>${this.CONFIG.workspace} Hub</title></head><body><div class="container" id="app"></div></body>`;
			
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
				.action-btn { background: #334155; border: 1px solid #475569; color: #f8fafc; padding: 8px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.15s, border-color 0.15s, color 0.15s; }
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
			
			const routerData = this.loadGlobal('router', { routes: [] });
			const verData = this.loadGlobal('version', { version: '1.0.0' });
			const currentVersion = typeof verData === 'object' && verData?.version ? verData.version : String(verData);
			const globalSettings = this.loadGlobal('settings', {});

			const routes = routerData.routes || [];
			let modulesHTML = '';

			if (routes.length === 0) {
				modulesHTML = '<div style="color:#64748b;font-size:14px;">No registered modules found in this workspace.</div>';
			} else {
				routes.forEach(m => {
					let targetUrl = m.launchUrl;
					if (m.subpath) {
						const cleanSub = m.subpath.replace(/^\/+|\/+$/g, '');
						targetUrl = `https://${this.CONFIG.dashboardHost}${this.CONFIG.dashboardPath}/${cleanSub}`;
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
						<h1 class="brand-title">⚡ ${this.config?.title || 'omniNexus'} <span>// ${this.workspace}</span></h1>
						<div class="brand-subtitle">Environment Hub & Launcher</div>
					</div>
					<div class="meta-pill">${this.CONFIG.provider.toUpperCase()} : v${currentVersion}</div>
				</header>

				<div>
					<div class="section-title">Available Modules</div>
					<div class="modules-grid">
						${modulesHTML}
					</div>
				</div>

				<details>
					<summary>📦 Backup & Data Transfer (${this.workspace})</summary>
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

				<details>
					<summary>⚙️ Workspace Configuration (${this.workspace})</summary>
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
					this.saveGlobal('settings', val);
					alert('Configuration saved successfully.');
				} catch (e) {
					alert('JSON validation error: ' + e.message);
				}
			};
		}

		getAllWorkspaceData() {
			const prefix = `nexus_${this.workspace}_`;
			let keys = [];

			if (typeof this._GM_list === 'function') {
				keys = this._GM_list().filter(k => k.startsWith(prefix)).map(k => k.replace(prefix, ''));
			} else {
				keys = ['trello', 'todo', 'pass', 'word', 'sheet', 'settings', 'router'];
			}

			const payload = {
				__meta: {
					workspace: this.workspace,
					timestamp: Date.now(),
					exportedAt: new Date().toISOString()
				},
				data: {}
			};

			keys.forEach(k => {
				const val = this.loadGlobal(k, null);
				if (val !== null) {
					payload.data[k] = val;
				}
			});

			return payload;
		}

		applyWorkspaceData(payload) {
			const data = payload.data || payload;
			let count = 0;

			for (const key in data) {
				if (key === '__meta') continue;
				this.saveGlobal(key, data[key]);
				count++;
			}

			alert(`Successfully restored ${count} data sections. The page will reload.`);
			window.location.reload();
		}

		initBackupHandlers() {
			const area = document.getElementById('backup-text');
			const fileInput = document.getElementById('file-input');
			const copyBtn = document.getElementById('btn-copy-text');

			document.getElementById('btn-export-text').onclick = () => {
				const data = this.getAllWorkspaceData();
				area.value = JSON.stringify(data, null, 2);
			};

			copyBtn.onclick = () => {
				if (!area.value.trim()) {
					const data = this.getAllWorkspaceData();
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
					this.applyWorkspaceData(parsed);
				} catch (e) {
					console.error('[Backup Import Error]', e);
					alert(`JSON Parse Error: ${e.message}\n\nPlease ensure the full payload was copied.`);
				}
			};

			document.getElementById('btn-export-file').onclick = () => {
				const data = this.getAllWorkspaceData();
				const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `nexus_backup_${this.workspace}_${Date.now()}.json`;
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
						this.applyWorkspaceData(parsed);
					} catch (err) {
						alert('File read error: Invalid JSON format.');
					}
				};
				reader.readAsText(file);
			};
		}
	};

})(NexusBehaviour);