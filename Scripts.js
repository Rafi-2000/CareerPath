        // 🔥 Firebase Config
        const firebaseConfig = {
            apiKey: "AIzaSyDJzBe85RSD5ZHBc5UhjBf0Cl6aUeDVmoQ",
            authDomain: "careerpath-6c04a.firebaseapp.com",
            projectId: "careerpath-6c04a",
        };
        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        const auth = firebase.auth();

        // ☁️ Cloudinary & Supabase config
        const CLOUDINARY_CLOUD_NAME = 'dt0u0isrm';
        const CLOUDINARY_UPLOAD_PRESET = 'CareerPath_Uploads';
        const SUPABASE_URL = 'https://nbnrsqwtzxqildbaxuxn.supabase.co';
        const SUPABASE_ANON_KEY =
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ibnJzcXd0enhxaWxkYmF4dXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODk2MDksImV4cCI6MjA5MzY2NTYwOX0.3Dp94d-Aot2viZUAjYxalTtMNH5s9o7ZACW_jPyzQoE';
        const SUPABASE_BUCKET = 'careerpath-files';

        async function uploadToCloudinary(file) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            fd.append('folder', 'careerpath');
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: fd
            });
            if (!res.ok) throw new Error('Cloudinary upload failed');
            const data = await res.json();
            return data.secure_url;
        }

        async function uploadToSupabase(file, uid) {
            const ext = file.name.split('.').pop();
            const path = `${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': file.type || 'application/octet-stream',
                    'x-upsert': 'true'
                },
                body: file
            });
            if (!res.ok) throw new Error('Supabase upload failed');
            return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
        }

        // ===== Current user =====
        let currentUser = null;

        function userAppsRef() {
            return db.collection('users').doc(currentUser.uid).collection('applications');
        }

        // ===== AUTH FUNCTIONS =====
        function switchAuthTab(tab) {
            document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
            document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
            document.getElementById('tab-login').classList.toggle('active', tab === 'login');
            document.getElementById('tab-register').classList.toggle('active', tab === 'register');
            document.getElementById('auth-error').textContent = '';
        }

        function setAuthError(msg) { document.getElementById('auth-error').textContent = msg; }

        async function loginWithEmail() {
            const email = document.getElementById('login-email').value.trim();
            const pass = document.getElementById('login-password').value;
            if (!email || !pass) return setAuthError('Please fill in all fields.');
            try { await auth.signInWithEmailAndPassword(email, pass); } catch (e) { setAuthError(e.message.replace(
                    'Firebase: ', '')); }
        }

        async function registerWithEmail() {
            const email = document.getElementById('reg-email').value.trim();
            const pass = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;
            if (!email || !pass) return setAuthError('Please fill in all fields.');
            if (pass !== confirm) return setAuthError('Passwords do not match.');
            if (pass.length < 6) return setAuthError('Password must be at least 6 characters.');
            try { isNewRegistration = true;
                await auth.createUserWithEmailAndPassword(email, pass); } catch (e) { isNewRegistration = false;
                setAuthError(e.message.replace('Firebase: ', '')); }
        }

        async function loginWithGoogle() {
            const provider = new firebase.auth.GoogleAuthProvider();
            try { await auth.signInWithPopup(provider); } catch (e) { setAuthError(e.message.replace('Firebase: ', '')); }
        }

        function signOut() { if (confirm('Sign out of CareerPath?')) auth.signOut(); }

        // ===== AUTH STATE LISTENER =====
        let isNewRegistration = false;
        document.body.insertAdjacentHTML('afterbegin', `
            <div id="app-loading" style="position:fixed;inset:0;z-index:99999;background:#eef2ff;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
                <div style="width:44px;height:44px;border:4px solid #c7d2fe;border-top-color:#6366f1;border-radius:50%;animation:spin 0.7s linear infinite;"></div>
                <span style="font-size:14px;font-weight:600;color:#6366f1;">Loading CareerPath…</span>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `);

        auth.onAuthStateChanged(async user => {
            const loader = document.getElementById('app-loading');
            if (loader) loader.remove();
            if (user) {
                currentUser = user;
                document.getElementById('auth-overlay').classList.add('hidden');
                if (user.photoURL) document.getElementById('user-avatar').src = user.photoURL;
                clearProfileSection();
                applications = [];
                activeCurrentPage = 1;
                archiveCurrentPage = 1;
                renderCurrentTab();
                await loadUserProfile();
                loadApplicationsFromFirebase();
                if (isNewRegistration) { isNewRegistration = false;
                    setTimeout(() => openProfileModal(true), 400); }
            } else {
                currentUser = null;
                applications = [];
                activeCurrentPage = 1;
                archiveCurrentPage = 1;
                clearProfileSection();
                document.getElementById('auth-overlay').classList.remove('hidden');
                renderCurrentTab();
            }
        });

        // --- Application State ---
        let applications = JSON.parse(localStorage.getItem('applications')) || [
            { id: '1', company: 'Google', role: 'Frontend Engineer', status: 'applied', dateApplied: '', lastDate: new Date(
                    Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], location: 'Remote',
                salary: '$150k - $180k', sector: 'non-govt', jobType: 'Full-time', cvName: 'Resume.pdf', cvUrl: null,
                circularName: 'JD.pdf', circularUrl: null, url: 'https://careers.google.com' },
            { id: '2', company: 'OpenAI', role: 'AI Researcher', status: 'wishlist', dateApplied: '', lastDate: new Date(
                    Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], location: 'San Francisco',
                salary: '$250k+', sector: 'non-govt', jobType: 'Full-time', cvName: '', cvUrl: null, circularName: '',
                circularUrl: null, url: '' }
        ];
        let viewMode = 'grid';
        let currentFiles = { cv: null, circular: null };

        // ===== PAGINATION STATE =====
        const ITEMS_PER_PAGE = 12;
        let activeCurrentPage = 1;
        let archiveCurrentPage = 1;

        function getCurrentPage() {
            return currentTab === 'active' ? activeCurrentPage : archiveCurrentPage;
        }

        function setCurrentPage(page) {
            if (currentTab === 'active') activeCurrentPage = page;
            else archiveCurrentPage = page;
        }

        function resetCurrentPage() {
            if (currentTab === 'active') activeCurrentPage = 1;
            else archiveCurrentPage = 1;
        }

        function resetPageAndRender() {
            resetCurrentPage();
            renderCurrentTab();
        }

        function goToPage(pageNum) {
            setCurrentPage(pageNum);
            renderCurrentTab();
            const slider = document.getElementById('tab-slider');
            if (slider) {
                const rect = slider.getBoundingClientRect();
                if (rect.top < 0 || rect.top > window.innerHeight) {
                    slider.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }

        function renderPaginationHTML(totalItems, currentPageNum) {
            const maxPage = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
            if (totalItems <= ITEMS_PER_PAGE) return '';

            const startItem = (currentPageNum - 1) * ITEMS_PER_PAGE + 1;
            const endItem = Math.min(currentPageNum * ITEMS_PER_PAGE, totalItems);

            let pageButtons = '';
            const maxVisible = 5;
            let startPage = Math.max(1, currentPageNum - Math.floor(maxVisible / 2));
            let endPage = Math.min(maxPage, startPage + maxVisible - 1);
            if (endPage - startPage + 1 < maxVisible) {
                startPage = Math.max(1, endPage - maxVisible + 1);
            }

            if (startPage > 1) {
                pageButtons +=
                    `<button class="page-nav-btn" onclick="goToPage(1)" title="Page 1">1</button>`;
                if (startPage > 2) {
                    pageButtons += `<span class="page-nav-btn ellipsis">…</span>`;
                }
            }

            for (let p = startPage; p <= endPage; p++) {
                if (p === currentPageNum) {
                    pageButtons +=
                        `<button class="page-nav-btn active" disabled>${p}</button>`;
                } else {
                    pageButtons +=
                        `<button class="page-nav-btn" onclick="goToPage(${p})" title="Page ${p}">${p}</button>`;
                }
            }

            if (endPage < maxPage) {
                if (endPage < maxPage - 1) {
                    pageButtons += `<span class="page-nav-btn ellipsis">…</span>`;
                }
                pageButtons +=
                    `<button class="page-nav-btn" onclick="goToPage(${maxPage})" title="Page ${maxPage}">${maxPage}</button>`;
            }

            return `
                <div class="pagination-wrapper">
                    <div class="pagination-info">
                        Showing <span>${startItem}-${endItem}</span> of <span>${totalItems}</span>
                    </div>
                    <div class="pagination-buttons">
                        <button class="page-nav-btn" onclick="goToPage(${currentPageNum - 1})" ${currentPageNum === 1 ? 'disabled' : ''} title="Previous page">
                            <i class="fas fa-chevron-left text-xs"></i>
                        </button>
                        ${pageButtons}
                        <button class="page-nav-btn" onclick="goToPage(${currentPageNum + 1})" ${currentPageNum === maxPage ? 'disabled' : ''} title="Next page">
                            <i class="fas fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>`;
        }

        const STATUS_MAP = {
            wishlist: { label: 'Wishlist', color: 'bg-gray-100 text-gray-700 border-gray-200' },
            applied: { label: 'Applied', color: 'bg-blue-100 text-blue-700 border-blue-200' },
            preliminary: { label: 'Preliminary (Pass)', color: 'bg-orange-100 text-orange-700 border-orange-200' },
            written: { label: 'Written (Pass)', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
            interview: { label: 'Interview', color: 'bg-purple-100 text-purple-700 border-purple-200' },
            offer: { label: 'Offer', color: 'bg-green-100 text-green-700 border-green-200' },
            rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200' }
        };

        function getUrgencyClass(app) {
            if (app.dateApplied && app.dateApplied.trim() !== "") return "";
            if (!app.lastDate) return "";
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const deadline = new Date(app.lastDate);
            deadline.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 3) return "urgency-danger";
            if (diffDays <= 7) return "urgency-warning";
            return "urgency-safe";
        }

