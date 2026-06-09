// Wait for the DOM to load before targeting the element
document.addEventListener("DOMContentLoaded", () => {
    window.vantaEffect = VANTA.WAVES({
        el: '#vanta-bg', // Vanta can take the ID string directly
        mouseControls: true,
        touchControls: true,
        gyroControls: true,
        minHeight: 200,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x08200c, // Fixed: Added the leading 0 for a valid 6-digit hex
        shininess: 22.00,
        waveHeight: 23.50,
        waveSpeed: 0.65,
        zoom: 0.75
    });
});
