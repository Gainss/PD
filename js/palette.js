import { state } from './state.js';
import { rgbToHex, findClosestPaletteColor } from './utils.js';
import { drawFullGrid } from './canvas.js';
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

// 切换色卡类型：'full' 或 'light'，并自动重新匹配当前画布颜色
export function switchPalette(type) {
    if (type === 'full') {
        window.palette = window.paletteFull;
    } else if (type === 'light') {
        window.palette = window.paletteLight;
    } else {
        return;
    }

    // 重新初始化映射
    initPalette();

    // 重新匹配当前画布中的所有颜色到新色卡
    if (state.gridData && state.gridData.length) {
        let changedCount = 0;
        for (let row = 0; row < state.gridHeight; row++) {
            for (let col = 0; col < state.gridWidth; col++) {
                const oldHex = state.gridData[row][col];
                const newHex = findClosestPaletteColor(oldHex);
                if (newHex !== oldHex) {
                    state.gridData[row][col] = newHex;
                    changedCount++;
                }
            }
        }
        if (changedCount > 0) {
            console.log(`色卡切换后，已重新匹配 ${changedCount} 个格子的颜色`);
        }
    }

    // 重新渲染色卡面板
    renderPaletteGrid('paletteGrid');

    // 重新绘制画布（应用新颜色）
    drawFullGrid();

    // 刷新统计面板
    updateStatsWithSort(state.currentSort);
}