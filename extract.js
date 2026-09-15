
        // ================================================================
        //  DAYJS UTC
        // ================================================================
        if (typeof dayjs !== 'undefined' && typeof dayjs_plugin_utc !== 'undefined') {
            dayjs.extend(dayjs_plugin_utc);
        } else {
            if (!dayjs.utc) dayjs.utc = function(d) { return dayjs(d); };
        }

        // ================================================================
        //  TOAST
        // ================================================================
        window.showToast = function(title, msg, isError = false) {
            const t = document.getElementById('toast');
            document.getElementById('toastTitle').textContent = title;
            document.getElementById('toastMsg').textContent = msg;
            t.style.borderColor = isError ? '#cc3355' : 'var(--accent)';
            t.classList.add('show');
            clearTimeout(t._timeout);
            t._timeout = setTimeout(() => t.classList.remove('show'), 4000);
        };

        // ================================================================
        //  WINDOW MANAGEMENT
        // ================================================================
        function openWindow(id) {
            document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
            const win = document.getElementById('win-' + id);
            if (win) win.classList.add('active');
            document.querySelectorAll('.dock .icon').forEach(b => b.classList.remove('active'));
            const btn = document.querySelector(`.dock .icon[data-app="${id}"]`);
            if (btn) btn.classList.add('active');
        }

        window.openWindow = openWindow;

        window.closeWindow = function(id) {
            const win = document.getElementById('win-' + id);
            if (win) win.classList.remove('active');
            const active = document.querySelector('.window.active');
            if (!active) {
                const term = document.getElementById('win-android');
                if (term) term.classList.add('active');
                document.querySelector('.dock .icon[data-app="android"]')?.classList.add('active');
            }
        };

        document.querySelectorAll('.dock .icon').forEach(btn => {
            btn.addEventListener('click', function() {
                const app = this.dataset.app;
                openWindow(app);
            });
        });

        // Draggable windows
        document.querySelectorAll('.window .titlebar').forEach(bar => {
            let isDragging = false,
                offsetX, offsetY, win;
            bar.addEventListener('mousedown', function(e) {
                win = this.closest('.window');
                if (!win.classList.contains('active')) return;
                isDragging = true;
                const rect = win.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                win.style.cursor = 'grabbing';
                e.preventDefault();
            });
            document.addEventListener('mousemove', function(e) {
                if (!isDragging || !win) return;
                const container = document.getElementById('windowsContainer');
                const cRect = container.getBoundingClientRect();
                let left = e.clientX - cRect.left - offsetX;
                let top = e.clientY - cRect.top - offsetY;
                left = Math.max(0, Math.min(left, cRect.width - win.offsetWidth));
                top = Math.max(0, Math.min(top, cRect.height - win.offsetHeight));
                win.style.left = left + 'px';
                win.style.top = top + 'px';
                win.style.width = win.offsetWidth + 'px';
                win.style.height = win.offsetHeight + 'px';
            });
            document.addEventListener('mouseup', function() {
                if (isDragging && win) {
                    isDragging = false;
                    win.style.cursor = '';
                }
            });
        });

        // ================================================================
        //  CLOCK
        // ================================================================
        function updateClock() {
            const now = dayjs();
            const utc = now.utc ? now.utc() : now;
            document.getElementById('clockDisplay').textContent = utc.format('HH:mm:ss');
        }
        setInterval(updateClock, 1000);
        updateClock();

        // ================================================================
        //  ANDROID IFRAME CONTROLS (Zoom & Fullscreen)
        // ================================================================
        let androidZoomLevel = 1.0;
        const ANDROID_ZOOM_STEP = 0.1;
        const ANDROID_MIN_ZOOM = 0.3;
        const ANDROID_MAX_ZOOM = 2.0;

        function getAndroidIframe() {
            return document.getElementById('androidRuntime');
        }

        function applyAndroidZoom() {
            const runtime = getAndroidIframe();
            const screen = document.getElementById('screen_container');
            if (screen) {
                screen.style.transform = `scale(${androidZoomLevel})`;
                screen.style.transformOrigin = 'top left';
            } else if (runtime) {
                runtime.style.transform = `scale(${androidZoomLevel})`;
                runtime.style.transformOrigin = 'top left';
            }
            document.getElementById('androidZoomStatus').textContent = Math.round(androidZoomLevel * 100) + '%';
        }

        window.androidZoomIn = function() {
            if (androidZoomLevel < ANDROID_MAX_ZOOM) {
                androidZoomLevel = Math.min(androidZoomLevel + ANDROID_ZOOM_STEP, ANDROID_MAX_ZOOM);
                applyAndroidZoom();
            }
        };

        window.androidZoomOut = function() {
            if (androidZoomLevel > ANDROID_MIN_ZOOM) {
                androidZoomLevel = Math.max(androidZoomLevel - ANDROID_ZOOM_STEP, ANDROID_MIN_ZOOM);
                applyAndroidZoom();
            }
        };

        window.androidZoomReset = function() {
            androidZoomLevel = 1.0;
            applyAndroidZoom();
        };

        window.toggleAndroidFullscreen = function() {
            const container = document.getElementById('win-android');
            if (!container) return;
            if (!document.fullscreenElement) {
                container.requestFullscreen?.() || container.webkitRequestFullscreen?.() || container.msRequestFullscreen?.();
            } else {
                document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.();
            }
        };

        document.addEventListener('fullscreenchange', updateFullscreenIcon);
        document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
        document.addEventListener('msfullscreenchange', updateFullscreenIcon);

        function updateFullscreenIcon() {
            const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
            const btn = document.querySelector('#win-android .titlebar .actions button:first-child i');
            if (btn) {
                btn.className = isFull ? 'fas fa-compress' : 'fas fa-expand';
            }
            const btn2 = document.querySelector('#win-android .android-controls .btn-sm:first-child i');
            if (btn2) {
                btn2.className = isFull ? 'fas fa-compress' : 'fas fa-expand';
            }
        }

        // ================================================================
        //  GAMES TAB FALLBACK
        // ================================================================
        document.addEventListener('DOMContentLoaded', function() {
            const frame = document.getElementById('pixelsFrame');
            const fallback = document.getElementById('gameFallback');

            let loaded = false;
            frame.onload = function() {
                loaded = true;
                fallback.style.display = 'none';
                console.log('Pixels iframe loaded.');
            };

            setTimeout(() => {
                if (!loaded) {
                    fallback.style.display = 'flex';
                    console.log('Showing Pixels fallback (iframe did not load).');
                }
            }, 8000);

            frame.onerror = function() {
                fallback.style.display = 'flex';
                console.log('Pixels iframe error, showing fallback.');
            };
        });

        // ================================================================
        //  WALLET CONNECT (CDN method â€“ this is the working version)
        // ================================================================
        let walletProvider = null;
        let ethersProvider = null;
        let signer = null;
        let walletAddress = null;

        const PROJECT_ID = 'f5520f7f-646c-466f-936e-1cf40caa6345';
        const CHAIN_ID = 1;

        const connectBtn = document.getElementById('connectWalletBtn');
        const disconnectBtn = document.getElementById('disconnectWalletBtn');
        const walletStatus = document.getElementById('walletStatus');

        async function connectWallet() {
            try {
                showToast('Connecting', 'Initializing WalletConnect...');

                if (typeof window.ethereumProvider === 'undefined') {
                    showToast('Error', 'WalletConnect library not loaded. Check your network.', true);
                    return;
                }

                // Initialize the provider
                walletProvider = await window.ethereumProvider.init({
                    projectId: PROJECT_ID,
                    chains: [CHAIN_ID],
                    showQrModal: true,
                    qrModalOptions: {
                        themeMode: 'dark',
                        themeVariables: {
                            '--wcm-accent-color': '#33ccff',
                            '--wcm-background-color': '#0a0e1a',
                        }
                    }
                });

                // Connect (this shows the QR modal)
                await walletProvider.connect();

                // Wrap with ethers
                ethersProvider = new ethers.providers.Web3Provider(walletProvider);
                signer = ethersProvider.getSigner();
                walletAddress = await signer.getAddress();

                // Update UI
                walletStatus.textContent = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'inline-block';

                showToast('Connected', 'Wallet connected: ' + walletAddress.slice(0, 10) + '...');

                // Check PRST balance
                try {
                    const prstContract = new ethers.Contract(
                        '0xb2a8E38177c1a023db108e28384aa6055A1c7Ba3', [
                            'function balanceOf(address) view returns (uint256)'
                        ], ethersProvider
                    );
                    const bal = await prstContract.balanceOf(walletAddress);
                    const formatted = ethers.utils.formatEther(bal);
                    showToast('PRST Balance', formatted + ' PRST');
                } catch (e) { /* ignore */ }

                // Listen for disconnection events
                walletProvider.on('disconnect', () => {
                    disconnectWallet();
                });

                console.log('âœ… Wallet connected:', walletAddress);

            } catch (error) {
                console.error('Wallet connection error:', error);
                if (error.code === 4001) {
                    showToast('Rejected', 'You rejected the connection request.', true);
                } else {
                    showToast('Error', error.message || 'Failed to connect wallet.', true);
                }
                walletProvider = null;
                ethersProvider = null;
                signer = null;
                walletAddress = null;
            }
        }

        async function disconnectWallet() {
            try {
                if (walletProvider) {
                    await walletProvider.disconnect();
                }
            } catch (e) {
                console.warn('Disconnect error:', e);
            } finally {
                walletProvider = null;
                ethersProvider = null;
                signer = null;
                walletAddress = null;
                walletStatus.textContent = 'Not Connected';
                connectBtn.style.display = 'inline-block';
                disconnectBtn.style.display = 'none';
                showToast('Disconnected', 'Wallet disconnected.');
                console.log('ðŸ”Œ Wallet disconnected');
            }
        }

        // Wire up buttons
        connectBtn.addEventListener('click', connectWallet);
        disconnectBtn.addEventListener('click', disconnectWallet);

        // Check if library loaded
        if (typeof window.ethereumProvider === 'undefined') {
            showToast('Warning', 'WalletConnect library not loaded. Please refresh.', true);
            connectBtn.disabled = true;
        }

        // ================================================================
        //  BLUEHOUND AI (OpenRouter free tier + fallback)
        // ================================================================
        const OPENROUTER_KEY = ''; // Never embed API keys in a browser-delivered application.

        async function sendChat() {
            const input = document.getElementById('chatInput');
            const msg = input.value.trim();
            if (!msg) return;
            const box = document.getElementById('chatBox');
            box.innerHTML += `<div class="msg user">ðŸ§‘ ${msg}</div>`;
            input.value = '';
            box.scrollTop = box.scrollHeight;

            try {
                let reply;
                if (window.PrecogAI) {
                    try {
                        reply = await window.PrecogAI.chat(msg);
                    } catch (_) {}
                }
                if (!reply && OPENROUTER_KEY) {
                    const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                        model: 'mistralai/mistral-7b-instruct:free',
                        messages: [
                            { role: 'system',
                                content: 'You are BlueHound, a cybersecurity AI assistant inspired by the BlueHound blue-team tool (attack-path mapping, crown-jewel focus, edge filtering). Be concise, helpful, and security-focused.' },
                            { role: 'user', content: msg }
                        ]
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + OPENROUTER_KEY
                        }
                    });
                    reply = resp.data.choices[0].message.content;
                }
                if (!reply) throw new Error('No AI backend available');
                box.innerHTML += `<div class="msg bot">ðŸ• BlueHound: ${reply}</div>`;
            } catch (e) {
                const fallbacks = [
                    "That's a great security question. Let me think...",
                    "I recommend checking your firewall rules and updating all credentials.",
                    "Have you looked at the latest CVE database for that vulnerability?",
                    "Always enable 2FA on all critical accounts. It's your first line of defense.",
                    "Let's analyze that threat together. I'll help you secure your network."
                ];
                const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
                box.innerHTML += `<div class="msg bot">ðŸ• BlueHound: ${reply}</div>`;
            }
            box.scrollTop = box.scrollHeight;
        }
        window.sendChat = sendChat;
        document.getElementById('chatInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') sendChat();
        });

        // ================================================================
        //  TOOLS (Real APIs)
        // ================================================================

        async function lookupIP(ip) {
            try {
                const resp = await axios.get('https://ip-api.com/json/' + ip, { params: { fields: 'status,country,regionName,city,isp,org,as,query,timezone' } });
                return resp.data;
            } catch (e) { return null; }
        }

        async function checkAbuseIPDB(ip) {
            try {
                const resp = await axios.get('https://api.abuseipdb.com/api/v2/check', {
                    params: { ipAddress: ip, maxAgeInDays: 90 },
                    headers: { 'Key': 'YOUR_DEMO_KEY_HERE', 'Accept': 'application/json' }
                });
                return resp.data;
            } catch (e) { return null; }
        }

        async function checkHIBP(email) {
            try {
                const resp = await axios.get('https://haveibeenpwned.com/api/v3/breachedaccount/' + encodeURIComponent(email),
                { headers: { 'hibp-api-key': '' } });
                return resp.data;
            } catch (e) {
                if (e.response && e.response.status === 404) return [];
                return null;
            }
        }

        window.scanIP = async function() {
            const ip = document.getElementById('scanInput').value.trim();
            const res = document.getElementById('scanResult');
            if (!ip) { res.innerHTML = 'Enter an IP.'; return; }
            res.innerHTML = 'â³ Scanning...';
            try {
                const abuse = await checkAbuseIPDB(ip);
                const geo = await lookupIP(ip);
                let html = '';
                if (geo && geo.status === 'success') {
                    html += `<strong>${ip}</strong> Â· ${geo.city}, ${geo.country}<br>`;
                    html += `<span class="label">ðŸ¢ ${geo.isp}</span><br>`;
                }
                if (abuse && abuse.data) {
                    const score = abuse.data.abuseConfidenceScore || 0;
                    const color = score > 50 ? '#ff4466' : score > 20 ? '#ff8833' : '#33ff99';
                    html += `<span style="color:${color};">âš ï¸ Abuse Score: ${score}%</span>`;
                    if (abuse.data.totalReports) html += ` (${abuse.data.totalReports} reports)`;
                } else {
                    html += `<span class="label">ðŸ”’ No abuse reports</span>`;
                }
                res.innerHTML = html;
            } catch (e) {
                res.innerHTML = 'âŒ Error: ' + e.message;
            }
        };

        document.getElementById('ipInput').addEventListener('keydown', async function(e) {
            if (e.key !== 'Enter') return;
            const ip = this.value.trim();
            const res = document.getElementById('lookupResult');
            if (!ip) { res.innerHTML = 'Enter IP.'; return; }
            res.innerHTML = 'â³ Looking up...';
            try {
                const geo = await lookupIP(ip);
                if (geo && geo.status === 'success') {
                    let html = `<strong>${geo.query}</strong><br>`;
                    html += `<span class="label">ðŸ“ ${geo.city}, ${geo.regionName}, ${geo.country}</span><br>`;
                    html += `<span class="label">ðŸ¢ ${geo.isp}</span><br>`;
                    res.innerHTML = html;
                } else {
                    res.innerHTML = 'âŒ IP not found.';
                }
            } catch (e) {
                res.innerHTML = 'âš ï¸ Error: ' + e.message;
            }
        });

        window.lookupCVE = async function() {
            const cve = document.getElementById('cveInput').value.trim();
            const res = document.getElementById('cveResult');
            if (!cve || !cve.toUpperCase().startsWith('CVE-')) {
                res.innerHTML = 'Enter a valid CVE (e.g. CVE-2025-1234)';
                return;
            }
            res.innerHTML = 'â³ Looking up...';
            try {
                const resp = await axios.get('https://services.nvd.nist.gov/rest/json/cves/2.0', { params: { cveId: cve
                            .toUpperCase() } });
                const vuln = resp.data.vulnerabilities?.[0];
                if (!vuln) { res.innerHTML = 'âŒ CVE not found.'; return; }
                const data = vuln.cve;
                const score = data.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || 'N/A';
                const severity = data.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || 'N/A';
                const desc = data.descriptions?.[0]?.value || 'No description.';
                let html = `<strong>${data.id}</strong> Â· CVSS: ${score} (${severity})<br>`;
                html += `<span class="label">${desc.substring(0, 120)}...</span>`;
                res.innerHTML = html;
            } catch (e) {
                res.innerHTML = 'âš ï¸ Error: ' + e.message;
            }
        };

        window.checkBreach = async function() {
            const email = document.getElementById('breachInput').value.trim();
            const res = document.getElementById('breachResult');
            if (!email || !email.includes('@')) {
                res.innerHTML = 'Enter a valid email.';
                return;
            }
            res.innerHTML = 'â³ Checking...';
            try {
                const data = await checkHIBP(email);
                if (data && data.length > 0) {
                    const breaches = data.map(b => b.Name).join(', ');
                    res.innerHTML = `âš ï¸ Found in ${data.length} breaches: ${breaches}`;
                } else if (data === null) {
                    res.innerHTML = 'âš ï¸ API rate limit. Try again.';
                } else {
                    res.innerHTML = 'âœ… No breaches found.';
                }
            } catch (e) {
                res.innerHTML = 'âš ï¸ Error: ' + e.message;
            }
        };


        // ================================================================
        //  PRECOG SECURITY v3 â€” LOCAL-FIRST PERSISTENCE
        // ================================================================
        const PRECOG_DB = 'precog-security-v3';
        const PRECOG_STORE = 'state';
        const PRECOG_KEY = 'workspace';

        const PrecogPersistence = (() => {
            let dbPromise;

            function openDB() {
                if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
                if (dbPromise) return dbPromise;
                dbPromise = new Promise((resolve, reject) => {
                    const req = indexedDB.open(PRECOG_DB, 1);
                    req.onupgradeneeded = () => {
                        const db = req.result;
                        if (!db.objectStoreNames.contains(PRECOG_STORE)) {
                            db.createObjectStore(PRECOG_STORE);
                        }
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
                return dbPromise;
            }

            async function getState() {
                try {
                    const db = await openDB();
                    return await new Promise((resolve, reject) => {
                        const tx = db.transaction(PRECOG_STORE, 'readonly');
                        const req = tx.objectStore(PRECOG_STORE).get(PRECOG_KEY);
                        req.onsuccess = () => resolve(req.result || {});
                        req.onerror = () => reject(req.error);
                    });
                } catch (_) {
                    try { return JSON.parse(localStorage.getItem('precog-state') || '{}'); }
                    catch (_) { return {}; }
                }
            }

            async function putEmulatorState(state) {
                const db = await openDB();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(PRECOG_STORE, 'readwrite');
                    tx.objectStore(PRECOG_STORE).put(state, 'emulator-state');
                    tx.oncomplete = resolve;
                    tx.onerror = () => reject(tx.error);
                });
            }
            async function getEmulatorState() {
                const db = await openDB();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(PRECOG_STORE, 'readonly');
                    const req = tx.objectStore(PRECOG_STORE).get('emulator-state');
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => reject(req.error);
                });
            }
            async function clearEmulatorState() {
                const db = await openDB();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(PRECOG_STORE, 'readwrite');
                    tx.objectStore(PRECOG_STORE).delete('emulator-state');
                    tx.oncomplete = resolve;
                    tx.onerror = () => reject(tx.error);
                });
            }

            async function putState(state) {
                const clean = JSON.parse(JSON.stringify(state));
                try {
                    const db = await openDB();
                    await new Promise((resolve, reject) => {
                        const tx = db.transaction(PRECOG_STORE, 'readwrite');
                        tx.objectStore(PRECOG_STORE).put(clean, PRECOG_KEY);
                        tx.oncomplete = resolve;
                        tx.onerror = () => reject(tx.error);
                    });
                } catch (_) {
                    localStorage.setItem('precog-state', JSON.stringify(clean));
                }
                return clean;
            }

            function uiState() {
                const windows = {};
                document.querySelectorAll('.window').forEach(w => {
                    windows[w.id] = {
                        active: w.classList.contains('active'),
                        left: w.style.left,
                        top: w.style.top,
                        width: w.style.width,
                        height: w.style.height
                    };
                });
                return {
                    version: 3,
                    savedAt: new Date().toISOString(),
                    windows,
                    activeApp: document.querySelector('.dock .icon.active')?.dataset.app || 'android',
                    androidZoomLevel,
                    chat: document.getElementById('chatBox')?.innerHTML || '',
                    inputs: [...document.querySelectorAll('input[id]')].reduce((a, el) => {
                        a[el.id] = el.value; return a;
                    }, {}),
                    wallet: {
                        address: walletAddress || null,
                        chainId: CHAIN_ID
                    },
                    settings: {
                        theme: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
                    }
                };
            }

            async function save() {
                const state = uiState();
                await putState(state);
                const badge = document.getElementById('emulatorStateBadge');
                if (badge) badge.textContent = 'LOCAL STATE SAVED Â· ' + new Date().toLocaleTimeString();
                return state;
            }

            async function restore() {
                const state = await getState();
                if (!state || !state.version) {
                    window.showToast('Persistence', 'No saved Precog workspace found.');
                    return false;
                }

                if (state.windows) {
                    Object.entries(state.windows).forEach(([id, s]) => {
                        const w = document.getElementById(id);
                        if (!w) return;
                        if (s.left) w.style.left = s.left;
                        if (s.top) w.style.top = s.top;
                        if (s.width) w.style.width = s.width;
                        if (s.height) w.style.height = s.height;
                        w.classList.toggle('active', !!s.active);
                    });
                }

                if (typeof state.androidZoomLevel === 'number') {
                    androidZoomLevel = state.androidZoomLevel;
                    applyAndroidZoom();
                }

                if (state.chat && document.getElementById('chatBox')) {
                    document.getElementById('chatBox').innerHTML = state.chat;
                }

                Object.entries(state.inputs || {}).forEach(([id, value]) => {
                    const el = document.getElementById(id);
                    if (el) el.value = value;
                });

                const app = state.activeApp || 'android';
                document.querySelectorAll('.dock .icon').forEach(b => b.classList.remove('active'));
                document.querySelector(`.dock .icon[data-app="${app}"]`)?.classList.add('active');

                document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
                document.getElementById('win-' + app)?.classList.add('active');

                const badge = document.getElementById('emulatorStateBadge');
                if (badge) badge.textContent = 'LOCAL STATE RESTORED Â· ' + new Date().toLocaleTimeString();
                window.showToast('Restored', 'Precog workspace restored from local storage.');
                return true;
            }

            async function snapshot() {
                await save();
                window.showToast('Saved', 'Precog workspace snapshot saved locally.');
            }

            async function exportBackup() {
                const state = await save();
                const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'precog-security-backup.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }

            async function importBackup(file) {
                const text = await file.text();
                const state = JSON.parse(text);
                if (!state || state.version !== 3) throw new Error('Unsupported Precog backup');
                await putState(state);
                await restore();
            }

            let timer;
            function schedule() {
                clearTimeout(timer);
                timer = setTimeout(save, 350);
            }

            return {save, restore, snapshot, exportBackup, importBackup, schedule, putEmulatorState, getEmulatorState, clearEmulatorState};
        })();

        // Save UI changes automatically.
        document.addEventListener('click', () => PrecogPersistence.schedule());
        window.addEventListener('beforeunload', () => {
            // Best-effort synchronous fallback for the last UI snapshot.
            try { localStorage.setItem('precog-state-last', JSON.stringify({
                version: 3, savedAt: new Date().toISOString(),
                activeApp: document.querySelector('.dock .icon.active')?.dataset.app || 'android',
                androidZoomLevel
            })); } catch (_) {}
        });

        // ================================================================
        //  EIP-1193 WALLET BRIDGE
        // ================================================================
        async function connectInjectedWallet() {
            if (!window.ethereum) return false;
            try {
                const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
                if (!accounts?.length) return false;

                walletAddress = accounts[0];
                ethersProvider = new ethers.providers.Web3Provider(window.ethereum, 'any');
                signer = ethersProvider.getSigner();

                const network = await ethersProvider.getNetwork();
                walletStatus.textContent = walletAddress.slice(0,6) + '...' + walletAddress.slice(-4);
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'inline-block';

                await PrecogPersistence.save();
                showToast('Connected', 'Injected wallet: ' + walletAddress.slice(0,10) + '...');
                console.log('Precog EIP-1193 wallet:', walletAddress, network.chainId);
                return true;
            } catch (e) {
                console.error(e);
                showToast('Wallet Error', e.message || 'Wallet connection failed.', true);
                return false;
            }
        }

        if (window.ethereum) {
            window.ethereum.on?.('accountsChanged', async accounts => {
                if (!accounts?.length) {
                    await disconnectWallet();
                } else {
                    walletAddress = accounts[0];
                    walletStatus.textContent = walletAddress.slice(0,6) + '...' + walletAddress.slice(-4);
                    await PrecogPersistence.save();
                }
            });
            window.ethereum.on?.('chainChanged', async () => {
                await PrecogPersistence.save();
                showToast('Network Changed', 'Wallet network changed.');
            });
        }

        // Prefer an injected wallet for single-file/browser-native operation;
        // fall back to the existing WalletConnect implementation.
        const originalConnectWallet = connectWallet;
        connectWallet = async function() {
            if (await connectInjectedWallet()) return;
            return originalConnectWallet();
        };

        // ================================================================
        //  V86 ANDROID RUNTIME â€” LOCAL DISK + INDEXEDDB STATE
        // ================================================================
        const PrecogEmulator = (() => {
            const A = './assets/';
            let emulator = null;
            let booted = false;
            let autosaveTimer = null;

            function status(text, ok=false) {
                const el = document.getElementById('emulatorStateBadge');
                if (el) {
                    el.textContent = text;
                    el.style.color = ok ? '#33ff99' : '#ffcc66';
                }
            }

            function loadScript(src) {
                return new Promise((resolve, reject) => {
                    const existing = document.querySelector(`script[data-v86="${src}"]`);
                    if (existing) return existing.dataset.loaded === '1' ? resolve() : existing.addEventListener('load', resolve, {once:true});
                    const script = document.createElement('script');
                    script.src = src;
                    script.dataset.v86 = src;
                    script.onload = () => { script.dataset.loaded='1'; resolve(); };
                    script.onerror = () => reject(new Error('Unable to load v86 runtime: ' + src));
                    document.head.appendChild(script);
                });
            }

            async function loadState() {
                try {
                    const state = await PrecogPersistence.getEmulatorState?.();
                    return state || null;
                } catch (e) { console.warn('No emulator state:', e); return null; }
            }

            function start() {
                return loadScript(A + 'libv86.js').then(async () => {
                    if (!window.V86Starter && !window.V86) throw new Error('v86 library loaded but V86 API was not found');
                    const Runtime = window.V86Starter || window.V86;
                    const screen = document.getElementById('androidRuntime');
                    screen.innerHTML = `<div id="screen_container" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000"><div style="white-space:pre;font:14px monospace;line-height:14px;color:#8fb8d8"></div><canvas style="display:none"></canvas></div>`;
                    status('STARTING ANDROIDâ€¦');
                    emulator = new Runtime({
                        wasm_path: A + 'v86.wasm',
                        memory_size: 128 * 1024 * 1024,
                        vga_memory_size: 8 * 1024 * 1024,
                        screen_container: document.getElementById('screen_container'),
                        bios: { url: A + 'seabios.bin' },
                        vga_bios: { url: A + 'vgabios.bin' },
                        hda: { url: A + 'android-x86-4.4-r2.img', async: true },
                        autostart: true,
                        disable_mouse: false,
                        disable_keyboard: false,
                    });
                    booted = true;
                    status('ANDROID RUNTIME ACTIVE', true);
                    applyAndroidZoom();
                    const saved = await loadState();
                    if (saved) {
                        status('RESTORING ANDROID STATEâ€¦');
                        await new Promise((resolve, reject) => emulator.restore_state(saved, err => err ? reject(err) : resolve()));
                        status('ANDROID STATE RESTORED', true);
                    }
                    clearInterval(autosaveTimer);
                    autosaveTimer = setInterval(() => save(), 60000);
                    return emulator;
                }).catch(err => {
                    console.error(err);
                    status('RUNTIME ASSETS NOT FOUND');
                    const badge = document.getElementById('emulatorStateBadge');
                    if (badge) badge.title = 'Place libv86.js, v86.wasm, seabios.bin, vgabios.bin and android-x86-4.4-r2.img in ./assets/';
                });
            }

            async function save() {
                if (!emulator || !booted || !emulator.save_state) return false;
                status('SAVING ANDROID STATEâ€¦');
                return new Promise(resolve => {
                    emulator.save_state(async (error, state) => {
                        if (error) { console.error(error); status('SAVE FAILED'); return resolve(false); }
                        try {
                            await PrecogPersistence.putEmulatorState?.(state);
                            status('ANDROID STATE SAVED Â· ' + new Date().toLocaleTimeString(), true);
                            resolve(true);
                        } catch (e) { console.error(e); status('SAVE FAILED'); resolve(false); }
                    });
                });
            }

            async function restore() {
                if (!emulator) return start();
                const state = await loadState();
                if (!state) return window.showToast('Emulator', 'No Android snapshot exists yet.');
                emulator.stop();
                await new Promise((resolve, reject) => emulator.restore_state(state, err => err ? reject(err) : resolve()));
                emulator.run();
                status('ANDROID STATE RESTORED', true);
            }

            async function reset() {
                if (emulator) { try { emulator.stop(); } catch(_){} emulator = null; }
                await PrecogPersistence.clearEmulatorState?.();
                location.reload();
            }

            window.addEventListener('pagehide', () => { try { save(); } catch(_){} });
            return {start, save, restore, reset};
        })();

        // ================================================================
        //  ATTACK PATH â€” BlueHound-inspired threat mapping
        //  Combines host reputation/exposure (ip-api) + crown-jewel focus
        //  to reveal the paths an attacker would take (edge-filter, C2, pivot).
        // ================================================================
        function isPrivateIP(ip) {
            const p = ip.split('.').map(Number);
            if (p.length !== 4 || p.some(isNaN)) return false;
            return (p[0] === 10) ||
                (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
                (p[0] === 192 && p[1] === 168) ||
                (p[0] === 127) || (p[0] === 0) || (p[0] === 169 && p[1] === 254);
        }

        function exposureScore(geo) {
            // BlueHound-style risk proxy: internet-facing + commercial hosting = more exposed.
            if (!geo || geo.status !== 'success') return { score: 20, label: 'unknown', color: '#88bbdd' };
            if (isPrivateIP(geo.query)) return { score: 10, label: 'internal', color: '#33ff99' };
            const hosting = /(amazon|aws|microsoft|azure|google|gcp|digitalocean|ovh|linode|hetzner|cloudflare|alphabet)/i.test(geo.isp || '');
            const score = hosting ? 95 : 60;
            return { score, label: hosting ? 'cloud / hosting' : (geo.isp || 'residential'), color: hosting ? '#ff4466' : '#ff8833' };
        }

        window.mapAttackPath = async function() {
            const start = document.getElementById('pathStartInput').value.trim();
            const jewels = document.getElementById('pathJewelsInput').value.split(',').map(s => s.trim()).filter(Boolean);
            const res = document.getElementById('pathMapResult');
            if (!start || jewels.length === 0) {
                res.innerHTML = '<span class="label">âš ï¸ Provide a start host AND at least one crown jewel.</span>';
                return;
            }
            res.innerHTML = '<span class="label">â³ Mapping attack pathsâ€¦</span>';
            try {
                const startGeo = await lookupIP(start);
                const rows = [];
                for (const jewel of jewels) {
                    const g = await lookupIP(jewel);
                    const s = exposureScore(g);
                    rows.push({ jewel, geo: g && g.status === 'success' ? `${g.city || '?'}, ${g.country || '?'}` : 'unresolved', score: s.score, label: s.label, color: s.color });
                }
                let html = '<div style="font-size:0.6rem;margin-bottom:0.3rem;"><strong>Entry point:</strong> ' +
                    (startGeo && startGeo.status === 'success' ? `${start} Â· ${startGeo.isp || ''}` : start) +
                    ' <em>(assumed compromised / external)</em></div>';
                rows.forEach(r => {
                    const risk = r.score >= 85 ? 'HIGH' : r.score >= 50 ? 'MED' : 'LOW';
                    html += `<div style="display:flex;align-items:center;gap:0.4rem;padding:0.25rem 0;border-top:1px solid var(--border);">
                        <i class="fas fa-chevron-right" style="color:var(--accent);"></i>
                        <span style="min-width:70px;font-family:monospace;">${r.jewel}</span>
                        <span class="label">${r.geo}</span>
                        <span style="margin-left:auto;font-weight:600;color:${r.color};">${r.label} Â· ${risk} (${r.score})</span>
                    </div>`;
                });
                const avg = Math.round(rows.reduce((a, b) => a + b.score, 0) / rows.length);
                html += `<div style="margin-top:0.4rem;font-size:0.6rem;color:var(--accent);">
                    <i class="fas fa-crown"></i> Crown-jewel exposure: ${avg}/100 â€” prioritize hardening the <strong>${avg >= 85 ? 'internet-facing' : 'highest-scored'}</strong> hosts first, BlueHound-style.</div>`;
                res.innerHTML = html;
            } catch (e) {
                res.innerHTML = 'âŒ Error: ' + e.message;
            }
        };

        // ================================================================
        //  LOCAL AI CONFIG â€” NO SECRET KEYS
        // ================================================================
        window.PrecogAI = {
            endpoint: localStorage.getItem('precog-ai-endpoint') || 'http://localhost:11434',
            model: localStorage.getItem('precog-ai-model') || 'qwen2.5-coder:7b',
            async chat(message) {
                const r = await fetch(this.endpoint.replace(/\/$/, '') + '/api/chat', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        model:this.model,
                        messages:[
                            {role:'system',content:'You are BlueHound, a defensive cybersecurity assistant inspired by the BlueHound blue-team tool (attack-path mapping, crown-jewel focus, edge filtering). Be concise and safety-focused.'},
                            {role:'user',content:message}
                        ],
                        stream:false
                    })
                });
                if (!r.ok) throw new Error('Local AI HTTP ' + r.status);
                const data = await r.json();
                return data.message?.content || '';
            }
        };

        // Persist after typing into important fields.
        document.addEventListener('input', () => PrecogPersistence.schedule());

        // ================================================================
        //  INIT
        // ================================================================
        document.addEventListener('DOMContentLoaded', function() {
            openWindow('android');
            PrecogEmulator.start();
            PrecogPersistence.restore().catch(e => console.warn('Restore failed:', e));
            if (window.ethereum) {
                connectBtn.disabled = false;
                connectBtn.title = 'Connect browser wallet';
            }
            showToast('Precog Security', 'BlueHound OS ready. Local persistence enabled.');
            console.log('ðŸ›¡ï¸ Precog Security v3 â€“ Local v86 Android runtime + IndexedDB persistence.');
        });
    