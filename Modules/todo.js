var ModuleClass = (function(NexusBehaviour) {

	return class NexusTodo extends NexusBehaviour.Explorer {

		moduleIcon = '📝';
		moduleTitle = 'omniNexus Checklist';
		defaultFileName = 'New Checklist';
		defaultTemplateName = 'New Template';
		emptyStateIcon = '📭';
		emptyStateTitle = 'No Active Checklists';
		emptyStateDesc = 'Select a checklist or template from the explorer on the left or create a new one.';

		defaults = {
			defaultData: {
				activeId: 'f_1',
				isTemplatesOpen: true,
				files: [
					{
						id: 'f_1',
						name: 'QA Test Run Sample',
						items: [
							{ id: 'i_1', text: 'CA-Module Tricolor validation', status: 'passed', done: true },
							{ id: 'i_2', text: 'USB Films Dolby HDR playback test', status: 'failed', done: false },
							{ id: 'i_3', text: 'Google Account (unavailable in region)', status: 'na', done: false },
							{ id: 'i_4', text: 'Validate Okko streaming app', status: 'todo', done: false }
						]
					}
				],
				templates: []
			}
		};

		createFileData(name) { return { items: [] }; }
		createTemplateData(name) { return { items: [] }; }

		cloneTemplateData(tpl) {
			return {
				items: (tpl.items || []).map(i => ({
					id: 'i_' + Date.now() + Math.random().toString(36).substr(2, 5),
					text: i.text,
					status: 'todo',
					done: false
				}))
			};
		}

		getItemBadge(item, isTemplate) {
			if (isTemplate) {
				return `<div class="file-badge">${(item.items || []).length} items</div>`;
			}
			const total = (item.items || []).length;
			const passed = (item.items || []).filter(i => this.getItemStatus(i) === 'passed').length;
			const failed = (item.items || []).filter(i => this.getItemStatus(i) === 'failed').length;
			const isAllDone = total > 0 && total === passed;

			let badgeText = `${passed}/${total}`;
			if (failed > 0) badgeText += ` (!${failed})`;

			return `<div class="file-badge ${isAllDone ? 'done' : ''}">${isAllDone ? '✓ 100%' : badgeText}</div>`;
		}

		getItemStatus(task) {
			if (task.status) return task.status;
			return task.done ? 'passed' : 'todo';
		}

		cycleStatus(task) {
			const current = this.getItemStatus(task);
			const order = ['todo', 'passed', 'failed', 'na'];
			const nextIdx = (order.indexOf(current) + 1) % order.length;
			const nextStatus = order[nextIdx];

			task.status = nextStatus;
			task.done = (nextStatus === 'passed');
			
			this.persist();
			this.render();
		}

		renderEditor(active, isTemplate, pane) {
			if (!this.currentFilter) this.currentFilter = 'all';

			this.addCSS(`
				.qa-header { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #1e293b; padding-bottom: 16px; flex-shrink: 0; }
				.qa-title-row { display: flex; justify-content: space-between; align-items: center; }
				.qa-title-wrap { display: flex; align-items: center; gap: 10px; }
				.qa-title { font-size: 22px; font-weight: 700; color: #f8fafc; margin: 0; cursor: pointer; display: flex; align-items: center; gap: 8px; }
				.qa-title:hover { color: #38bdf8; }
				.tpl-indicator { font-size: 11px; font-weight: 700; background: #f59e0b; color: #000; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
				
				.qa-stats-row { display: flex; align-items: center; gap: 12px; font-size: 12px; font-family: monospace; }
				.stat-pill { padding: 3px 8px; border-radius: 4px; font-weight: bold; }
				.stat-passed { background: rgba(16, 185, 129, 0.15); color: #34d399; }
				.stat-failed { background: rgba(239, 68, 68, 0.15); color: #f87171; }
				.stat-na { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
				.stat-total { color: #94a3b8; }

				.progress-bar-bg { background: #1e293b; height: 6px; border-radius: 3px; overflow: hidden; width: 100%; display: flex; }
				.progress-bar-fill-passed { background: #10b981; height: 100%; transition: width 0.25s ease; }
				.progress-bar-fill-failed { background: #ef4444; height: 100%; transition: width 0.25s ease; }

				.toolbar-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
				.tool-btns, .filter-tabs { display: flex; gap: 6px; align-items: center; }
				.tool-btn { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; }
				.tool-btn:hover { background: #334155; color: #f8fafc; }
				.tool-btn.primary-tpl { background: #0284c7; border-color: #0284c7; color: #fff; }
				.tool-btn.primary-tpl:hover { background: #0369a1; }
				
				.tab-btn { background: transparent; border: none; color: #64748b; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; }
				.tab-btn:hover { color: #f8fafc; }
				.tab-btn.active { background: #0284c7; color: white; }

				.add-task-form { display: flex; gap: 8px; margin-bottom: 20px; flex-shrink: 0; }
				.add-task-input { flex-grow: 1; max-width: 650px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 10px 14px; color: #f8fafc; font-size: 14px; outline: none; }
				.add-task-input:focus { border-color: #38bdf8; }
				.add-task-btn { background: #0284c7; border: none; color: white; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
				.add-task-btn:hover { background: #0369a1; }

				.task-list { display: flex; flex-direction: column; gap: 8px; max-width: 800px; overflow-y: auto; flex-grow: 1; }
				.task-row { display: flex; align-items: center; justify-content: space-between; background: #1e293b; border: 1px solid #334155; padding: 8px 12px; border-radius: 6px; transition: border-color 0.15s; cursor: grab; }
				.task-row:hover { border-color: #475569; }
				.task-row.dragging { opacity: 0.3; }

				.task-left { display: flex; align-items: center; gap: 12px; flex-grow: 1; }
				.status-zone-btn { min-width: 95px; width: 95px; padding: 5px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; text-align: center; user-select: none; border: 1px solid transparent; transition: transform 0.1s, background 0.15s; flex-shrink: 0; }
				.status-zone-btn:hover { transform: scale(1.02); }
				
				.status-todo { background: #0f172a; border-color: #334155; color: #64748b; }
				.status-passed { background: rgba(16, 185, 129, 0.15); border-color: #10b981; color: #34d399; }
				.status-failed { background: rgba(239, 68, 68, 0.18); border-color: #ef4444; color: #f87171; }
				.status-na { background: rgba(245, 158, 11, 0.15); border-color: #f59e0b; color: #fbbf24; }

				.task-text { font-size: 14px; color: #f8fafc; word-break: break-word; cursor: text; line-height: 1.4; flex-grow: 1; }
				.task-row.status-passed .task-text { color: #94a3b8; }
				.task-row.status-failed .task-text { color: #fca5a5; font-weight: 600; }
				.task-row.status-na .task-text { opacity: 0.6; color: #94a3b8; }

				.task-actions { display: flex; gap: 4px; opacity: 0; }
				.task-row:hover .task-actions { opacity: 1; }
				.task-action-btn { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 4px 6px; border-radius: 4px; }
				.task-action-btn:hover { color: #f8fafc; background: rgba(255,255,255,0.1); }
				.task-action-btn.del:hover { color: #ef4444; background: rgba(239,68,68,0.15); }
			`);

			const items = active.items || [];
			const total = items.length;
			const passed = items.filter(t => this.getItemStatus(t) === 'passed').length;
			const failed = items.filter(t => this.getItemStatus(t) === 'failed').length;
			const na = items.filter(t => this.getItemStatus(t) === 'na').length;
			const todo = items.filter(t => this.getItemStatus(t) === 'todo').length;

			const passedPct = total === 0 ? 0 : Math.round((passed / total) * 100);
			const failedPct = total === 0 ? 0 : Math.round((failed / total) * 100);

			const filteredTasks = items.filter(t => {
				const s = this.getItemStatus(t);
				if (this.currentFilter === 'passed') return s === 'passed';
				if (this.currentFilter === 'failed') return s === 'failed';
				if (this.currentFilter === 'todo') return s === 'todo';
				if (this.currentFilter === 'na') return s === 'na';
				return true;
			});

			pane.innerHTML = `
				<div class="qa-header">
					<div class="qa-title-row">
						<div class="qa-title-wrap">
							<h2 class="qa-title" id="file-title" title="Click to rename">
								<span>${isTemplate ? this.templateIcon : this.fileIcon} ${active.name}</span>
								<span style="font-size:14px;color:#64748b;">✏️</span>
							</h2>
							${isTemplate ? '<span class="tpl-indicator">Template</span>' : ''}
						</div>
						
						<div class="qa-stats-row">
							<span class="stat-pill stat-passed" title="Passed">✓ ${passed}</span>
							<span class="stat-pill stat-failed" title="Failed">✕ ${failed}</span>
							<span class="stat-pill stat-na" title="N/A">⊘ ${na}</span>
							<span class="stat-pill stat-total">${passedPct}%</span>
						</div>
					</div>

					<div class="progress-bar-bg">
						<div class="progress-bar-fill-passed" style="width:${passedPct}%;"></div>
						<div class="progress-bar-fill-failed" style="width:${failedPct}%;"></div>
					</div>

					<div class="toolbar-row">
						<div class="tool-btns">
							${isTemplate ? `<button class="tool-btn primary-tpl" id="btn-use-tpl">⚡ Create Checklist from Template</button>` : ''}
							<button class="tool-btn" id="btn-toggle-all">✓ Pass All</button>
							<button class="tool-btn" id="btn-reset-all">↺ Reset All</button>
							<button class="tool-btn" id="btn-duplicate">📋 Duplicate</button>
						</div>

						<div class="filter-tabs">
							<button class="tab-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All (${total})</button>
							<button class="tab-btn ${this.currentFilter === 'todo' ? 'active' : ''}" data-filter="todo">Queue (${todo})</button>
							<button class="tab-btn ${this.currentFilter === 'passed' ? 'active' : ''}" data-filter="passed">✓ (${passed})</button>
							<button class="tab-btn ${this.currentFilter === 'failed' ? 'active' : ''}" data-filter="failed">✕ (${failed})</button>
							<button class="tab-btn ${this.currentFilter === 'na' ? 'active' : ''}" data-filter="na">⊘ (${na})</button>
						</div>
					</div>
				</div>
				
				<div class="add-task-form">
					<input type="text" class="add-task-input" id="new-task-input" placeholder="Add test case or task (Enter)..." autofocus />
					<button class="add-task-btn" id="add-task-btn">+ Add</button>
				</div>

				<div class="task-list" id="task-container"></div>
			`;

			document.getElementById('file-title').onclick = () => this.renameItem(active);

			if (isTemplate) {
				document.getElementById('btn-use-tpl').onclick = () => this.instantiateTemplate(active);
			}

			document.getElementById('btn-toggle-all').onclick = () => this.setAllStatus(active, 'passed');
			document.getElementById('btn-reset-all').onclick = () => this.setAllStatus(active, 'todo');
			document.getElementById('btn-duplicate').onclick = () => this.duplicateItem(active, isTemplate);

			pane.querySelectorAll('.tab-btn').forEach(btn => {
				btn.onclick = () => {
					this.currentFilter = btn.dataset.filter;
					this.renderEditor(active, isTemplate, pane);
				};
			});

			const input = document.getElementById('new-task-input');
			const addBtn = document.getElementById('add-task-btn');

			const handleAdd = () => {
				const val = input.value.trim();
				if (!val) return;
				active.items.push({ id: 'i_' + Date.now(), text: val, status: 'todo', done: false });
				this.persist();
				this.render();
				
				const newInput = document.getElementById('new-task-input');
				if (newInput) newInput.focus();
			};

			addBtn.onclick = handleAdd;
			input.onkeydown = (e) => {
				if (e.key === 'Enter') handleAdd();
			};

			const container = document.getElementById('task-container');

			if (filteredTasks.length === 0) {
				container.innerHTML = `<div style="color:#64748b;font-size:13px;padding:12px 0;">${total === 0 ? 'Checklist is empty. Add the first test case above.' : 'No items match the selected filter.'}</div>`;
				return;
			}

			filteredTasks.forEach(task => {
				const status = this.getItemStatus(task);
				const row = document.createElement('div');
				row.className = `task-row status-${status}`;
				row.draggable = true;

				let statusText = '○ Todo';
				if (status === 'passed') statusText = '✓ Passed';
				if (status === 'failed') statusText = '✕ Failed';
				if (status === 'na') statusText = '⊘ N/A';

				row.innerHTML = `
					<div class="task-left">
						<button class="status-zone-btn status-${status}" title="Click to cycle status (Todo -> Passed -> Failed -> N/A)">
							${statusText}
						</button>
						<span class="task-text" title="Double click to edit">${task.text}</span>
					</div>
					<div class="task-actions">
						<button class="task-action-btn edit" title="Edit">✏️</button>
						<button class="task-action-btn del" title="Delete">✕</button>
					</div>
				`;

				row.addEventListener('dragstart', () => {
					this._draggedTaskId = task.id;
					setTimeout(() => row.classList.add('dragging'), 0);
				});

				row.addEventListener('dragend', () => {
					row.classList.remove('dragging');
					this._draggedTaskId = null;
				});

				row.addEventListener('dragover', (e) => e.preventDefault());
				row.addEventListener('drop', (e) => {
					e.preventDefault();
					if (!this._draggedTaskId || this._draggedTaskId === task.id) return;
					this.reorderTasks(active, this._draggedTaskId, task.id);
				});

				row.querySelector('.status-zone-btn').onclick = (e) => {
					e.stopPropagation();
					this.cycleStatus(task);
				};

				const editAction = () => {
					const newText = prompt('Edit item:', task.text);
					if (newText && newText.trim()) {
						task.text = newText.trim();
						this.persist();
						this.render();
					}
				};

				row.querySelector('.task-text').ondblclick = editAction;
				row.querySelector('.task-action-btn.edit').onclick = editAction;

				row.querySelector('.task-action-btn.del').onclick = () => {
					active.items = active.items.filter(t => t.id !== task.id);
					this.persist();
					this.render();
				};

				container.appendChild(row);
			});
		}

		setAllStatus(target, status) {
			(target.items || []).forEach(i => {
				i.status = status;
				i.done = (status === 'passed');
			});
			this.persist();
			this.render();
		}

		reorderTasks(target, fromId, toId) {
			const fromIdx = target.items.findIndex(i => i.id === fromId);
			const toIdx = target.items.findIndex(i => i.id === toId);
			if (fromIdx === -1 || toIdx === -1) return;

			const [moved] = target.items.splice(fromIdx, 1);
			target.items.splice(toIdx, 0, moved);

			this.persist();
			this.render();
		}
	};

})(NexusBehaviour);