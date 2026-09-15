class NexusBehaviour {
    constructor(context) {
        this.id = this.constructor.name;
        this.role = context.role;
        this.workspace = context.CONFIG.workspace;
        this.CONFIG = context.CONFIG;
        this._context = context;
        
        this._GM_get = context.GM_getValue;
        this._GM_set = context.GM_setValue;
        this._GM_list = context.GM_listValues;
        this._observers = [];

        queueMicrotask(() => this._initLifecycle());
    }

    get config() {
        if (!this._cachedConfig) {
            let userSettings = {};
            try {
                userSettings = JSON.parse(this._context?.settingsJSON || '{}');
            } catch (e) {}
            this._cachedConfig = { ...(this.defaults || {}), ...userSettings };
        }
        return this._cachedConfig;
    }

    _initLifecycle() {
        this.awake();
        this.injectGlobalScrollbars();
        this.updateTitle();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }

    updateTitle(customTitle = null) {
        const icon = this.moduleIcon ? `${this.moduleIcon} ` : '';
        const title = customTitle || this.moduleTitle || this.id;
        document.title = `${icon}${title} // ${this.workspace}`;
    }

    injectGlobalScrollbars() {
        if (document.getElementById('nexus-global-scrollbars')) return;
        const style = document.createElement('style');
        style.id = 'nexus-global-scrollbars';
        style.textContent = `
            * { scrollbar-width: thin; scrollbar-color: #334155 #0f172a; }
            ::-webkit-scrollbar, *::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
            ::-webkit-scrollbar-track, *::-webkit-scrollbar-track { background: #0f172a !important; }
            ::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb { background: #334155 !important; border-radius: 4px !important; border: 2px solid #0f172a !important; }
            ::-webkit-scrollbar-thumb:hover, *::-webkit-scrollbar-thumb:hover { background: #475569 !important; }
            ::-webkit-scrollbar-corner, *::-webkit-scrollbar-corner { background: #0f172a !important; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    awake() {}
    start() {}

    print(...args) {
        if (this.role === "dodev") console.log(`==== [${this.id}]`, ...args);
    }

    addCSS(cssString, subId = null) {
        const styleId = subId ? `custom-${subId}-css` : `custom-${this.id}-css`;
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = cssString;
        (document.head || document.documentElement).appendChild(style);
    }

    waitForElement(selector, timeout = 10000, parent = null) {
        return new Promise((resolve) => {
            if (!selector) return resolve(null);
            const root = parent || document;
            const existing = root.querySelector(selector);
            if (existing) return resolve(existing);
            const targetNode = parent || document.body || document.documentElement;

            let timeoutId;
            const observer = new MutationObserver(() => {
                const found = root.querySelector(selector);
                if (found) {
                    clearTimeout(timeoutId);
                    observer.disconnect();
                    resolve(found);
                }
            });

            timeoutId = setTimeout(() => {
                observer.disconnect();
                this.print(`[Timeout] Element "${selector}" not found.`);
                resolve(null);
            }, timeout);

            observer.observe(targetNode, { childList: true, subtree: true });
        });
    }

    observe(target, callback, options = { childList: true, subtree: true }) {
        const node = typeof target === 'string' ? document.querySelector(target) : target;
        if (!node || !(node instanceof Node)) return null;
        const observer = new MutationObserver((mutations, obs) => callback(node, mutations, obs));
        observer.observe(node, options);
        this._observers.push(observer);
        return observer;
    }

    disconnectObservers() {
        this._observers.forEach(obs => obs.disconnect());
        this._observers = [];
    }

    save(key, value) {
        this._GM_set(`nexus_${this.workspace}_${this.id}_${key}`, value);
    }

    load(key, fallback = null) {
        return this._GM_get(`nexus_${this.workspace}_${this.id}_${key}`, fallback);
    }

    saveGlobal(key, value) {
        this._GM_set(`nexus_${this.workspace}_${key}`, value);
    }

    loadGlobal(key, fallback = null) {
        return this._GM_get(`nexus_${this.workspace}_${key}`, fallback);
    }
}

NexusBehaviour.Explorer = class NexusExplorerBehaviour extends NexusBehaviour {

    moduleTitle = 'omniNexus Explorer';
    storageKey = 'files';
    fileIcon = '📄';
    templateIcon = '📑';
    defaultFileName = 'New Document';
    defaultTemplateName = 'New Template';
    emptyStateIcon = '📭';
    emptyStateTitle = 'No Active Documents';
    emptyStateDesc = 'Select a document from the explorer on the left or create a new one.';

    awake() {
        const hubUrl = `https://${this.CONFIG.dashboardHost}${this.CONFIG.dashboardPath}`;

        document.documentElement.innerHTML = `
            <head><title>${this.moduleTitle} // ${this.workspace}</title></head>
            <body>
                <header>
                    <div class="header-left">
                        <a href="${hubUrl}" class="back-link">← Hub</a>
                        <span class="header-title">${this.moduleTitle}</span>
                    </div>
                </header>
                <div class="app-layout">
                    <div class="explorer-pane">
                        <div class="explorer-section files-section">
                            <div class="section-header">
                                <span class="section-title">Documents</span>
                                <button class="icon-action-btn" id="btn-new-file" title="New Document">+ Create</button>
                            </div>
                            <div class="file-list" id="explorer-files"></div>
                        </div>

                        <div class="explorer-section templates-section" id="templates-accordion">
                            <div class="section-header accordion-toggle" id="toggle-templates">
                                <div class="accordion-title-wrap">
                                    <span class="chevron" id="templates-chevron">⌄</span>
                                    <span class="section-title">Templates</span>
                                    <span class="accordion-count" id="templates-count">0</span>
                                </div>
                                <button class="icon-action-btn" id="btn-new-tpl" title="New Template">+ Template</button>
                            </div>
                            <div class="file-list" id="explorer-templates"></div>
                        </div>
                    </div>
                    <div class="content-pane" id="editor-pane"></div>
                </div>
            </body>`;

        this.addCSS(`
            * { box-sizing: border-box; }
            body { margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; background: #0f172a; color: #f8fafc; height: 100vh; display: flex; flex-direction: column; overflow: hidden; user-select: none; }
            header { height: 52px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex-shrink: 0; }
            .header-left { display: flex; align-items: center; gap: 14px; }
            .back-link { color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 4px; background: #334155; display: flex; align-items: center; gap: 6px; }
            .back-link:hover { color: #f8fafc; background: #475569; }
            .header-title { font-weight: 700; font-size: 15px; color: #38bdf8; }

            .app-layout { flex-grow: 1; display: flex; overflow: hidden; }
            .explorer-pane { width: 290px; min-width: 290px; background: #111827; border-right: 1px solid #1f2937; display: flex; flex-direction: column; }
            .explorer-section { display: flex; flex-direction: column; }
            .files-section { flex-grow: 1; overflow: hidden; }
            .templates-section { flex-shrink: 0; border-top: 1px solid #1f2937; background: #0d131f; }
            .templates-section.collapsed #explorer-templates { display: none; }

            .section-header { padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; height: 38px; }
            .accordion-toggle { cursor: pointer; user-select: none; }
            .accordion-toggle:hover { background: #172033; }
            .accordion-title-wrap { display: flex; align-items: center; gap: 8px; }
            .chevron { font-size: 14px; color: #9ca3af; font-family: monospace; font-weight: bold; width: 12px; display: inline-block; transition: transform 0.15s; }
            .templates-section.collapsed .chevron { transform: rotate(-90deg); }
            .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; }
            .accordion-count { font-size: 11px; color: #64748b; font-family: monospace; }
            
            .icon-action-btn { background: #1f2937; border: 1px solid #374151; color: #38bdf8; padding: 2px 7px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; }
            .icon-action-btn:hover { background: #374151; color: #fff; }

            .file-list { overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 3px; max-height: calc(100vh - 200px); }
            .templates-section .file-list { max-height: 240px; }

            .file-item { display: flex; align-items: center; justify-content: space-between; padding: 7px 9px; border-radius: 5px; cursor: grab; font-size: 13px; color: #d1d5db; transition: background 0.1s; position: relative; }
            .file-item:active { cursor: grabbing; }
            .file-item:hover { background: #1f2937; color: #fff; }
            .file-item.active { background: #0284c7; color: #fff; }
            .file-item.item-dragging { opacity: 0.2; }
            .file-item.drop-above { border-top: 2px solid #38bdf8 !important; }
            .file-item.drop-below { border-bottom: 2px solid #38bdf8 !important; }

            .file-name-wrapper { display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow: 1; margin-right: 6px; }
            .file-actions { display: flex; gap: 2px; opacity: 0; }
            .file-item:hover .file-actions { opacity: 1; }
            .file-btn { background: transparent; border: none; color: #9ca3af; cursor: pointer; padding: 2px 5px; border-radius: 3px; font-size: 11px; }
            .file-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
            .file-btn.make-file { color: #38bdf8; font-weight: bold; }
            .file-btn.make-file:hover { background: rgba(56, 189, 248, 0.2); color: #fff; }
            .file-btn.del:hover { background: rgba(239,68,68,0.3); color: #ef4444; }

            .content-pane { flex-grow: 1; display: flex; flex-direction: column; background: #0f172a; overflow: hidden; user-select: text; }
            
            .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 70vh; text-align: center; gap: 16px; color: #64748b; }
            .empty-icon { font-size: 48px; }
            .empty-title { font-size: 20px; font-weight: 700; color: #94a3b8; margin: 0; }
            .empty-desc { font-size: 14px; max-width: 340px; line-height: 1.5; margin: 0; }
            .empty-btns { display: flex; gap: 10px; }
            .empty-btn { background: #0284c7; border: none; color: white; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; }
            .empty-btn:hover { background: #0369a1; }
            .empty-btn.secondary { background: #1e293b; border: 1px solid #334155; color: #94a3b8; }
            .empty-btn.secondary:hover { background: #334155; color: #fff; }
        `, 'nexus-explorer-engine');
    }

    start() {
        this.appData = this.loadGlobal(this.storageKey, this.config.defaultData || {});
        if (!this.appData.files) this.appData.files = [];
        if (!this.appData.templates) this.appData.templates = [];
        if (this.appData.isTemplatesOpen === undefined) this.appData.isTemplatesOpen = true;
        if (!this.appData.activeId && this.appData.files.length > 0) {
            this.appData.activeId = this.appData.files[0].id;
        }

        this._draggedFileId = null;
        this._draggedIsTemplate = false;

        this.initExplorerEvents();
        this.render();
    }

    initExplorerEvents() {
        document.getElementById('btn-new-file').onclick = () => this.createNewFile();
        document.getElementById('btn-new-tpl').onclick = (e) => {
            e.stopPropagation();
            this.createNewTemplate();
        };

        const accordionHeader = document.getElementById('toggle-templates');
        accordionHeader.onclick = (e) => {
            if (e.target.closest('#btn-new-tpl')) return;
            this.appData.isTemplatesOpen = !this.appData.isTemplatesOpen;
            this.persist();
            this.updateAccordionVisual();
        };
    }

    updateAccordionVisual() {
        const section = document.getElementById('templates-accordion');
        if (section) section.classList.toggle('collapsed', !this.appData.isTemplatesOpen);
    }

    getActiveObject() {
        const id = this.appData.activeId;
        if (!id) return null;
        const file = this.appData.files.find(f => f.id === id);
        if (file) return { data: file, isTemplate: false };
        const tpl = this.appData.templates.find(t => t.id === id);
        if (tpl) return { data: tpl, isTemplate: true };
        return null;
    }

    render() {
        this.renderExplorer();
        this.renderContent();
        this.updateAccordionVisual();
    }

    renderExplorer() {
        this.renderItemList('explorer-files', this.appData.files, false);
        this.renderItemList('explorer-templates', this.appData.templates, true);
        const count = document.getElementById('templates-count');
        if (count) count.textContent = this.appData.templates.length;
    }

    renderItemList(containerId, list, isTemplate) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        list.forEach(itemData => {
            const item = document.createElement('div');
            item.className = `file-item ${itemData.id === this.appData.activeId ? 'active' : ''}`;
            item.draggable = true;

            const icon = isTemplate ? this.templateIcon : this.fileIcon;
            const badgeHTML = this.getItemBadge ? this.getItemBadge(itemData, isTemplate) : '';

            item.innerHTML = `
                <div class="file-name-wrapper" title="${itemData.name}">
                    <span>${icon}</span>
                    <span style="overflow:hidden;text-overflow:ellipsis;">${itemData.name}</span>
                </div>
                ${badgeHTML || ''}
                <div class="file-actions">
                    ${isTemplate ? `<button class="file-btn make-file" title="Create document from template">⚡</button>` : ''}
                    <button class="file-btn edit" title="Rename">✏️</button>
                    <button class="file-btn del" title="Delete">✕</button>
                </div>
            `;

            item.onclick = (e) => {
                if (e.target.closest('.file-actions')) return;
                this.appData.activeId = itemData.id;
                this.persist();
                this.render();
            };

            item.addEventListener('dragstart', (e) => {
                this._draggedFileId = itemData.id;
                this._draggedIsTemplate = isTemplate;
                e.stopPropagation();
                setTimeout(() => item.classList.add('item-dragging'), 0);
            });

            item.addEventListener('dragend', (e) => {
                e.stopPropagation();
                item.classList.remove('item-dragging');
                document.querySelectorAll('.file-item').forEach(el => el.classList.remove('drop-above', 'drop-below'));
                this._draggedFileId = null;
            });

            item.addEventListener('dragover', (e) => {
                if (!this._draggedFileId || this._draggedFileId === itemData.id || this._draggedIsTemplate !== isTemplate) return;
                e.preventDefault();
                e.stopPropagation();
                const rect = item.getBoundingClientRect();
                if (e.clientY < rect.top + rect.height / 2) {
                    item.classList.add('drop-above');
                    item.classList.remove('drop-below');
                } else {
                    item.classList.add('drop-below');
                    item.classList.remove('drop-above');
                }
            });

            item.addEventListener('dragleave', (e) => {
                e.stopPropagation();
                item.classList.remove('drop-above', 'drop-below');
            });

            item.addEventListener('drop', (e) => {
                if (!this._draggedFileId || this._draggedFileId === itemData.id || this._draggedIsTemplate !== isTemplate) return;
                e.preventDefault();
                e.stopPropagation();
                const rect = item.getBoundingClientRect();
                const insertBefore = e.clientY < rect.top + rect.height / 2;
                this.reorderFiles(list, this._draggedFileId, itemData.id, insertBefore);
            });

            if (isTemplate) {
                item.querySelector('.file-btn.make-file').onclick = (e) => {
                    e.stopPropagation();
                    this.instantiateTemplate(itemData);
                };
            }

            item.querySelector('.file-btn.edit').onclick = (e) => {
                e.stopPropagation();
                this.renameItem(itemData);
            };

            item.querySelector('.file-btn.del').onclick = (e) => {
                e.stopPropagation();
                this.deleteItem(itemData.id, isTemplate);
            };

            container.appendChild(item);
        });
    }

    reorderFiles(list, fromId, targetId, insertBefore) {
        const fromIdx = list.findIndex(x => x.id === fromId);
        const [moved] = list.splice(fromIdx, 1);
        let targetIdx = list.findIndex(x => x.id === targetId);

        if (targetIdx === -1) {
            list.push(moved);
        } else {
            if (!insertBefore) targetIdx++;
            list.splice(targetIdx, 0, moved);
        }

        this.persist();
        this.render();
    }

    renderContent() {
        const pane = document.getElementById('editor-pane');
        const activeObj = this.getActiveObject();

        if (!activeObj) {
            this.updateTitle();
            pane.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">${this.emptyStateIcon}</div>
                    <h3 class="empty-title">${this.emptyStateTitle}</h3>
                    <p class="empty-desc">${this.emptyStateDesc}</p>
                    <div class="empty-btns">
                        <button class="empty-btn" id="empty-create-file">+ New Document</button>
                        <button class="empty-btn secondary" id="empty-create-tpl">+ New Template</button>
                    </div>
                </div>
            `;
            document.getElementById('empty-create-file').onclick = () => this.createNewFile();
            document.getElementById('empty-create-tpl').onclick = () => this.createNewTemplate();
            return;
        }

        this.updateTitle(activeObj.data.name);

        if (this.renderEditor) {
            this.renderEditor(activeObj.data, activeObj.isTemplate, pane);
        }
    }

    createNewFile() {
        const name = prompt('Document Name:', this.defaultFileName);
        if (!name || !name.trim()) return;

        const newFile = {
            id: 'f_' + Date.now(),
            name: name.trim(),
            ...(this.createFileData ? this.createFileData(name.trim()) : {})
        };

        this.appData.files.push(newFile);
        this.appData.activeId = newFile.id;
        this.persist();
        this.render();
    }

    createNewTemplate() {
        const name = prompt('Template Name:', this.defaultTemplateName);
        if (!name || !name.trim()) return;

        const newTpl = {
            id: 't_' + Date.now(),
            name: name.trim(),
            ...(this.createTemplateData ? this.createTemplateData(name.trim()) : {})
        };

        this.appData.templates.push(newTpl);
        this.appData.activeId = newTpl.id;
        this.appData.isTemplatesOpen = true;
        this.persist();
        this.render();
    }

    instantiateTemplate(tpl) {
        const name = prompt('Document Name from Template:', `${tpl.name} (Copy)`);
        if (!name || !name.trim()) return;

        const newFile = {
            id: 'f_' + Date.now(),
            name: name.trim(),
            ...(this.cloneTemplateData ? this.cloneTemplateData(tpl) : JSON.parse(JSON.stringify(tpl)))
        };
        delete newFile.isTemplate;

        this.appData.files.push(newFile);
        this.appData.activeId = newFile.id;
        this.persist();
        this.render();
    }

    renameItem(item) {
        const newName = prompt('New Name:', item.name);
        if (newName && newName.trim()) {
            item.name = newName.trim();
            this.persist();
            this.render();
        }
    }

    deleteItem(id, isTemplate) {
        const list = isTemplate ? this.appData.templates : this.appData.files;
        const item = list.find(x => x.id === id);
        if (!item) return;

        const label = isTemplate ? 'template' : 'document';
        if (!confirm(`Delete ${label} "${item.name}"?`)) return;

        if (isTemplate) {
            this.appData.templates = this.appData.templates.filter(x => x.id !== id);
        } else {
            this.appData.files = this.appData.files.filter(x => x.id !== id);
        }

        if (this.appData.activeId === id) {
            if (this.appData.files.length > 0) {
                this.appData.activeId = this.appData.files[0].id;
            } else if (this.appData.templates.length > 0) {
                this.appData.activeId = this.appData.templates[0].id;
            } else {
                this.appData.activeId = null;
            }
        }

        this.persist();
        this.render();
    }

    persist() {
        this.saveGlobal(this.storageKey, this.appData);
    }
};