class NexusBehaviour {
    constructor(context) {
        this.id = this.constructor.name;
        this.storage = context.storage;
        this.env = context.env || {};
        this._context = context;
        this._cachedConfig = null;
        this._observers = [];

        queueMicrotask(() => this._initLifecycle());
    }

    get config() {
        if (!this._cachedConfig) {
            const userConfig = (typeof this._context?.config === 'object' && this._context?.config !== null)
                ? this._context.config
                : {};
            this._cachedConfig = { ...(this.defaults || {}), ...userConfig };
        }
        return this._cachedConfig;
    }

    set config(val) {
        this._cachedConfig = val;
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
        const ws = this.env.workspace ? ` // ${this.env.workspace}` : '';
        document.title = `${icon}${title}${ws}`;
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
        if (this.env.role === "dodev") console.log(`==== [${this.id}]`, ...args);
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
        return this.storage.set(key, value);
    }

    load(key, fallback = null) {
        return this.storage.get(key, fallback);
    }
}

// =========================================================================
// ПРОВОДНИК С ИЕРАРХИЧЕСКИМИ ПАПКАМИ, ВЛОЖЕННОСТЬЮ И СОРТИРОВКОЙ
// =========================================================================
NexusBehaviour.Explorer = class NexusExplorerBehaviour extends NexusBehaviour {

    moduleTitle = 'omniNexus Explorer';
    fileIcon = '📄';
    templateIcon = '📑';
    defaultFileName = 'New Document';
    defaultTemplateName = 'New Template';
    emptyStateIcon = '📭';
    emptyStateTitle = 'No Active Documents';
    emptyStateDesc = 'Select a document from the explorer on the left or create a new one.';

    awake() {
        const hubUrl = `https://${this.env.dashboardHost}${this.env.dashboardPath}`;

        document.documentElement.innerHTML = `
            <head><title>${this.moduleTitle} // ${this.env.workspace}</title></head>
            <body>
                <header>
                    <div class="header-left">
                        <button class="icon-toggle-btn" id="btn-toggle-sidebar" title="Toggle Sidebar (Ctrl+B)">
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M2 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm4 1H2v8h4V4zm1 0v8h7V4H7z"/>
                            </svg>
                        </button>
                        <a href="${hubUrl}" class="back-link">← Hub</a>
                        <span class="header-title">${this.moduleTitle}</span>
                    </div>
                </header>
                <div class="app-layout">
                    <div class="explorer-pane">
                        <div class="explorer-section files-section">
                            <div class="section-header">
                                <span class="section-title">Explorer</span>
                                <div class="header-actions">
                                    <button class="icon-action-btn" id="btn-new-file" title="New File in Root">+ File</button>
                                    <button class="icon-action-btn" id="btn-new-folder" title="New Folder in Root">+ Folder</button>
                                </div>
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
            .header-left { display: flex; align-items: center; gap: 10px; }
            
            .icon-toggle-btn { background: #334155; border: 1px solid #475569; color: #94a3b8; padding: 6px 9px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
            .icon-toggle-btn:hover { background: #475569; color: #f8fafc; }
            .icon-toggle-btn.active { background: #0284c7; border-color: #38bdf8; color: #fff; }

            .back-link { color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 4px; background: #334155; display: flex; align-items: center; gap: 6px; }
            .back-link:hover { color: #f8fafc; background: #475569; }
            .header-title { font-weight: 700; font-size: 15px; color: #38bdf8; }

            .app-layout { flex-grow: 1; display: flex; overflow: hidden; }
            .explorer-pane { width: 300px; min-width: 300px; background: #111827; border-right: 1px solid #1f2937; display: flex; flex-direction: column; transition: margin-left 0.2s ease; }
            .app-layout.sidebar-collapsed .explorer-pane { display: none !important; }

            .explorer-section { display: flex; flex-direction: column; }
            .files-section { flex-grow: 1; overflow: hidden; }
            .templates-section { flex-shrink: 0; border-top: 1px solid #1f2937; background: #0d131f; }
            .templates-section.collapsed #explorer-templates { display: none; }

            .section-header { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f2937; height: 38px; }
            .header-actions { display: flex; gap: 4px; }
            .accordion-toggle { cursor: pointer; user-select: none; }
            .accordion-toggle:hover { background: #172033; }
            .accordion-title-wrap { display: flex; align-items: center; gap: 8px; }
            .chevron { font-size: 14px; color: #9ca3af; font-family: monospace; font-weight: bold; width: 12px; display: inline-block; transition: transform 0.15s; }
            .templates-section.collapsed .chevron { transform: rotate(-90deg); }
            .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; }
            .accordion-count { font-size: 11px; color: #64748b; font-family: monospace; }
            
            .icon-action-btn { background: #1f2937; border: 1px solid #374151; color: #38bdf8; padding: 2px 7px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; }
            .icon-action-btn:hover { background: #374151; color: #fff; }

            .file-list { overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-height: 50px; }
            .file-list.root-drop-zone { outline: 2px dashed #0284c7; background: rgba(2, 132, 199, 0.05); }
            .templates-section .file-list { max-height: 220px; }

            /* Папки */
            .folder-block { display: flex; flex-direction: column; margin-bottom: 2px; }
            .folder-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 4px; cursor: grab; color: #cbd5e1; font-size: 13px; font-weight: 600; transition: background 0.1s; position: relative; }
            .folder-header:active { cursor: grabbing; }
            .folder-header:hover { background: #1f2937; color: #fff; }
            .folder-header.folder-drop-inside { outline: 2px dashed #38bdf8 !important; background: rgba(56, 189, 248, 0.15) !important; }
            .folder-header.drop-above { border-top: 2px solid #38bdf8 !important; }
            .folder-header.drop-below { border-bottom: 2px solid #38bdf8 !important; }
            .folder-header.item-dragging { opacity: 0.3; }

            .folder-title-wrap { display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow: 1; }
            .folder-chevron { font-size: 11px; width: 12px; color: #94a3b8; font-family: monospace; font-weight: bold; display: inline-block; transition: transform 0.15s; }
            .folder-chevron.closed { transform: rotate(-90deg); }
            .folder-badge { font-size: 10px; color: #64748b; font-family: monospace; margin-right: 4px; }
            
            .folder-children { padding-left: 10px; border-left: 1px solid #1e293b; margin-left: 10px; display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
            .folder-children.collapsed { display: none; }

            /* Файлы */
            .file-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 4px; cursor: grab; font-size: 13px; color: #d1d5db; transition: background 0.1s; position: relative; }
            .file-item:active { cursor: grabbing; }
            .file-item:hover { background: #1f2937; color: #fff; }
            .file-item.active { background: #0284c7; color: #fff; }
            .file-item.item-dragging { opacity: 0.2; }
            .file-item.drop-above { border-top: 2px solid #38bdf8 !important; }
            .file-item.drop-below { border-bottom: 2px solid #38bdf8 !important; }

            .file-name-wrapper { display: flex; align-items: center; gap: 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow: 1; margin-right: 6px; }
            .file-actions { display: flex; gap: 2px; opacity: 0; }
            .file-item:hover .file-actions, .folder-header:hover .file-actions { opacity: 1; }
            .file-btn { background: transparent; border: none; color: #9ca3af; cursor: pointer; padding: 2px 4px; border-radius: 3px; font-size: 11px; }
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
        this.appData = this.load('data', this.defaults.defaultData || {});
        if (!this.appData.files) this.appData.files = [];
        if (!this.appData.folders) this.appData.folders = [];
        if (!this.appData.templates) this.appData.templates = [];
        if (this.appData.isTemplatesOpen === undefined) this.appData.isTemplatesOpen = true;
        if (this.appData.isSidebarOpen === undefined) this.appData.isSidebarOpen = true;
        if (!this.appData.activeId && this.appData.files.length > 0) {
            this.appData.activeId = this.appData.files[0].id;
        }

        this._draggedId = null;
        this._draggedType = null; // 'file' | 'folder'
        this._draggedIsTemplate = false;

        this.initExplorerEvents();
        this.render();
        this.updateSidebarVisual();
    }

    initExplorerEvents() {
        document.getElementById('btn-new-file').onclick = () => this.createNewFile(null);
        document.getElementById('btn-new-folder').onclick = () => this.createNewFolder(null);
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

        const toggleBtn = document.getElementById('btn-toggle-sidebar');
        if (toggleBtn) {
            toggleBtn.onclick = () => this.toggleSidebar();
        }

        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                    e.preventDefault();
                    this.toggleSidebar();
                }
            }
        });

        // Дроп на пустую область проводника выносит файл или папку обратно в корень
        const rootList = document.getElementById('explorer-files');
        rootList.addEventListener('dragover', (e) => {
            if (this._draggedId && !this._draggedIsTemplate && !e.target.closest('.file-item, .folder-header')) {
                e.preventDefault();
                rootList.classList.add('root-drop-zone');
            }
        });

        rootList.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget || !rootList.contains(e.relatedTarget)) {
                rootList.classList.remove('root-drop-zone');
            }
        });

        rootList.addEventListener('drop', (e) => {
            rootList.classList.remove('root-drop-zone');
            if (this._draggedId && !this._draggedIsTemplate && !e.target.closest('.file-item, .folder-header')) {
                e.preventDefault();
                if (this._draggedType === 'file') {
                    const f = this.appData.files.find(x => x.id === this._draggedId);
                    if (f) f.folderId = null;
                } else if (this._draggedType === 'folder') {
                    const d = this.appData.folders.find(x => x.id === this._draggedId);
                    if (d) d.parentId = null;
                }
                this.persist();
                this.render();
            }
        });
    }

    toggleSidebar() {
        this.appData.isSidebarOpen = !this.appData.isSidebarOpen;
        this.persist();
        this.updateSidebarVisual();
    }

    updateSidebarVisual() {
        const layout = document.querySelector('.app-layout');
        if (layout) {
            layout.classList.toggle('sidebar-collapsed', !this.appData.isSidebarOpen);
        }
        const btn = document.getElementById('btn-toggle-sidebar');
        if (btn) {
            btn.classList.toggle('active', !this.appData.isSidebarOpen);
        }
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

    // Проверка на предотвращение циклов: нельзя вложить папку внутрь самой себя или своего потомка
    isDescendantOf(folderId, potentialAncestorId) {
        let current = this.appData.folders.find(d => d.id === folderId);
        while (current && current.parentId) {
            if (current.parentId === potentialAncestorId) return true;
            current = this.appData.folders.find(d => d.id === current.parentId);
        }
        return false;
    }

    render() {
        this.renderExplorer();
        this.renderContent();
        this.updateAccordionVisual();
        this.updateSidebarVisual();
    }

    renderExplorer() {
        const rootContainer = document.getElementById('explorer-files');
        if (!rootContainer) return;
        rootContainer.innerHTML = '';

        // Рекурсивный рендер дерева папок и файлов от корня (parentId: null)
        this.renderHierarchy(rootContainer, null);

        // Рендер шаблонов
        this.renderTemplatesList();
    }

    renderHierarchy(container, parentFolderId) {
        // 1. Папки текущего уровня
        const folders = this.appData.folders.filter(d => (d.parentId || null) === parentFolderId);
        folders.forEach(folder => {
            const folderBlock = this.createFolderElement(folder);
            container.appendChild(folderBlock);
        });

        // 2. Файлы текущего уровня
        const files = this.appData.files.filter(f => (f.folderId || null) === parentFolderId);
        files.forEach(file => {
            const fileEl = this.createFileElement(file, false);
            container.appendChild(fileEl);
        });
    }

    createFolderElement(folder) {
        const block = document.createElement('div');
        block.className = 'folder-block';
        block.dataset.folderId = folder.id;

        const allSubFolderIds = this.getAllSubfolderIds(folder.id);
        const filesCount = this.appData.files.filter(f => allSubFolderIds.includes(f.folderId)).length;
        const isOpen = folder.isOpen !== false;

        block.innerHTML = `
            <div class="folder-header" draggable="true" title="${folder.name}">
                <div class="folder-title-wrap">
                    <span class="folder-chevron ${isOpen ? '' : 'closed'}">⌄</span>
                    <span class="folder-icon">${isOpen ? '📂' : '📁'}</span>
                    <span style="overflow:hidden;text-overflow:ellipsis;">${folder.name}</span>
                </div>
                <span class="folder-badge">${filesCount}</span>
                <div class="file-actions">
                    <button class="file-btn add-file" title="Create File Inside">+</button>
                    <button class="file-btn add-subfolder" title="Create Subfolder Inside">📁+</button>
                    <button class="file-btn edit" title="Rename Folder">✏️</button>
                    <button class="file-btn del" title="Delete Folder and Contents">✕</button>
                </div>
            </div>
            <div class="folder-children ${isOpen ? '' : 'collapsed'}"></div>
        `;

        const header = block.querySelector('.folder-header');
        const children = block.querySelector('.folder-children');

        header.onclick = (e) => {
            if (e.target.closest('.file-actions')) return;
            folder.isOpen = !isOpen;
            this.persist();
            this.render();
        };

        // Drag & Drop для папок
        header.addEventListener('dragstart', (e) => {
            this._draggedId = folder.id;
            this._draggedType = 'folder';
            this._draggedIsTemplate = false;
            e.stopPropagation();
            setTimeout(() => header.classList.add('item-dragging'), 0);
        });

        header.addEventListener('dragend', (e) => {
            e.stopPropagation();
            header.classList.remove('item-dragging');
            this.clearDropHighlights();
            this._draggedId = null;
            this._draggedType = null;
        });

        header.addEventListener('dragover', (e) => {
            if (!this._draggedId || this._draggedIsTemplate) return;
            
            // Нельзя дропнуть папку в себя или в своего потомка
            if (this._draggedType === 'folder' && (this._draggedId === folder.id || this.isDescendantOf(folder.id, this._draggedId))) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const rect = header.getBoundingClientRect();
            header.classList.remove('drop-above', 'drop-below', 'folder-drop-inside');

            // Верхние 25% — вставить выше на том же уровне
            // Нижние 25% — вставить ниже на том же уровне
            // Центр 50% — вложить внутрь папки
            if (e.clientY < rect.top + rect.height * 0.25) {
                header.classList.add('drop-above');
            } else if (e.clientY > rect.bottom - rect.height * 0.25) {
                header.classList.add('drop-below');
            } else {
                header.classList.add('folder-drop-inside');
            }
        });

        header.addEventListener('dragleave', (e) => {
            e.stopPropagation();
            header.classList.remove('drop-above', 'drop-below', 'folder-drop-inside');
        });

        header.addEventListener('drop', (e) => {
            if (!this._draggedId || this._draggedIsTemplate) return;
            if (this._draggedType === 'folder' && (this._draggedId === folder.id || this.isDescendantOf(folder.id, this._draggedId))) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const rect = header.getBoundingClientRect();
            const isInside = (e.clientY >= rect.top + rect.height * 0.25) && (e.clientY <= rect.bottom - rect.height * 0.25);
            const insertBefore = e.clientY < rect.top + rect.height * 0.25;

            header.classList.remove('drop-above', 'drop-below', 'folder-drop-inside');

            if (isInside) {
                // Вложить внутрь папки
                if (this._draggedType === 'file') {
                    const f = this.appData.files.find(x => x.id === this._draggedId);
                    if (f) f.folderId = folder.id;
                } else if (this._draggedType === 'folder') {
                    const d = this.appData.folders.find(x => x.id === this._draggedId);
                    if (d) d.parentId = folder.id;
                }
                folder.isOpen = true;
            } else {
                // Сортировать на одном уровне с этой папкой
                if (this._draggedType === 'folder') {
                    const d = this.appData.folders.find(x => x.id === this._draggedId);
                    if (d) d.parentId = folder.parentId || null;
                    this.reorderArray(this.appData.folders, this._draggedId, folder.id, insertBefore);
                } else if (this._draggedType === 'file') {
                    const f = this.appData.files.find(x => x.id === this._draggedId);
                    if (f) f.folderId = folder.parentId || null;
                }
            }

            this.persist();
            this.render();
        });

        header.querySelector('.add-file').onclick = (e) => {
            e.stopPropagation();
            this.createNewFile(folder.id);
        };

        header.querySelector('.add-subfolder').onclick = (e) => {
            e.stopPropagation();
            this.createNewFolder(folder.id);
        };

        header.querySelector('.edit').onclick = (e) => {
            e.stopPropagation();
            this.renameFolder(folder);
        };

        header.querySelector('.del').onclick = (e) => {
            e.stopPropagation();
            this.deleteFolderRecursive(folder.id);
        };

        // Рекурсивный рендер содержимого папки
        this.renderHierarchy(children, folder.id);

        return block;
    }

    createFileElement(itemData, isTemplate) {
        const item = document.createElement('div');
        item.className = `file-item ${itemData.id === this.appData.activeId ? 'active' : ''}`;
        item.draggable = true;
        item.dataset.fileId = itemData.id;

        const icon = isTemplate ? this.templateIcon : this.fileIcon;
        const badgeHTML = this.getItemBadge ? this.getItemBadge(itemData, isTemplate) : '';

        item.innerHTML = `
            <div class="file-name-wrapper" title="${itemData.name}">
                <span>${icon}</span>
                <span style="overflow:hidden;text-overflow:ellipsis;">${itemData.name}</span>
            </div>
            ${badgeHTML || ''}
            <div class="file-actions">
                ${isTemplate ? `<button class="file-btn make-file" title="Create from template">⚡</button>` : ''}
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
            this._draggedId = itemData.id;
            this._draggedType = 'file';
            this._draggedIsTemplate = isTemplate;
            e.stopPropagation();
            setTimeout(() => item.classList.add('item-dragging'), 0);
        });

        item.addEventListener('dragend', (e) => {
            e.stopPropagation();
            item.classList.remove('item-dragging');
            this.clearDropHighlights();
            this._draggedId = null;
            this._draggedType = null;
        });

        item.addEventListener('dragover', (e) => {
            if (!this._draggedId || this._draggedId === itemData.id || this._draggedIsTemplate !== isTemplate) return;
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
            if (!this._draggedId || this._draggedId === itemData.id || this._draggedIsTemplate !== isTemplate) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = item.getBoundingClientRect();
            const insertBefore = e.clientY < rect.top + rect.height / 2;

            if (isTemplate) {
                this.reorderArray(this.appData.templates, this._draggedId, itemData.id, insertBefore);
            } else {
                if (this._draggedType === 'file') {
                    const draggedFile = this.appData.files.find(f => f.id === this._draggedId);
                    if (draggedFile) {
                        draggedFile.folderId = itemData.folderId || null;
                    }
                    this.reorderArray(this.appData.files, this._draggedId, itemData.id, insertBefore);
                } else if (this._draggedType === 'folder') {
                    const draggedFolder = this.appData.folders.find(d => d.id === this._draggedId);
                    if (draggedFolder) {
                        draggedFolder.parentId = itemData.folderId || null;
                    }
                }
            }

            this.persist();
            this.render();
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

        return item;
    }

    clearDropHighlights() {
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('drop-above', 'drop-below'));
        document.querySelectorAll('.folder-header').forEach(el => el.classList.remove('drop-above', 'drop-below', 'folder-drop-inside'));
        const root = document.getElementById('explorer-files');
        if (root) root.classList.remove('root-drop-zone');
    }

    renderTemplatesList() {
        const container = document.getElementById('explorer-templates');
        const count = document.getElementById('templates-count');
        if (count) count.textContent = this.appData.templates.length;
        if (!container) return;
        container.innerHTML = '';

        this.appData.templates.forEach(tpl => {
            const el = this.createFileElement(tpl, true);
            container.appendChild(el);
        });
    }

    reorderArray(list, fromId, targetId, insertBefore) {
        const fromIdx = list.findIndex(x => x.id === fromId);
        if (fromIdx === -1) return;
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
            document.getElementById('empty-create-file').onclick = () => this.createNewFile(null);
            document.getElementById('empty-create-tpl').onclick = () => this.createNewTemplate();
            return;
        }

        this.updateTitle(activeObj.data.name);

        if (this.renderEditor) {
            this.renderEditor(activeObj.data, activeObj.isTemplate, pane);
        }
    }

    createNewFile(folderId = null) {
        const name = prompt('File Name:', this.defaultFileName);
        if (!name || !name.trim()) return;

        const newFile = {
            id: 'f_' + Date.now(),
            name: name.trim(),
            folderId: folderId,
            ...(this.createFileData ? this.createFileData(name.trim()) : {})
        };

        this.appData.files.push(newFile);
        this.appData.activeId = newFile.id;
        this.persist();
        this.render();
    }

    createNewFolder(parentFolderId = null) {
        const name = prompt('Folder Name:', 'New Folder');
        if (!name || !name.trim()) return;

        const newFolder = {
            id: 'dir_' + Date.now(),
            name: name.trim(),
            parentId: parentFolderId,
            isOpen: true
        };

        this.appData.folders.push(newFolder);
        this.persist();
        this.render();
    }

    renameFolder(folder) {
        const newName = prompt('Rename Folder:', folder.name);
        if (newName && newName.trim()) {
            folder.name = newName.trim();
            this.persist();
            this.render();
        }
    }

    // Рекурсивный поиск всех подпапок для удаления
    getAllSubfolderIds(folderId) {
        const subIds = [folderId];
        let added = true;
        while (added) {
            added = false;
            this.appData.folders.forEach(d => {
                if (d.parentId && subIds.includes(d.parentId) && !subIds.includes(d.id)) {
                    subIds.push(d.id);
                    added = true;
                }
            });
        }
        return subIds;
    }

    // Честное рекурсивное удаление папки со всем содержимым
    deleteFolderRecursive(folderId) {
        const folder = this.appData.folders.find(d => d.id === folderId);
        if (!folder) return;

        const subfolderIds = this.getAllSubfolderIds(folderId);
        const filesToDelete = this.appData.files.filter(f => subfolderIds.includes(f.folderId));

        let warning = `Delete folder "${folder.name}" and ALL contents permanently?`;
        if (filesToDelete.length > 0 || subfolderIds.length > 1) {
            warning += `\n(${filesToDelete.length} files and ${subfolderIds.length - 1} subfolders will be deleted).`;
        }

        if (!confirm(warning)) return;

        // Удаляем все вложенные папки и файлы
        this.appData.folders = this.appData.folders.filter(d => !subfolderIds.includes(d.id));
        this.appData.files = this.appData.files.filter(f => !subfolderIds.includes(f.folderId));

        // Если удален активный файл — сбрасываем выбор
        if (filesToDelete.some(f => f.id === this.appData.activeId)) {
            this.appData.activeId = this.appData.files.length > 0 ? this.appData.files[0].id : null;
        }

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
            folderId: null,
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

        const label = isTemplate ? 'template' : 'file';
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
        this.save('data', this.appData);
    }
};