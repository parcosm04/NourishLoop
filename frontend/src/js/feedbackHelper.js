/**
 * Feedback modal handler and submission pipeline.
 */
export function initFeedbackModal(currentUser = null) {
    const modal = document.getElementById('feedback-modal');
    if (!modal) return;

    const openBtns = [
        document.getElementById('open-feedback-btn'),
        document.getElementById('open-landing-feedback')
    ].filter(Boolean);

    const closeBtn = document.getElementById('close-feedback-modal');
    const form = document.getElementById('feedback-form');
    const statusEl = document.getElementById('fb-status');
    const submitBtn = document.getElementById('fb-submit-btn');

    // Pre-fill user data if authenticated
    function prefillUser() {
        if (!currentUser) return;
        const nameInput = document.getElementById('fb-name');
        const emailInput = document.getElementById('fb-email');
        const phoneInput = document.getElementById('fb-phone');
        const orgInput = document.getElementById('fb-org');

        if (nameInput && currentUser.name) nameInput.value = currentUser.name;
        if (emailInput && currentUser.email) emailInput.value = currentUser.email;
        if (phoneInput && currentUser.phone) phoneInput.value = currentUser.phone;
        if (orgInput && currentUser.organizationName) orgInput.value = currentUser.organizationName;
    }

    openBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            prefillUser();
            modal.classList.remove('hidden');
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            if (statusEl) {
                statusEl.classList.add('hidden');
                statusEl.innerHTML = '';
            }
        });
    }

    // Close on outer backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('fb-name')?.value.trim();
            const email = document.getElementById('fb-email')?.value.trim();
            const phone = document.getElementById('fb-phone')?.value.trim();
            const organizationName = document.getElementById('fb-org')?.value.trim();
            const category = document.getElementById('fb-category')?.value;
            const rating = document.getElementById('fb-rating')?.value;
            const message = document.getElementById('fb-message')?.value.trim();

            if (!name || !email || !message) {
                alert('Please fill out all required fields.');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Submitting & Dispatching Email...';
            }

            try {
                const response = await fetch('http://localhost:5000/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: currentUser?._id || null,
                        name,
                        email,
                        phone,
                        organizationName,
                        role: currentUser?.role || 'general',
                        category,
                        rating: Number(rating),
                        message
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    if (statusEl) {
                        statusEl.className = 'fb-status success';
                        let statusHtml = `
              <strong>✓ Feedback Received!</strong>
              <p>A full copy containing all details you filled has been emailed to <strong>${email}</strong> for your review.</p>
            `;
                        if (data.emailPreviewUrl) {
                            statusHtml += `
                <p><a href="${data.emailPreviewUrl}" target="_blank" rel="noopener noreferrer" class="test-email-link">
                  ✉ Click here to preview the sent email receipt (Test Inbox) &rarr;
                </a></p>
              `;
                        }
                        statusEl.innerHTML = statusHtml;
                        statusEl.classList.remove('hidden');
                    }

                    form.reset();
                    prefillUser();
                } else {
                    throw new Error(data.error || 'Failed to submit feedback.');
                }
            } catch (err) {
                console.error('Feedback error:', err);
                if (statusEl) {
                    statusEl.className = 'fb-status error';
                    statusEl.innerHTML = `<strong>Submission Error:</strong> ${err.message}`;
                    statusEl.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Submit & Email Me A Copy';
                }
            }
        });
    }
}

/**
 * Attaches logout handler to clean sessions.
 */
export function setupLogout(auth, signOutFunc) {
    const logoutBtn = document.getElementById('logout-btn');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async () => {
        try {
            if (auth && signOutFunc) {
                await signOutFunc(auth);
            }
        } catch (e) {
            console.warn('SignOut warning:', e);
        }
        sessionStorage.removeItem('user');
        localStorage.removeItem('user');
        window.location.href = '/';
    });
}
