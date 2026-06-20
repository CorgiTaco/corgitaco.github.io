(function () {
    let isCaptchaValid = false;
    let lastSubmittedData = null;

    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwfNepGa30kszlRwtTlADJ41BthdFl4OT9CD63LckVFPVVr8-itJQ-LaRtgyuTXeNr/exec';

    window.onJobCaptchaSuccess = function () {
        isCaptchaValid = true;
        checkReady();
    };

    window.onJobCaptchaExpired = function () {
        isCaptchaValid = false;
        checkReady();
    };

    function checkReady() {
        const form = document.getElementById('job-offer-form');
        const btn  = document.getElementById('job-offer-submit-btn');
        if (!form || !btn) return;
        btn.disabled = !(form.checkValidity() && isCaptchaValid);
    }

    function resetModal() {
        const formView    = document.getElementById('job-offer-form-view');
        const successView = document.getElementById('job-offer-success-view');
        const status      = document.getElementById('job-offer-status');
        const form        = document.getElementById('job-offer-form');
        if (formView)    formView.style.display    = 'block';
        if (successView) successView.style.display = 'none';
        if (status)      status.textContent        = '';
        if (form)        form.reset();
        isCaptchaValid = false;
        if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
        checkReady();
    }

    function openModalUI() {
        const overlay = document.getElementById('job-offer-modal-overlay');
        if (!overlay) return;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModalUI() {
        const overlay = document.getElementById('job-offer-modal-overlay');
        if (!overlay) return;
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(resetModal, 200);
    }

    function openModal() {
        history.pushState(null, '', location.pathname + location.search + '#job-offer');
        openModalUI();
    }

    function closeModal() {
        closeModalUI();
        if (location.hash === '#job-offer') history.replaceState(null, '', location.pathname + location.search);
    }

    // ── Hash routing ──
    function handleJobOfferHash() {
        const hash = location.hash.slice(1);
        const overlay = document.getElementById('job-offer-modal-overlay');
        if (!overlay) return;
        if (hash === 'job-offer' && !overlay.classList.contains('active')) openModalUI();
        if (!hash && overlay.classList.contains('active')) closeModalUI();
    }

    if (window._jobOfferHashHandler) window.removeEventListener('hashchange', window._jobOfferHashHandler);
    window._jobOfferHashHandler = handleJobOfferHash;
    window.addEventListener('hashchange', window._jobOfferHashHandler);

    function init() {
        const openBtn     = document.getElementById('open-job-offer-btn');
        const overlay     = document.getElementById('job-offer-modal-overlay');
        const closeX      = document.getElementById('job-offer-close-x');
        const form        = document.getElementById('job-offer-form');
        const submitBtn   = document.getElementById('job-offer-submit-btn');
        const status      = document.getElementById('job-offer-status');
        const closeSucc   = document.getElementById('job-offer-close-success-btn');

        if (!overlay) return;

        if (openBtn) openBtn.addEventListener('click', openModal);
        if (closeX)  closeX.addEventListener('click', closeModal);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) closeModal();
        });

        if (form) {
            form.addEventListener('input',  checkReady);
            form.addEventListener('change', checkReady);

            form.addEventListener('submit', async e => {
                e.preventDefault();
                if (!isCaptchaValid) return;

                const formData = new FormData(form);
                formData.append('form_type', 'job_offer');

                lastSubmittedData = {
                    name:     formData.get('name'),
                    email:    formData.get('email'),
                    discord:  formData.get('discord'),
                    company:  formData.get('company'),
                    role:     formData.get('role'),
                    job_type: formData.get('job_type'),
                    linkedin: formData.get('linkedin'),
                    message:  formData.get('message'),
                    date:     new Date().toLocaleString()
                };

                submitBtn.disabled     = true;
                submitBtn.textContent  = 'Sending...';
                if (status) status.textContent = '';

                try {
                    const resp   = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
                    const result = await resp.json();
                    if (result.result === 'success') {
                        document.getElementById('job-offer-form-view').style.display    = 'none';
                        document.getElementById('job-offer-success-view').style.display = 'flex';
                    } else {
                        throw new Error(result.error || 'Unknown server error');
                    }
                } catch (err) {
                    console.error('Job offer submission failed:', err);
                    if (status) {
                        status.textContent = 'Failed to send. Please check your connection and try again.';
                        status.style.color = '#ff5f57';
                    }
                    isCaptchaValid = false;
                    if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                    checkReady();
                } finally {
                    submitBtn.disabled    = false;
                    submitBtn.textContent = 'Send Offer';
                }
            });
        }

        if (closeSucc) closeSucc.addEventListener('click', closeModal);

        const downloadBtn = document.getElementById('job-offer-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (!lastSubmittedData) return;

                const discordRow  = lastSubmittedData.discord  ? `\nDiscord Handle: ${lastSubmittedData.discord}`   : '';
                const linkedinRow = lastSubmittedData.linkedin ? `\nLinkedIn / Website: ${lastSubmittedData.linkedin}` : '';

                const receiptText =
`=========================================
        JOB OFFER RECEIPT
=========================================

Date Submitted: ${lastSubmittedData.date}
Name / Handle:  ${lastSubmittedData.name}
Email Address:  ${lastSubmittedData.email}${discordRow}
Company:        ${lastSubmittedData.company}
Role / Position:${lastSubmittedData.role}
Job Type:       ${lastSubmittedData.job_type}${linkedinRow}

-----------------------------------------
DETAILS:
-----------------------------------------
${lastSubmittedData.message}

=========================================
Thank you for your offer!
I will review the details and be in touch soon.
- Corgi Taco`;

                const blob = new Blob([receiptText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const safeName = lastSubmittedData.company.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                a.download = `corgi_taco_job_offer_${safeName}.txt`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
