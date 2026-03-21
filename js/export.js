import { state } from './state.js';
import { getColorStats, sortByNameAsc } from './stats.js';
import { drawFullGrid } from './canvas.js';
import { rgbToHex, findClosestPaletteColor } from './utils.js';

export function exportCanvasPNG() {
    if (!state.canvas) return;
    const link = document.createElement('a');
    link.download = '拼豆图纸.png';
    link.href = state.canvas.toDataURL('image/png');
    link.click();
}

export function exportUsedPalettePNG() {
    const colors = getColorStats(); // 已排除空白
    if (colors.length === 0) {
        alert('没有使用任何颜色');
        return;
    }

    const sorted = [...colors].sort(sortByNameAsc);
    const groups = new Map();
    sorted.forEach(item => {
        const firstChar = item.name ? item.name.charAt(0) : '?';
        const key = /[A-Za-z]/.test(firstChar) ? firstChar.toUpperCase() : firstChar;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    });

    const circleRadius = 24;
    const circleDiameter = circleRadius * 2;
    const margin = 90;
    const rowExtra = 70;
    const topMargin = 70;
    const leftMargin = 50;
    const maxPerRow = 6;

    let totalHeight = topMargin;
    let currentY = topMargin;
    const groupRows = [];

    groups.forEach((groupItems) => {
        const rows = [];
        for (let i = 0; i < groupItems.length; i += maxPerRow) {
            rows.push(groupItems.slice(i, i + maxPerRow));
        }
        groupRows.push({ rows, startY: currentY });
        currentY += rows.length * (circleDiameter + rowExtra);
    });
    totalHeight = currentY;

    const maxRowWidth = maxPerRow * (circleDiameter + margin) - margin + leftMargin * 2;
    const canvasWidth = maxRowWidth;
    const canvasHeight = totalHeight;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvasWidth;
    offCanvas.height = canvasHeight;
    const offCtx = offCanvas.getContext('2d');

    offCtx.fillStyle = '#FFFFFF';
    offCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    offCtx.font = 'bold 35px sans-serif';
    offCtx.fillStyle = '#000000';
    offCtx.textAlign = 'center';
    offCtx.fillText('已用拼豆色卡', canvasWidth / 2, 50);

    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';

    groupRows.forEach(group => {
        const { rows, startY } = group;
        for (let r = 0; r < rows.length; r++) {
            const rowItems = rows[r];
            const rowY = startY + r * (circleDiameter + rowExtra);
            const rowWidth = rowItems.length * (circleDiameter + margin) - margin;
            const startX = (canvasWidth - rowWidth) / 2 + circleRadius;

            for (let c = 0; c < rowItems.length; c++) {
                const item = rowItems[c];
                const cx = startX + c * (circleDiameter + margin);
                const cy = rowY + circleRadius;

                offCtx.beginPath();
                offCtx.arc(cx, cy, circleRadius, 0, 2 * Math.PI);
                offCtx.fillStyle = item.hex;
                offCtx.fill();
                offCtx.strokeStyle = '#000000';
                offCtx.lineWidth = 1;
                offCtx.stroke();

                offCtx.font = 'bold 28px "Courier New", monospace';
                offCtx.fillStyle = '#000000';
                const displayName = item.name || '空白';
                const textY = cy + circleRadius + 30;
                offCtx.fillText(`${displayName} x${item.count}`, cx, textY);
            }
        }
    });

    const link = document.createElement('a');
    link.download = '已用拼豆色卡.png';
    link.href = offCanvas.toDataURL('image/png');
    link.click();
}

export function exportHistory() {
    const nameGrid = state.gridData.map(row =>
        row.map(hex => state.hexToNameMap.get(hex.toUpperCase()))
    );
    const historyData = {
        version: 1,
        width: state.gridWidth,
        height: state.gridHeight,
        colors: nameGrid
    };
    const jsonStr = JSON.stringify(historyData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `拼豆历史_${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

export function importHistory(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.version || !data.width || !data.height || !data.colors) {
                alert('无效的历史文件：缺少必要字段');
                return;
            }
            if (data.width !== state.gridWidth || data.height !== state.gridHeight) {
                alert(`尺寸不匹配：文件为 ${data.width}x${data.height}，当前画布为 ${state.gridWidth}x${state.gridHeight}`);
                return;
            }
            if (!Array.isArray(data.colors) || data.colors.length !== state.gridHeight ||
                !data.colors.every(row => Array.isArray(row) && row.length === state.gridWidth)) {
                alert('颜色数据格式错误');
                return;
            }

            const newGrid = [];
            for (let row = 0; row < state.gridHeight; row++) {
                const newRow = [];
                for (let col = 0; col < state.gridWidth; col++) {
                    const name = data.colors[row][col];
                    const hex = state.nameToHexMap.get(name);
                    if (!hex) {
                        alert(`未知色号：${name}，请检查文件`);
                        return;
                    }
                    newRow.push(hex);
                }
                newGrid.push(newRow);
            }

            state.gridData = newGrid;
            drawFullGrid();
        } catch (err) {
            alert('解析文件失败：' + err.message);
        }
    };
    reader.readAsText(file);
}

export function uploadImage(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            const maxWidth = 400;
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            tempCanvas.width = width;
            tempCanvas.height = height;
            tempCtx.drawImage(img, 0, 0, width, height);
            
            tempCtx.filter = 'blur(0.8px)';
            tempCtx.drawImage(tempCanvas, 0, 0);
            tempCtx.filter = 'none';
            
            const offCanvas = document.createElement('canvas');
            offCanvas.width = state.gridWidth;
            offCanvas.height = state.gridHeight;
            const offCtx = offCanvas.getContext('2d');
            offCtx.drawImage(tempCanvas, 0, 0, state.gridWidth, state.gridHeight);
            
            const imageData = offCtx.getImageData(0, 0, state.gridWidth, state.gridHeight);
            const data = imageData.data;
            for (let row = 0; row < state.gridHeight; row++) {
                for (let col = 0; col < state.gridWidth; col++) {
                    const index = (row * state.gridWidth + col) * 4;
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    const a = data[index + 3];
                    if (a < 128) {
                        state.gridData[row][col] = rgbToHex(255,255,255);
                    } else {
                        const hex = rgbToHex(r, g, b);
                        state.gridData[row][col] = findClosestPaletteColor(hex);
                    }
                }
            }
            drawFullGrid();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}