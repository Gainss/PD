import { state } from './state.js';
import { rgbToHex } from './utils.js';

export function initPalette() {
    const palette = window.palette;
    if (!palette) return;
    palette.forEach(item => {
        const [r, g, b] = item.rgb;
        const hex = rgbToHex(r, g, b);
        state.hexToNameMap.set(hex.toUpperCase(), item.name);
        state.nameToHexMap.set(item.name, hex);
    });
}

export function renderPaletteGrid(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    window.palette.forEach(item => {
        const [r, g, b] = item.rgb;
        const hex = rgbToHex(r, g, b);
        const swatch = document.createElement('div');
        swatch.className = 'palette-swatch';
        swatch.style.backgroundColor = hex;
        swatch.title = `${item.name} (${hex})`;
        swatch.addEventListener('click', () => {
            state.currentColor = hex;
            if (state.currentMode !== 'brush') {
                state.currentMode = 'brush';
                const brushBtn = document.getElementById('brushModeBtn');
                const eraserBtn = document.getElementById('eraserModeBtn');
                if (brushBtn && eraserBtn) {
                    brushBtn.classList.add('active');
                    eraserBtn.classList.remove('active');
                }
            }
        });
        container.appendChild(swatch);
    });
}