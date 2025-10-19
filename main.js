
// تطبيق ربح المال - الجافاسكريبت الرئيسي (مع دعم Firebase)
class MoneyApp {
    constructor() {
        // التحقق من تهيئة Firebase
        if (typeof firebase === 'undefined') {
            console.error("Firebase is not initialized. Make sure the config is correct in your HTML file.");
            this.showNotification('خطأ فادح: لم يتم تهيئة Firebase!', 'error');
            return;
        }

        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.currentUser = null; // سيحتوي على كائن المصادقة من Firebase
        this.userData = null; // سيحتوي على بيانات المستخدم من Firestore
        this.userUnsubscribe = null; // للاستماع لتحديثات المستخدم

        // الحالة
        this.isSpinning = false;

        // البيانات الثابتة
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

    init() {
        this.setupEventListeners();
        this.handleAuthStateChange();
    }

    // =================================================================
    // AUTH & DATA (FIREBASE)
    // =================================================================

    handleAuthStateChange() {
        this.auth.onAuthStateChanged(async (user) => {
            if (this.userUnsubscribe) this.userUnsubscribe(); // إيقاف الاستماع السابق

            const currentPage = window.location.pathname.split('/').pop();
            const isAuthPage = currentPage === 'index.html' || currentPage === '';

            if (user) {
                this.currentUser = user;
                // الاستماع لتحديثات بيانات المستخدم في الوقت الفعلي
                this.userUnsubscribe = this.db.collection('users').doc(user.uid).onSnapshot(doc => {
                    if (doc.exists) {
                        this.userData = { uid: user.uid, ...doc.data() };
                        this.updateUserInterface();
                        this.loadPageData(); // تحميل بيانات الصفحة بعد الحصول على بيانات المستخدم
                    } else {
                        // حالة نادرة: مستخدم مسجل ولكن ليس له ملف شخصي
                        console.error("User is authenticated but has no profile data.");
                        this.logout();
                    }
                }, error => {
                    console.error("Error fetching user data:", error);
                    this.showNotification('خطأ في تحميل بيانات المستخدم', 'error');
                });

                if (isAuthPage) {
                    window.location.href = 'dashboard.html';
                }
            } else {
                this.currentUser = null;
                this.userData = null;
                if (!isAuthPage) {
                    window.location.href = 'index.html';
                }
            }
        });
    }

    async registerUser(username, email, phone, password) {
        try {
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // إنشاء ملف المستخدم في Firestore
            const newUserProfile = {
                username,
                email,
                phone,
                points: 0,
                totalEarned: 0,
                lastSpin: null,
                watchedAds: [],
                downloadedApps: [],
                withdrawalRequests: [],
                joinDate: firebase.firestore.FieldValue.serverTimestamp(),
                activity: [{ type: 'system', title: 'إنشاء حساب', points: 0, date: new Date().toISOString() }],
                prizeHistory: [],
                paymentMethods: [],
                settings: { notifications: true, email: true, sound: true }
            };

            await this.db.collection('users').doc(user.uid).set(newUserProfile);
            this.showNotification('تم التسجيل بنجاح! جاري تسجيل الدخول...', 'success');
            // onAuthStateChanged سيتولى الباقي
        } catch (error) {
            console.error("Registration Error:", error);
            this.showNotification(this.getFirebaseAuthErrorMessage(error), 'error');
        }
    }

    async loginUser(email, password) {
        try {
            await this.auth.signInWithEmailAndPassword(email, password);
            this.showNotification('تم تسجيل الدخول بنجاح!', 'success');
            // onAuthStateChanged سيتولى الباقي
        } catch (error) {
            console.error("Login Error:", error);
            this.showNotification(this.getFirebaseAuthErrorMessage(error), 'error');
        }
    }

    async logout() {
        await this.auth.signOut();
        // onAuthStateChanged سيتولى الباقي
    }
    
    async deleteAccount() {
        if (!this.currentUser) return;
        try {
            // يمكنك إضافة منطق لحذف بيانات المستخدم من Firestore هنا إذا أردت
            await this.db.collection('users').doc(this.currentUser.uid).delete();
            await this.currentUser.delete();
            this.showNotification('تم حذف الحساب بنجاح.', 'success');
        } catch (error) {
            console.error("Delete Account Error:", error);
            this.showNotification('فشل حذف الحساب. قد تحتاج إلى تسجيل الدخول مرة أخرى.', 'error');
        }
    }

    async addPoints(pointsToAdd, activityType, activityTitle) {
        if (!this.currentUser) return;
        const userRef = this.db.collection('users').doc(this.currentUser.uid);
        
        const newActivity = {
            type: activityType,
            title: activityTitle,
            points: pointsToAdd,
            date: new Date().toISOString()
        };

        try {
            await userRef.update({
                points: firebase.firestore.FieldValue.increment(pointsToAdd),
                totalEarned: firebase.firestore.FieldValue.increment(pointsToAdd),
                activity: firebase.firestore.FieldValue.arrayUnion(newActivity)
            });
            this.showFloatingPoints(`+${pointsToAdd}`);
        } catch (error) {
            console.error("Error adding points:", error);
        }
    }

    // =================================================================
    // PAGE LOADERS
    // =================================================================

    async loadPageData() {
        if (!this.userData) return; // لا تقم بتحميل أي شيء إذا لم تكن بيانات المستخدم جاهزة

        const page = window.location.pathname.split('/').pop();
        switch (page) {
            case 'dashboard.html': this.initDashboardPage(); break;
            case 'apps.html': this.initAppsPage(); break;
            case 'ads.html': this.initAdsPage(); break;
            case 'wheel.html': this.initWheelPage(); break;
            case 'withdraw.html': this.initWithdrawPage(); break;
            case 'profile.html': this.initProfilePage(); break;
        }
    }

    initDashboardPage() {
        this.updateDashboardStats();
        this.animateElements('.stats-card, .quick-action, .chart-container, .bg-white');
    }

    updateDashboardStats() {
        if (!this.userData) return;
        const el = (id) => document.getElementById(id);
        if(el('adsWatched')) el('adsWatched').textContent = this.userData.watchedAds?.length || 0;
        if(el('appsDownloaded')) el('appsDownloaded').textContent = this.userData.downloadedApps?.length || 0;
        const totalEarnedEl = document.querySelector('.total-earned');
        if(totalEarnedEl) totalEarnedEl.textContent = (this.userData.totalEarned * 0.01).toFixed(2); // Assuming 100 points = $1
        // TODO: Implement renderActivity and renderEarningsChart
    }

    initAdsPage() {
        this.updateDailyAdLimit();
    }

    updateDailyAdLimit() {
        // This is a placeholder as AdSense doesn't provide a direct way to track views via JS for rewards.
        // This logic should be handled server-side or with more advanced AdSense APIs if available.
        const dailyAdLimit = 20;
        const watchedToday = 0;
        const remaining = Math.max(0, dailyAdLimit - watchedToday);
        const adsRemainingEl = document.getElementById('adsRemaining');
        const dailyProgressEl = document.getElementById('dailyProgress');

        if(adsRemainingEl) adsRemainingEl.textContent = remaining;
        if(dailyProgressEl) dailyProgressEl.style.width = `${(watchedToday / dailyAdLimit) * 100}%`;
    }

    initWheelPage() {
        this.checkSpinStatus();
    }

    checkSpinStatus() {
        if (!this.userData || !document.getElementById('spinButton')) return;

        const spinButton = document.getElementById('spinButton');
        const countdownDiv = document.getElementById('countdown');
        const timerSpan = document.getElementById('timer');
        const twentyFourHours = 24 * 60 * 60 * 1000;

        const lastSpin = this.userData.lastSpin?.toDate(); // تحويل Timestamp إلى Date
        if (lastSpin && (new Date() - lastSpin < twentyFourHours)) {
            spinButton.disabled = true;
            spinButton.style.display = 'none';
            countdownDiv.style.display = 'inline-block';

            const interval = setInterval(() => {
                const now = new Date();
                const timeRemaining = lastSpin.getTime() + twentyFourHours - now.getTime();
                if (timeRemaining <= 0) {
                    clearInterval(interval);
                    spinButton.disabled = false;
                    spinButton.style.display = 'block';
                    countdownDiv.style.display = 'none';
                } else {
                    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
                    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
                    timerSpan.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                }
            }, 1000);
        } else {
            spinButton.disabled = false;
            spinButton.style.display = 'block';
            countdownDiv.style.display = 'none';
        }
    }

    async spinWheel() {
        if (this.isSpinning || !this.currentUser) return;

        this.isSpinning = true;
        document.getElementById('spinButton').disabled = true;

        // Check last spin time again just before spinning
        const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();
        const lastSpin = userDoc.data().lastSpin?.toDate();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (lastSpin && (new Date() - lastSpin < twentyFourHours)) {
            this.showNotification('لقد قمت بالدوران بالفعل اليوم!', 'warning');
            this.isSpinning = false;
            document.getElementById('spinButton').disabled = false;
            this.checkSpinStatus(); // Re-sync timer
            return;
        }

        const wheel = document.getElementById('fortuneWheel');
        const totalProbability = this.wheelPrizes.reduce((sum, prize) => sum + prize.probability, 0);
        let random = Math.random() * totalProbability;
        let chosenPrize;
        for (const prize of this.wheelPrizes) {
            random -= prize.probability;
            if (random < 0) {
                chosenPrize = prize;
                break;
            }
        }

        const prizeIndex = this.wheelPrizes.indexOf(chosenPrize);
        const degreesPerSection = 360 / this.wheelPrizes.length;
        const randomOffset = (Math.random() - 0.5) * degreesPerSection * 0.8;
        const rotation = 360 * 5 - (prizeIndex * degreesPerSection + randomOffset);

        anime({
            targets: wheel,
            rotate: rotation,
            duration: 4000,
            easing: 'easeOutExpo',
            complete: async () => {
                this.showNotification(`تهانينا! لقد ربحت ${chosenPrize.points} نقطة!`, 'success');
                
                // Update Firestore
                const userRef = this.db.collection('users').doc(this.currentUser.uid);
                await userRef.update({
                    lastSpin: firebase.firestore.FieldValue.serverTimestamp()
                });
                await this.addPoints(chosenPrize.points, 'wheel', `ربح من دولاب الحظ`);

                this.isSpinning = false;
                this.checkSpinStatus();
            }
        });
    }
    
    initAppsPage() {
        // TODO: Implement app loading logic
    }
    
    initWithdrawPage() {
        // TODO: Implement withdrawal logic
    }
    
    initProfilePage() {
        if (!this.userData) return;
        const el = (id) => document.getElementById(id);
        if(el('joinDate')) {
            const joinDate = this.userData.joinDate?.toDate();
            if(joinDate) el('joinDate').textContent = joinDate.toLocaleDateString('ar-SA');
        }
        if(el('totalAds')) el('totalAds').textContent = this.userData.watchedAds?.length || 0;
        if(el('totalApps')) el('totalApps').textContent = this.userData.downloadedApps?.length || 0;
    }

    // =================================================================
    // EVENT LISTENERS
    // =================================================================

    setupEventListeners() {
        document.addEventListener('click', e => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            const actions = {
                'logout': () => this.logout(),
                'toggle-sidebar': () => this.toggleSidebar(),
                'spin-wheel': () => this.spinWheel(),
                'delete-account': () => this.confirmDeleteAccount(),
            };

            if (actions[action]) actions[action]();
            if (e.target.matches('.sidebar-overlay')) this.toggleSidebar();
        });

        document.addEventListener('submit', e => {
            e.preventDefault();
            const form = e.target;
            const action = form.dataset.action;
            if (!action) return;

            const submitActions = {
                'login': () => {
                    const email = form.querySelector('#loginEmail').value;
                    const password = form.querySelector('#loginPassword').value;
                    this.loginUser(email, password);
                },
                'register': () => {
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
                },
            };

            if (submitActions[action]) submitActions[action]();
        });
    }
    