async function handleFile(input, type) {
    const file = input.files[0];
    if (!file) return;
    const label = document.getElementById(`${type}-label`);
    label.innerText = '⏳ Uploading…';

    try {
        const uid = currentUser ? currentUser.uid : 'guest';
        let url;

        if (file.type.startsWith('image/')) {
            url = await uploadToCloudinary(file);
            label.innerText = '🖼️ ' + file.name + ' (Cloudinary)';
        } else {
            url = await uploadToSupabase(file, uid);
            label.innerText = '📄 ' + file.name + ' (Supabase)';
        }

        label.classList.add('text-indigo-600', 'font-semibold');
        currentFiles[type] = { name: file.name, url };
    } catch (err) {
        console.error(err);
        alert('Upload failed. Please check your service configuration.');
        label.innerText = '❌ Upload failed';
        currentFiles[type] = null;
    }
}

        function downloadFile(url, filename) {
            if (!url) { alert('No file attached.');
                return; }
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function setView(mode) {
            viewMode = mode;
            document.getElementById('btn-grid').className = mode === 'grid' ?
                'p-2 rounded bg-slate-100 text-indigo-600' : 'p-2 rounded text-slate-400';
            document.getElementById('btn-list').className = mode === 'list' ?
                'p-2 rounded bg-slate-100 text-indigo-600' : 'p-2 rounded text-slate-400';
            renderCurrentTab();
        }

        function openModal(appId = null) {
            const modal = document.getElementById('modal');
            const form = document.getElementById('app-form');
            form.reset();
            currentFiles = { cv: null, circular: null };
            document.getElementById('cv-label').innerText = "Select CV";
            document.getElementById('circular-label').innerText = "Select Circular";
            if (appId) {
                const app = applications.find(a => a.id === appId);
                document.getElementById('edit-id').value = app.id;
                document.getElementById('modal-title').innerText = "Edit Application";
                document.getElementById('company').value = app.company;
                document.getElementById('role').value = app.role;
                document.getElementById('status').value = app.status;
                document.getElementById('dateApplied').value = app.dateApplied || '';
                document.getElementById('lastDate').value = app.lastDate || '';
                document.getElementById('location').value = app.location || '';
                document.getElementById('salary').value = app.salary || '';
                document.getElementById('sector').value = app.sector;
                document.getElementById('jobType').value = app.jobType;
                document.getElementById('url').value = app.url;
                if (app.cvName) { document.getElementById('cv-label').innerText = app.cvName;
                    document.getElementById('cv-label').classList.add('text-indigo-600', 'font-semibold'); }
                if (app.circularName) { document.getElementById('circular-label').innerText = app.circularName;
                    document.getElementById('circular-label').classList.add('text-indigo-600', 'font-semibold'); }
                currentFiles.cv = { name: app.cvName, url: app.cvUrl };
                currentFiles.circular = { name: app.circularName, url: app.circularUrl };
            } else {
                document.getElementById('edit-id').value = '';
                document.getElementById('modal-title').innerText = "New Application";
            }
            modal.classList.remove('hidden');
        }

        function closeModal() { document.getElementById('modal').classList.add('hidden'); }

        function deleteApp(id) {
            const app = applications.find(a => a.id === id);
            if (!app) return;
            if (!confirm(`Are you sure you want to delete "${app.company} - ${app.role}"?\n\nThis action cannot be undone.`))
                return;
            applications = applications.filter(a => a.id !== id);
            saveApplications();
            renderCurrentTab();
            if (currentUser) userAppsRef().doc(id).delete().catch(err => console.warn("Firebase delete failed:", err));
        }

        document.getElementById('app-form').onsubmit = function(e) {
            e.preventDefault();
            const id = document.getElementById('edit-id').value;
            const appData = {
                id: id || Date.now().toString(),
                company: document.getElementById('company').value,
                role: document.getElementById('role').value,
                status: document.getElementById('status').value,
                dateApplied: document.getElementById('dateApplied').value,
                lastDate: document.getElementById('lastDate').value,
                location: document.getElementById('location').value,
                salary: document.getElementById('salary').value,
                sector: document.getElementById('sector').value,
                jobType: document.getElementById('jobType').value,
                url: document.getElementById('url').value,
                cvName: currentFiles.cv ? currentFiles.cv.name : '',
                cvUrl: currentFiles.cv ? currentFiles.cv.url : null,
                circularName: currentFiles.circular ? currentFiles.circular.name : '',
                circularUrl: currentFiles.circular ? currentFiles.circular.url : null
            };
            if (id) { applications = applications.map(a => a.id === id ? appData : a); } else { applications.unshift(
                appData); }
            closeModal();
            saveApplications();
            resetCurrentPage();
            renderCurrentTab();
            if (currentUser) userAppsRef().doc(appData.id).set(appData).catch(err => console.warn(
                "Firebase save failed:", err));
        };

        // --- Stats ---
        function updateStats() {
            const all = applications;
            const counts = {
                total: all.length,
                applied: all.filter(a => a.status === 'applied').length,
                preliminary: all.filter(a => a.status === 'preliminary').length,
                written: all.filter(a => a.status === 'written').length,
                interviews: all.filter(a => a.status === 'interview').length,
                offers: all.filter(a => a.status === 'offer').length,
            };
            document.getElementById('stats-container').innerHTML = `
                ${renderStatCard('Total Applications', counts.total, 'fa-th-large', 'blue')}
                ${renderStatCard('Applied', counts.applied, 'fa-paper-plane', 'amber')}
                ${renderStatCard('Preliminary (Pass)', counts.preliminary, 'fa-clipboard-check', 'orange')}
                ${renderStatCard('Written (Pass)', counts.written, 'fa-pen-nib', 'indigo')}
                ${renderStatCard('Interviews', counts.interviews, 'fa-calendar-alt', 'purple')}
                ${renderStatCard('Offers', counts.offers, 'fa-chart-line', 'green')}
            `;
        }

        function renderStatCard(label, val, icon, color) {
            const colors = {
                blue: 'text-blue-600 bg-blue-50 border-blue-100',
                amber: 'text-amber-600 bg-amber-50 border-amber-100',
                orange: 'text-orange-600 bg-orange-50 border-orange-100',
                indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                purple: 'text-purple-600 bg-purple-50 border-purple-100',
                green: 'text-green-600 bg-green-50 border-green-100'
            };
            return `
                <div class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:border-slate-300 transition-colors">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-2 sm:mb-3 border ${colors[color]}">
                        <i class="fas ${icon} text-xs sm:text-sm"></i>
                    </div>
                    <div>
                        <p class="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">${label}</p>
                        <p class="text-xl sm:text-2xl font-black text-slate-900 leading-none">${val}</p>
                    </div>
                </div>`;
        }

        // ===== SORT =====
        let currentSort = 'deadline-soon';

        function toggleSortMenu() {
            const btn = document.getElementById('sort-btn');
            const menu = document.getElementById('sort-menu');
            btn.classList.toggle('open');
            menu.classList.toggle('open');
        }
        document.addEventListener('click', function(e) {
            const wrapper = document.getElementById('sort-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                document.getElementById('sort-btn').classList.remove('open');
                document.getElementById('sort-menu').classList.remove('open');
            }
        });

        function setSort(value, label, el) {
            currentSort = value;
            document.getElementById('sort-label').textContent = label;
            document.querySelectorAll('.sort-option').forEach(o => o.classList.remove('selected'));
            el.classList.add('selected');
            document.getElementById('sort-btn').classList.toggle('active', value !== 'newest');
            document.getElementById('sort-btn').classList.remove('open');
            document.getElementById('sort-menu').classList.remove('open');
            resetCurrentPage();
            renderCurrentTab();
        }

        function parseSalary(salaryStr) {
            if (!salaryStr) return 0;
            const match = salaryStr.replace(/,/g, '').match(/[\d.]+/);
            if (!match) return 0;
            let val = parseFloat(match[0]);
            if (salaryStr.toLowerCase().includes('k')) val *= 1000;
            if (salaryStr.toLowerCase().includes('m')) val *= 1000000;
            return val;
        }

        // ===== ARCHIVE HELPERS =====
        function isExpired(app) {
            if (!app.lastDate) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dl = new Date(app.lastDate);
            dl.setHours(0, 0, 0, 0);
            return dl < today;
        }

        function getActiveApps() { return applications.filter(a => !isExpired(a)); }

        function getArchivedApps() { return applications.filter(a => isExpired(a)); }

        function updateArchiveBadge() {
            const badge = document.getElementById('archive-badge');
            if (!badge) return;
            const count = getArchivedApps().length;
            if (count > 0) { badge.textContent = count;
                badge.classList.remove('hidden'); } else badge.classList.add('hidden');
        }

        // ===== TAB SWITCHING =====
        let currentTab = 'active';

        function switchMainTab(tab) {
            currentTab = tab;
            const slider = document.getElementById('tab-slider');
            slider.style.transform = tab === 'active' ? 'translateX(0%)' : 'translateX(-100%)';
            const activeBtn = document.getElementById('tab-active-btn');
            const archiveBtn = document.getElementById('tab-archive-btn');
            if (tab === 'active') {
                activeBtn.className =
                    'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 bg-indigo-600 text-white shadow';
                archiveBtn.className =
                    'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 text-slate-500 hover:bg-slate-50';
            } else {
                archiveBtn.className =
                    'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 bg-amber-500 text-white shadow';
                activeBtn.className =
                    'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 text-slate-500 hover:bg-slate-50';
            }
            resetCurrentPage();
            renderCurrentTab();
        }

        function renderCurrentTab() {
            if (currentTab === 'active') renderApplications();
            else renderArchiveTab();
        }

        // ===== RENDER ARCHIVE TAB =====
        function renderArchiveTab() {
            const search = document.getElementById('search-input').value.toLowerCase();
            const filter = document.getElementById('status-filter').value;
            const container = document.getElementById('archive-container');
            const pagContainer = document.getElementById('archive-pagination-container');
            const archived = sortApplications(getArchivedApps().filter(a => {
                const ms = a.company.toLowerCase().includes(search) || a.role.toLowerCase().includes(search);
                const mf = filter === 'all' || a.status === filter;
                return ms && mf;
            }));

            updateStats();
            updateArchiveBadge();

            const totalItems = archived.length;
            const maxPage = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
            let cp = getCurrentPage();
            if (cp > maxPage) { cp = maxPage;
                setCurrentPage(cp); }
            const startIdx = (cp - 1) * ITEMS_PER_PAGE;
            const paginatedItems = archived.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            if (totalItems === 0) {
                container.innerHTML = `<div class="text-center py-16 sm:py-20 bg-white rounded-2xl border-2 border-dashed border-amber-200">
                    <div class="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-400 mb-4">
                        <i class="fas fa-archive text-xl sm:text-2xl"></i>
                    </div>
                    <h3 class="text-base sm:text-lg font-semibold text-slate-800">No archived applications</h3>
                    <p class="text-slate-400 mt-1 text-xs sm:text-sm">Applications whose deadlines pass will appear here automatically.</p>
                </div>`;
                pagContainer.innerHTML = '';
                return;
            }

            if (viewMode === 'grid') {
                container.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    ${paginatedItems.map(app => renderArchiveGridCard(app)).join('')}
                </div>`;
            } else {
                container.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div class="table-responsive-wrap">
                        <table class="w-full text-left min-w-[900px] sm:min-w-[1000px]">
                            <thead class="bg-amber-50 text-[9px] sm:text-[10px] uppercase font-bold text-slate-500 border-b">
                                <tr>
                                    <th class="px-4 sm:px-6 py-3 sm:py-4">Company & Role</th>
                                    <th class="px-4 sm:px-6 py-3 sm:py-4">Sector</th>
                                    <th class="px-4 sm:px-6 py-3 sm:py-4">Type / Salary</th>
                                    <th class="px-4 sm:px-6 py-3 sm:py-4">Files</th>
                                    <th class="px-4 sm:px-6 py-3 sm:py-4">Status</th>
                                    <th class="px-4 sm:px-6 py-3 sm:py-4">Dates</th>
                                    <th class="px-4 sm:px-6 py-3 sm:py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${paginatedItems.map(app => renderArchiveListRow(app)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            }
            pagContainer.innerHTML = renderPaginationHTML(totalItems, cp);
        }

        function renderArchiveGridCard(app) {
            const status = STATUS_MAP[app.status];
            const daysAgo = Math.floor((new Date() - new Date(app.lastDate)) / (1000 * 60 * 60 * 24));
            return `
                <div class="bg-white border-2 border-amber-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full group">
                    <div class="p-4 sm:p-5 flex-grow">
                        <div class="flex justify-between items-start mb-3 sm:mb-4">
                            <div class="bg-slate-50 p-2 rounded-xl border border-slate-100 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center overflow-hidden">
                                <img src="${getCompanyLogoUrl(app.company)}" alt="${app.company} logo" class="w-7 h-7 sm:w-9 sm:h-9 object-contain rounded" onerror="this.onerror=null;this.src='';this.style.display='none';this.nextElementSibling.style.display='flex';" />
                                <i class="fas fa-building text-lg sm:text-xl text-slate-400" style="display:none;"></i>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="openNotepad('${app.id}','${app.role.replace(/'/g,"\\'")}','${app.company.replace(/'/g,"\\'")}')\" class="p-2 text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg" title="Note"><i class="fas fa-sticky-note text-sm"></i></button>
                                <button onclick="openModal('${app.id}')" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit"><i class="fas fa-edit text-sm"></i></button>
                                <button onclick="deleteArchivedApp('${app.id}')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><i class="fas fa-trash text-sm"></i></button>
                            </div>
                        </div>
                        <h3 class="text-base sm:text-lg font-bold text-slate-900 mb-1 leading-tight">${app.role}</h3>
                        <p class="text-sm sm:text-base text-slate-600 font-medium mb-3">${app.company}</p>
                        <div class="flex gap-2 mb-3 flex-wrap">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${status.color}">${status.label}</span>
                            ${app.sector === 'govt' ? '<span class="bg-amber-100 text-amber-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Govt</span>' : ''}
                        </div>
                        <div class="text-xs sm:text-[13px] text-slate-500 space-y-2 border-t pt-3">
                            ${app.location ? `<div class="flex items-center"><i class="fas fa-map-marker-alt w-5 text-slate-400"></i>${app.location}</div>` : ''}
                            ${app.salary ? `<div class="flex items-center text-emerald-600 font-semibold"><i class="fas fa-dollar-sign w-5"></i>${app.salary}</div>` : ''}
                            ${app.dateApplied ? `<div class="flex items-center"><i class="far fa-calendar-check w-5 text-slate-400"></i>Applied: ${app.dateApplied}</div>` : ''}
                            <div class="flex items-center font-bold text-amber-600">
                                <i class="far fa-calendar-times w-5"></i>
                                Expired ${daysAgo === 0 ? 'today' : daysAgo + 'd ago'} — ${new Date(app.lastDate).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                    <div class="px-4 sm:px-5 py-3 bg-amber-50/50 border-t flex flex-wrap gap-2">
                        ${app.cvName ? `<button onclick="downloadFile('${app.cvUrl}', '${app.cvName}')" class="text-[10px] sm:text-[11px] bg-white border px-2 py-1 rounded shadow-sm hover:text-indigo-600 transition-colors"><i class="far fa-file-pdf text-red-500 mr-1"></i>CV</button>` : ''}
                        ${app.circularName ? `<button onclick="downloadFile('${app.circularUrl}', '${app.circularName}')" class="text-[10px] sm:text-[11px] bg-white border px-2 py-1 rounded shadow-sm hover:text-purple-600 transition-colors"><i class="fas fa-file-contract text-purple-500 mr-1"></i>Circular</button>` : ''}
                        ${app.url ? `<a href="${app.url}" target="_blank" class="text-[10px] sm:text-[11px] font-bold text-indigo-600 ml-auto flex items-center">Visit <i class="fas fa-external-link-alt ml-1"></i></a>` : ''}
                    </div>
                </div>`;
        }

        function renderArchiveListRow(app) {
            const status = STATUS_MAP[app.status];
            const daysAgo = Math.floor((new Date() - new Date(app.lastDate)) / (1000 * 60 * 60 * 24));
            return `<tr class="hover:bg-amber-50/30 transition-colors group">
                <td class="px-4 sm:px-6 py-3 sm:py-4"><div class="font-bold text-slate-900 text-sm">${app.company}</div><div class="text-xs sm:text-sm text-slate-500">${app.role}</div></td>
                <td class="px-4 sm:px-6 py-3 sm:py-4"><span class="text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded ${app.sector === 'govt' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}">${app.sector === 'govt' ? 'Government' : 'Non-Govt'}</span></td>
                <td class="px-4 sm:px-6 py-3 sm:py-4"><div class="text-xs text-slate-700 font-medium">${app.jobType || '—'}</div><div class="text-xs text-emerald-600 font-bold">${app.salary || '—'}</div></td>
                <td class="px-4 sm:px-6 py-3 sm:py-4"><div class="flex gap-2">${app.cvName ? `<button onclick="downloadFile('${app.cvUrl}', '${app.cvName}')" class="p-2 border rounded text-indigo-500 hover:bg-indigo-50" title="Download CV"><i class="far fa-file-pdf"></i></button>` : ''}${app.circularName ? `<button onclick="downloadFile('${app.circularUrl}', '${app.circularName}')" class="p-2 border rounded text-purple-500 hover:bg-purple-50" title="Download Circular"><i class="fas fa-file-contract"></i></button>` : ''}</div></td>
                <td class="px-4 sm:px-6 py-3 sm:py-4"><span class="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border uppercase tracking-wider ${status.color}">${status.label}</span></td>
                <td class="px-4 sm:px-6 py-3 sm:py-4"><div class="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1"><i class="far fa-calendar-check"></i> ${app.dateApplied ? new Date(app.dateApplied).toLocaleDateString() : '—'}</div><div class="text-[10px] sm:text-[11px] text-amber-600 font-bold flex items-center gap-1 mt-1"><i class="far fa-calendar-times"></i> Expired ${daysAgo === 0 ? 'today' : daysAgo + 'd ago'}</div></td>
                <td class="px-4 sm:px-6 py-3 sm:py-4 text-right"><div class="flex justify-end gap-2"><button onclick="openModal('${app.id}')" class="text-slate-400 hover:text-indigo-600 p-1" title="Edit"><i class="fas fa-edit"></i></button><button onclick="deleteArchivedApp('${app.id}')" class="text-slate-400 hover:text-red-600 p-1" title="Delete"><i class="fas fa-trash"></i></button></div></td>
            </tr>`;
        }

        function deleteArchivedApp(id) {
            const app = applications.find(a => a.id === id);
            if (!app) return;
            if (!confirm(`Are you sure you want to delete "${app.company} - ${app.role}"?\n\nThis action cannot be undone.`))
                return;
            applications = applications.filter(a => a.id !== id);
            saveApplications();
            renderArchiveTab();
            updateArchiveBadge();
            updateStats();
            if (currentUser) userAppsRef().doc(id).delete().catch(() => {});
        }

        function sortApplications(arr) {
            const sorted = [...arr];
            switch (currentSort) {
                case 'newest':
                    return sorted.sort((a, b) => b.id.localeCompare(a.id));
                case 'oldest':
                    return sorted.sort((a, b) => a.id.localeCompare(b.id));
                case 'salary-high':
                    return sorted.sort((a, b) => parseSalary(b.salary) - parseSalary(a.salary));
                case 'salary-low':
                    return sorted.sort((a, b) => parseSalary(a.salary) - parseSalary(b.salary));
                case 'deadline-soon':
                    return sorted.sort((a, b) => { if (!a.lastDate) return 1; if (!b.lastDate) return -1; return new Date(a
                            .lastDate) - new Date(b.lastDate); });
                case 'deadline-late':
                    return sorted.sort((a, b) => { if (!a.lastDate) return 1; if (!b.lastDate) return -1; return new Date(b
                            .lastDate) - new Date(a.lastDate); });
                default:
                    return sorted;
            }
        }

        // ===== RENDER ACTIVE APPLICATIONS =====
        function renderApplications() {
            const search = document.getElementById('search-input').value.toLowerCase();
            const filter = document.getElementById('status-filter').value;
            const container = document.getElementById('apps-container');
            const pagContainer = document.getElementById('active-pagination-container');

            const filtered = sortApplications(getActiveApps().filter(app => {
                const matchesSearch = app.company.toLowerCase().includes(search) || app.role.toLowerCase()
                    .includes(search);
                const matchesFilter = filter === 'all' || app.status === filter;
                return matchesSearch && matchesFilter;
            }));

            updateStats();
            updateArchiveBadge();

            const totalItems = filtered.length;
            const maxPage = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
            let cp = getCurrentPage();
            if (cp > maxPage) { cp = maxPage;
                setCurrentPage(cp); }
            const startIdx = (cp - 1) * ITEMS_PER_PAGE;
            const paginatedItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

            if (totalItems === 0) {
                container.innerHTML = `
                    <div class="text-center py-16 sm:py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                        <div class="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
                            <i class="fas fa-search text-xl sm:text-2xl"></i>
                        </div>
                        <h3 class="text-base sm:text-lg font-semibold text-slate-800">No applications found</h3>
                    </div>`;
                pagContainer.innerHTML = '';
                return;
            }

            if (viewMode === 'grid') {
                container.innerHTML = `
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        ${paginatedItems.map(app => renderGridCard(app)).join('')}
                    </div>`;
            } else {
                container.innerHTML = `
                    <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div class="table-responsive-wrap">
                            <table class="w-full text-left min-w-[900px] sm:min-w-[1000px]">
                                <thead class="bg-slate-50 text-[9px] sm:text-[10px] uppercase font-bold text-slate-500 border-b">
                                    <tr>
                                        <th class="px-4 sm:px-6 py-3 sm:py-4">Company & Role</th>
                                        <th class="px-4 sm:px-6 py-3 sm:py-4">Sector</th>
                                        <th class="px-4 sm:px-6 py-3 sm:py-4">Type/Salary</th>
                                        <th class="px-4 sm:px-6 py-3 sm:py-4">Files</th>
                                        <th class="px-4 sm:px-6 py-3 sm:py-4">Status</th>
                                        <th class="px-4 sm:px-6 py-3 sm:py-4">Dates</th>
                                        <th class="px-4 sm:px-6 py-3 sm:py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y">
                                    ${paginatedItems.map(app => renderListRow(app)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>`;
            }
            pagContainer.innerHTML = renderPaginationHTML(totalItems, cp);
            setTimeout(updateNoteIndicators, 0);
        }

        // ===== COMPANY LOGO HELPER =====
        function getCompanyLogoUrl(companyName) {
            const name = companyName.trim().toLowerCase();
            // Known domain overrides (especially for local/BD companies)
            const overrides = {
                'google': 'google.com',
                'openai': 'openai.com',
                'meta': 'meta.com',
                'facebook': 'facebook.com',
                'amazon': 'amazon.com',
                'apple': 'apple.com',
                'microsoft': 'microsoft.com',
                'netflix': 'netflix.com',
                'twitter': 'twitter.com',
                'x': 'x.com',
                'linkedin': 'linkedin.com',
                'uber': 'uber.com',
                'airbnb': 'airbnb.com',
                'spotify': 'spotify.com',
                'samsung': 'samsung.com',
                'tesla': 'tesla.com',
                'nvidia': 'nvidia.com',
                'ibm': 'ibm.com',
                'oracle': 'oracle.com',
                'salesforce': 'salesforce.com',
                'adobe': 'adobe.com',
                'intel': 'intel.com',
                'paypal': 'paypal.com',
                'stripe': 'stripe.com',
                'shopify': 'shopify.com',
                'slack': 'slack.com',
                'zoom': 'zoom.us',
                'dropbox': 'dropbox.com',
                'github': 'github.com',
                'gitlab': 'gitlab.com',
                'figma': 'figma.com',
                'notion': 'notion.so',
                'anthropic': 'anthropic.com',
                'meghna bank': 'meghnabank.com.bd',
                'dutch bangla bank': 'dutchbanglabank.com',
                'dbbl': 'dutchbanglabank.com',
                'brac bank': 'bracbank.com',
                'islami bank': 'islamibankbd.com',
                'sonali bank': 'sonalibank.com.bd',
                'janata bank': 'janatabank-bd.com',
                'agrani bank': 'agranibank.org',
                'rupali bank': 'rupalibank.org',
                'city bank': 'thecitybank.com',
                'eastern bank': 'ebl.com.bd',
                'prime bank': 'primebank.com.bd',
                'southeast bank': 'southeastbank.com.bd',
                'trust bank': 'trustbank.com.bd',
                'uttara bank': 'uttarabank-bd.com',
                'ific bank': 'ificbankbd.com',
                'bank asia': 'bankasia-bd.com',
                'mutual trust bank': 'mutualtrustbank.com',
                'national bank': 'nblbd.com',
                'exim bank': 'eximbankbd.com',
                'social islami bank': 'siblbd.com',
                'shahjalal islami bank': 'sjiblbd.com',
                'grameenphone': 'grameenphone.com',
                'robi': 'robi.com.bd',
                'banglalink': 'banglalink.net',
                'teletalk': 'teletalk.com.bd',
                'bkash': 'bkash.com',
                'nagad': 'nagad.com.bd',
                'walton': 'waltonbd.com',
                'pran': 'pranfoods.net',
                'square': 'squaregroup.com.bd',
                'beximco': 'beximco.com',
                'bashundhara': 'bashundharagroup.com',
                'akij': 'akijgroup.com.bd',
                'The Security Printing Corporation (Bangladesh) Ltd': 'spcbl.org.bd',
                'Bangladesh Bank': 'bb.org.bd',
                'BARI': 'bari.gov.bd',
                'BCS': 'bpsc.gov.bd',
                'DPE': 'dpe.gov.bd',
            };
            const domain = overrides[name] || (name.replace(/[^a-z0-9]/g, '') + '.com');
            return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=64';
        }

        function renderGridCard(app) {
            const status = STATUS_MAP[app.status];
            const urgency = getUrgencyClass(app);
            return `
                <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full group ${urgency}">
                    <div class="p-4 sm:p-5 flex-grow">
                        <div class="flex justify-between items-start mb-3 sm:mb-4">
                            <div class="bg-slate-50 p-2 rounded-xl border border-slate-100 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center overflow-hidden" style="position:relative;">
                                <img src="${getCompanyLogoUrl(app.company)}" alt="${app.company} logo" class="w-7 h-7 sm:w-9 sm:h-9 object-contain rounded" onerror="this.onerror=null; this.src=''; this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                <i class="fas fa-building text-lg sm:text-xl text-slate-400" style="display:none;"></i>
                                <span data-note-dot="${app.id}" style="display:none;position:absolute;top:2px;right:2px;width:8px;height:8px;background:#fdd835;border-radius:50%;border:1.5px solid #f9a825;"></span>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="openNotepad('${app.id}','${app.role.replace(/'/g,"\\'")}','${app.company.replace(/'/g,"\\'")}')\" class="p-2 text-slate-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg" title="Note"><i class="fas fa-sticky-note text-sm"></i></button>
                                <button onclick="openModal('${app.id}')" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><i class="fas fa-edit text-sm"></i></button>
                                <button onclick="deleteApp('${app.id}')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><i class="fas fa-trash text-sm"></i></button>
                            </div>
                        </div>
                        <h3 class="text-base sm:text-lg font-bold text-slate-900 mb-1 leading-tight">${app.role}</h3>
                        <p class="text-sm sm:text-base text-slate-600 font-medium mb-3 sm:mb-4">${app.company}</p>
                        <div class="flex gap-2 mb-3 sm:mb-4 flex-wrap">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${status.color}">${status.label}</span>
                            ${app.sector === 'govt' ? '<span class="bg-amber-100 text-amber-700 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Govt</span>' : ''}
                        </div>
                        <div class="text-xs sm:text-[13px] text-slate-500 space-y-2 border-t pt-3 sm:pt-4">
                            ${app.location ? `<div class="flex items-center"><i class="fas fa-map-marker-alt w-5 text-slate-400"></i>${app.location}</div>` : ''}
                            ${app.salary ? `<div class="flex items-center text-emerald-600 font-semibold"><i class="fas fa-dollar-sign w-5"></i>${app.salary}</div>` : ''}
                            <div class="flex items-center ${!app.dateApplied ? 'text-rose-500 font-bold' : ''}">
                                <i class="far fa-calendar-check w-5 text-slate-400"></i>
                                ${app.dateApplied ? 'Applied: ' + app.dateApplied : 'Not Applied Yet'}
                            </div>
                            ${app.lastDate ? `<div class="flex items-center font-bold ${urgency === 'urgency-danger' ? 'text-red-600' : 'text-slate-600'}"><i class="far fa-clock w-5"></i>Deadline: ${app.lastDate}</div>` : ''}
                        </div>
                    </div>
                    <div class="px-4 sm:px-5 py-3 bg-slate-50/50 border-t flex flex-wrap gap-2">
                        ${app.cvName ? `<button onclick="downloadFile('${app.cvUrl}', '${app.cvName}')" class="text-[10px] sm:text-[11px] bg-white border px-2 py-1 rounded shadow-sm hover:text-indigo-600 transition-colors"><i class="far fa-file-pdf text-red-500 mr-1"></i>CV</button>` : ''}
                        ${app.circularName ? `<button onclick="downloadFile('${app.circularUrl}', '${app.circularName}')" class="text-[10px] sm:text-[11px] bg-white border px-2 py-1 rounded shadow-sm hover:text-purple-600 transition-colors"><i class="fas fa-file-contract text-purple-500 mr-1"></i>Circular</button>` : ''}
                        ${app.url ? `<a href="${app.url}" target="_blank" class="text-[10px] sm:text-[11px] font-bold text-indigo-600 ml-auto flex items-center">Visit <i class="fas fa-external-link-alt ml-1"></i></a>` : ''}
                    </div>
                </div>`;
        }

        function renderListRow(app) {
            const status = STATUS_MAP[app.status];
            const urgency = getUrgencyClass(app);
            return `
                <tr class="hover:bg-slate-50/50 transition-colors group ${urgency}">
                    <td class="px-4 sm:px-6 py-3 sm:py-4"><div class="font-bold text-slate-900 text-sm">${app.company}</div><div class="text-xs sm:text-sm text-slate-500">${app.role}</div></td>
                    <td class="px-4 sm:px-6 py-3 sm:py-4"><span class="text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded ${app.sector === 'govt' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}">${app.sector === 'govt' ? 'Government' : 'Non-Govt'}</span></td>
                    <td class="px-4 sm:px-6 py-3 sm:py-4"><div class="text-xs text-slate-700 font-medium">${app.jobType || '—'}</div><div class="text-xs text-emerald-600 font-bold">${app.salary || '—'}</div></td>
                    <td class="px-4 sm:px-6 py-3 sm:py-4"><div class="flex gap-2">${app.cvName ? `<button onclick="downloadFile('${app.cvUrl}', '${app.cvName}')" class="p-2 border rounded text-indigo-500 hover:bg-indigo-50"><i class="far fa-file"></i></button>` : ''}${app.circularName ? `<button onclick="downloadFile('${app.circularUrl}', '${app.circularName}')" class="p-2 border rounded text-purple-500 hover:bg-purple-50"><i class="fas fa-upload"></i></button>` : ''}</div></td>
                    <td class="px-4 sm:px-6 py-3 sm:py-4"><span class="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border uppercase tracking-wider ${status.color}">${status.label}</span></td>
                    <td class="px-4 sm:px-6 py-3 sm:py-4"><div class="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1"><i class="far fa-clock"></i> App: ${app.dateApplied ? new Date(app.dateApplied).toLocaleDateString() : '—'}</div>${app.lastDate ? `<div class="text-[10px] sm:text-[11px] text-amber-600 font-bold flex items-center gap-1"><i class="far fa-calendar"></i> End: ${new Date(app.lastDate).toLocaleDateString()}</div>` : ''}</td>
                    <td class="px-4 sm:px-6 py-3 sm:py-4 text-right"><div class="flex justify-end gap-2"><button onclick="openModal('${app.id}')" class="text-slate-400 hover:text-indigo-600 p-1"><i class="fas fa-edit"></i></button><button onclick="deleteApp('${app.id}')" class="text-slate-400 hover:text-red-600 p-1"><i class="fas fa-trash"></i></button></div></td>
                </tr>`;
        }

        async function handleProfilePhoto(input) {
            const file = input.files[0];
            if (!file) return;
            const uid = currentUser ? currentUser.uid : 'local';
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('profile-img').src = e.target.result;
                document.getElementById('user-avatar').src = e.target.result;
                localStorage.setItem('profile_photo_' + uid, e.target.result);
            };
            reader.readAsDataURL(file);
            try {
                const url = await uploadToCloudinary(file);
                document.getElementById('profile-img').src = url;
                document.getElementById('user-avatar').src = url;
                localStorage.setItem('profile_photo_' + uid, url);
                if (currentUser) { db.collection('users').doc(uid).set({ profile: { photoURL: url } }, { merge: true }).catch(
                        () => {}); }
            } catch (e) { console.warn('Cloudinary upload failed, using local storage:', e); }
        }

        function saveApplications() { localStorage.setItem('applications', JSON.stringify(applications)); }

        // ===== HAMBURGER MENU =====
        function toggleHamburger() { document.getElementById('hamburger-menu').classList.toggle('open'); }

        function closeHamburger() {
            document.getElementById('hamburger-menu').classList.remove('open');
            document.getElementById('ei-menu').classList.remove('open');
            document.getElementById('export-menu').classList.remove('open');
        }

        function toggleEIMenu(e) { e.stopPropagation();
            document.getElementById('ei-menu').classList.toggle('open');
            document.getElementById('export-menu').classList.remove('open'); }

        function toggleExportMenu(e) { e.stopPropagation();
            document.getElementById('export-menu').classList.toggle('open'); }
        document.addEventListener('click', function(e) {
            if (!document.getElementById('hamburger-wrapper').contains(e.target)) closeHamburger();
            const wrapper = document.getElementById('sort-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                document.getElementById('sort-btn').classList.remove('open');
                document.getElementById('sort-menu').classList.remove('open');
            }
        });

        // ===== EXPORT PDF =====
async function exportPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });

        const title = 'CareerPath | Job Application Tracker';
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        const pageWidth = doc.internal.pageSize.width;
        doc.text(title, pageWidth / 2, 18, { align: 'center' });

        const profileCard = document.querySelector('.profile-card');
        let profileImgData = null;
        if (profileCard) {
            const overlays = profileCard.querySelectorAll('.photo-overlay');
            overlays.forEach(o => o.style.opacity = '0');
            const canvas = await html2canvas(profileCard, {
                scale: 3,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff'
            });
            overlays.forEach(o => o.style.opacity = '');
            profileImgData = canvas.toDataURL('image/png');
        }

        const leftMargin = 14;
        const rightMargin = 14;
        const tableWidth = pageWidth - leftMargin - rightMargin;
        let currentY = 24;

        if (profileImgData && profileCard) {
            const aspectRatio = profileCard.offsetHeight / profileCard.offsetWidth;
            const imgHeight = tableWidth * aspectRatio;
            doc.addImage(profileImgData, 'PNG', leftMargin, currentY, tableWidth, imgHeight);
            currentY += imgHeight + 6;
        }

        const columns = [
            'Company', 'Role', 'Status', 'Sector', 'Location', 'Salary',
            'Date Applied', 'Deadline', 'Job Link', 'Notes'
        ];

        function drawTable(apps, heading, headerColor) {
            if (apps.length === 0) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...headerColor);
                doc.text(heading, leftMargin, currentY);
                currentY += 8;
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100);
                doc.text('No applications found.', leftMargin + 2, currentY);
                currentY += 10;
                return;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...headerColor);
            doc.text(heading, leftMargin, currentY);
            currentY += 8;
            doc.setTextColor(30);

            const rows = apps.map(app => [
                app.company,
                app.role,
                app.status,
                app.sector === 'govt' ? 'Government' : 'Non-Govt',
                app.location || '',
                app.salary || '',
                app.dateApplied || '',
                app.lastDate || '',
                app.url || '',
                getNoteText(app.id)
            ]);

            doc.autoTable({
                head: [columns],
                body: rows,
                startY: currentY,
                margin: { left: leftMargin, right: rightMargin },
                styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
                headStyles: { fillColor: headerColor, textColor: [255, 255, 255] },
            });

            currentY = doc.lastAutoTable.finalY + 10;
        }

        const activeApps = applications.filter(app => !isExpired(app));
        drawTable(activeApps, 'Active Applications', [14, 165, 233]);

        const archivedApps = applications.filter(app => isExpired(app));
        drawTable(archivedApps, 'Archived Applications', [255, 0, 0]);

        const now = new Date().toLocaleString();
        const totalPages = doc.internal.getNumberOfPages();
        doc.setFontSize(9);
        doc.setTextColor(100);
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.text(
                `Exported: ${now}`,
                pageWidth - rightMargin,
                doc.internal.pageSize.height - 12,
                { align: 'right' }
            );
        }

        doc.save('CareerPath_Applications.pdf');
    } catch (error) {
        console.error("PDF export failed:", error);
        alert("PDF export failed. See console for details.");
    }
}

        // ===== EXPORT EXCEL =====
function exportExcel() {
    const activeApps = getActiveApps();
    const archivedApps = getArchivedApps();

    const header = [
        'Company', 'Role', 'Status', 'Sector', 'Location', 'Salary',
        'Job Type', 'Date Applied', 'Deadline', 'Job Link', 'Notes'
    ];

    const mapAppToRow = (app) => [
        app.company,
        app.role,
        app.status,
        app.sector === 'govt' ? 'Government' : 'Non-Govt',
        app.location || '',
        app.salary || '',
        app.jobType || '',
        app.dateApplied || '',
        app.lastDate || '',
        app.url || '',
        getNoteText(app.id)
    ];

    const wb = XLSX.utils.book_new();

    const activeData = [header, ...activeApps.map(mapAppToRow)];
    const activeWs = XLSX.utils.aoa_to_sheet(activeData);
    activeWs['!cols'] = header.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, activeWs, 'Active');

    const archiveData = [header, ...archivedApps.map(mapAppToRow)];
    const archiveWs = XLSX.utils.aoa_to_sheet(archiveData);
    archiveWs['!cols'] = header.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, archiveWs, 'Archive');

    XLSX.writeFile(wb, 'CareerPath_Applications.xlsx');
}

        function triggerImport() { document.getElementById('import-excel-input').value = '';
            document.getElementById('import-excel-input').click(); }

        function importFromExcel(input) {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                    if (rows.length < 2) return alert('No data found in the Excel file.');
                    let imported = 0;
                    for (let i = 1; i < rows.length; i++) {
                        const r = rows[i];
                        if (!r[0]) continue;
                        const app = {
                            id: Date.now().toString() + i,
                            company: r[0] || '',
                            role: r[1] || '',
                            status: r[2] || 'applied',
                            sector: (r[3] || '').toLowerCase().includes('govt') ? 'govt' : 'non-govt',
                            location: r[4] || '',
                            salary: r[5] || '',
                            jobType: r[6] || '',
                            dateApplied: r[7] || '',
                            lastDate: r[8] || '',
                            url: r[9] || '',
                            cvName: '',
                            cvUrl: null,
                            circularName: '',
                            circularUrl: null
                        };
                        applications.unshift(app);
                        if (currentUser) { await userAppsRef().doc(app.id).set(app).catch(() => {}); }
                        imported++;
                    }
                    saveApplications();
                    resetCurrentPage();
                    renderCurrentTab();
                    alert(`✅ Successfully imported ${imported} application${imported !== 1 ? 's' : ''}!`);
                } catch (err) { alert('Error reading Excel file. Please use the exported template format.'); }
            };
            reader.readAsArrayBuffer(file);
        }

        // ===== PROFILE MODAL =====
        let profileModalIsNew = false;

        function openProfileModal(isNew = false) {
            profileModalIsNew = isNew;
            const overlay = document.getElementById('profile-modal-overlay');
            const p = getLocalProfile();
            document.getElementById('pmodal-name').value = p.name || '';
            document.getElementById('pmodal-email').value = currentUser ? currentUser.email : '';
            document.getElementById('pmodal-phone').value = p.phone || '';
            document.getElementById('pmodal-linkedin').value = p.linkedin || '';
            document.getElementById('pmodal-address').value = p.address || '';
            document.getElementById('pmodal-photo').src = p.image || document.getElementById('user-avatar').src;
            document.getElementById('pmodal-skip-btn').style.display = isNew ? '' : 'none';
            overlay.classList.remove('hidden');
        }

        function skipProfileModal() { document.getElementById('profile-modal-overlay').classList.add('hidden'); }

        async function saveProfileModal() {
            const name = document.getElementById('pmodal-name').value.trim();
            const phone = document.getElementById('pmodal-phone').value.trim();
            const linkedin = document.getElementById('pmodal-linkedin').value.trim();
            const address = document.getElementById('pmodal-address').value.trim();
            const image = document.getElementById('pmodal-photo').src;
            const uid = currentUser ? currentUser.uid : 'local';
            if (image && !image.includes('dicebear') && !image.startsWith('https://api.')) {
                localStorage.setItem('profile_photo_' + uid, image);
            }
            const textProfile = { name, phone, linkedin, address };
            localStorage.setItem('profile_' + uid, JSON.stringify(textProfile));
            if (currentUser) {
                const storedPhoto = localStorage.getItem('profile_photo_' + uid) || '';
                const isCloudUrl = storedPhoto.startsWith('https://res.cloudinary') || storedPhoto.startsWith('https://');
                db.collection('users').doc(currentUser.uid).set({ profile: { ...textProfile, ...(isCloudUrl ? { photoURL: storedPhoto } : {}) } },
                    { merge: true }).catch(() => {});
            }
            applyProfileToPage({ ...textProfile, image });
            document.getElementById('profile-modal-overlay').classList.add('hidden');
        }

        async function handlePmodalPhoto(input) {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => { document.getElementById('pmodal-photo').src = e.target.result; };
            reader.readAsDataURL(file);
            try {
                const url = await uploadToCloudinary(file);
                document.getElementById('pmodal-photo').src = url;
                const uid = currentUser ? currentUser.uid : 'local';
                localStorage.setItem('profile_photo_' + uid, url);
            } catch (e) { console.warn('Cloudinary upload failed:', e); }
        }

        function getLocalProfile() {
            const uid = currentUser ? currentUser.uid : 'local';
            const text = JSON.parse(localStorage.getItem('profile_' + uid) || '{}');
            const photo = localStorage.getItem('profile_photo_' + uid);
            if (photo) text.image = photo;
            return text;
        }

        function clearProfileSection() {
            const nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.value = '';
            const phoneEl = document.getElementById('user-phone-text');
            if (phoneEl) phoneEl.textContent = '—';
            const addressEl = document.getElementById('user-address-text');
            if (addressEl) addressEl.textContent = '—';
            const linkedinEl = document.getElementById('user-linkedin-link');
            if (linkedinEl) { linkedinEl.href = '#';
                linkedinEl.textContent = '—'; }
            const emailEl = document.getElementById('user-email-link');
            if (emailEl) { emailEl.href = '#';
                emailEl.textContent = '—'; }
            const avatarEl = document.getElementById('user-avatar');
            if (avatarEl) avatarEl.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=user';
            const profileImgEl = document.getElementById('profile-img');
            if (profileImgEl) profileImgEl.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=user';
        }

        function applyProfileToPage(p) {
            if (p.name) document.getElementById('user-name').value = p.name;
            if (p.phone) document.getElementById('user-phone-text').textContent = p.phone;
            if (p.address) document.getElementById('user-address-text').textContent = p.address;
            const photo = p.image || p.photoURL;
            if (photo && !photo.includes('dicebear') && !photo.startsWith('https://api.dicebear')) {
                document.getElementById('profile-img').src = photo;
                document.getElementById('user-avatar').src = photo;
                const pmodalPhoto = document.getElementById('pmodal-photo');
                if (pmodalPhoto) pmodalPhoto.src = photo;
            }
            if (p.linkedin) {
                const link = document.getElementById('user-linkedin-link');
                link.href = p.linkedin.startsWith('http') ? p.linkedin : 'https://' + p.linkedin;
                link.textContent = p.name || p.linkedin;
            }
            if (currentUser) {
                const emailLink = document.getElementById('user-email-link');
                if (emailLink) { emailLink.href = 'mailto:' + currentUser.email;
                    emailLink.textContent = currentUser.email; }
            }
        }

        async function loadUserProfile() {
            if (!currentUser) return;
            const local = getLocalProfile();
            if (Object.keys(local).length) applyProfileToPage(local);
            try {
                const doc = await db.collection('users').doc(currentUser.uid).get();
                if (doc.exists && doc.data().profile) {
                    const remote = doc.data().profile;
                    if (remote.photoURL && remote.photoURL.startsWith('https://')) {
                        localStorage.setItem('profile_photo_' + currentUser.uid, remote.photoURL);
                    }
                    const photo = localStorage.getItem('profile_photo_' + currentUser.uid);
                    const merged = { ...remote, image: photo || local.image };
                    const { name = '', phone = '', linkedin = '', address = '' } = remote;
                    localStorage.setItem('profile_' + currentUser.uid, JSON.stringify({ name, phone, linkedin, address }));
                    applyProfileToPage(merged);
                }
            } catch (e) {}
            const emailLink = document.getElementById('user-email-link');
            if (emailLink) { emailLink.href = 'mailto:' + currentUser.email;
                emailLink.textContent = currentUser.email; }
        }

        async function loadApplicationsFromFirebase() {
            if (!currentUser) return;
            try {
                const snapshot = await userAppsRef().get();
                if (snapshot.empty) { renderCurrentTab();
                    updateDeadlineSlider(); return; }
                const firebaseApps = [];
                snapshot.forEach(doc => firebaseApps.push({ id: doc.id, ...doc.data() }));
                applications = firebaseApps;
                saveApplications();
                activeCurrentPage = 1;
                archiveCurrentPage = 1;
                renderCurrentTab();
                updateDeadlineSlider();
            } catch (err) { console.warn("Firebase load failed:", err); }
        }

        // ===== DEADLINE SLIDER BANNER =====
        function getUrgentApps() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return applications.filter(app => {
                if (!app.lastDate) return false;
                const deadline = new Date(app.lastDate);
                deadline.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 3;
            });
        }

        function closeDeadlineSlider() { document.getElementById('deadline-slider-wrap').classList.remove('show'); }

        function updateDeadlineSlider() {
            const criticalJobs = getUrgentApps();
            const wrap = document.getElementById('deadline-slider-wrap');
            const textEl = document.getElementById('deadline-slider-text');
            if (criticalJobs.length === 0) { wrap.classList.remove('show'); return; }
            const jobNames = criticalJobs.map(j => `<span class="job-list">"${j.company} — ${j.role}"</span>`).join(', ');
            textEl.innerHTML =
                `<strong>⚠️ You have ${criticalJobs.length} job${criticalJobs.length > 1 ? 's' : ''} closing within 3 days!</strong> Please apply soon. The post${criticalJobs.length > 1 ? 's' : ''} ${criticalJobs.length > 1 ? 'are' : 'is'}: ${jobNames}`;
            requestAnimationFrame(() => { setTimeout(() => wrap.classList.add('show'), 120); });
        }

        // ===== PROFILE SAVE (for inline name editing) =====
        function saveProfile() {
            const name = document.getElementById('user-name').value.trim();
            const uid = currentUser ? currentUser.uid : 'local';
            const existing = JSON.parse(localStorage.getItem('profile_' + uid) || '{}');
            existing.name = name;
            localStorage.setItem('profile_' + uid, JSON.stringify(existing));
            if (currentUser) {
                db.collection('users').doc(currentUser.uid).set({ profile: existing }, { merge: true }).catch(() => {});
            }
        }

        let npCurrentId = null;

        function openNotepad(id, role, company) {
            npCurrentId = id;
            const overlay = document.getElementById('notepad-overlay');
            overlay.style.display = 'flex';
            document.getElementById('notepad-title').textContent = role;
            document.getElementById('notepad-subtitle').textContent = company;
            const saved = JSON.parse(localStorage.getItem('note_' + id) || '{}');
            const body = document.getElementById('notepad-body');
            body.innerHTML = saved.html || '';
            setNpBg(saved.bg || '#fff8e1', '', false);
            document.getElementById('notepad-saved').textContent = saved.ts ? 'Last saved: ' + saved.ts : '';
            setTimeout(() => { overlay.onclick = (e) => { if (e.target === overlay) closeNotepad(); }; }, 10);
        }

        function closeNotepad() {
            document.getElementById('notepad-overlay').style.display = 'none';
            document.getElementById('np-bg-picker').style.display = 'none';
        }

        function saveNote() {
            if (!npCurrentId) return;
            const body = document.getElementById('notepad-body');
            const bg = document.getElementById('notepad-card').style.background;
            const ts = new Date().toLocaleString();
            localStorage.setItem('note_' + npCurrentId, JSON.stringify({ html: body.innerHTML, bg, ts }));
            document.getElementById('notepad-saved').textContent = 'Saved at ' + ts;
            const btn = event.target;
            btn.textContent = 'Saved ✓';
            setTimeout(() => { btn.textContent = 'Save Note'; }, 1500);
            updateNoteIndicators();
        }

        function clearNote() {
            if (!confirm('Clear this note?')) return;
            document.getElementById('notepad-body').innerHTML = '';
            document.getElementById('notepad-saved').textContent = '';
            if (npCurrentId) localStorage.removeItem('note_' + npCurrentId);
            updateNoteIndicators();
        }

        function npExec(cmd, val) {
            document.getElementById('notepad-body').focus();
            document.execCommand(cmd, false, val || null);
        }

        function toggleNpBgPicker() {
            const p = document.getElementById('np-bg-picker');
            p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
        }

        function setNpBg(color, name, closeP = true) {
            const card = document.getElementById('notepad-card');
            card.style.background = color;
            const body = document.getElementById('notepad-body');
            const dark = color === '#263238';
            body.style.color = dark ? '#eceff1' : '#37474f';
            document.getElementById('notepad-title').style.color = dark ? '#eceff1' : '#37474f';
            document.getElementById('notepad-subtitle').style.color = dark ? '#90a4ae' : '#78909c';
            if (closeP) document.getElementById('np-bg-picker').style.display = 'none';
        }

        function updateNoteIndicators() {
            document.querySelectorAll('[data-note-dot]').forEach(el => {
                const id = el.getAttribute('data-note-dot');
                el.style.display = localStorage.getItem('note_' + id) ? 'block' : 'none';
            });
        }

function getNoteText(appId) {
    const raw = localStorage.getItem('note_' + appId);
    if (!raw) return '';
    try {
        const data = JSON.parse(raw);
        const div = document.createElement('div');
        div.innerHTML = data.html || '';
        return div.textContent || div.innerText || '';
    } catch (e) {
        return '';
    }
}
