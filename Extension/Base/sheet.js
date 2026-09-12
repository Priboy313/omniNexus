var ModuleClass = (function(NexusBehaviour) {

	return class OmniSheet extends NexusBehaviour.Explorer {

		moduleTitle = '📊 omniSheet Studio';
		storageKey = 'sheet';
		fileIcon = '📊';
		templateIcon = '📑';
		defaultFileName = 'New Sheet';
		defaultTemplateName = 'New Template';
		emptyStateIcon = '📊';
		emptyStateTitle = 'No Active Spreadsheets';
		emptyStateDesc = 'Select a spreadsheet or template from the explorer on the left or create a new one.';

		defaults = {
			defaultData: {
				activeId: 'sheet_1',
				isTemplatesOpen: true,
				files: [
					{
						id: 'sheet_1',
						name: 'TV Test Matrix.xlsx',
						cols: 6,
						rows: 15,
						cells: {
							"A1": "ID", "B1": "Test / Module", "C1": "Duration (s)", "D1": "Status", "E1": "Factor", "F1": "Total",
							"A2": "1", "B2": "CA Tricolor", "C2": "4.2", "D2": "1", "E2": "1.1", "F2": "=C2*E2",
							"A3": "2", "B3": "CA NTV+", "C3": "3.8", "D3": "1", "E3": "1.1", "F3": "=C3*E3",
							"A4": "3", "B4": "CA MTS", "C4": "12.5", "D4": "0", "E4": "1.0", "F4": "=C4*E4",
							"A5": "4", "B5": "USB Dolby HDR", "C5": "5.1", "D5": "1", "E5": "1.2", "F5": "=C5*E5",
							"B7": "Total Duration:", "C7": "=SUM(C2:C5)",
							"B8": "Average Duration:", "C8": "=AVERAGE(C2:C5)",
							"B9": "Tests Passed:", "C9": "=SUM(D2:D5)"
						}
					}
				],
				templates: [
					{
						id: 'tpl_calc',
						name: 'Invoice Calculator',
						cols: 5,
						rows: 10,
						cells: {
							"A1": "Item", "B1": "Qty", "C1": "Price", "D1": "Amount",
							"A2": "Software License", "B2": "5", "C2": "1200", "D2": "=B2*C2",
							"A3": "Test Remote", "B3": "2", "C3": "3500", "D3": "=B3*C3",
							"A4": "HDMI 2.1 Cable", "B4": "4", "C4": "850", "D4": "=B4*C4",
							"C6": "TOTAL:", "D6": "=SUM(D2:D4)"
						}
					}
				]
			}
		};

		createFileData(name) { return { cols: 8, rows: 20, cells: {} }; }
		createTemplateData(name) { return { cols: 6, rows: 15, cells: {} }; }

		cloneTemplateData(tpl) {
			return {
				cols: tpl.cols || 8,
				rows: tpl.rows || 20,
				cells: JSON.parse(JSON.stringify(tpl.cells || {}))
			};
		}

		idxToCol(i) {
			let s = '';
			while (i >= 0) {
				s = String.fromCharCode((i % 26) + 65) + s;
				i = Math.floor(i / 26) - 1;
			}
			return s;
		}

		colToIdx(s) {
			let n = 0;
			for (let i = 0; i < s.length; i++) n = n * 26 + s.charCodeAt(i) - 64;
			return n - 1;
		}

		parseCoord(coord) {
			const m = coord.trim().toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
			if (!m) return null;
			return { col: m[1], row: parseInt(m[2]), cIdx: this.colToIdx(m[1]), rIdx: parseInt(m[2]) - 1 };
		}

		expandRange(rangeStr) {
			const parts = rangeStr.split(':');
			if (parts.length === 1) return [parts[0].trim().toUpperCase()];
			const start = this.parseCoord(parts[0]);
			const end = this.parseCoord(parts[1]);
			if (!start || !end) return [];

			const minC = Math.min(start.cIdx, end.cIdx);
			const maxC = Math.max(start.cIdx, end.cIdx);
			const minR = Math.min(start.rIdx, end.rIdx);
			const maxR = Math.max(start.rIdx, end.rIdx);

			const list = [];
			for (let c = minC; c <= maxC; c++) {
				for (let r = minR; r <= maxR; r++) {
					list.push(`${this.idxToCol(c)}${r + 1}`);
				}
			}
			return list;
		}

		evalCell(coord, cells, visited = new Set()) {
			coord = coord.toUpperCase();
			if (visited.has(coord)) return '#CYCLE!';
			const raw = (cells[coord] ?? '').toString().trim();

			if (!raw.startsWith('=')) {
				if (raw === '') return '';
				const num = Number(raw);
				return !isNaN(num) ? num : raw;
			}

			return this.evalFormula(raw.substring(1), cells, new Set([...visited, coord]));
		}

		evalFormula(formula, cells, visited) {
			try {
				let expr = formula.trim();

				const fnRegex = /(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\(([^)]+)\)/gi;
				expr = expr.replace(fnRegex, (match, fnName, argStr) => {
					fnName = fnName.toUpperCase();
					const rangeCells = this.expandRange(argStr);
					const vals = rangeCells.map(c => this.evalCell(c, cells, visited)).filter(v => typeof v === 'number' && !isNaN(v));

					if (fnName === 'SUM') return vals.reduce((a, b) => a + b, 0);
					if (fnName === 'COUNT') return vals.length;
					if (fnName === 'AVERAGE' || fnName === 'AVG') return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
					if (fnName === 'MIN') return vals.length ? Math.min(...vals) : 0;
					if (fnName === 'MAX') return vals.length ? Math.max(...vals) : 0;
					return 0;
				});

				const cellRefRegex = /\b([A-Z]+[0-9]+)\b/g;
				expr = expr.replace(cellRefRegex, (ref) => {
					const val = this.evalCell(ref, cells, visited);
					if (typeof val === 'number') return val;
					if (val === '' || val === null || val === undefined) return 0;
					if (typeof val === 'string' && val.startsWith('#')) throw new Error(val);
					const num = Number(val);
					return !isNaN(num) ? num : 0;
				});

				if (!/^[0-9+\-*/(). eE%]+$/.test(expr)) return '#VALUE!';

				const result = Function(`"use strict"; return (${expr})`)();
				if (typeof result === 'number') {
					if (!isFinite(result)) return '#DIV/0!';
					return Math.round(result * 10000) / 10000;
				}
				return result;
			} catch (err) {
				return err.message && err.message.startsWith('#') ? err.message : '#ERR!';
			}
		}

		renderEditor(active, isTemplate, pane) {
			if (!active.cells) active.cells = {};
			if (!active.cols) active.cols = 8;
			if (!active.rows) active.rows = 20;
			if (!this.selectedCell) this.selectedCell = 'A1';

			this.addCSS(`
				.sheet-topbar { padding: 12px 20px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }
				.sheet-title-row { display: flex; justify-content: space-between; align-items: center; }
				.sheet-title { font-size: 18px; font-weight: 700; color: #f8fafc; margin: 0; cursor: pointer; display: flex; align-items: center; gap: 8px; }
				.sheet-title:hover { color: #38bdf8; }
				.tpl-badge { font-size: 11px; font-weight: 700; background: #f59e0b; color: #000; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; }

				.sheet-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
				.toolbar-group { display: flex; gap: 6px; align-items: center; }
				.s-btn { background: #0f172a; border: 1px solid #334155; color: #94a3b8; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; }
				.s-btn:hover { background: #334155; color: #f8fafc; }
				.s-btn.primary { background: #0284c7; border-color: #0284c7; color: white; }
				.s-btn.primary:hover { background: #0369a1; }
				.s-btn.btn-copied { background: #10b981 !important; border-color: #10b981 !important; color: white !important; }

				.formula-bar-container { display: flex; align-items: center; gap: 8px; background: #0f172a; border: 1px solid #334155; border-radius: 4px; padding: 4px 8px; }
				.active-cell-badge { font-family: monospace; font-weight: 700; color: #38bdf8; font-size: 13px; min-width: 45px; text-align: center; border-right: 1px solid #334155; padding-right: 8px; }
				.fx-label { font-family: serif; font-style: italic; font-weight: bold; color: #64748b; font-size: 14px; user-select: none; }
				#formula-input { flex-grow: 1; background: transparent; border: none; color: #f8fafc; font-family: monospace; font-size: 13px; outline: none; }

				.grid-viewport { flex-grow: 1; overflow: auto; background: #0f172a; position: relative; }
				table.sheet-table { border-collapse: collapse; table-layout: fixed; width: max-content; }
				
				th.corner-header { width: 45px; min-width: 45px; background: #111827; border: 1px solid #334155; position: sticky; top: 0; left: 0; z-index: 30; }
				th.col-header { height: 28px; width: 120px; min-width: 120px; background: #1e293b; border: 1px solid #334155; font-size: 12px; font-weight: 600; color: #94a3b8; text-align: center; position: sticky; top: 0; z-index: 20; user-select: none; }
				th.col-header.selected-col { background: #334155; color: #38bdf8; }
				
				td.row-header { width: 45px; min-width: 45px; height: 28px; background: #1e293b; border: 1px solid #334155; font-size: 11px; font-weight: 600; color: #94a3b8; text-align: center; position: sticky; left: 0; z-index: 10; user-select: none; font-family: monospace; }
				td.row-header.selected-row { background: #334155; color: #38bdf8; }

				td.cell { height: 28px; background: #0f172a; border: 1px solid #1e293b; padding: 4px 8px; font-size: 13px; color: #f8fafc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: cell; user-select: text; }
				td.cell.numeric { text-align: right; font-family: monospace; }
				td.cell.selected { outline: 2px solid #38bdf8 !important; outline-offset: -2px; background: rgba(56, 189, 248, 0.08) !important; }
				td.cell.editing { padding: 0; background: #000 !important; }
				
				input.cell-editor { width: 100%; height: 100%; background: #000; border: none; color: #38bdf8; font-family: monospace; font-size: 13px; padding: 4px 8px; outline: none; }
				.err-val { color: #f87171 !important; font-weight: bold; font-family: monospace; }
			`);

			pane.innerHTML = `
				<div class="sheet-topbar">
					<div class="sheet-title-row">
						<h2 class="sheet-title" id="sheet-title" title="Click to rename">
							<span>${isTemplate ? this.templateIcon : this.fileIcon} ${active.name}</span>
							<span style="font-size:14px;color:#64748b;">✏️</span>
						</h2>
						${isTemplate ? '<span class="tpl-badge">Template</span>' : ''}
					</div>

					<div class="sheet-toolbar">
						<div class="toolbar-group">
							${isTemplate ? `<button class="s-btn primary" id="btn-use-tpl">⚡ Create Sheet from Template</button>` : ''}
							<button class="s-btn" id="btn-add-row">+ Row</button>
							<button class="s-btn" id="btn-add-col">+ Col</button>
							<button class="s-btn" id="btn-del-row">- Row</button>
							<button class="s-btn" id="btn-del-col">- Col</button>
						</div>
						<div class="toolbar-group">
							<button class="s-btn" id="btn-copy-tsv" title="Copy table to clipboard for Excel">📋 Copy for Excel</button>
							<button class="s-btn" id="btn-paste-tsv" title="Paste data copied from Excel">📥 Paste from Excel</button>
							<button class="s-btn" id="btn-export-csv">💾 Download .csv</button>
						</div>
					</div>

					<div class="formula-bar-container">
						<span class="active-cell-badge" id="fx-cell">${this.selectedCell}</span>
						<span class="fx-label">fx</span>
						<input type="text" id="formula-input" placeholder="Value or formula (=SUM(A1:A5), =A1*1.2)..." />
					</div>
				</div>

				<div class="grid-viewport" id="grid-viewport">
					<table class="sheet-table" id="sheet-table"></table>
				</div>
			`;

			document.getElementById('sheet-title').onclick = () => this.renameItem(active);

			if (isTemplate) {
				document.getElementById('btn-use-tpl').onclick = () => this.instantiateTemplate(active);
			}

			document.getElementById('btn-add-row').onclick = () => { active.rows++; this.persist(); this.renderGrid(active); };
			document.getElementById('btn-add-col').onclick = () => { active.cols++; this.persist(); this.renderGrid(active); };
			document.getElementById('btn-del-row').onclick = () => { if (active.rows > 1) { active.rows--; this.persist(); this.renderGrid(active); } };
			document.getElementById('btn-del-col').onclick = () => { if (active.cols > 1) { active.cols--; this.persist(); this.renderGrid(active); } };

			this.initExcelBridge(active);
			this.renderGrid(active);
		}

		renderGrid(sheet) {
			const table = document.getElementById('sheet-table');
			if (!table) return;
			table.innerHTML = '';

			const parsedSelected = this.parseCoord(this.selectedCell) || { cIdx: 0, rIdx: 0 };

			const thead = document.createElement('thead');
			const headerRow = document.createElement('tr');

			const cornerTh = document.createElement('th');
			cornerTh.className = 'corner-header';
			headerRow.appendChild(cornerTh);

			for (let c = 0; c < sheet.cols; c++) {
				const colName = this.idxToCol(c);
				const th = document.createElement('th');
				th.className = `col-header ${c === parsedSelected.cIdx ? 'selected-col' : ''}`;
				th.textContent = colName;
				headerRow.appendChild(th);
			}
			thead.appendChild(headerRow);
			table.appendChild(thead);

			const tbody = document.createElement('tbody');

			for (let r = 0; r < sheet.rows; r++) {
				const tr = document.createElement('tr');
				const rowNum = r + 1;

				const rowTh = document.createElement('td');
				rowTh.className = `row-header ${r === parsedSelected.rIdx ? 'selected-row' : ''}`;
				rowTh.textContent = rowNum;
				tr.appendChild(rowTh);

				for (let c = 0; c < sheet.cols; c++) {
					const cellKey = `${this.idxToCol(c)}${rowNum}`;
					const td = document.createElement('td');
					td.className = `cell ${cellKey === this.selectedCell ? 'selected' : ''}`;
					td.dataset.coord = cellKey;

					const displayVal = this.evalCell(cellKey, sheet.cells);
					if (typeof displayVal === 'number') {
						td.classList.add('numeric');
						td.textContent = displayVal;
					} else if (typeof displayVal === 'string' && displayVal.startsWith('#')) {
						td.classList.add('err-val');
						td.textContent = displayVal;
					} else {
						td.textContent = displayVal;
					}

					td.onclick = () => this.selectCell(cellKey, sheet);
					td.ondblclick = () => this.startInlineEdit(td, cellKey, sheet);

					tr.appendChild(td);
				}
				tbody.appendChild(tr);
			}
			table.appendChild(tbody);

			this.syncFormulaBar(sheet);
		}

		selectCell(coord, sheet) {
			if (this.isEditing) this.commitInlineEdit(sheet);
			this.selectedCell = coord;

			document.querySelectorAll('td.cell.selected').forEach(el => el.classList.remove('selected'));
			const td = document.querySelector(`td.cell[data-coord="${coord}"]`);
			if (td) td.classList.add('selected');

			this.syncFormulaBar(sheet);
		}

		syncFormulaBar(sheet) {
			const fxBadge = document.getElementById('fx-cell');
			const fxInput = document.getElementById('formula-input');
			if (!fxBadge || !fxInput) return;

			fxBadge.textContent = this.selectedCell;
			fxInput.value = sheet.cells[this.selectedCell] ?? '';

			fxInput.oninput = (e) => {
				const val = e.target.value;
				if (val.trim() === '') {
					delete sheet.cells[this.selectedCell];
				} else {
					sheet.cells[this.selectedCell] = val;
				}
				this.persist();
				this.renderGrid(sheet);
			};

			fxInput.onkeydown = (e) => {
				if (e.key === 'Enter') {
					fxInput.blur();
					this.renderGrid(sheet);
				}
			};
		}

		startInlineEdit(td, coord, sheet) {
			this.isEditing = true;
			td.classList.add('editing');
			const raw = sheet.cells[coord] ?? '';

			td.innerHTML = `<input type="text" class="cell-editor" value="${raw.replace(/"/g, '&quot;')}" />`;
			const input = td.querySelector('input');
			input.focus();

			input.onkeydown = (e) => {
				if (e.key === 'Enter' || e.key === 'Tab') {
					e.preventDefault();
					this.commitInlineEdit(sheet);
					if (e.key === 'Tab') {
						const next = this.getNextCell(coord, 1, 0, sheet);
						this.selectCell(next, sheet);
					} else {
						const next = this.getNextCell(coord, 0, 1, sheet);
						this.selectCell(next, sheet);
					}
				}
				if (e.key === 'Escape') {
					this.isEditing = false;
					this.renderGrid(sheet);
				}
			};

			input.onblur = () => {
				if (this.isEditing) this.commitInlineEdit(sheet);
			};
		}

		commitInlineEdit(sheet) {
			const input = document.querySelector('input.cell-editor');
			if (input) {
				const val = input.value;
				if (val.trim() === '') {
					delete sheet.cells[this.selectedCell];
				} else {
					sheet.cells[this.selectedCell] = val;
				}
				this.persist();
			}
			this.isEditing = false;
			this.renderGrid(sheet);
		}

		getNextCell(coord, colDelta, rowDelta, sheet) {
			const p = this.parseCoord(coord);
			if (!p) return coord;
			const newC = Math.max(0, Math.min(sheet.cols - 1, p.cIdx + colDelta));
			const newR = Math.max(1, Math.min(sheet.rows, p.row + rowDelta));
			return `${this.idxToCol(newC)}${newR}`;
		}

		initExcelBridge(sheet) {
			const copyBtn = document.getElementById('btn-copy-tsv');
			const pasteBtn = document.getElementById('btn-paste-tsv');
			const csvBtn = document.getElementById('btn-export-csv');

			copyBtn.onclick = () => {
				let tsv = '';
				for (let r = 1; r <= sheet.rows; r++) {
					const rowVals = [];
					for (let c = 0; c < sheet.cols; c++) {
						const key = `${this.idxToCol(c)}${r}`;
						rowVals.push(this.evalCell(key, sheet.cells));
					}
					tsv += rowVals.join('\t') + '\n';
				}

				navigator.clipboard.writeText(tsv).then(() => {
					const prev = copyBtn.textContent;
					copyBtn.textContent = '✓ Copied for Excel!';
					copyBtn.classList.add('btn-copied');
					setTimeout(() => {
						copyBtn.textContent = prev;
						copyBtn.classList.remove('btn-copied');
					}, 1500);
				});
			};

			pasteBtn.onclick = async () => {
				try {
					const text = await navigator.clipboard.readText();
					if (!text.trim()) return alert('Clipboard is empty.');

					const rows = text.trim().split(/\r?\n/).map(line => line.split('\t'));
					const startCoord = this.parseCoord(this.selectedCell) || { cIdx: 0, row: 1 };

					rows.forEach((rowVals, rOffset) => {
						const targetRow = startCoord.row + rOffset;
						if (targetRow > sheet.rows) sheet.rows = targetRow;

						rowVals.forEach((val, cOffset) => {
							const targetColIdx = startCoord.cIdx + cOffset;
							if (targetColIdx >= sheet.cols) sheet.cols = targetColIdx + 1;

							const key = `${this.idxToCol(targetColIdx)}${targetRow}`;
							if (val.trim() === '') delete sheet.cells[key];
							else sheet.cells[key] = val.trim();
						});
					});

					this.persist();
					this.renderGrid(sheet);
					alert('Data from Excel successfully imported!');
				} catch (err) {
					alert('Clipboard access denied. Please grant clipboard permissions in your browser.');
				}
			};

			csvBtn.onclick = () => {
				let csv = '';
				for (let r = 1; r <= sheet.rows; r++) {
					const rowVals = [];
					for (let c = 0; c < sheet.cols; c++) {
						const key = `${this.idxToCol(c)}${r}`;
						let v = this.evalCell(key, sheet.cells).toString();
						if (v.includes(',') || v.includes('"') || v.includes('\n')) {
							v = `"${v.replace(/"/g, '""')}"`;
						}
						rowVals.push(v);
					}
					csv += rowVals.join(',') + '\n';
				}

				const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${sheet.name}.csv`;
				a.click();
				URL.revokeObjectURL(url);
			};
		}
	};

})(NexusBehaviour);