import { state } from './state.js';
import { rgbToHex, rgbFromHex, findClosestPaletteColor, initGridData } from './utils.js';
import { updateStatsWithSort } from './stats.js';

let longPressTimer = null;
let touchStartX = 0, touchStartY = 0;
let hasMoved = false;
let longPressTriggered = false;

export function initCanvas() {
    state.canvas = document.getElementById('pixelCanvas');
    if (!state.canvas) return;
    state.ctx = state.canvas.getContext('2d');

    state.canvas.width = state.gridWidth * state.BASE_CELL_SIZE;
    state.canvas.height = state.gridHeight * state.BASE_CELL_SIZE;
    state.canvas.style.width = '100%';
    state.canvas.style.height = 'auto';

    state.gridData = initGridData(state.gridWidth, state.gridHeight);

    bindCanvasEvents();
    drawFullGrid();
}

function bindCanvasEvents() {
    const canvas = state.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 鼠标事件（PC）
    canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (e.button === 0) {
            state.isDrawing = true;
            handleDraw(e);
        } else if (e.button === 2) {
            pickColorFromEvent(e);
        }
    });

    canvas.addEventListener('mousemove', handleDraw);
    window.addEventListener('mouseup', () => { state.isDrawing = false; });
    canvas.addEventListener('mouseleave', () => { state.isDrawing = false; });

    // ========== 移动端触摸事件（重新设计） ==========
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        hasMoved = false;
        longPressTriggered = false;
        state.isDrawing = true; // 允许连续绘制

        // 启动长按计时器
        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
            // 长按触发：吸取颜色，不绘制
            longPressTriggered = true;
            pickColorFromEvent({ clientX: touchStartX, clientY: touchStartY });
            // 吸取后，阻止后续绘制操作
            state.isDrawing = false;
        }, 500);
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);

        // 移动距离超过 5px 视为拖动，取消长按
        if (dx > 5 || dy > 5) {
            hasMoved = true;
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }

        // 如果长按已触发，忽略后续绘制
        if (longPressTriggered) return;

        // 拖动绘制
        if (state.isDrawing) {
            handleDraw({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
        }
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        // 清除长按计时器
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        // 如果没有移动且长按未触发 → 视为点击，执行一次绘制
        if (!hasMoved && !longPressTriggered) {
            // 临时确保绘制状态
            const wasDrawing = state.isDrawing;
            state.isDrawing = true;
            handleDraw({ clientX: touchStartX, clientY: touchStartY, preventDefault: () => {} });
            state.isDrawing = wasDrawing;
        }

        // 重置状态
        state.isDrawing = false;
        hasMoved = false;
        longPressTriggered = false;
    });
}

// 根据事件坐标吸取颜色
function pickColorFromEvent(e) {
    const rect = state.canvas.getBoundingClientRect();
    const scaleX = state.canvas.width / rect.width;
    const scaleY = state.canvas.height / rect.height;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const mouseX = (clientX - rect.left) * scaleX;
    const mouseY = (clientY - rect.top) * scaleY;
    const col = Math.floor(mouseX / state.BASE_CELL_SIZE);
    const row = Math.floor(mouseY / state.BASE_CELL_SIZE);
    if (row >= 0 && row < state.gridHeight && col >= 0 && col < state.gridWidth) {
        state.currentColor = state.gridData[row][col];
    }
}

function handleDraw(e) {
    if (!state.isDrawing) return;
    e.preventDefault();

    const rect = state.canvas.getBoundingClientRect();
    const scaleX = state.canvas.width / rect.width;
    const scaleY = state.canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(mouseX / state.BASE_CELL_SIZE);
    const row = Math.floor(mouseY / state.BASE_CELL_SIZE);

    if (row >= 0 && row < state.gridHeight && col >= 0 && col < state.gridWidth) {
        let newColor;
        if (state.currentMode === 'brush') {
            newColor = findClosestPaletteColor(state.currentColor);
        } else {
            newColor = rgbToHex(255,255,255);
        }
        if (state.gridData[row][col] !== newColor) {
            state.gridData[row][col] = newColor;
            drawFullGrid();
        }
    }
}

export function drawFullGrid() {
    if (!state.gridData.length) return;
    const ctx = state.ctx;
    ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);

    for (let row = 0; row < state.gridHeight; row++) {
        for (let col = 0; col < state.gridWidth; col++) {
            ctx.fillStyle = state.gridData[row][col];
            ctx.fillRect(col * state.BASE_CELL_SIZE, row * state.BASE_CELL_SIZE, state.BASE_CELL_SIZE, state.BASE_CELL_SIZE);
        }
    }

    ctx.beginPath();
    ctx.strokeStyle = '#c0b6a8';
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= state.gridWidth; i++) {
        ctx.moveTo(i * state.BASE_CELL_SIZE, 0);
        ctx.lineTo(i * state.BASE_CELL_SIZE, state.canvas.height);
    }
    for (let i = 0; i <= state.gridHeight; i++) {
        ctx.moveTo(0, i * state.BASE_CELL_SIZE);
        ctx.lineTo(state.canvas.width, i * state.BASE_CELL_SIZE);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#9a8b7c';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, state.canvas.width, state.canvas.height);

    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let row = 0; row < state.gridHeight; row++) {
        for (let col = 0; col < state.gridWidth; col++) {
            const hex = state.gridData[row][col];
            const name = state.hexToNameMap.get(hex.toUpperCase());
            if (!name) continue;

            const { r, g, b } = rgbFromHex(hex);
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            ctx.fillStyle = luminance > 186 ? '#000000' : '#FFFFFF';

            const x = col * state.BASE_CELL_SIZE + state.BASE_CELL_SIZE / 2;
            const y = row * state.BASE_CELL_SIZE + state.BASE_CELL_SIZE / 2;
            ctx.fillText(name, x, y);
        }
    }

    updateStatsWithSort(state.currentSort);
}

export function clearCanvas() {
    state.gridData = initGridData(state.gridWidth, state.gridHeight);
    drawFullGrid();
}