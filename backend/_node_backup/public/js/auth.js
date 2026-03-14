/**
 * KEEP-Up Authentication Module
 * Handles login state and user management
 * ENFORCES: All pages except login.html require authentication
 */

class KeepUpAuth {
    constructor() {
        this.user = null;
        this.token = null;
        this.loadSession();
        this.enforceLogin();
    }

    loadSession() {
        const session = localStorage.getItem('keepup_session') || sessionStorage.getItem('keepup_session');
        if (session) {
            try {
                const data = JSON.parse(session);
                this.user = data.user;
                this.token = data.token;
                console.log('✅ Session loaded for:', this.user.username);
            } catch (e) {
                console.log('⚠️ Invalid session data');
                this.logout();
            }
        }
    }

    enforceLogin() {
        const pathname = window.location.pathname;
        const filename = pathname.split('/').pop() || 'index.html';
        
        // Pages that don't require login
        const publicPages = ['login.html', 'index.html', ''];
        
        // If trying to access a protected page without login, redirect
        if (!publicPages.includes(filename) && !this.isLoggedIn()) {
            console.warn('❌ Access denied - redirecting to login');
            window.location.href = '/login.html?redirect=' + encodeURIComponent(pathname);
        }
    }

    isLoggedIn() {
        return !!(this.user && this.token);
    }

    getUser() {
        return this.user;
    }

    getToken() {
        return this.token;
    }

    saveSession(user, token) {
        this.user = user;
        this.token = token;
        const sessionData = { user, token, loginTime: new Date().getTime() };
        localStorage.setItem('keepup_session', JSON.stringify(sessionData));
        sessionStorage.setItem('keepup_session', JSON.stringify(sessionData));
        console.log('✅ Session saved for:', user.username);
    }

    logout() {
        console.log('👋 User logged out');
        this.user = null;
        this.token = null;
        localStorage.removeItem('keepup_session');
        sessionStorage.removeItem('keepup_session');
        window.location.href = '/login.html';
    }

    requireLogin() {
        if (!this.isLoggedIn()) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        }
    }

    getAuthHeader() {
        return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
    }
}

// Initialize auth immediately (before DOM)
window.Auth = new KeepUpAuth();
