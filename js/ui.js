import { state } from './state.js';
import { clearCanvas } from './canvas.js';
import { updateStatsWithSort } from './stats.js';
import { exportCanvasPNG, exportUsedPalettePNG, exportHistory, importHistory, uploadImage } from './export.js';
import { simplifyColors } from './simplify.js';
import { switchPalette } from './palette.js';

export function initUI() {
    const brushBtn = document.getElementById('brushModeBtn');
    const eraserBtn = document.getElementById('eraserModeBtn');

    brushBtn?.addEventListener('click', () => {
        state.currentMode = 'brush';
        brushBtn.classList.add('active');
        eraserBtn.classList.remove('active');
    });

    eraserBtn?.addEventListener('click', () => {
        state.currentMode = 'eraser';
        eraserBtn.classList.add('active');
        brushBtn.classList.remove('active');
    });

    document.getElementById('clearBtn')?.addEventListener('click', () => {
        clearCanvas();
    });

    document.getElementById('exportBtn')?.addEventListener('click', exportCanvasPNG);
    document.getElementById('exportUsedPaletteBtn')?.addEventListener('click', exportUsedPalettePNG);
    document.getElementById('exportHistoryBtn')?.addEventListener('click', exportHistory);

    const importHistoryInput = document.getElementById('importHistoryInput');
    document.getElementById('importHistoryBtn')?.addEventListener('click', () => importHistoryInput.click());
    importHistoryInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importHistory(file);
            importHistoryInput.value = '';
        }
    });

    const fileInput = document.getElementById('imageUpload');
    document.getElementById('uploadBtn')?.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadImage(file);
            fileInput.value = '';
        }
    });

    const sortCountBtn = document.getElementById('sortByCountDesc');
    const sortNameBtn = document.getElementById('sortByNameAsc');

    sortCountBtn?.addEventListener('click', () => {
        state.currentSort = 'count-desc';
        updateStatsWithSort(state.currentSort);
    });

    sortNameBtn?.addEventListener('click', () => {
        state.currentSort = 'name-asc';
        updateStatsWithSort(state.currentSort);
    });

    // 简化颜色按钮
    const simplifyBtn = document.getElementById('simplifyBtn');
    if (simplifyBtn) {
        simplifyBtn.addEventListener('click', async () => {
            const target = prompt('请输入目标颜色数量（建议 1~100）', '16');
            if (target === null) return;
            const num = parseInt(target, 10);
            if (isNaN(num) || num < 1) {
                alert('请输入有效的数字（>=1）');
                return;
            }
            try {
                await simplifyColors(num);
            } catch (error) {
                console.error('简化颜色出错:', error);
                alert('简化颜色时发生错误，请查看控制台。');
            }
        });
    }

    // 色卡切换按钮
    const fullBtn = document.getElementById('paletteFullBtn');
    const lightBtn = document.getElementById('paletteLightBtn');
    
    if (fullBtn) {
        fullBtn.addEventListener('click', () => {
            switchPalette('full');
            fullBtn.classList.add('active');
            lightBtn.classList.remove('active');
            // 可选：提示用户
            alert('已切换到完整版色卡（234色）');
        });
    }
    
    if (lightBtn) {
        lightBtn.addEventListener('click', () => {
            switchPalette('light');
            lightBtn.classList.add('active');
            fullBtn.classList.remove('active');
            alert('已切换到精简版色卡（132色）');
        });
    }

    updateStatsWithSort(state.currentSort);
}