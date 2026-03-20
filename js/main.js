import { state } from './state.js';
import { initPalette, renderPaletteGrid } from './palette.js';
import { initCanvas } from './canvas.js';
import { initUI } from './ui.js';

// 启动应用
function startApp() {
    if (typeof window.palette === 'undefined') {
        alert('错误：未找到色卡数据文件 color.js');
        return;
    }

    initPalette();
    initCanvas();
    renderPaletteGrid('paletteGrid');
    initUI();
}

startApp();