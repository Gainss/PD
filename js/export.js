import { state } from './state.js';
import { getColorStats, sortByNameAsc } from './stats.js';
import { drawFullGrid } from './canvas.js';
import { rgbToHex, findClosestPaletteColor } from './utils.js';
import { kMeans } from './simplify.js';

export function exportCanvasPNG() {
    if (!state.canvas) return;
    const link = document.createElement('a');
    link.download = '图豆师图纸.png';
    link.href = state.canvas.toDataURL('image/png');
    link.click();
}

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
    offCtx.fillText('已用图豆师色卡', canvasWidth / 2, 50);

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

/**
 * 上传图片转图纸（优化版）
 * - 使用颜色量化（k-means）自动将图片颜色压缩到合适数量（默认16）
 * - 黑色/白色增强识别
 */
export function uploadImage(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // 直接缩放到 52x52
            const offCanvas = document.createElement('canvas');
            offCanvas.width = state.gridWidth;
            offCanvas.height = state.gridHeight;
            const offCtx = offCanvas.getContext('2d');
            offCtx.imageSmoothingEnabled = false;
            offCtx.drawImage(img, 0, 0, state.gridWidth, state.gridHeight);

            const imageData = offCtx.getImageData(0, 0, state.gridWidth, state.gridHeight);
            const data = imageData.data;

            // 收集所有非透明像素的颜色
            const pixels = [];
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                const a = data[i+3];
                if (a >= 128) {
                    // 黑色阈值扩展：≤ 50 统一为黑色
                    if (r <= 50 && g <= 50 && b <= 50) {
                        pixels.push({ r: 0, g: 0, b: 0 });
                    } else {
                        pixels.push({ r, g, b });
                    }
                }
            }

            if (pixels.length === 0) {
                // 全透明，填充白色
                for (let row = 0; row < state.gridHeight; row++) {
                    for (let col = 0; col < state.gridWidth; col++) {
                        state.gridData[row][col] = rgbToHex(255,255,255);
                    }
                }
                drawFullGrid();
                return;
            }

            // 自动确定聚类数量（根据像素数量和复杂度）
            let targetColors = 16;
            if (pixels.length < 100) targetColors = 8;
            else if (pixels.length < 500) targetColors = 12;
            else targetColors = 16;

            // 将每个像素作为点，进行 k-means 聚类
            const points = pixels.map(p => ({ r: p.r, g: p.g, b: p.b, weight: 1 }));
            const centroids = kMeans(points, targetColors, 20);
            // 将聚类中心映射到色卡
            const centroidColors = centroids.map(c => findClosestPaletteColor(rgbToHex(c.r, c.g, c.b)));

            // 为每个像素分配最近的聚类中心
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

            // 将结果填回 gridData
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