import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from "firebase/auth";
import { initFeedbackModal } from "./feedbackHelper";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmKjiQ6H8PuOqDYgyIdKmmDAATHmnqE90",
  authDomain: "food-rescue-b0a7c.firebaseapp.com",
  projectId: "food-rescue-b0a7c",
  storageBucket: "food-rescue-b0a7c.firebasestorage.app",
  messagingSenderId: "500630558105",
  appId: "1:500630558105:web:79fc03f7c54a2460b06f08",
  measurementId: "G-SGTZ8FEHRS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// State
let selectedRole = 'donor'; // 'donor' | 'receiver'

// DOM Elements
const donorTab = document.getElementById('role-donor-tab');
const receiverTab = document.getElementById('role-receiver-tab');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const googleBtn = document.getElementById('google-signin-btn');
const magicLinkBtn = document.getElementById('magic-link-btn');
const authAlert = document.getElementById('auth-alert');
const roleTexts = document.querySelectorAll('.role-text');

// Show alerts/notices
function showAlert(message, type = 'error') {
  if (!authAlert) return;
  authAlert.className = `auth-alert ${type}`;
  authAlert.innerHTML = message;
  authAlert.classList.remove('hidden');
}

function hideAlert() {
  if (!authAlert) return;
  authAlert.classList.add('hidden');
  authAlert.innerHTML = '';
}

// 1. Role Toggle Handler
function setRole(role) {
  selectedRole = role;
  hideAlert();

  if (role === 'donor') {
    donorTab?.classList.add('active');
    receiverTab?.classList.remove('active');
    loginSubmitBtn?.classList.remove('violet');
    loginSubmitBtn?.classList.add('tangerine');
    registerSubmitBtn?.classList.remove('violet');
    registerSubmitBtn?.classList.add('tangerine');
  } else {
    receiverTab?.classList.add('active');
    donorTab?.classList.remove('active');
    loginSubmitBtn?.classList.remove('tangerine');
    loginSubmitBtn?.classList.add('violet');
    registerSubmitBtn?.classList.remove('tangerine');
    registerSubmitBtn?.classList.add('violet');
  }

  roleTexts.forEach(el => {
    el.innerText = role === 'donor' ? 'Donor' : 'Receiver';
  });
}

donorTab?.addEventListener('click', () => setRole('donor'));
receiverTab?.addEventListener('click', () => setRole('receiver'));

// 2. Auth Mode Tab Switcher (Login vs Register)
tabLogin?.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  hideAlert();
});

tabRegister?.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  hideAlert();
});

// Helper: Sync profile to backend MongoDB
async function syncUserProfile(profileData) {
  try {
    const response = await fetch('http://localhost:5000/api/auth/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to sync user profile with backend.');
    }

    const dbUser = await response.json();
    sessionStorage.setItem('user', JSON.stringify(dbUser));
    localStorage.setItem('user', JSON.stringify(dbUser));
    return dbUser;
  } catch (err) {
    console.warn('Backend sync failed, providing safe local session profile:', err.message);
    const existing = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null');
    const fallbackUser = {
      uid: profileData.uid,
      email: profileData.email || (existing ? existing.email : ''),
      role: (existing && existing.role) ? existing.role : (profileData.role || selectedRole || 'donor'),
      name: profileData.name || (existing && existing.name) || (profileData.email ? profileData.email.split('@')[0] : 'Contributor'),
      phone: profileData.phone || (existing && existing.phone) || '',
      organizationName: profileData.organizationName || (existing && existing.organizationName) || 'Community Contributor',
      organizationType: profileData.organizationType || (existing && existing.organizationType) || '',
      address: profileData.address || (existing && existing.address) || '',
      city: profileData.city || (existing && existing.city) || '',
      _fallback: true
    };
    sessionStorage.setItem('user', JSON.stringify(fallbackUser));
    localStorage.setItem('user', JSON.stringify(fallbackUser));
    return fallbackUser;
  }
}

// Helper: Redirect to dashboard
function navigateToDashboard(role) {
  window.location.href = role === 'donor' ? '/donor.html' : '/receiver.html';
}

