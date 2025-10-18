// تطبيق ربح المال - الجافاسكريبت الرئيسي
class MoneyApp {
    constructor() {
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('moneyAppUsers')) || {};
        
        // State for different pages
        this.isSpinning = false;
        this.selectedWithdrawalMethod = null;
        this.currentAdCategory = 'all';
        this.appsData = [];
        this.adsData = [];

        // Static Data
        this.wheelPrizes = [
            { points: 5, probability: 30 }, { points: 10, probability: 25 },
            { points: 15, probability: 20 }, { points: 25, probability: 15 },
            { points: 50, probability: 8 }, { points: 100, probability: 2 }
        ];
        this.withdrawalMethods = {
            'orange_money': { name: 'أورنج ماني', min: 500, detailLabel: 'رقم الهاتف', type: 'tel' },
            'paypal': { name: 'بايبال', min: 1000, detailLabel: 'البريد الإلكتروني', type: 'email' },
            'atm_card': { name: 'بطاقة ATM', min: 2000, detailLabel: 'رقم البطاقة', type: 'text' },
            'electronic_wallet': { name: 'محفظة إلكترونية', min: 1000, detailLabel: 'رقم المحفظة', type: 'text' }
        };

        this.init();
    }

    async init() {
        this.loadUserData();
        this.setupEventListeners();
        await this.loadPageData();
        this.updateUserInterface();
    }

    // =================================================================
    // AUTH & DATA (SERVER SIMULATION)
    // =================================================================

    registerUser(username, email, phone, password) {
        if (this.users[email]) {
            this.showNotification('هذا البريد الإلكتروني مسجل بالفعل', 'error');
            return false;
        }
        this.users[email] = {
            username, email, phone, password,
            points: 0, totalEarned: 0, lastSpin: null,
            watchedAds: [], downloadedApps: [], withdrawalRequests: [],
            joinDate: new Date().toISOString(),
            activity: [{ type: 'system', title: 'إنشاء حساب', points: 0, date: new Date().toISOString() }],
            prizeHistory: [],
            paymentMethods: [],
            settings: { notifications: true, email: true, sound: true }
        };
        this.saveUsers();
        this.showNotification('تم التسجيل بنجاح! جاري تسجيل الدخول...', 'success');
        setTimeout(() => this.loginUser(email, password), 1500);
        return true;
    }

    loginUser(email, password) {
        const user = this.users[email];
        if (user && user.password === password) {
            this.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.showNotification('تم تسجيل الدخول بنجاح!', 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
            return true;
        }
        this.showNotification('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'error');
        return false;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }

    deleteAccount() {
        if (!this.currentUser) return;
        delete this.users[this.currentUser.email];
        this.saveUsers();
        this.logout();
    }

    loadUserData() {
        const savedUser = localStorage.getItem('currentUser');
        const currentPage = window.location.pathname.split('/').pop();
        
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            if (currentPage === 'index.html' || currentPage === '') {
                window.location.href = 'dashboard.html'; // Redirect logged-in users away from index
            }
        } else {
            if (currentPage !== 'index.html' && currentPage !== '') {
                window.location.href = 'index.html'; // Redirect non-logged-in users to index
            }
        }
    }

    saveCurrentUser() {
        if (!this.currentUser) return;
        this.users[this.currentUser.email] = this.currentUser;
        this.saveUsers();
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }
    
    saveUsers() {
        localStorage.setItem('moneyAppUsers', JSON.stringify(this.users));
    }

    addActivity(type, title, points) {
        if (!this.currentUser) return;
        if (!this.currentUser.activity) this.currentUser.activity = [];
        this.currentUser.activity.unshift({ type, title, points, date: new Date().toISOString() });
        if (this.currentUser.activity.length > 20) this.currentUser.activity.pop();
    }

    // =================================================================
    // PAGE LOADER
    // =================================================================

    async loadPageData() {
        const page = window.location.pathname.split('/').pop();
        switch (page) {
            case '':
            case 'index.html': await this.initIndexPage(); break;
            case 'dashboard.html': await this.initDashboardPage(); break;
            case 'apps.html': await this.initAppsPage(); break;
            case 'ads.html': await this.initAdsPage(); break;
            case 'wheel.html': await this.initWheelPage(); break;
            case 'withdraw.html': await this.initWithdrawPage(); break;
            case 'profile.html': await this.initProfilePage(); break;
        }
    }

    // =================================================================
    // INDEX PAGE
    // =================================================================
    async initIndexPage() {
        this.animateElements('.feature-card, .stat-card');
    }

    async initDashboardPage() {
        if (!this.currentUser) return;
        this.updateDashboardStats();
        this.animateElements('.stats-card, .quick-action, .chart-container, .bg-white');
    }

    updateDashboardStats() {
        if (!this.currentUser) return;
        document.getElementById('adsWatched').textContent = this.currentUser.watchedAds?.length || 0;
        document.getElementById('appsDownloaded').textContent = this.currentUser.downloadedApps?.length || 0;
        document.querySelector('.total-earned').textContent = this.currentUser.totalEarned.toFixed(2);
        this.renderActivity();
        this.renderEarningsChart();
    }

    renderActivity() {
        // TODO: Implement this function
    }

    renderEarningsChart() {
        // TODO: Implement this function
    }

    showAuthTab(tabToShow) {
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        const isLogin = tabToShow === 'login';
        loginTab.classList.toggle('active', isLogin);
        registerTab.classList.toggle('active', !isLogin);
        loginForm.classList.toggle('active', isLogin);
        registerForm.classList.toggle('active', !isLogin);
    }

    handleLogin(form) {
        const email = form.querySelector('#loginEmail').value;
        const password = form.querySelector('#loginPassword').value;
        this.loginUser(email, password);
    }

    handleRegistration(form) {
        const username = form.querySelector('#registerUsername').value;
        const email = form.querySelector('#registerEmail').value;
        const phone = form.querySelector('#registerPhone').value;
        const password = form.querySelector('#registerPassword').value;
        const confirmPassword = form.querySelector('#confirmPassword').value;

        if (password !== confirmPassword) {
            this.showNotification('كلمات المرور غير متطابقة', 'error');
            return;
        }
        this.registerUser(username, email, phone, password);
    }

    // =================================================================
    // ADS PAGE
    // =================================================================
    async initAdsPage() {
        // The ad display is now handled by Google AdSense in ads.html
        this.updateDailyAdLimit();
    }

    updateDailyAdLimit() {
        if (!this.currentUser || !document.getElementById('adsRemaining')) return;
        const dailyAdLimit = 20;
        // The concept of 'watched ads' needs to be re-evaluated with AdSense.
        // For now, we will leave this as a placeholder.
        const watchedToday = 0; 
        const remaining = Math.max(0, dailyAdLimit - watchedToday);
        
        document.getElementById('adsRemaining').textContent = remaining;
        const progress = (watchedToday / dailyAdLimit) * 100;
        document.getElementById('dailyProgress').style.width = `${progress}%`;
    }
    
    // =================================================================
    // EVENT LISTENERS
    // =================================================================

    setupEventListeners() {
        // Using a single, delegated event listener for clicks
        document.addEventListener('click', e => {
            const target = e.target;
            const action = target.closest('[data-action]')?.dataset.action;

            if (!action) return;

            const actions = {
                'show-tab': () => this.showAuthTab(target.closest('[data-tab]').dataset.tab),
                'logout': () => this.logout(),
                'toggle-sidebar': () => this.toggleSidebar(),
                'spin-wheel': () => this.spinWheel(),
                'delete-account': () => this.confirmDeleteAccount(),
                'open-modal': () => this.openModal(target.closest('[data-modal-id]').dataset.modalId, target.closest('[data-modal-type]')?.dataset.modalType),
                'close-modal': () => this.closeModal(target.closest('.modal').id),
                'select-method': () => this.selectPaymentMethod(target.closest('[data-method]').dataset.method),
                'toggle-setting': () => this.toggleSetting(target.closest('[data-setting]').dataset.setting),
                // Placeholder actions
                'change-avatar': () => this.showNotification('ميزة تغيير الصورة الشخصية قريباً!', 'info'),
                'add-payment-method': () => this.showNotification('ميزة إضافة طرق دفع جديدة قريباً!', 'info'),
                'show-privacy': () => this.showNotification('سيتم عرض سياسة الخصوصية قريباً', 'info'),
                'show-terms': () => this.showNotification('سيتم عرض الشروط والأحكام قريباً', 'info'),
                'show-help': () => this.showNotification('سيتم عرض الأسئلة الشائعة قريباً', 'info'),
                'contact-support': () => this.showNotification('تواصل معنا على support@example.com', 'info'),
            };

            if (actions[action]) {
                actions[action]();
            }

            if (target.matches('.sidebar-overlay')) this.toggleSidebar();
            
            const href = target.closest('[data-href]')?.dataset.href;
            if (href) window.location.href = href;

            const appButton = target.closest('[data-app-id][data-action]');
            if (appButton) {
                this.handleAppAction(parseInt(appButton.dataset.appId), appButton.dataset.action);
            }
        });

        // Delegated listener for form submissions
        document.addEventListener('submit', e => {
            e.preventDefault();
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            const submitActions = {
                'login': () => this.handleLogin(e.target),
                'register': () => this.handleRegistration(e.target),
                'save-personal-info': () => this.savePersonalInfo(e.target),
                'save-password': () => this.changePassword(e.target),
                'submit-withdrawal': () => this.handleWithdrawalRequest(e),
            };

            if (submitActions[action]) {
                submitActions[action]();
            }
        });

        // Delegated listener for inputs
        document.addEventListener('input', e => {
            if (e.target.id === 'amount') {
                this.updateWithdrawalSummary();
            }
        });
    }
    
    // =================================================================
    // UI, NOTIFICATIONS, ANIMATIONS
    // =================================================================
    
    toggleSidebar() {
        document.querySelector('.sidebar')?.classList.toggle('active');
        document.querySelector('.sidebar-overlay')?.classList.toggle('active');
        document.querySelector('.main-content')?.classList.toggle('sidebar-open');
    }

    updateUserInterface() {
        if (!this.currentUser) return;
        document.querySelectorAll('.user-points').forEach(el => el.textContent = this.currentUser.points.toLocaleString('ar-SA'));
        document.querySelectorAll('.username').forEach(el => el.textContent = this.currentUser.username);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const color = { success: '#4CAF50', error: '#f44336', warning: '#ff9800', info: '#2196F3' }[type] || '#2196F3';
        notification.innerHTML = `<span>${message}</span>`;
        Object.assign(notification.style, {
            position: 'fixed', top: '20px', right: '20px', background: color, color: 'white',
            padding: '15px 20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '10001', transform: 'translateX(120%)', transition: 'transform 0.4s ease-in-out'
        });
        document.body.appendChild(notification);
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        setTimeout(() => {
            notification.style.transform = 'translateX(120%)';
            setTimeout(() => notification.remove(), 400);
        }, 4000);
    }

    animateElements(selector) {
        if (typeof anime !== 'undefined') {
            anime({
                targets: selector,
                translateY: [30, 0], opacity: [0, 1],
                delay: anime.stagger(100), duration: 600, easing: 'easeOutExpo'
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.moneyApp = new MoneyApp();
});