    confirmDeleteAccount() {
        if (confirm("هل أنت متأكد أنك تريد حذف حسابك؟ لا يمكن التراجع عن هذا الإجراء.")) {
            this.deleteAccount();
        }
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
        if (!this.userData) return;
        document.querySelectorAll('.user-points').forEach(el => el.textContent = this.userData.points.toLocaleString('ar-SA'));
        document.querySelectorAll('.username').forEach(el => el.textContent = this.userData.username);
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
    
    showFloatingPoints(text) {
        const floatingEl = document.createElement('div');
        floatingEl.textContent = text;
        floatingEl.className = 'floating-points';
        Object.assign(floatingEl.style, {
            top: `${Math.random() * 50 + 25}%`,
            left: `${Math.random() * 50 + 25}%`,
        });
        document.body.appendChild(floatingEl);
        setTimeout(() => floatingEl.remove(), 2000);
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

    getFirebaseAuthErrorMessage(error) {
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
            case 'auth/email-already-in-use':
                return 'هذا البريد الإلكتروني مسجل بالفعل.';
            case 'auth/weak-password':
                return 'كلمة المرور ضعيفة جدًا. يجب أن تتكون من 6 أحرف على الأقل.';
            case 'auth/invalid-email':
                return 'البريد الإلكتروني غير صالح.';
            default:
                return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // تأكد من تهيئة Firebase قبل إنشاء التطبيق
    if (typeof firebase !== 'undefined') {
        window.moneyApp = new MoneyApp();
    } else {
        console.error("Firebase is not available. App initialization failed.");
        // يمكنك عرض رسالة خطأ للمستخدم هنا
        const body = document.querySelector('body');
        if(body) body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: sans-serif; color: red;"><h1>خطأ فادح</h1><p>فشل الاتصال بالخادم. يرجى التحقق من إعدادات Firebase.</p></div>';
    }
});
