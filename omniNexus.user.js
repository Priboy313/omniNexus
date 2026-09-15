// ==UserScript==
// @name         omniNexus
// @version      2026.09.15
// @author       Priboy313
// @description  A modular userscript framework for creating virtual workspaces and dashboards.
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @run-at       document-start
// @connect      127.0.0.1
// @connect      localhost
// @connect      my-domain.com		// replace with your custom domain if using the "custom" provider
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// ==/UserScript==

(function() {
	'use strict';

	const CONFIG = {
		// Active workspace name used for data scoping
		workspace: "Base",
		// Host domain used to anchor the virtual workspace
		dashboardHost: "google.com",
		// Virtual route on the host domain
		dashboardPath: "/omninexus",
		// Active provider: "github" | "custom" | "local" | "file"
		provider: "github",

		sources: {
			github: {
				username: "Priboy313",
				repo: "omniNexus",
				branch: "main",
			},
			custom: {
				baseUrl: "https://my-domain.com/omninexus"
			},
			local: {
				baseUrl: "http://127.0.0.1:5500"
			},
			file: {
				baseUrl: "file:///C:/omniNexus"
			}
		},

		role: "user",
		ttlMinutes: 60,
	};

	class GMStorageAdapter {
		constructor(workspace, moduleId) {
			this.workspace = workspace;
			this.moduleId = moduleId;
			this.prefix = `nexus_${workspace}_`;
		}

		get(key, fallback = null) {
			const fullKey = key === 'data' ? `${this.prefix}${this.moduleId}` : `${this.prefix}${this.moduleId}_${key}`;
			return GM_getValue(fullKey, fallback);
		}

		set(key, value) {
			const fullKey = key === 'data' ? `${this.prefix}${this.moduleId}` : `${this.prefix}${this.moduleId}_${key}`;
			GM_setValue(fullKey, value);
		}

		getGlobal(key, fallback = null) {
			return GM_getValue(`${this.prefix}${key}`, fallback);
		}

		setGlobal(key, value) {
			GM_setValue(`${this.prefix}${key}`, value);
		}

		exportAll() {
			const keys = typeof GM_listValues === 'function' ? GM_listValues() : [];
			const result = {};
			keys.forEach(k => {
				if (k.startsWith(this.prefix)) {
					const cleanKey = k.replace(this.prefix, '');
					result[cleanKey] = GM_getValue(k);
				}
			});
			return {
				__meta: {
					workspace: this.workspace,
					timestamp: Date.now(),
					exportedAt: new Date().toISOString()
				},
				data: result
			};
		}

		importAll(payload) {
			const data = payload.data || payload;
			for (const key in data) {
				if (key.startsWith('__')) continue;
				GM_setValue(`${this.prefix}${key}`, data[key]);
			}
		}
	}

	const MANIFEST_CACHE_KEY = `nexus_${CONFIG.workspace}_router`;
	const VERSION_CACHE_KEY = `nexus_${CONFIG.workspace}_version`;
	const currentUrl = window.location.href;

	function escapeRegex(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	let manifestCache = GM_getValue(MANIFEST_CACHE_KEY, { timestamp: 0, routes: [] });

	let activeRoute = null;
	for (const route of manifestCache.routes) {
		let pattern = route.pattern;
		if (route.subpath) {
			const cleanSub = route.subpath.replace(/^\/+|\/+$/g, '');
			pattern = `${escapeRegex(CONFIG.dashboardHost)}.*${escapeRegex(CONFIG.dashboardPath)}\\/${cleanSub}(\\/)?($|\\?.*)`;
		}
		if (pattern && new RegExp(pattern, 'i').test(currentUrl)) {
			activeRoute = route;
			break;
		}
	}

	const homePattern = new RegExp(`${escapeRegex(CONFIG.dashboardHost)}.*${escapeRegex(CONFIG.dashboardPath)}\\/?($|\\?.*)`, 'i');
	const isDashboardHome = !activeRoute && homePattern.test(currentUrl);

	if (!activeRoute && !isDashboardHome) return;

	if (currentUrl.includes(CONFIG.dashboardHost)) {
		window.stop();
		document.documentElement.innerHTML = `
			<head><title>${CONFIG.workspace} Hub</title></head>
			<body style="background:#0f172a;color:#38bdf8;font-family:monospace;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
				<h2>[omniNexus:${CONFIG.workspace}] Loading...</h2>
			</body>`;
	}

	init();

	async function init() {
		try {
			const ttlMs = CONFIG.ttlMinutes * 60 * 1000;
			const cachedVersion = GM_getValue(VERSION_CACHE_KEY, null);
			const isExpired = !cachedVersion || (Date.now() - cachedVersion.timestamp > ttlMs);

			const needUpdate = isDashboardHome || isExpired;
			const currentVersion = await resolveVersion(needUpdate);

			if (needUpdate) {
				await updateManifest(currentVersion);
			}

			if (isDashboardHome) {
				await executeWorker('dashboard.js', 'dashboard', currentVersion);
			} else if (activeRoute && activeRoute.worker) {
				await executeWorker(activeRoute.worker, activeRoute.moduleId, currentVersion);
			}
		} catch (err) {
			console.error(`[omniNexus:${CONFIG.workspace}] Initialization error:`, err);
		}
	}

	function request(options) {
		return new Promise((resolve, reject) => {
			options.onload = res => {
				const isSuccess = res.status === 200 || (res.status === 0 && res.responseText);
				if (isSuccess) resolve(res);
				else reject(res.status);
			};
			options.onerror = reject;
			GM_xmlhttpRequest(options);
		});
	}

	async function resolveVersion(forceUpdate) {
		if (CONFIG.provider !== 'github') return 'latest';

		const cached = GM_getValue(VERSION_CACHE_KEY, null);
		if (!forceUpdate && cached && cached.version) {
			return cached.version;
		}

		const src = CONFIG.sources.github;
		const versionUrl = `https://raw.githubusercontent.com/${src.username}/${src.repo}/${src.branch}/version.json?t=${Date.now()}`;

		try {
			const res = await request({ method: 'GET', url: versionUrl });
			const data = JSON.parse(res.responseText);
			const version = data.version || 'latest';

			GM_setValue(VERSION_CACHE_KEY, {
				version: version,
				timestamp: Date.now()
			});

			return version;
		} catch (e) {
			console.warn("[omniNexus] Failed to resolve version, falling back to cache:", e);
			return cached ? cached.version : 'latest';
		}
	}

	function getCoreUrl(version) {
		const src = CONFIG.sources[CONFIG.provider];
		const path = `Core/NexusBehaviour.js`;

		if (CONFIG.provider === 'github') {
			return `https://raw.githubusercontent.com/${src.username}/${src.repo}/${src.branch}/${path}?v=${version}`;
		}
		if (CONFIG.provider === 'file') {
			return `${src.baseUrl}/${path}`;
		}
		return `${src.baseUrl}/${path}?t=${Date.now()}`;
	}

	function getWorkerUrl(workerName, version) {
		const src = CONFIG.sources[CONFIG.provider];
		const path = `Modules/${workerName}`;

		if (CONFIG.provider === 'github') {
			return `https://raw.githubusercontent.com/${src.username}/${src.repo}/${src.branch}/${path}?v=${version}`;
		}
		if (CONFIG.provider === 'file') {
			return `${src.baseUrl}/${path}`;
		}
		return `${src.baseUrl}/${path}?t=${Date.now()}`;
	}

	async function updateManifest(version) {
		try {
			let manifestUrl;
			const src = CONFIG.sources[CONFIG.provider];
			const path = `Modules/manifest.json`;

			if (CONFIG.provider === 'github') {
				manifestUrl = `https://raw.githubusercontent.com/${src.username}/${src.repo}/${src.branch}/${path}?v=${version}`;
			} else if (CONFIG.provider === 'file') {
				manifestUrl = `${src.baseUrl}/${path}`;
			} else {
				manifestUrl = `${src.baseUrl}/${path}?t=${Date.now()}`;
			}

			const res = await request({ method: 'GET', url: manifestUrl });
			const newManifest = JSON.parse(res.responseText);

			GM_setValue(MANIFEST_CACHE_KEY, {
				timestamp: Date.now(),
				routes: newManifest.routes || []
			});
		} catch (e) {
			console.error("[omniNexus] Failed to update manifest.json:", e);
		}
	}

	async function executeWorker(workerFileName, moduleId, version) {
		const coreUrl = getCoreUrl(version);
		const workerUrl = getWorkerUrl(workerFileName, version);

		const globalSettings = GM_getValue(`nexus_${CONFIG.workspace}_settings`, {});
		const moduleSettings = globalSettings[moduleId] || {};

		try {
			const [coreRes, workerRes] = await Promise.all([
				request({ method: 'GET', url: coreUrl }),
				request({ method: 'GET', url: workerUrl })
			]);

			const NexusBehaviour = new Function(coreRes.responseText + '; return NexusBehaviour;')();

			const WorkerClass = new Function('NexusBehaviour', workerRes.responseText + '; return typeof ModuleClass !== "undefined" ? ModuleClass : null;')(NexusBehaviour);

			if (WorkerClass) {
				const storageAdapter = new GMStorageAdapter(CONFIG.workspace, moduleId);
				
				new WorkerClass({
					storage: storageAdapter,
					config: moduleSettings,
					env: {
						workspace: CONFIG.workspace,
						role: CONFIG.role,
						provider: CONFIG.provider,
						dashboardHost: CONFIG.dashboardHost,
						dashboardPath: CONFIG.dashboardPath,
						version: version
					}
				});
			} else {
				console.error(`[omniNexus] Module "${workerFileName}" did not export ModuleClass`);
			}
		} catch (err) {
			console.error(`[omniNexus] Execution error in "${workerFileName}" (v${version}):`, err);
		}
	}
})();