// 3. Handle Registration
registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const name = document.getElementById('reg-name')?.value.trim();
  const phone = document.getElementById('reg-phone')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim();
  const password = document.getElementById('reg-password')?.value;
  const organizationName = document.getElementById('reg-org-name')?.value.trim();
  const organizationType = document.getElementById('reg-org-type')?.value;
  const address = document.getElementById('reg-address')?.value.trim();
  const city = document.getElementById('reg-city')?.value.trim();

  if (!name || !email || !password || !organizationName) {
    showAlert('Please fill in all required fields.');
    return;
  }

  registerSubmitBtn.disabled = true;
  registerSubmitBtn.innerText = 'Creating Account...';

  try {
    // 1. Create user in Firebase
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Sync full organization details to MongoDB
    await syncUserProfile({
      uid: user.uid,
      email: email,
      role: selectedRole,
      name: name,
      phone: phone,
      organizationName: organizationName,
      organizationType: organizationType,
      address: address,
      city: city,
      isRegistration: true
    });

    showAlert('Account created successfully! Entering dashboard...', 'success');
    setTimeout(() => navigateToDashboard(selectedRole), 800);
  } catch (error) {
    console.error('Registration Error:', error);
    let msg = error.message;
    if (error.code === 'auth/email-already-in-use') {
      msg = 'This email address is already registered. Please sign in instead.';
    } else if (error.code === 'auth/weak-password') {
      msg = 'Password should be at least 6 characters.';
    }
    showAlert(msg, 'error');
  } finally {
    registerSubmitBtn.disabled = false;
    registerSubmitBtn.innerHTML = `Create <span class="role-text">${selectedRole === 'donor' ? 'Donor' : 'Receiver'}</span> Account`;
  }
});

// 4. Handle Email/Password Login
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    showAlert('Please enter both email and password.');
    return;
  }

  loginSubmitBtn.disabled = true;
  loginSubmitBtn.innerText = 'Verifying Credentials...';

  try {
    // 1. Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Fetch or sync profile from MongoDB
    const dbUser = await syncUserProfile({
      uid: user.uid,
      email: email,
      role: selectedRole,
      isRegistration: false
    });

    const targetRole = dbUser.role || selectedRole;
    showAlert(`Welcome back, ${dbUser.name || 'User'}! Loading dashboard...`, 'success');
    setTimeout(() => navigateToDashboard(targetRole), 600);
  } catch (error) {
    console.error('Login Error:', error);
    let msg = error.message;
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      msg = 'Invalid email or password. Please verify your credentials.';
    }
    showAlert(msg, 'error');
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.innerHTML = `Sign In as <span class="role-text">${selectedRole === 'donor' ? 'Donor' : 'Receiver'}</span>`;
  }
});

// 5. Handle Google Sign-In
googleBtn?.addEventListener('click', async () => {
  hideAlert();
  googleBtn.disabled = true;

  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Sync profile to MongoDB
    const dbUser = await syncUserProfile({
      uid: user.uid,
      email: user.email,
      role: selectedRole,
      name: user.displayName || 'Google Account Contributor',
      organizationName: user.displayName ? `${user.displayName}'s Organization` : 'Community Partner'
    });

    showAlert(`Google Sign-In Successful! Redirecting...`, 'success');
    setTimeout(() => navigateToDashboard(dbUser.role || selectedRole), 600);
  } catch (error) {
    console.error('Google Auth Error:', error);
    if (error.code !== 'auth/popup-closed-by-user') {
      showAlert(`Google Sign-In Error: ${error.message}`, 'error');
    }
  } finally {
    googleBtn.disabled = false;
  }
});

// 6. Handle Passwordless Email Link Login (Magic Link)
magicLinkBtn?.addEventListener('click', async () => {
  hideAlert();
  let email = document.getElementById('login-email')?.value.trim();

  if (!email) {
    email = window.prompt('Please enter your email to receive a passwordless sign-in link:');
    if (!email) return;
  }

  const actionCodeSettings = {
    url: window.location.origin + window.location.pathname,
    handleCodeInApp: true
  };

  magicLinkBtn.disabled = true;
  magicLinkBtn.innerText = 'Sending Link...';

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    window.localStorage.setItem('roleForSignIn', selectedRole);

    showAlert(
      `✉ Sign-in link sent to <strong>${email}</strong>! Please check your inbox (or spam) and click the link to log in.`,
      'success'
    );
  } catch (error) {
    console.error('Magic Link Error:', error);
    showAlert(`Error sending sign-in link: ${error.message}`, 'error');
  } finally {
    magicLinkBtn.disabled = false;
    magicLinkBtn.innerHTML = `
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
      Email Sign-In Link (Passwordless)
    `;
  }
});

// 7. Check if returning from Email Link
async function checkEmailLinkSignIn() {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    let role = window.localStorage.getItem('roleForSignIn') || 'donor';

    if (!email) {
      email = window.prompt('Please confirm your email address to complete sign in:');
    }

    if (email) {
      showAlert('Authenticating with Email Link...', 'info');
      try {
        const result = await signInWithEmailLink(auth, email, window.location.href);
        const user = result.user;
        window.localStorage.removeItem('emailForSignIn');
        window.localStorage.removeItem('roleForSignIn');

        const dbUser = await syncUserProfile({
          uid: user.uid,
          email: user.email || email,
          role: role,
          name: email.split('@')[0]
        });

        showAlert('Sign-in successful! Loading your dashboard...', 'success');
        setTimeout(() => navigateToDashboard(dbUser.role || role), 800);
      } catch (err) {
        console.error('Email link error:', err);
        showAlert(`Failed to sign in with link: ${err.message}`, 'error');
      }
    }
  }
}

checkEmailLinkSignIn();

// 8. Initialize Feedback Modal for Landing Page
initFeedbackModal();
