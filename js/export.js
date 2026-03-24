import { state } from './state.js';
import { getColorStats, sortByNameAsc } from './stats.js';
import { drawFullGrid } from './canvas.js';
import { rgbToHex, rgbFromHex, findClosestPaletteColor } from './utils.js';
import { kMeans } from './simplify.js';

/**
 * 导出现有图纸为 PNG（放大 2 倍，文字清晰）
 */
export function exportCanvasPNG() {
    if (!state.canvas) return;

    const scale = 2;                     // 放大倍数
    const originalCellSize = state.BASE_CELL_SIZE; // 20px
    const scaledCellSize = originalCellSize * scale;

    const width = state.gridWidth * scaledCellSize;
    const height = state.gridHeight * scaledCellSize;

    // 创建离屏画布
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');

    // 禁用图像平滑，保持像素锐利
    offCtx.imageSmoothingEnabled = false;

    // 1. 绘制所有颜色格子（使用放大后的坐标）
    for (let row = 0; row < state.gridHeight; row++) {
        for (let col = 0; col < state.gridWidth; col++) {
            offCtx.fillStyle = state.gridData[row][col];
            offCtx.fillRect(
                col * scaledCellSize,
                row * scaledCellSize,
                scaledCellSize,
                scaledCellSize
            );
        }
    }

    // 2. 绘制网格线（使用放大后的坐标）
    offCtx.beginPath();
    offCtx.strokeStyle = '#c0b6a8';
    offCtx.lineWidth = 0.8 * scale;      // 线宽也适当放大
    for (let i = 0; i <= state.gridWidth; i++) {
        offCtx.moveTo(i * scaledCellSize, 0);
        offCtx.lineTo(i * scaledCellSize, height);
    }
    for (let i = 0; i <= state.gridHeight; i++) {
        offCtx.moveTo(0, i * scaledCellSize);
        offCtx.lineTo(width, i * scaledCellSize);
    }
    offCtx.stroke();

    offCtx.beginPath();
    offCtx.strokeStyle = '#9a8b7c';
    offCtx.lineWidth = 1.5 * scale;
    offCtx.strokeRect(0, 0, width, height);

    // 3. 绘制色号文字（字体大小随缩放比例增大）
    offCtx.font = `bold ${10 * scale}px "Courier New", monospace`;
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';

    for (let row = 0; row < state.gridHeight; row++) {
        for (let col = 0; col < state.gridWidth; col++) {
            const hex = state.gridData[row][col];
            const name = state.hexToNameMap.get(hex.toUpperCase());
            if (!name || name === '空白') continue;

            const { r, g, b } = rgbFromHex(hex);
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            offCtx.fillStyle = luminance > 186 ? '#000000' : '#FFFFFF';

            const x = col * scaledCellSize + scaledCellSize / 2;
            const y = row * scaledCellSize + scaledCellSize / 2;
            offCtx.fillText(name, x, y);
        }
    }

    // 导出图片
    const link = document.createElement('a');
    link.download = '图豆师图纸.png';
    link.href = offCanvas.toDataURL('image/png');
    link.click();
}

/**
 * 导出已用色卡 PNG（间距放大 1.5 倍，标题改为“图豆师色卡”）
 */
export function exportUsedPalettePNG() {
    const colors = getColorStats();
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

    // 间距放大 1.5 倍
    const circleRadius = 24;
    const circleDiameter = circleRadius * 2;
    const margin = 90 * 1.5;       // 水平间距 135
    const rowExtra = 70 * 1.5;     // 垂直行距 105
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
    offCtx.fillText('图豆师色卡', canvasWidth / 2, 50);

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
    link.download = '已用图豆师色卡.png';
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
    link.download = `图豆师历史_${timestamp}.json`;
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
            const offCanvas = document.createElement('canvas');
            offCanvas.width = state.gridWidth;
            offCanvas.height = state.gridHeight;
            const offCtx = offCanvas.getContext('2d');
            offCtx.imageSmoothingEnabled = false;
            offCtx.drawImage(img, 0, 0, state.gridWidth, state.gridHeight);

            const imageData = offCtx.getImageData(0, 0, state.gridWidth, state.gridHeight);
            const data = imageData.data;

            const pixels = [];
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                const a = data[i+3];
                if (a >= 128) {
                    if (r <= 50 && g <= 50 && b <= 50) {
                        pixels.push({ r: 0, g: 0, b: 0 });
                    } else {
                        pixels.push({ r, g, b });
                    }
                }
            }

            if (pixels.length === 0) {
                for (let row = 0; row < state.gridHeight; row++) {
                    for (let col = 0; col < state.gridWidth; col++) {
                        state.gridData[row][col] = rgbToHex(255,255,255);
                    }
                }
                drawFullGrid();
                return;
            }

            let targetColors = 16;
            if (pixels.length < 100) targetColors = 8;
            else if (pixels.length < 500) targetColors = 12;
            else targetColors = 16;

            const points = pixels.map(p => ({ r: p.r, g: p.g, b: p.b, weight: 1 }));
            const centroids = kMeans(points, targetColors, 20);
            const centroidColors = centroids.map(c => findClosestPaletteColor(rgbToHex(c.r, c.g, c.b)));

            const pixelColors = pixels.map(p => {
                let minDist = Infinity;
                let bestIdx = 0;
                for (let i = 0; i < centroids.length; i++) {
                    const cent = centroids[i];
                    const dr = p.r - cent.r;
                    const dg = p.g - cent.g;
                    const db = p.b - cent.b;
                    const dist = dr*dr + dg*dg + db*db;
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                }
                return centroidColors[bestIdx];
            });

            let pixelIdx = 0;
            for (let row = 0; row < state.gridHeight; row++) {
                for (let col = 0; col < state.gridWidth; col++) {
                    const idx = (row * state.gridWidth + col) * 4;
                    const a = data[idx + 3];
                    if (a < 128) {
                        state.gridData[row][col] = rgbToHex(255,255,255);
                    } else {
                        state.gridData[row][col] = pixelColors[pixelIdx++];
                    }
                }
            }
            drawFullGrid();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}