import { state } from './state.js';
import { rgbFromHex, rgbToHex, findClosestPaletteColor } from './utils.js';
import { drawFullGrid } from './canvas.js';

/**
 * 合并小区域（面积 ≤ maxArea，且该颜色全局出现次数 ≤ maxCount）
 */
function mergeSmallRegions(maxArea = 3, maxColorCount = 3) {
    const H = state.gridHeight;
    const W = state.gridWidth;
    const directions = [[-1,0],[1,0],[0,-1],[0,1]];
    let changed = false;

    const globalColorCount = new Map();
    for (let i = 0; i < H; i++) {
        for (let j = 0; j < W; j++) {
            const hex = state.gridData[i][j];
            const name = state.hexToNameMap.get(hex.toUpperCase());
            if (name === '空白') continue;
            globalColorCount.set(hex, (globalColorCount.get(hex) || 0) + 1);
        }
    }

    const visited = Array(H).fill().map(() => Array(W).fill(false));
    const regions = [];

    for (let i = 0; i < H; i++) {
        for (let j = 0; j < W; j++) {
            if (!visited[i][j]) {
                const hex = state.gridData[i][j];
                const name = state.hexToNameMap.get(hex.toUpperCase());
                if (name === '空白') {
                    visited[i][j] = true;
                    continue;
                }
                const color = hex;
                const cells = [];
                const queue = [[i, j]];
                visited[i][j] = true;

                while (queue.length) {
                    const [r, c] = queue.shift();
                    cells.push([r, c]);
                    for (const [dr, dc] of directions) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < H && nc >= 0 && nc < W && !visited[nr][nc] && state.gridData[nr][nc] === color) {
                            visited[nr][nc] = true;
                            queue.push([nr, nc]);
                        }
                    }
                }
                regions.push({ color, cells, area: cells.length });
            }
        }
    }

    const smallRegions = regions.filter(reg => 
        reg.area <= maxArea && (globalColorCount.get(reg.color) || 0) <= maxColorCount
    );

    if (smallRegions.length === 0) return false;

    for (const region of smallRegions) {
        const neighborCount = new Map();
        for (const [r, c] of region.cells) {
            for (const [dr, dc] of directions) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < H && nc >= 0 && nc < W) {
                    const neighborColor = state.gridData[nr][nc];
                    if (neighborColor !== region.color) {
                        neighborCount.set(neighborColor, (neighborCount.get(neighborColor) || 0) + 1);
                    }
                }
            }
        }
        if (neighborCount.size === 0) continue;

        let bestColor = null;
        let maxCount = 0;
        for (const [color, cnt] of neighborCount) {
            if (cnt > maxCount) {
                maxCount = cnt;
                bestColor = color;
            }
        }
        if (bestColor) {
            for (const [r, c] of region.cells) {
                if (state.gridData[r][c] !== bestColor) {
                    state.gridData[r][c] = bestColor;
                    changed = true;
                }
            }
        }
    }
    return changed;
}

/**
 * 边缘平滑
 */
function smoothEdges() {
    const H = state.gridHeight;
    const W = state.gridWidth;
    const newGrid = JSON.parse(JSON.stringify(state.gridData));
    let changed = false;

    for (let i = 0; i < H; i++) {
        for (let j = 0; j < W; j++) {
            const colorCount = new Map();
            for (let di = -1; di <= 1; di++) {
                for (let dj = -1; dj <= 1; dj++) {
                    const ni = i + di;
                    const nj = j + dj;
                    if (ni >= 0 && ni < H && nj >= 0 && nj < W) {
                        const color = state.gridData[ni][nj];
                        const name = state.hexToNameMap.get(color.toUpperCase());
                        if (name === '空白') continue;
                        colorCount.set(color, (colorCount.get(color) || 0) + 1);
                    }
                }
            }
            if (colorCount.size === 0) continue;

            let maxCount = 0;
            let dominantColor = null;
            for (const [color, cnt] of colorCount) {
                if (cnt > maxCount) {
                    maxCount = cnt;
                    dominantColor = color;
                }
            }
            if (dominantColor && maxCount >= 5 && dominantColor !== state.gridData[i][j]) {
                newGrid[i][j] = dominantColor;
                changed = true;
            }
        }
    }

    if (changed) {
        state.gridData = newGrid;
        drawFullGrid();
    }
    return changed;
}

