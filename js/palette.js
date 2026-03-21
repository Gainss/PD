import { state } from './state.js';
import { rgbToHex } from './utils.js';
import { updateStatsWithSort } from './stats.js';

export function initPalette() {
    const palette = window.palette;
    if (!palette) return;
    state.hexToNameMap.clear();
    state.nameToHexMap.clear();
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
        // 空白色块添加特殊样式
        if (item.name === '空白') {
            swatch.style.backgroundImage = 'repeating-linear-gradient(45deg, #ccc 0px, #ccc 2px, #fff 2px, #fff 8px)';
            swatch.style.border = '1px dashed #999';
        }
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

export function switchPalette(type) {
    if (type === 'full') {
        window.palette = window.paletteFull;
    } else if (type === 'light') {
        window.palette = window.paletteLight;
    } else {
        return;
    }
    initPalette();
    renderPaletteGrid('paletteGrid');
    updateStatsWithSort(state.currentSort);
}