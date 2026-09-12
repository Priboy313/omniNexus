// ==UserScript==
// @name         omniNexus
// @version      2.0
// @author       Priboy313
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @run-at       document-start
// @connect      127.0.0.1
// @connect      localhost
// @connect      my-domain.com
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// ==/UserScript==

(function() {
	'use strict';

	const CONFIG = {
		// Root folder inside the repository
		systemRoot: "Extension",
		// Workspace directory name containing target modules
		workspace: "Base",

		// Host domain used to anchor the virtual dashboard
		dashboardHost: "google.com",
		// Virtual path for the dashboard (recommended to be a non-existent path on the host)
		dashboardPath: "/omninexus",

		// Active source provider: "github" | "custom" | "local" | "file"
		provider: "github",

		sources: {
			github: {
				// Public repository details
				username: "Priboy313",
				repo: "omniNexus",
				branch: "main",
			},
			custom: {
				// Self-hosted server endpoint
				baseUrl: "https://my-domain.com/omninexus"
			},
			local: {
				// Local dev server endpoint
				baseUrl: "http://127.0.0.1:5500"
			},
			file: {
				// Direct filesystem path without running an HTTP server (requires "Allow access to file URLs")
				baseUrl: "file:///C:/Users/USER_NAME/Desktop/omniNexus"
			}
		},

		// User access role
		role: "user",
		// Cache time-to-live for version checks (in minutes)
		ttlMinutes: 60,
	};

	const CACHE_PREFIX = `nexus_${CONFIG.workspace}_`;
	const ROUTER_CACHE_KEY = CACHE_PREFIX + 'router';
	const SETTINGS_KEY = CACHE_PREFIX + 'settings';
	const VERSION_CACHE_KEY = CACHE_PREFIX + 'version';

	const currentUrl = window.location.href;

	function escapeRegex(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	let routerCache = GM_getValue(ROUTER_CACHE_KEY, { timestamp: 0, routes: [] });

	let activeRoute = null;
	for (const route of routerCache.routes) {
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
			const cachedVersionData = GM_getValue(VERSION_CACHE_KEY, null);
			const isExpired = !cachedVersionData || (Date.now() - cachedVersionData.timestamp > ttlMs);

			const needUpdate = isDashboardHome || isExpired;
			const currentVersion = await resolveVersion(needUpdate);

			if (needUpdate) {
				await updateRouter(currentVersion);
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
		const versionUrl = `https://raw.githubusercontent.com/${src.username}/${src.repo}/${src.branch}/${CONFIG.systemRoot}/version.json?t=${Date.now()}`;

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
			console.warn("[omniNexus] Failed to resolve version from version.json, falling back to cache:", e);
			return cached ? cached.version : 'latest';
		}
	}

	function getCoreUrl(version) {
		const src = CONFIG.sources[CONFIG.provider];
		const path = `${CONFIG.systemRoot}/_core/NexusBehaviour.js`;

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
		const path = `${CONFIG.systemRoot}/${CONFIG.workspace}/${workerName}`;

		if (CONFIG.provider === 'github') {
			return `https://raw.githubusercontent.com/${src.username}/${src.repo}/${src.branch}/${path}?v=${version}`;
		}
		if (CONFIG.provider === 'file') {
			return `${src.baseUrl}/${path}`;
		}
		return `${src.baseUrl}/${path}?t=${Date.now()}`;
	}

	async function updateRouter(version) {
		try {
			let routerUrl;
			const src = CONFIG.sources[CONFIG.provider];
			const path = `${CONFIG.systemRoot}/${CONFIG.workspace}/router.json`;

			if (CONFIG.provider === 'github') {
				routerUrl = `https://raw.githubusercontent.com/${src.username}/${src.repo}/${src.branch}/${path}?v=${version}`;
			} else if (CONFIG.provider === 'file') {
				routerUrl = `${src.baseUrl}/${path}`;
			} else {
				routerUrl = `${src.baseUrl}/${path}?t=${Date.now()}`;
			}

			const res = await request({ method: 'GET', url: routerUrl });
			const newRouter = JSON.parse(res.responseText);

			GM_setValue(ROUTER_CACHE_KEY, {
				timestamp: Date.now(),
				routes: newRouter.routes || []
			});
		} catch (e) {
			console.error("[omniNexus] Failed to update router.json:", e);
		}
	}

	async function executeWorker(workerFileName, moduleId, version) {
		const coreUrl = getCoreUrl(version);
		const workerUrl = getWorkerUrl(workerFileName, version);

		const globalSettings = GM_getValue(SETTINGS_KEY, {});
		const moduleSettings = globalSettings[moduleId] || {};
		const settingsJSON = JSON.stringify(moduleSettings);

		try {
			const [coreRes, workerRes] = await Promise.all([
				request({ method: 'GET', url: coreUrl }),
				request({ method: 'GET', url: workerUrl })
			]);

			const NexusBehaviour = new Function(coreRes.responseText + '; return NexusBehaviour;')();

			const WorkerClass = new Function('NexusBehaviour', workerRes.responseText + '; return typeof ModuleClass !== "undefined" ? ModuleClass : null;')(NexusBehaviour);

			if (WorkerClass) {
				new WorkerClass({
					settingsJSON,
					role: CONFIG.role,
					GM_getValue,
					GM_setValue,
					GM_listValues,
					CONFIG
				});
			} else {
				console.error(`[omniNexus] Module "${workerFileName}" did not export ModuleClass`);
			}
		} catch (err) {
			console.error(`[omniNexus] Execution error in "${workerFileName}" (v${version}):`, err);
		}
	}
})();