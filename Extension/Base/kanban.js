var ModuleClass = (function(NexusBehaviour) {

	return class NexusTrello extends NexusBehaviour {

		defaults = {
			defaultData: {
				activeBoardId: 'b_1',
				boards: [
					{
						id: 'b_1',
						title: 'Главная доска',
						columns: [
							{ id: 'col_1', title: 'To Do', cards: [] },
							{ id: 'col_2', title: 'In Progress', cards: [] },
							{ id: 'col_3', title: 'Done', cards: [] }
						]
					}
				]
			}
		};

		awake() {
			const hubUrl = `https://${this.CONFIG.dashboardHost}${this.CONFIG.dashboardPath}`;

			document.documentElement.innerHTML = `
				<head><title>omniKanban // ${this.workspace}</title></head>
				<body>
					<header id="trello-header">
						<div class="header-left">
							<a href="${hubUrl}" class="back-link">← В Хаб</a>
							<span class="header-title">⚡ omniKanban</span>
							
							<!-- Вкладки досок -->
							<div class="board-tabs-bar" id="board-tabs"></div>
						</div>
						<div class="header-right">
							<input type="text" id="board-search" placeholder="Поиск карточек и тегов..." />
							<button class="hdr-btn" id="btn-add-col">+ Колонка</button>
						</div>
					</header>
					<main id="board-canvas"></main>
					<div id="modal-container"></div>
				</body>`;

			this.addCSS(`
				* { box-sizing: border-box; }
				body { margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; overflow: hidden; user-select: none; }
				
				/* Шапка */
				header { height: 56px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex-shrink: 0; gap: 16px; }
				.header-left, .header-right { display: flex; align-items: center; gap: 12px; }
				.header-left { flex-grow: 1; overflow: hidden; }
				.back-link { color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 600; padding: 6px 10px; border-radius: 4px; background: #334155; flex-shrink: 0; }
				.back-link:hover { color: #f8fafc; background: #475569; }
				.header-title { font-weight: 700; font-size: 16px; color: #38bdf8; white-space: nowrap; flex-shrink: 0; }
				
				/* Вкладки нескольких досок */
				.board-tabs-bar { display: flex; gap: 4px; align-items: center; overflow-x: auto; padding: 2px 6px; scrollbar-width: none; }
				.board-tabs-bar::-webkit-scrollbar { display: none; }
				.board-tab { background: #0f172a; border: 1px solid #334155; color: #94a3b8; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.15s; }
				.board-tab:hover { background: #1e293b; color: #f8fafc; }
				.board-tab.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
				.tab-del-btn { opacity: 0.6; font-size: 10px; border-radius: 2px; padding: 1px 3px; }
				.tab-del-btn:hover { opacity: 1; background: rgba(0,0,0,0.2); }
				.new-board-btn { background: transparent; border: 1px dashed #475569; color: #38bdf8; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: bold; }
				.new-board-btn:hover { background: #334155; }

				#board-search { width: 220px; background: #0f172a; border: 1px solid #334155; padding: 6px 12px; border-radius: 4px; color: #f8fafc; font-size: 13px; outline: none; }
				#board-search:focus { border-color: #38bdf8; }
				.hdr-btn { background: #0284c7; border: none; color: white; padding: 7px 14px; border-radius: 4px; font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap; }
				.hdr-btn:hover { background: #0369a1; }

				/* Холст доски */
				#board-canvas { flex-grow: 1; overflow-x: auto; padding: 20px; display: flex; gap: 16px; align-items: flex-start; }
				
				/* Столбцы (с поддержкой перетаскивания) */
				.col { background: #1e293b; border: 1px solid #334155; width: 300px; min-width: 300px; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; max-height: calc(100vh - 96px); flex-shrink: 0; transition: border-color 0.15s, opacity 0.15s; }
				.col.col-dragging { opacity: 0.3; }
				.col.col-drop-target { border-left: 3px solid #38bdf8 !important; }
				
				.col-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #334155; cursor: grab; }
				.col-header:active { cursor: grabbing; }
				.col-title { font-weight: 700; font-size: 14px; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
				.col-badge { background: #334155; color: #94a3b8; font-size: 11px; padding: 2px 6px; border-radius: 10px; font-weight: normal; }
				.col-actions { display: flex; gap: 4px; }
				.icon-btn { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 4px; border-radius: 4px; font-size: 12px; }
				.icon-btn:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
				
				/* Список карточек */
				.card-list { flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; min-height: 40px; padding: 2px; }
				
				/* Карточка */
				.card { background: #334155; border: 1px solid #475569; padding: 10px 12px; border-radius: 6px; cursor: pointer; transition: transform 0.1s, border-color 0.15s; display: flex; flex-direction: column; gap: 6px; position: relative; }
				.card:hover { border-color: #38bdf8; transform: translateY(-1px); }
				.card.card-dragging { opacity: 0.2; }
				.card.card-drop-above { border-top: 3px solid #38bdf8 !important; }
				.card.card-drop-below { border-bottom: 3px solid #38bdf8 !important; }

				.card-tags { display: flex; flex-wrap: wrap; gap: 4px; }
				.tag-pill { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px; color: white; }
				.card-title { font-size: 14px; font-weight: 600; line-height: 1.3; color: #f8fafc; word-break: break-word; }
				
				.card-badges { display: flex; gap: 8px; align-items: center; font-size: 11px; color: #94a3b8; margin-top: 4px; flex-wrap: wrap; }
				.badge-item { display: flex; align-items: center; gap: 3px; background: rgba(15, 23, 42, 0.4); padding: 2px 5px; border-radius: 3px; }
				.badge-overdue { color: #f87171; background: rgba(239, 68, 68, 0.15); font-weight: 700; }
				.badge-chk-done { color: #34d399; font-weight: bold; background: rgba(16, 185, 129, 0.15); }

				.add-card-container { margin-top: 8px; }
				.quick-add-btn { background: transparent; border: 1px dashed #475569; color: #94a3b8; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 13px; width: 100%; text-align: left; }
				.quick-add-btn:hover { background: #334155; color: #f8fafc; }
				.quick-add-form { display: none; flex-direction: column; gap: 6px; }
				.quick-add-input { background: #0f172a; border: 1px solid #38bdf8; color: #f8fafc; padding: 8px; border-radius: 4px; font-size: 13px; outline: none; }
				.quick-actions { display: flex; gap: 6px; }
				.btn-sub { padding: 5px 10px; font-size: 12px; border-radius: 3px; border: none; cursor: pointer; font-weight: 600; }
				.btn-save { background: #0284c7; color: white; }
				.btn-cancel { background: transparent; color: #94a3b8; }

				/* Модальное окно */
				#modal-container { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(2px); z-index: 9999; justify-content: center; align-items: center; padding: 20px; }
				.modal-box { background: #1e293b; border: 1px solid #475569; border-radius: 8px; width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); user-select: text; }
				.modal-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
				.modal-title-input { background: #0f172a; border: 1px solid #334155; color: #f8fafc; font-size: 18px; font-weight: 700; padding: 8px 12px; border-radius: 4px; width: 100%; outline: none; }
				.modal-title-input:focus { border-color: #38bdf8; }
				.close-modal-btn { background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; line-height: 1; }
				.close-modal-btn:hover { color: #f8fafc; }
				
				.modal-row { display: flex; gap: 16px; flex-wrap: wrap; }
				.modal-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 200px; }
				.modal-label { font-size: 12px; text-transform: uppercase; font-weight: 700; color: #94a3b8; }
				.modal-date-input { background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 6px 10px; border-radius: 4px; font-size: 13px; outline: none; color-scheme: dark; }

				.modal-desc-area { width: 100%; min-height: 90px; background: #0f172a; border: 1px solid #334155; color: #f8fafc; padding: 10px; border-radius: 4px; font-family: inherit; font-size: 13px; resize: vertical; outline: none; }
				.modal-desc-area:focus { border-color: #38bdf8; }

				/* Вложенный чеклист в модалке */
				.progress-bar-bg { background: #0f172a; height: 6px; border-radius: 3px; overflow: hidden; margin: 4px 0 8px 0; }
				.progress-bar-fill { background: #10b981; height: 100%; width: 0%; transition: width 0.2s ease; }
				.modal-chk-list { display: flex; flex-direction: column; gap: 6px; }
				
				.chk-item { display: flex; align-items: center; justify-content: space-between; background: #0f172a; padding: 7px 10px; border-radius: 4px; border: 1px solid #334155; cursor: grab; }
				.chk-item.chk-dragging { opacity: 0.3; }
				.chk-left { display: flex; align-items: center; gap: 8px; flex-grow: 1; }
				.chk-drag-handle { color: #64748b; font-size: 14px; cursor: grab; user-select: none; }
				.chk-text { font-size: 13px; color: #f8fafc; cursor: pointer; line-height: 1.4; word-break: break-word; }
				.chk-item.done .chk-text { text-decoration: line-through; color: #64748b; }
				
				.chk-actions { display: flex; gap: 4px; }
				.chk-btn { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 2px 4px; border-radius: 3px; font-size: 11px; }
				.chk-btn:hover { color: #f8fafc; background: #1e293b; }
				.chk-btn.del:hover { color: #ef4444; }

				.add-chk-row { display: flex; gap: 6px; margin-top: 8px; }
				.add-chk-input { flex-grow: 1; background: #0f172a; border: 1px solid #334155; padding: 7px 10px; border-radius: 4px; color: #f8fafc; font-size: 13px; outline: none; }
				.add-chk-input:focus { border-color: #38bdf8; }
				
				.tags-container { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
				.tag-del-btn { cursor: pointer; margin-left: 4px; font-weight: bold; }
				.new-tag-btn { background: #334155; border: 1px dashed #64748b; color: #94a3b8; padding: 2px 8px; border-radius: 3px; font-size: 11px; cursor: pointer; }
				
				.modal-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #334155; padding-top: 16px; }
				.danger-btn { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #ef4444; padding: 8px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; }
				.danger-btn:hover { background: #ef4444; color: white; }
				.primary-btn { background: #0284c7; color: white; border: none; padding: 8px 18px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600; }
			`);
		}

		start() {
			const rawData = this.loadGlobal('trello', this.config.defaultData);
			this.appData = this.migrate(rawData);

			this.filterText = '';
			this.draggedCardId = null;
			this.sourceColId = null;
			this.draggedColId = null;
			this.draggedChkId = null;

			this.initGlobalEvents();
			this.render();
		}

		// Бесшовная миграция любых старых форматов данных
		migrate(raw) {
			if (!raw) return this.defaults.defaultData;

			// Если в памяти лежал массив колонок старого Трелло — упаковываем в доску "Главная"
			if (Array.isArray(raw)) {
				return {
					activeBoardId: 'b_main',
					boards: [
						{
							id: 'b_main',
							title: 'Главная',
							columns: this.migrateColumns(raw)
						}
					]
				};
			}

			// Если уже формат с несколькими досками
			if (raw.boards && Array.isArray(raw.boards)) {
				return {
					activeBoardId: raw.activeBoardId || raw.boards[0]?.id || 'b_main',
					boards: raw.boards.map(b => ({
						id: b.id || 'b_' + Date.now(),
						title: b.title || 'Доска',
						columns: this.migrateColumns(b.columns || [])
					}))
				};
			}

			return this.defaults.defaultData;
		}

		migrateColumns(cols) {
			return (cols || []).map(col => ({
				id: col.id || 'col_' + Date.now(),
				title: col.title || 'Колонка',
				cards: (col.cards || []).map(c => {
					if (typeof c === 'string') {
						return { id: 'c_' + Date.now() + Math.random(), title: c, description: '', tags: [], checklist: [], dueDate: '' };
					}
					return {
						id: c.id || ('c_' + Date.now() + Math.random()),
						title: c.title || c.text || 'Без названия',
						description: c.description || '',
						tags: c.tags || [],
						checklist: (c.checklist || []).map(chk => ({
							id: chk.id || ('chk_' + Date.now() + Math.random()),
							text: chk.text || '',
							done: !!chk.done
						})),
						dueDate: c.dueDate || ''
					};
				})
			}));
		}

		getActiveBoard() {
			let board = this.appData.boards.find(b => b.id === this.appData.activeBoardId);
			if (!board && this.appData.boards.length > 0) {
				board = this.appData.boards[0];
				this.appData.activeBoardId = board.id;
			}
			return board;
		}

		initGlobalEvents() {
			document.getElementById('btn-add-col').onclick = () => this.addColumn();
			
			const search = document.getElementById('board-search');
			search.oninput = (e) => {
				this.filterText = e.target.value.trim().toLowerCase();
				this.renderBoard();
			};

			window.onkeydown = (e) => {
				if (e.key === 'Escape') this.closeModal();
			};

			const modalCont = document.getElementById('modal-container');
			modalCont.onclick = (e) => {
				if (e.target === modalCont) this.closeModal();
			};
		}

		render() {
			this.renderTabs();
			this.renderBoard();
		}

		// Рендер вкладок досок в шапке
		renderTabs() {
			const tabsContainer = document.getElementById('board-tabs');
			tabsContainer.innerHTML = '';

			this.appData.boards.forEach(b => {
				const tab = document.createElement('div');
				tab.className = `board-tab ${b.id === this.appData.activeBoardId ? 'active' : ''}`;
				
				tab.innerHTML = `
					<span>${b.title}</span>
					${this.appData.boards.length > 1 ? `<span class="tab-del-btn" title="Удалить доску">✕</span>` : ''}
				`;

				tab.onclick = (e) => {
					if (e.target.classList.contains('tab-del-btn')) return;
					this.appData.activeBoardId = b.id;
					this.persist();
					this.render();
				};

				tab.ondblclick = () => this.renameBoard(b.id);

				if (this.appData.boards.length > 1) {
					tab.querySelector('.tab-del-btn').onclick = (e) => {
						e.stopPropagation();
						this.deleteBoard(b.id);
					};
				}

				tabsContainer.appendChild(tab);
			});

			const addBoardBtn = document.createElement('button');
			addBoardBtn.className = 'new-board-btn';
			addBoardBtn.textContent = '+ Доска';
			addBoardBtn.title = 'Создать новую доску';
			addBoardBtn.onclick = () => this.addBoard();
			tabsContainer.appendChild(addBoardBtn);
		}

		renderBoard() {
			const canvas = document.getElementById('board-canvas');
			canvas.innerHTML = '';

			const currentBoard = this.getActiveBoard();
			if (!currentBoard) return;

			currentBoard.columns.forEach((col, colIdx) => {
				const colEl = document.createElement('div');
				colEl.className = 'col';
				colEl.dataset.colId = col.id;

				const visibleCards = col.cards.filter(c => {
					if (!this.filterText) return true;
					const inTitle = c.title.toLowerCase().includes(this.filterText);
					const inDesc = (c.description || '').toLowerCase().includes(this.filterText);
					const inTags = (c.tags || []).some(t => t.name.toLowerCase().includes(this.filterText));
					return inTitle || inDesc || inTags;
				});

				colEl.innerHTML = `
					<div class="col-header" draggable="true" title="Зажмите для перетаскивания колонки. Двойной клик — переименовать">
						<div class="col-title">
							<span>${col.title}</span>
							<span class="col-badge">${visibleCards.length}</span>
						</div>
						<div class="col-actions">
							<button class="icon-btn del-col-btn" title="Удалить колонку">✕</button>
						</div>
					</div>
					<div class="card-list" data-col="${col.id}"></div>
					<div class="add-card-container">
						<button class="quick-add-btn">+ Добавить карточку</button>
						<div class="quick-add-form">
							<input type="text" class="quick-add-input" placeholder="Заголовок карточки..." />
							<div class="quick-actions">
								<button class="btn-sub btn-save">Добавить</button>
								<button class="btn-sub btn-cancel">Отмена</button>
							</div>
						</div>
					</div>
				`;

				// Двойной клик на название колонки
				colEl.querySelector('.col-title').ondblclick = (e) => {
					e.stopPropagation();
					this.renameColumn(col.id);
				};
				colEl.querySelector('.del-col-btn').onclick = () => this.deleteColumn(col.id);

				// 1. Drag & Drop перетаскивания колонок
				const colHeader = colEl.querySelector('.col-header');
				colHeader.addEventListener('dragstart', (e) => {
					this.draggedColId = col.id;
					e.dataTransfer.effectAllowed = 'move';
					setTimeout(() => colEl.classList.add('col-dragging'), 0);
				});

				colHeader.addEventListener('dragend', () => {
					colEl.classList.remove('col-dragging');
					this.draggedColId = null;
					document.querySelectorAll('.col').forEach(c => c.classList.remove('col-drop-target'));
				});

				colEl.addEventListener('dragover', (e) => {
					if (this.draggedColId && this.draggedColId !== col.id) {
						e.preventDefault();
						colEl.classList.add('col-drop-target');
					}
				});

				colEl.addEventListener('dragleave', () => {
					colEl.classList.remove('col-drop-target');
				});

				colEl.addEventListener('drop', (e) => {
					if (this.draggedColId && this.draggedColId !== col.id) {
						e.preventDefault();
						this.reorderColumns(currentBoard, this.draggedColId, col.id);
					}
				});

				// Добавление карточки
				const addBtn = colEl.querySelector('.quick-add-btn');
				const addForm = colEl.querySelector('.quick-add-form');
				const input = colEl.querySelector('.quick-add-input');
				const saveBtn = colEl.querySelector('.btn-save');
				const cancelBtn = colEl.querySelector('.btn-cancel');

				const submitNewCard = () => {
					const val = input.value.trim();
					if (val) {
						col.cards.push({
							id: 'c_' + Date.now(),
							title: val,
							description: '',
							tags: [],
							checklist: [],
							dueDate: ''
						});
						this.persist();
						this.renderBoard();
					}
				};

				addBtn.onclick = () => {
					addBtn.style.display = 'none';
					addForm.style.display = 'flex';
					input.focus();
				};

				cancelBtn.onclick = () => {
					addForm.style.display = 'none';
					addBtn.style.display = 'block';
					input.value = '';
				};

				saveBtn.onclick = submitNewCard;
				input.onkeydown = (e) => {
					if (e.key === 'Enter') submitNewCard();
					if (e.key === 'Escape') cancelBtn.click();
				};

				// Drag & Drop карточек в пустую зону колонки
				const listEl = colEl.querySelector('.card-list');
				listEl.addEventListener('dragover', (e) => {
					if (this.draggedCardId) e.preventDefault();
				});

				listEl.addEventListener('drop', (e) => {
					if (this.draggedCardId && !e.target.closest('.card')) {
						e.preventDefault();
						this.moveCardToColumnEnd(currentBoard, this.sourceColId, col.id, this.draggedCardId);
					}
				});

				// Рендер карточек
				visibleCards.forEach(card => {
					const cardEl = this.createCardElement(currentBoard, card, col.id);
					listEl.appendChild(cardEl);
				});

				canvas.appendChild(colEl);
			});
		}

		createCardElement(currentBoard, card, colId) {
			const el = document.createElement('div');
			el.className = 'card';
			el.draggable = true;
			el.dataset.cardId = card.id;

			let tagsHTML = '';
			if (card.tags && card.tags.length > 0) {
				tagsHTML = `<div class="card-tags">${card.tags.map(t => `<span class="tag-pill" style="background:${t.color}">${t.name}</span>`).join('')}</div>`;
			}

			let badgesHTML = '';
			const chkTotal = (card.checklist || []).length;
			const chkDone = (card.checklist || []).filter(c => c.done).length;
			
			if (chkTotal > 0) {
				const isAllChecked = chkTotal === chkDone;
				badgesHTML += `<div class="badge-item ${isAllChecked ? 'badge-chk-done' : ''}">☑ ${chkDone}/${chkTotal}</div>`;
			}
			if (card.description) {
				badgesHTML += `<div class="badge-item">≡</div>`;
			}
			if (card.dueDate) {
				const isOverdue = new Date(card.dueDate) < new Date().setHours(0,0,0,0);
				badgesHTML += `<div class="badge-item ${isOverdue ? 'badge-overdue' : ''}">📅 ${card.dueDate.substring(5)}</div>`;
			}

			el.innerHTML = `
				${tagsHTML}
				<div class="card-title">${card.title}</div>
				${badgesHTML ? `<div class="card-badges">${badgesHTML}</div>` : ''}
			`;

			// Drag & Drop карточек между позициями
			el.addEventListener('dragstart', (e) => {
				this.draggedCardId = card.id;
				this.sourceColId = colId;
				e.stopPropagation();
				setTimeout(() => el.classList.add('card-dragging'), 0);
			});

			el.addEventListener('dragend', (e) => {
				e.stopPropagation();
				el.classList.remove('card-dragging');
				document.querySelectorAll('.card').forEach(c => {
					c.classList.remove('card-drop-above', 'card-drop-below');
				});
				this.draggedCardId = null;
				this.sourceColId = null;
			});

			el.addEventListener('dragover', (e) => {
				if (!this.draggedCardId || this.draggedCardId === card.id) return;
				e.preventDefault();
				e.stopPropagation();

				const rect = el.getBoundingClientRect();
				const midY = rect.top + rect.height / 2;
				if (e.clientY < midY) {
					el.classList.add('card-drop-above');
					el.classList.remove('card-drop-below');
				} else {
					el.classList.add('card-drop-below');
					el.classList.remove('card-drop-above');
				}
			});

			el.addEventListener('dragleave', (e) => {
				e.stopPropagation();
				el.classList.remove('card-drop-above', 'card-drop-below');
			});

			el.addEventListener('drop', (e) => {
				if (!this.draggedCardId || this.draggedCardId === card.id) return;
				e.preventDefault();
				e.stopPropagation();

				const rect = el.getBoundingClientRect();
				const insertBefore = e.clientY < (rect.top + rect.height / 2);
				this.reorderCardPosition(currentBoard, this.sourceColId, colId, this.draggedCardId, card.id, insertBefore);
			});

			el.onclick = () => this.openCardModal(currentBoard, card, colId);

			return el;
		}

		// Модалка просмотра и редактирования задачи
		openCardModal(board, card, colId, autoFocusChk = false) {
			const container = document.getElementById('modal-container');
			container.style.display = 'flex';

			const chkTotal = card.checklist.length;
			const chkDone = card.checklist.filter(c => c.done).length;
			const progressPercent = chkTotal === 0 ? 0 : Math.round((chkDone / chkTotal) * 100);

			container.innerHTML = `
				<div class="modal-box">
					<div class="modal-header">
						<input type="text" class="modal-title-input" id="m-title" value="${card.title}" />
						<button class="close-modal-btn" id="m-close">✕</button>
					</div>

					<div class="modal-row">
						<div class="modal-field">
							<span class="modal-label">Дедлайн</span>
							<input type="date" class="modal-date-input" id="m-due" value="${card.dueDate || ''}" />
						</div>
						<div class="modal-field">
							<span class="modal-label">Теги</span>
							<div class="tags-container" id="m-tags">
								${card.tags.map((t, idx) => `
									<span class="tag-pill" style="background:${t.color}">
										${t.name} <span class="tag-del-btn" data-tag="${idx}">✕</span>
									</span>
								`).join('')}
								<button class="new-tag-btn" id="m-add-tag">+ Добавить тег</button>
							</div>
						</div>
					</div>

					<div class="modal-field">
						<span class="modal-label">Описание</span>
						<textarea class="modal-desc-area" id="m-desc" placeholder="Подробное описание задачи...">${card.description || ''}</textarea>
					</div>

					<!-- Чеклист с поддержкой Drag-and-Drop и редактирования -->
					<div class="modal-field">
						<div style="display:flex;justify-content:space-between;align-items:center;">
							<span class="modal-label">Чек-лист</span>
							<span style="font-size:12px;color:#10b981;font-weight:bold;">${progressPercent}%</span>
						</div>
						<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progressPercent}%;"></div></div>
						
						<div class="modal-chk-list" id="m-chk-list">
							${card.checklist.map(item => `
								<div class="chk-item ${item.done ? 'done' : ''}" data-chkid="${item.id}" draggable="true">
									<div class="chk-left">
										<span class="chk-drag-handle" title="Зажмите для изменения порядка">⠿</span>
										<input type="checkbox" data-chk="${item.id}" ${item.done ? 'checked' : ''} />
										<span class="chk-text" data-edit-chk="${item.id}" title="Двойной клик для редактирования">${item.text}</span>
									</div>
									<div class="chk-actions">
										<button class="chk-btn edit-chk" data-edit-chk="${item.id}" title="Редактировать">✏️</button>
										<button class="chk-btn del" data-del-chk="${item.id}" title="Удалить">✕</button>
									</div>
								</div>
							`).join('')}
						</div>

						<div class="add-chk-row">
							<input type="text" class="add-chk-input" id="m-new-chk" placeholder="Добавить пункт чек-листа (Enter)..." />
							<button class="btn-sub btn-save" id="m-add-chk-btn">+ Добавить</button>
						</div>
					</div>

					<div class="modal-footer">
						<button class="danger-btn" id="m-delete-card">Удалить карточку</button>
						<button class="primary-btn" id="m-save">Готово</button>
					</div>
				</div>
			`;

			// Слушатели закрытия
			document.getElementById('m-close').onclick = () => this.closeModal();
			document.getElementById('m-save').onclick = () => this.closeModal();

			// Редактирование текста и даты на лету
			document.getElementById('m-title').oninput = (e) => { card.title = e.target.value.trim() || 'Без названия'; this.persist(); };
			document.getElementById('m-desc').oninput = (e) => { card.description = e.target.value; this.persist(); };
			document.getElementById('m-due').onchange = (e) => { card.dueDate = e.target.value; this.persist(); };

			// Удаление карточки
			document.getElementById('m-delete-card').onclick = () => {
				if (confirm('Удалить эту карточку навсегда?')) {
					const col = board.columns.find(c => c.id === colId);
					col.cards = col.cards.filter(c => c.id !== card.id);
					this.persist();
					this.closeModal();
					this.renderBoard();
				}
			};

			// Переключение чекбоксов
			const chkListEl = document.getElementById('m-chk-list');
			chkListEl.onchange = (e) => {
				if (e.target.dataset.chk) {
					const item = card.checklist.find(i => i.id === e.target.dataset.chk);
					if (item) {
						item.done = e.target.checked;
						this.persist();
						this.openCardModal(board, card, colId);
					}
				}
			};

			// Удаление пункта чеклиста
			chkListEl.onclick = (e) => {
				const delBtn = e.target.closest('[data-del-chk]');
				if (delBtn) {
					card.checklist = card.checklist.filter(i => i.id !== delBtn.dataset.delChk);
					this.persist();
					this.openCardModal(board, card, colId);
					return;
				}

				// Редактирование пункта чеклиста
				const editTarget = e.target.closest('[data-edit-chk]');
				if (editTarget) {
					const chkItem = card.checklist.find(i => i.id === editTarget.dataset.editChk);
					if (chkItem) {
						const newText = prompt('Редактировать пункт:', chkItem.text);
						if (newText && newText.trim()) {
							chkItem.text = newText.trim();
							this.persist();
							this.openCardModal(board, card, colId);
						}
					}
				}
			};

			// Двойной клик по тексту пункта
			chkListEl.ondblclick = (e) => {
				const textEl = e.target.closest('.chk-text');
				if (textEl && textEl.dataset.editChk) {
					const chkItem = card.checklist.find(i => i.id === textEl.dataset.editChk);
					if (chkItem) {
						const newText = prompt('Редактировать пункт:', chkItem.text);
						if (newText && newText.trim()) {
							chkItem.text = newText.trim();
							this.persist();
							this.openCardModal(board, card, colId);
						}
					}
				}
			};

			// Drag & Drop сортировка пунктов чеклиста
			chkListEl.querySelectorAll('.chk-item').forEach(chkEl => {
				chkEl.addEventListener('dragstart', (e) => {
					this.draggedChkId = chkEl.dataset.chkid;
					e.stopPropagation();
					setTimeout(() => chkEl.classList.add('chk-dragging'), 0);
				});

				chkEl.addEventListener('dragend', () => {
					chkEl.classList.remove('chk-dragging');
					this.draggedChkId = null;
				});

				chkEl.addEventListener('dragover', (e) => {
					if (this.draggedChkId && this.draggedChkId !== chkEl.dataset.chkid) {
						e.preventDefault();
					}
				});

				chkEl.addEventListener('drop', (e) => {
					if (this.draggedChkId && this.draggedChkId !== chkEl.dataset.chkid) {
						e.preventDefault();
						e.stopPropagation();
						this.reorderChecklist(card, this.draggedChkId, chkEl.dataset.chkid);
						this.openCardModal(board, card, colId);
					}
				});
			});

			// Добавление нового пункта чеклиста с АВТОФОКУСОМ
			const addChk = () => {
				const inp = document.getElementById('m-new-chk');
				const val = inp.value.trim();
				if (val) {
					card.checklist.push({ id: 'chk_' + Date.now(), text: val, done: false });
					this.persist();
					this.openCardModal(board, card, colId, true); // флаг авто-фокуса
				}
			};

			document.getElementById('m-add-chk-btn').onclick = addChk;
			document.getElementById('m-new-chk').onkeydown = (e) => {
				if (e.key === 'Enter') addChk();
			};

			// Теги
			document.getElementById('m-tags').onclick = (e) => {
				if (e.target.dataset.tag) {
					card.tags.splice(parseInt(e.target.dataset.tag), 1);
					this.persist();
					this.openCardModal(board, card, colId);
				}
			};

			document.getElementById('m-add-tag').onclick = () => {
				const name = prompt('Название тега:');
				if (name && name.trim()) {
					const colors = ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
					const randomColor = colors[Math.floor(Math.random() * colors.length)];
					card.tags.push({ name: name.trim(), color: randomColor });
					this.persist();
					this.openCardModal(board, card, colId);
				}
			};

			// Сохраняем фокус в поле ввода, если мы добавляли пункт
			if (autoFocusChk) {
				const newInp = document.getElementById('m-new-chk');
				if (newInp) newInp.focus();
			}
		}

		closeModal() {
			document.getElementById('modal-container').style.display = 'none';
			this.renderBoard();
		}

		// Управление несколькими досками
		addBoard() {
			const name = prompt('Название новой доски:', 'Новая доска');
			if (name && name.trim()) {
				const newBoard = {
					id: 'b_' + Date.now(),
					title: name.trim(),
					columns: [
						{ id: 'col_' + Date.now() + '_1', title: 'To Do', cards: [] },
						{ id: 'col_' + Date.now() + '_2', title: 'In Progress', cards: [] },
						{ id: 'col_' + Date.now() + '_3', title: 'Done', cards: [] }
					]
				};
				this.appData.boards.push(newBoard);
				this.appData.activeBoardId = newBoard.id;
				this.persist();
				this.render();
			}
		}

		renameBoard(boardId) {
			const board = this.appData.boards.find(b => b.id === boardId);
			if (!board) return;
			const newName = prompt('Новое название доски:', board.title);
			if (newName && newName.trim()) {
				board.title = newName.trim();
				this.persist();
				this.renderTabs();
			}
		}

		deleteBoard(boardId) {
			if (this.appData.boards.length <= 1) return alert('Нельзя удалить единственную доску.');
			const board = this.appData.boards.find(b => b.id === boardId);
			if (!confirm(`Удалить доску "${board.title}" со всеми колонками и задачами?`)) return;

			this.appData.boards = this.appData.boards.filter(b => b.id !== boardId);
			if (this.appData.activeBoardId === boardId) {
				this.appData.activeBoardId = this.appData.boards[0].id;
			}
			this.persist();
			this.render();
		}

		// Управление колонками
		addColumn() {
			const board = this.getActiveBoard();
			if (!board) return;

			const name = prompt('Название новой колонки:', 'Новая колонка');
			if (name && name.trim()) {
				board.columns.push({
					id: 'col_' + Date.now(),
					title: name.trim(),
					cards: []
				});
				this.persist();
				this.renderBoard();
			}
		}

		renameColumn(colId) {
			const board = this.getActiveBoard();
			if (!board) return;
			const col = board.columns.find(c => c.id === colId);
			if (!col) return;

			const newName = prompt('Новое название колонки:', col.title);
			if (newName && newName.trim()) {
				col.title = newName.trim();
				this.persist();
				this.renderBoard();
			}
		}

		deleteColumn(colId) {
			const board = this.getActiveBoard();
			if (!board) return;
			const col = board.columns.find(c => c.id === colId);
			if (!col) return;

			if (col.cards.length > 0) {
				if (!confirm(`В колонке "${col.title}" есть ${col.cards.length} карточек. Удалить со всеми задачами?`)) return;
			} else {
				if (!confirm(`Удалить колонку "${col.title}"?`)) return;
			}

			board.columns = board.columns.filter(c => c.id !== colId);
			this.persist();
			this.renderBoard();
		}

		// Перемещение самих колонок
		reorderColumns(board, fromColId, toColId) {
			const fromIdx = board.columns.findIndex(c => c.id === fromColId);
			const toIdx = board.columns.findIndex(c => c.id === toColId);
			if (fromIdx === -1 || toIdx === -1) return;

			const [moved] = board.columns.splice(fromIdx, 1);
			board.columns.splice(toIdx, 0, moved);

			this.persist();
			this.renderBoard();
		}

		// Точное перемещение карточки на позицию внутри или между колонками
		reorderCardPosition(board, fromColId, toColId, cardId, targetCardId, insertBefore) {
			const fromCol = board.columns.find(c => c.id === fromColId);
			const toCol = board.columns.find(c => c.id === toColId);
			if (!fromCol || !toCol) return;

			const cardIdx = fromCol.cards.findIndex(c => c.id === cardId);
			if (cardIdx === -1) return;
			const [card] = fromCol.cards.splice(cardIdx, 1);

			let targetIdx = toCol.cards.findIndex(c => c.id === targetCardId);
			if (targetIdx === -1) {
				toCol.cards.push(card);
			} else {
				if (!insertBefore) targetIdx++;
				toCol.cards.splice(targetIdx, 0, card);
			}

			this.persist();
			this.renderBoard();
		}

		moveCardToColumnEnd(board, fromColId, toColId, cardId) {
			const fromCol = board.columns.find(c => c.id === fromColId);
			const toCol = board.columns.find(c => c.id === toColId);
			if (!fromCol || !toCol) return;

			const cardIdx = fromCol.cards.findIndex(c => c.id === cardId);
			if (cardIdx === -1) return;

			const [card] = fromCol.cards.splice(cardIdx, 1);
			toCol.cards.push(card);

			this.persist();
			this.renderBoard();
		}

		// Сортировка чекбоксов в модалке
		reorderChecklist(card, fromChkId, toChkId) {
			const fromIdx = card.checklist.findIndex(i => i.id === fromChkId);
			const toIdx = card.checklist.findIndex(i => i.id === toChkId);
			if (fromIdx === -1 || toIdx === -1) return;

			const [moved] = card.checklist.splice(fromIdx, 1);
			card.checklist.splice(toIdx, 0, moved);
			this.persist();
		}

		persist() {
			this.saveGlobal('trello', this.appData);
		}
	};

})(NexusBehaviour);