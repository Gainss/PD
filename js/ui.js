import { state } from './state.js';
import { clearCanvas } from './canvas.js';
import { updateStatsWithSort } from './stats.js';
import { exportCanvasPNG, exportUsedPalettePNG, exportHistory, importHistory, uploadImage } from './export.js';

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

    updateStatsWithSort(state.currentSort);
}