import { state } from './state.js';
import { clearCanvas, resizeCanvas, drawFullGrid } from './canvas.js';
import { updateStatsWithSort } from './stats.js';
import { exportCanvasPNG, exportUsedPalettePNG, exportHistory, importHistory, uploadImage } from './export.js';
import { simplifyColors, clearBackground, mergeRareColors } from './simplify.js';
import { switchPalette } from './palette.js';

let hasShownClearBgTip = false;

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

    const fullBtn = document.getElementById('paletteFullBtn');
    const lightBtn = document.getElementById('paletteLightBtn');
    if (fullBtn && lightBtn) {
        fullBtn.addEventListener('click', () => {
            switchPalette('full');
            fullBtn.classList.add('active');
            lightBtn.classList.remove('active');
            alert('已切换到完整版色卡（234色）');
        });
        lightBtn.addEventListener('click', () => {
            switchPalette('light');
            lightBtn.classList.add('active');
            fullBtn.classList.remove('active');
            alert('已切换到精简版色卡（132色）');
        });
    }

    // 画板尺寸切换
    const size52Btn = document.getElementById('size52Btn');
    const size104Btn = document.getElementById('size104Btn');
    const sizeDisplaySpan = document.getElementById('sizeDisplay');
    if (size52Btn && size104Btn) {
        size52Btn.addEventListener('click', () => {
            if (state.currentGridSize === '52') return;
            if (confirm('切换画板大小将清空当前图纸，确定吗？')) {
                state.currentGridSize = '52';
                resizeCanvas(52, 52);
                size52Btn.classList.add('active-size');
                size104Btn.classList.remove('active-size');
                sizeDisplaySpan.textContent = '52x52 · 全格显色号';
                updateStatsWithSort(state.currentSort);
            }
        });
        size104Btn.addEventListener('click', () => {
            if (state.currentGridSize === '104') return;
            if (confirm('切换画板大小将清空当前图纸，确定吗？')) {
                state.currentGridSize = '104';
                resizeCanvas(104, 104);
                size104Btn.classList.add('active-size');
                size52Btn.classList.remove('active-size');
                sizeDisplaySpan.textContent = '104x104 · 全格显色号';
                updateStatsWithSort(state.currentSort);
            }
        });
        if (state.currentGridSize === '52') {
            size52Btn.classList.add('active-size');
            size104Btn.classList.remove('active-size');
        } else {
            size104Btn.classList.add('active-size');
            size52Btn.classList.remove('active-size');
        }
    }

    // 显示色号开关
    const toggle = document.getElementById('showColorNamesToggle');
    if (toggle) {
        toggle.checked = state.showColorNames;
        toggle.addEventListener('change', (e) => {
            state.showColorNames = e.target.checked;
            drawFullGrid(); // 重新绘制以更新显示
        });
    }

    const clearBgBtn = document.getElementById('clearBackgroundBtn');
    if (clearBgBtn) {
        clearBgBtn.addEventListener('click', () => {
            state.clearModeActive = true;
            clearBgBtn.classList.add('active');
            if (!hasShownClearBgTip) {
                alert('请点击画布上要清除的背景区域（与该颜色连通的区域将变为空白）');
                hasShownClearBgTip = true;
            }
        });

        const canvas = state.canvas;
        const handleCanvasClick = (e) => {
            if (!state.clearModeActive) return;
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            let clientX, clientY;
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            const mouseX = (clientX - rect.left) * scaleX;
            const mouseY = (clientY - rect.top) * scaleY;
            const col = Math.floor(mouseX / state.BASE_CELL_SIZE);
            const row = Math.floor(mouseY / state.BASE_CELL_SIZE);
            if (row >= 0 && row < state.gridHeight && col >= 0 && col < state.gridWidth) {
                clearBackground(row, col);
            }
            state.clearModeActive = false;
            clearBgBtn.classList.remove('active');
        };
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('touchstart', (e) => {
            if (state.clearModeActive) {
                e.preventDefault();
                handleCanvasClick(e);
            }
        });
    }

    const mergeRareBtn = document.getElementById('mergeRareBtn');
    if (mergeRareBtn) {
        mergeRareBtn.addEventListener('click', () => {
            const minCount = prompt('请输入最小使用数量阈值（低于此值的颜色将被合并）', '5');
            if (minCount === null) return;
            const threshold = parseInt(minCount, 10);
            if (isNaN(threshold) || threshold < 1) {
                alert('请输入有效的数字（>=1）');
                return;
            }
            mergeRareColors(threshold);
        });
    }

    updateStatsWithSort(state.currentSort);
}