export async function simplifyColors(targetColorCount) {
    try {
        console.log('开始简化颜色，目标数量:', targetColorCount);

        const colorCountMap = new Map();
        for (let row = 0; row < state.gridHeight; row++) {
            for (let col = 0; col < state.gridWidth; col++) {
                const hex = state.gridData[row][col];
                const name = state.hexToNameMap.get(hex.toUpperCase());
                if (name === '空白') continue;
                colorCountMap.set(hex, (colorCountMap.get(hex) || 0) + 1);
            }
        }

        const usedColors = Array.from(colorCountMap.entries()).map(([hex, count]) => ({
            hex,
            rgb: rgbFromHex(hex),
            count
        }));

        console.log('当前使用颜色数量:', usedColors.length);

        if (usedColors.length <= targetColorCount) {
            alert(`当前图案仅使用 ${usedColors.length} 种颜色，无需简化。`);
            return;
        }

        const points = usedColors.map(c => ({
            r: c.rgb.r,
            g: c.rgb.g,
            b: c.rgb.b,
            weight: c.count
        }));

        const centroids = kMeans(points, targetColorCount);
        const centroidColors = centroids.map(cent => findClosestPaletteColor(rgbToHex(cent.r, cent.g, cent.b)));

        const colorMapping = new Map();
        usedColors.forEach(color => {
            let minDist = Infinity;
            let bestCentroidHex = centroidColors[0];
            for (let i = 0; i < centroids.length; i++) {
                const cent = centroids[i];
                const dr = color.rgb.r - cent.r;
                const dg = color.rgb.g - cent.g;
                const db = color.rgb.b - cent.b;
                const dist = dr*dr + dg*dg + db*db;
                if (dist < minDist) {
                    minDist = dist;
                    bestCentroidHex = centroidColors[i];
                }
            }
            colorMapping.set(color.hex, bestCentroidHex);
        });

        let changedCount = 0;
        for (let row = 0; row < state.gridHeight; row++) {
            for (let col = 0; col < state.gridWidth; col++) {
                const oldHex = state.gridData[row][col];
                const name = state.hexToNameMap.get(oldHex.toUpperCase());
                if (name === '空白') continue;
                const newHex = colorMapping.get(oldHex);
                if (newHex && newHex !== oldHex) {
                    state.gridData[row][col] = newHex;
                    changedCount++;
                }
            }
        }

        drawFullGrid();

        const merged = mergeSmallRegions(3, 3);
        if (merged) drawFullGrid();

        const smoothed = smoothEdges();
        if (smoothed) drawFullGrid();

        const newColorCount = new Set(
            Array.from(state.gridData.flat())
                .filter(hex => state.hexToNameMap.get(hex.toUpperCase()) !== '空白')
        ).size;
        alert(`颜色简化完成！\n简化前: ${usedColors.length} 种\n简化后: ${newColorCount} 种\n共修改 ${changedCount} 个格子。`);
    } catch (err) {
        console.error('颜色简化出错:', err);
        alert('颜色简化失败，请查看控制台错误信息：' + err.message);
    }
}

export function clearBackground(startRow, startCol) {
    const targetColor = state.gridData[startRow][startCol];
    const targetName = state.hexToNameMap.get(targetColor.toUpperCase());
    if (targetName === '空白') {
        alert('点击的区域已经是空白，无需清除');
        return false;
    }

    const H = state.gridHeight;
    const W = state.gridWidth;
    const directions = [[-1,0],[1,0],[0,-1],[0,1]];
    const queue = [[startRow, startCol]];
    const visited = Array(H).fill().map(() => Array(W).fill(false));
    visited[startRow][startCol] = true;
    let changed = false;

    while (queue.length) {
        const [r, c] = queue.shift();
        if (state.gridData[r][c] !== targetColor) continue;
        state.gridData[r][c] = '#FFFFFF';
        changed = true;

        for (const [dr, dc] of directions) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < H && nc >= 0 && nc < W && !visited[nr][nc] && state.gridData[nr][nc] === targetColor) {
                visited[nr][nc] = true;
                queue.push([nr, nc]);
            }
        }
    }

    if (changed) {
        drawFullGrid();
        alert(`已清除与所选格子颜色相同的连通区域（共 ${visited.flat().filter(v => v).length} 个格子）`);
    }
    return changed;
}

