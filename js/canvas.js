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
    resizeCanvas(state.gridWidth, state.gridHeight);
    bindCanvasEvents();
    drawFullGrid();
}

export function resizeCanvas(width, height) {
    state.gridWidth = width;
    state.gridHeight = height;
    state.canvas.width = width * state.BASE_CELL_SIZE;
    state.canvas.height = height * state.BASE_CELL_SIZE;
    state.canvas.style.width = '100%';
    state.canvas.style.height = 'auto';
    state.gridData = initGridData(width, height);
    drawFullGrid();
}

function bindCanvasEvents() {
    const canvas = state.canvas;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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

    let startTouchX, startTouchY;
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        startTouchX = touch.clientX;
        startTouchY = touch.clientY;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        hasMoved = false;
        longPressTriggered = false;
        state.isDrawing = true;

        if (longPressTimer) clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            e.preventDefault();
            pickColorFromEvent({ clientX: startTouchX, clientY: startTouchY });
            state.isDrawing = false;
        }, 500);
    });

    canvas.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - startTouchX);
        const dy = Math.abs(touch.clientY - startTouchY);

        if (dx < 10 && dy < 10) {
            e.preventDefault();
            if (longPressTriggered) return;
            if (state.isDrawing) {
                handleDraw({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
            }
        } else {
            state.isDrawing = false;
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        if (!hasMoved && !longPressTriggered) {
            const wasDrawing = state.isDrawing;
            state.isDrawing = true;
            handleDraw({ clientX: startTouchX, clientY: startTouchY, preventDefault: () => {} });
            state.isDrawing = wasDrawing;
        }

        state.isDrawing = false;
        hasMoved = false;
        longPressTriggered = false;
    });
}

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
    if (state.clearModeActive) return;
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

    drawGridLines(ctx);

    if (state.showColorNames) {
        drawColorNames(ctx);
    }

    updateStatsWithSort(state.currentSort);
}

function drawGridLines(ctx) {
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
}

export function drawColorNames(ctx) {
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let row = 0; row < state.gridHeight; row++) {
        for (let col = 0; col < state.gridWidth; col++) {
            const hex = state.gridData[row][col];
            const name = state.hexToNameMap.get(hex.toUpperCase());
            if (!name || name === '空白') continue;

            const { r, g, b } = rgbFromHex(hex);
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            ctx.fillStyle = luminance > 186 ? '#000000' : '#FFFFFF';

            const x = col * state.BASE_CELL_SIZE + state.BASE_CELL_SIZE / 2;
            const y = row * state.BASE_CELL_SIZE + state.BASE_CELL_SIZE / 2;
            ctx.fillText(name, x, y);
        }
    }
}

export function clearCanvas() {
    state.gridData = initGridData(state.gridWidth, state.gridHeight);
    drawFullGrid();
}