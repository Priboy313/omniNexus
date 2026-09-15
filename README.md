# ⚡ omniNexus

An offline-first, modular productivity suite and userscript framework designed for restricted, air-gapped, or corporate environments.

Replaces a dummy URL on an accessible domain (e.g., `google.com/omninexus`) with a private, zero-latency desktop-grade workspace that dynamically mounts self-contained client-side web tools.

* 🚀 **Zero Dependencies** — Runs directly inside the browser using Tampermonkey as a secure sandbox and storage runtime.
* 🧩 **Pluggable Architecture** — Decoupled module lifecycle powered by the `NexusBehaviour` base engine (`Awake`, `Start`, DOM observers, and namespaced storage).
* 🔄 **Dynamic Routing** — Switch, mount, and manage workspace tools on the fly via relative route manifests.
* 📦 **Air-Gap Data Sync** — Export and restore complete workspace states via plain-text JSON payloads
* 🌐 **Multi-Provider Pipeline** — Seamlessly resolves assets from GitHub, local HTTP servers, direct local filesystem paths (`file:///`), or custom self-hosted endpoints.

---

## 🛠️ Prerequisites

omniNexus relies on **Tampermonkey** as its client-side execution sandbox and storage engine.

* Install **Tampermonkey** for [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) / [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) / [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/).

---

## 🚀 Installation

### Option 1: Online Mode (Recommended if GitHub is accessible)

Modules are automatically fetched and version-controlled via GitHub Raw without requiring API keys, personal access tokens, or rate limits.

1. Ensure Tampermonkey is installed and active in your browser.
2. Click the badge below to trigger the 1-click Tampermonkey installation dialog:

[![Install in Tampermonkey](https://img.shields.io/badge/Tampermonkey-Install%20Script-007acc?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/Priboy313/omniNexus/main/Extension/omniNexus.user.js)

3. Click **Install**.
4. Navigate to:
   ```text
   https://www.google.com/omninexus
   ```

---

### Option 2: Offline / Air-Gapped Mode (Strict Corporate Environment)

For restricted machines where GitHub and external CDNs are blocked. Runs entirely from your local drive without launching background servers or installing Node.js/Python.

#### Step 1: Enable Local File Access in Browser
Chromium-based browsers (Chrome, Edge, Brave) block extensions from accessing local disk files by default. You **must** enable this once:
1. Open your browser extension manager:
   * Chrome: `chrome://extensions`
   * Edge: `edge://extensions`
2. Find **Tampermonkey** and click **Details** (*Сведения*).
3. Scroll down and turn ON: **"Allow access to file URLs"** (*Разрешить открывать файлы по ссылкам*).

#### Step 2: Extract Artifacts
1. Download the latest `omniNexus-Extension-*.zip` from the [Releases](https://github.com/Priboy313/omniNexus/releases) page.
2. Extract the archive into a permanent folder on your machine, for example:
   ```text
   C:/omniNexus
   ```
   *(Ensure the `Extension/` folder and `omniNexus.user.js` are inside).*

#### Step 3: Install Connector in Tampermonkey
1. Open the Tampermonkey Dashboard in your browser.
2. Click the **`+`** tab (*Add a new script*).
3. Open `omniNexus.user.js` from your extracted folder in any text editor, copy its content, and paste it into the editor.
4. In the `CONFIG` block at the top, configure:
   ```javascript
   provider: "file",
   sources: {
       file: {
           // Use forward slashes and 3 leading slashes:
           baseUrl: "file:///C:/omniNexus"
       }
   }
   ```
5. Press `Ctrl + S` to save the script in Tampermonkey.

#### Step 4: Launch
Navigate to:
```text
https://www.google.com/omninexus
```
Tampermonkey will intercept the navigation, load all core scripts and modules directly from your hard drive, and deploy the workspace.

---

## 🔨 Maintained by 
- Priboy313