export function mergeRareColors(minCount = 5) {
    const colorCount = new Map();
    for (let row = 0; row < state.gridHeight; row++) {
        for (let col = 0; col < state.gridWidth; col++) {
            const hex = state.gridData[row][col];
            const name = state.hexToNameMap.get(hex.toUpperCase());
            if (name === '空白') continue;
            colorCount.set(hex, (colorCount.get(hex) || 0) + 1);
        }
    }

    const abundantColors = [];
    const rareColors = [];
    for (const [hex, count] of colorCount) {
        if (count >= minCount) {
            abundantColors.push({ hex, count, rgb: rgbFromHex(hex) });
        } else {
            rareColors.push({ hex, count, rgb: rgbFromHex(hex) });
        }
    }

    if (rareColors.length === 0) {
        alert(`所有颜色使用数量均 ≥ ${minCount}，无需合并。`);
        return;
    }

    if (abundantColors.length === 0) {
        alert(`没有足够多的颜色（数量 ≥ ${minCount}）作为目标，无法合并。`);
        return;
    }

    const replaceMap = new Map();
    for (const rare of rareColors) {
        let bestColor = null;
        let minDist = Infinity;
        for (const abundant of abundantColors) {
            const dr = rare.rgb.r - abundant.rgb.r;
            const dg = rare.rgb.g - abundant.rgb.g;
            const db = rare.rgb.b - abundant.rgb.b;
            const dist = dr*dr + dg*dg + db*db;
            if (dist < minDist) {
                minDist = dist;
                bestColor = abundant.hex;
            }
        }
        replaceMap.set(rare.hex, bestColor);
    }

    let changedCount = 0;
    for (let row = 0; row < state.gridHeight; row++) {
        for (let col = 0; col < state.gridWidth; col++) {
            const oldHex = state.gridData[row][col];
            const newHex = replaceMap.get(oldHex);
            if (newHex && newHex !== oldHex) {
                state.gridData[row][col] = newHex;
                changedCount++;
            }
        }
    }

    if (changedCount > 0) {
        drawFullGrid();
        alert(`合并完成！\n共将 ${rareColors.length} 种使用数量 < ${minCount} 的颜色合并到相近的大颜色中。\n修改了 ${changedCount} 个格子。`);
    } else {
        alert('没有发生任何变化，可能是阈值设置问题。');
    }
}

export function kMeans(points, k, maxIter = 30) {
    if (k <= 0) return [];
    if (k >= points.length) return points.map(p => ({ r: p.r, g: p.g, b: p.b }));

    let centroids = [];
    const totalWeight = points.reduce((sum, p) => sum + p.weight, 0);
    for (let i = 0; i < k; i++) {
        let rand = Math.random() * totalWeight;
        let accum = 0;
        for (let p of points) {
            accum += p.weight;
            if (rand <= accum) {
                centroids.push({ r: p.r, g: p.g, b: p.b });
                break;
            }
        }
    }

    let changed = true;
    let iter = 0;
    while (changed && iter < maxIter) {
        const clusters = Array(k).fill().map(() => []);
        points.forEach(point => {
            let minDist = Infinity;
            let bestIdx = 0;
            for (let i = 0; i < centroids.length; i++) {
                const c = centroids[i];
                const dr = point.r - c.r;
                const dg = point.g - c.g;
                const db = point.b - c.b;
                const dist = dr*dr + dg*dg + db*db;
                if (dist < minDist) {
                    minDist = dist;
                    bestIdx = i;
                }
            }
            clusters[bestIdx].push(point);
        });

        const newCentroids = [];
        for (let i = 0; i < k; i++) {
            const cluster = clusters[i];
            if (cluster.length === 0) {
                const randIdx = Math.floor(Math.random() * points.length);
                newCentroids.push({ r: points[randIdx].r, g: points[randIdx].g, b: points[randIdx].b });
                continue;
            }
            let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0;
            for (let p of cluster) {
                sumR += p.r * p.weight;
                sumG += p.g * p.weight;
                sumB += p.b * p.weight;
                totalWeight += p.weight;
            }
            newCentroids.push({
                r: Math.round(sumR / totalWeight),
                g: Math.round(sumG / totalWeight),
                b: Math.round(sumB / totalWeight)
            });
        }

        changed = false;
        for (let i = 0; i < k; i++) {
            if (centroids[i].r !== newCentroids[i].r ||
                centroids[i].g !== newCentroids[i].g ||
                centroids[i].b !== newCentroids[i].b) {
                changed = true;
                break;
            }
        }
        centroids = newCentroids;
        iter++;
    }
    return centroids;
}