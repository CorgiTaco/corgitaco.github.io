(function () {
    let isCaptchaValid = false;
    let lastSubmittedData = null;

    // Google Apps Script URL
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzDptrZUUksfszdFZ--buL11BLr7rkgazI27WahaCH4PQYzgSFZeQwKX0RCZdRxRHzn/exec';

    // ── Global reCAPTCHA Callbacks ──
    window.onCaptchaSuccess = function() {
        isCaptchaValid = true;
        checkFormReadyState();
    };

    window.onCaptchaExpired = function() {
        isCaptchaValid = false;
        checkFormReadyState();
    };

    // ── Validation Logic ──
    function checkFormReadyState() {
        const form = document.getElementById("commission-form");
        const submitBtn = document.getElementById("commission-submit-btn");

        if (!form || !submitBtn) return;

        if (form.checkValidity() && isCaptchaValid) {
            submitBtn.disabled = false;
        } else {
            submitBtn.disabled = true;
        }
    }

    // ── Modal Handling ──
    function resetModalView() {
        const formView = document.getElementById('commission-form-view');
        const successView = document.getElementById('commission-success-view');
        const statusMessage = document.getElementById('commission-status');
        const form = document.getElementById('commission-form');
        const otherTypeGroup = document.getElementById('other-type-group');
        const otherTypeInput = document.getElementById('other-type');

        if (formView && successView) {
            formView.style.display = 'block';
            successView.style.display = 'none';
        }
        if (statusMessage) statusMessage.textContent = '';
        if (form) form.reset();

        if (otherTypeGroup) otherTypeGroup.style.display = 'none';
        if (otherTypeInput) otherTypeInput.required = false;

        // Force a validity check reset
        isCaptchaValid = false;
        if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
        checkFormReadyState();
    }

    function openModalUI() {
        const overlay = document.getElementById('commission-modal-overlay');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModalUI() {
        const overlay = document.getElementById('commission-modal-overlay');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(resetModalView, 200);
    }

    function openModal() {
        history.pushState(null, '', location.pathname + location.search + '#commission');
        openModalUI();
    }

    function closeModal() {
        closeModalUI();
        if (location.hash === '#commission') history.replaceState(null, '', location.pathname + location.search);
    }

    // ── Hash routing ──
    function handleCommissionHash() {
        const hash = location.hash.slice(1);
        const overlay = document.getElementById('commission-modal-overlay');
        if (!overlay) return;
        if (hash === 'commission' && !overlay.classList.contains('active')) openModalUI();
        if (!hash && overlay.classList.contains('active')) closeModalUI();
    }

    if (window._commissionHashHandler) window.removeEventListener('hashchange', window._commissionHashHandler);
    window._commissionHashHandler = handleCommissionHash;
    window.addEventListener('hashchange', window._commissionHashHandler);

    // ── Main Initialization ──
    function initCommissionLogic() {
        const overlay = document.getElementById('commission-modal-overlay');
        const openBtn   = document.getElementById('open-commission-btn');
        const closeX    = document.getElementById('commission-close-x');
        const backBtn   = document.getElementById('commission-back-btn');
        const form = document.getElementById('commission-form');
        const submitBtn = document.getElementById('commission-submit-btn');
        const statusMessage = document.getElementById('commission-status');
        const commissionTypeSelect = document.getElementById('commission-type');
        const otherTypeGroup = document.getElementById('other-type-group');
        const otherTypeInput = document.getElementById('other-type');
        const closeSuccessBtn = document.getElementById('commission-close-success-btn');
        const downloadBtn = document.getElementById('commission-download-btn');

        if (!overlay) return;

        // Bind form interactions to validity check
        form.addEventListener("input", checkFormReadyState);
        form.addEventListener("change", checkFormReadyState);

        // Toggle "Other" specification field
        if (commissionTypeSelect) {
            commissionTypeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'other.') {
                    otherTypeGroup.style.display = 'block';
                    otherTypeInput.required = true;
                } else {
                    otherTypeGroup.style.display = 'none';
                    otherTypeInput.required = false;
                    otherTypeInput.value = ''; // clear it out
                }
                checkFormReadyState();
            });
        }

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (backBtn) backBtn.addEventListener('click', closeModal);
        closeX.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) closeModal();
        });

        // Form Submit
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                // Extra safety check in case they hacked the disabled button
                if (!isCaptchaValid) return;

                const formData = new FormData(form);

                let cType = formData.get('commission_type');
                if (cType === 'other.') {
                    cType = `other. (${formData.get('other_type')})`;
                }

                lastSubmittedData = {
                    name: formData.get('name'),
                    email: formData.get('email'),
                    discord: formData.get('discord'),
                    commission_type: cType,
                    message: formData.get('message'),
                    date: new Date().toLocaleString()
                };

                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
                statusMessage.textContent = '';

                try {
                    const response = await fetch(SCRIPT_URL, {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();

                    if (result.result === 'success') {
                        document.getElementById('commission-form-view').style.display = 'none';
                        document.getElementById('commission-success-view').style.display = 'flex';
                    } else {
                        throw new Error(result.error || 'Unknown server error');
                    }

                } catch (error) {
                    console.error('Submission failed:', error);
                    statusMessage.textContent = error.message.includes('reCAPTCHA')
                        ? error.message
                        : 'Failed to send request. Please check your connection and try again.';
                    statusMessage.style.color = '#ff5f57';

                    isCaptchaValid = false;
                    if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                    checkFormReadyState();

                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Send Request';
                }
            });
        }

        if (closeSuccessBtn) {
            closeSuccessBtn.addEventListener('click', closeModal);
        }

        // Receipt Generation
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (!lastSubmittedData) return;

                const discordRow = lastSubmittedData.discord ? `\nDiscord Handle: ${lastSubmittedData.discord}` : '';

                const receiptText =
                    `=========================================
      COMMISSION REQUEST RECEIPT
=========================================

Date Submitted: ${lastSubmittedData.date}
Name / Handle:  ${lastSubmittedData.name}
Email Address:  ${lastSubmittedData.email}${discordRow}
Discord:        ${lastSubmittedData.discord || 'N/A'}
Request Type:   ${lastSubmittedData.commission_type}

-----------------------------------------
COMMISSION DETAILS:
-----------------------------------------
${lastSubmittedData.message}

=========================================
Thank you for your request! 
I will review the details and be in touch soon.
- Corgi Taco (commissions@corgitaco.dev)`;

                const blob = new Blob([receiptText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                const safeName = lastSubmittedData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                a.download = `corgi_taco_commission_${safeName}.txt`;

                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            });
        }
    }

    // Run when the DOM is fully parsed
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCommissionLogic);
    } else {
        initCommissionLogic();
    }
})();