var ModuleClass = (function(NexusBehaviour) {

	return class OmniPass extends NexusBehaviour {

		defaults = {
			defaultData: {
				categories: ['All', 'Streaming', 'Ecosystems', 'TV & Satellite'],
				accounts: []
			}
		};

		awake() {
			const hubUrl = `https://${this.CONFIG.dashboardHost}${this.CONFIG.dashboardPath}`;

			document.documentElement.innerHTML = `
				<head><title>omniPass // ${this.workspace}</title></head>
				<body>
					<header>
						<div class="header-left">
							<a href="${hubUrl}" class="back-link">← Hub</a>
							<span class="header-title">🔐 omniPass Credentials</span>
							<input type="text" id="pass-search" placeholder="Search service, login, phone, notes..." />
						</div>
						<div class="header-right">
							<button class="hdr-btn" id="btn-add-acc">+ Account</button>
						</div>
					</header>
					
					<div class="filter-bar" id="category-filters"></div>

					<main id="pass-grid"></main>

					<div id="modal-overlay"></div>
				</body>`;

			this.addCSS(`
				* { box-sizing: border-box; }
				body { margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; overflow: hidden; user-select: none; }
				
				header { height: 56px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0; gap: 16px; }
				.header-left, .header-right { display: flex; align-items: center; gap: 12px; }
				.header-left { flex-grow: 1; max-width: 800px; }
				.back-link { color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 4px; background: #334155; }
				.back-link:hover { color: #f8fafc; background: #475569; }
				.header-title { font-weight: 700; font-size: 16px; color: #38bdf8; white-space: nowrap; }
				#pass-search { flex-grow: 1; max-width: 420px; background: #0f172a; border: 1px solid #334155; padding: 6px 12px; border-radius: 4px; color: #f8fafc; font-size: 13px; outline: none; }
				#pass-search:focus { border-color: #38bdf8; }
				.hdr-btn { background: #0284c7; border: none; color: white; padding: 7px 14px; border-radius: 4px; font-weight: 600; font-size: 13px; cursor: pointer; }
				.hdr-btn:hover { background: #0369a1; }

				.filter-bar { height: 44px; background: #111827; border-bottom: 1px solid #1f2937; display: flex; align-items: center; padding: 0 20px; gap: 8px; overflow-x: auto; flex-shrink: 0; }
				.cat-pill { background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
				.cat-pill:hover { background: #1e293b; color: #f8fafc; }
				.cat-pill.active { background: #0284c7; border-color: #0284c7; color: white; }

				#pass-grid { flex-grow: 1; overflow-y: auto; padding: 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; align-content: flex-start; }
				
				.acc-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.15s, transform 0.1s; position: relative; }
				.acc-card:hover { border-color: #38bdf8; transform: translateY(-2px); }
				
				.acc-header { display: flex; align-items: center; justify-content: space-between; }
				.acc-brand { display: flex; align-items: center; gap: 10px; }
				.acc-avatar { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: white; flex-shrink: 0; }
				.acc-name { font-size: 16px; font-weight: 700; color: #f8fafc; }
				.acc-cat-tag { font-size: 11px; background: #0f172a; border: 1px solid #334155; color: #94a3b8; padding: 2px 7px; border-radius: 4px; }
				
				.acc-actions { display: flex; gap: 4px; }
				.card-btn { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 4px; border-radius: 4px; font-size: 12px; }
				.card-btn:hover { color: #f8fafc; background: #334155; }
				.card-btn.del:hover { color: #ef4444; background: rgba(239, 68, 68, 0.15); }

				.data-field { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
				.data-field:hover { border-color: #475569; background: #141f33; }
				.data-field.copied { background: rgba(16, 185, 129, 0.15) !important; border-color: #10b981 !important; }
				.data-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; width: 55px; flex-shrink: 0; }
				.data-val { font-size: 13px; font-family: monospace; color: #f8fafc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow: 1; user-select: text; }
				.data-val.pass-val { color: #38bdf8; font-weight: bold; }
				.copy-icon { font-size: 12px; color: #94a3b8; padding-left: 6px; flex-shrink: 0; }
				.data-field.copied .copy-icon { color: #10b981; font-weight: bold; }

				.acc-notes { background: rgba(15, 23, 42, 0.4); border-left: 3px solid #3b82f6; padding: 6px 10px; font-size: 12px; color: #94a3b8; line-height: 1.4; border-radius: 0 4px 4px 0; user-select: text; }

				#modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(2px); z-index: 9999; justify-content: center; align-items: center; padding: 20px; }
				.modal-card { background: #1e293b; border: 1px solid #475569; border-radius: 8px; width: 100%; max-width: 480px; padding: 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
				.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
				.modal-title { font-size: 18px; font-weight: 700; color: #f8fafc; margin: 0; }
				.close-btn { background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; }
				.close-btn:hover { color: #f8fafc; }

				.form-group { display: flex; flex-direction: column; gap: 6px; }
				.form-label { font-size: 12px; text-transform: uppercase; font-weight: 700; color: #94a3b8; }
				.form-input { background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 8px 12px; border-radius: 4px; font-size: 14px; outline: none; }
				.form-input:focus { border-color: #38bdf8; }
				.form-input.font-mono { font-family: monospace; }
				
				.color-picker-row { display: flex; gap: 8px; margin-top: 4px; }
				.color-circle { width: 24px; height: 24px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; }
				.color-circle.selected { border-color: white; transform: scale(1.1); }

				.modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; border-top: 1px solid #334155; padding-top: 16px; }
				.btn-sub { padding: 8px 16px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
				.btn-save { background: #0284c7; color: white; }
				.btn-save:hover { background: #0369a1; }
				.btn-cancel { background: transparent; color: #94a3b8; }
			`);
		}

		start() {
			this.appData = this.loadGlobal('pass', this.config.defaultData);
			if (!this.appData.accounts) this.appData.accounts = [];
			if (!this.appData.categories) this.appData.categories = ['All'];

			this.activeCategory = 'All';
			this.searchQuery = '';
			this.editingAccId = null;

			this.initEvents();
			this.render();
		}

		initEvents() {
			document.getElementById('btn-add-acc').onclick = () => this.openModal();

			const search = document.getElementById('pass-search');
			search.oninput = (e) => {
				this.searchQuery = e.target.value.trim().toLowerCase();
				this.renderCards();
			};

			window.onkeydown = (e) => {
				if (e.key === 'Escape') this.closeModal();
			};

			const overlay = document.getElementById('modal-overlay');
			overlay.onclick = (e) => {
				if (e.target === overlay) this.closeModal();
			};
		}

		render() {
			this.renderFilters();
			this.renderCards();
		}

		renderFilters() {
			const bar = document.getElementById('category-filters');
			bar.innerHTML = '';

			const allCategories = ['All', ...new Set(this.appData.accounts.map(a => a.category).filter(Boolean))];

			allCategories.forEach(cat => {
				const pill = document.createElement('button');
				pill.className = `cat-pill ${cat === this.activeCategory ? 'active' : ''}`;
				pill.textContent = cat;
				pill.onclick = () => {
					this.activeCategory = cat;
					this.renderFilters();
					this.renderCards();
				};
				bar.appendChild(pill);
			});
		}

		renderCards() {
			const grid = document.getElementById('pass-grid');
			grid.innerHTML = '';

			const filtered = this.appData.accounts.filter(acc => {
				const matchesCat = (this.activeCategory === 'All') || (acc.category === this.activeCategory);
				if (!matchesCat) return false;

				if (!this.searchQuery) return true;
				const text = `${acc.service} ${acc.login} ${acc.notes || ''} ${acc.category || ''}`.toLowerCase();
				return text.includes(this.searchQuery);
			});

			if (filtered.length === 0) {
				grid.innerHTML = `
					<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding-top: 60px;">
						<div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
						<div style="font-size: 16px; font-weight: 600;">No credentials found</div>
					</div>`;
				return;
			}

			filtered.forEach(acc => {
				const card = document.createElement('div');
				card.className = 'acc-card';

				const avatarLetter = (acc.service || '?').charAt(0).toUpperCase();
				const avatarBg = acc.color || '#0284c7';

				card.innerHTML = `
					<div class="acc-header">
						<div class="acc-brand">
							<div class="acc-avatar" style="background:${avatarBg}">${avatarLetter}</div>
							<div>
								<div class="acc-name">${acc.service}</div>
								${acc.category ? `<span class="acc-cat-tag">${acc.category}</span>` : ''}
							</div>
						</div>
						<div class="acc-actions">
							<button class="card-btn edit-btn" title="Edit">✏️</button>
							<button class="card-btn del-btn del" title="Delete">✕</button>
						</div>
					</div>

					<div class="data-field" id="f-login-${acc.id}" title="Click to copy login">
						<span class="data-label">Login</span>
						<span class="data-val">${acc.login}</span>
						<span class="copy-icon">📋</span>
					</div>

					<div class="data-field" id="f-pass-${acc.id}" title="Click to copy password">
						<span class="data-label">Password</span>
						<span class="data-val pass-val">${acc.password}</span>
						<span class="copy-icon">📋</span>
					</div>

					${acc.notes ? `<div class="acc-notes" title="Notes">${acc.notes}</div>` : ''}
				`;

				const loginField = card.querySelector(`#f-login-${acc.id}`);
				loginField.onclick = () => this.copyData(acc.login, loginField);

				const passField = card.querySelector(`#f-pass-${acc.id}`);
				passField.onclick = () => this.copyData(acc.password, passField);

				card.querySelector('.edit-btn').onclick = () => this.openModal(acc);
				card.querySelector('.del-btn').onclick = () => this.deleteAccount(acc.id);

				grid.appendChild(card);
			});
		}

		copyData(text, element) {
			if (!text) return;
			navigator.clipboard.writeText(text).then(() => {
				element.classList.add('copied');
				const icon = element.querySelector('.copy-icon');
				const prev = icon.textContent;
				icon.textContent = '✓';

				setTimeout(() => {
					element.classList.remove('copied');
					icon.textContent = prev;
				}, 1200);
			});
		}

		openModal(acc = null) {
			this.editingAccId = acc ? acc.id : null;
			const overlay = document.getElementById('modal-overlay');
			overlay.style.display = 'flex';

			const isEdit = !!acc;
			const colors = ['#0284c7', '#f97316', '#ec4899', '#ef4444', '#10b981', '#8b5cf6', '#64748b'];
			let selectedColor = acc ? acc.color : colors[0];

			overlay.innerHTML = `
				<div class="modal-card">
					<div class="modal-header">
						<h3 class="modal-title">${isEdit ? 'Edit Account' : 'New Account'}</h3>
						<button class="close-btn" id="m-close">✕</button>
					</div>

					<div class="form-group">
						<span class="form-label">Service / Platform</span>
						<input type="text" class="form-input" id="m-service" placeholder="e.g. Okko or LG Account" value="${acc ? acc.service : ''}" />
					</div>

					<div class="form-group">
						<span class="form-label">Category</span>
						<input type="text" class="form-input" id="m-cat" placeholder="e.g. Streaming, Ecosystems" value="${acc ? acc.category : 'Streaming'}" />
					</div>

					<div class="form-group">
						<span class="form-label">Login / Email / Phone</span>
						<input type="text" class="form-input font-mono" id="m-login" value="${acc ? acc.login : ''}" />
					</div>

					<div class="form-group">
						<span class="form-label">Password / PIN</span>
						<input type="text" class="form-input font-mono" id="m-pass" value="${acc ? acc.password : ''}" />
					</div>

					<div class="form-group">
						<span class="form-label">Notes / Instructions</span>
						<input type="text" class="form-input" id="m-notes" placeholder="e.g. OTP code login or via Google ID" value="${acc && acc.notes ? acc.notes : ''}" />
					</div>

					<div class="form-group">
						<span class="form-label">Card Accent Color</span>
						<div class="color-picker-row" id="m-colors">
							${colors.map(c => `
								<div class="color-circle ${c === selectedColor ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>
							`).join('')}
						</div>
					</div>

					<div class="modal-footer">
						<button class="btn-sub btn-cancel" id="m-cancel">Cancel</button>
						<button class="btn-sub btn-save" id="m-save">${isEdit ? 'Save Changes' : 'Create'}</button>
					</div>
				</div>
			`;

			document.getElementById('m-close').onclick = () => this.closeModal();
			document.getElementById('m-cancel').onclick = () => this.closeModal();

			const colorContainer = document.getElementById('m-colors');
			colorContainer.onclick = (e) => {
				const color = e.target.dataset.color;
				if (color) {
					selectedColor = color;
					colorContainer.querySelectorAll('.color-circle').forEach(el => el.classList.remove('selected'));
					e.target.classList.add('selected');
				}
			};

			document.getElementById('m-save').onclick = () => {
				const service = document.getElementById('m-service').value.trim();
				const category = document.getElementById('m-cat').value.trim();
				const login = document.getElementById('m-login').value.trim();
				const password = document.getElementById('m-pass').value.trim();
				const notes = document.getElementById('m-notes').value.trim();

				if (!service || !login) return alert('Please provide a service name and login.');

				if (isEdit) {
					const target = this.appData.accounts.find(a => a.id === this.editingAccId);
					if (target) {
						target.service = service;
						target.category = category;
						target.login = login;
						target.password = password;
						target.notes = notes;
						target.color = selectedColor;
					}
				} else {
					this.appData.accounts.push({
						id: 'acc_' + Date.now(),
						service,
						category,
						login,
						password,
						notes,
						color: selectedColor
					});
				}

				this.persist();
				this.closeModal();
				this.render();
			};
		}

		closeModal() {
			document.getElementById('modal-overlay').style.display = 'none';
			this.editingAccId = null;
		}

		deleteAccount(id) {
			const acc = this.appData.accounts.find(a => a.id === id);
			if (!acc) return;
			if (!confirm(`Delete credential "${acc.service}" (${acc.login})?`)) return;

			this.appData.accounts = this.appData.accounts.filter(a => a.id !== id);
			this.persist();
			this.render();
		}

		persist() {
			this.saveGlobal('pass', this.appData);
		}
	};

})(NexusBehaviour);