// simplify.js - 颜色简化（聚类压缩）
import { state } from './state.js';
import { rgbFromHex, rgbToHex, findClosestPaletteColor } from './utils.js';
import { drawFullGrid } from './canvas.js';

/**
 * 将当前画布使用的颜色压缩到指定数量（通过 K-means 聚类）
 * @param {number} targetColorCount 目标颜色数量，建议 1~100
 */
export async function simplifyColors(targetColorCount) {
    try {
        console.log('开始简化颜色，目标数量:', targetColorCount);

        // 收集当前所有使用的颜色及其出现次数
        const colorCountMap = new Map(); // hex -> count
        for (let row = 0; row < state.gridHeight; row++) {
            for (let col = 0; col < state.gridWidth; col++) {
                const hex = state.gridData[row][col];
                colorCountMap.set(hex, (colorCountMap.get(hex) || 0) + 1);
            }
        }

        const usedColors = Array.from(colorCountMap.entries()).map(([hex, count]) => ({
            hex,
            rgb: rgbFromHex(hex),
            count
        }));

        console.log('当前使用颜色数量:', usedColors.length);

        // 如果当前颜色数已经小于等于目标，无需简化
        if (usedColors.length <= targetColorCount) {
            alert(`当前图案仅使用 ${usedColors.length} 种颜色，无需简化。`);
            return;
        }

        // 准备 K-means 聚类数据（每个点代表一种颜色，权重为出现次数）
        const points = usedColors.map(c => ({
            r: c.rgb.r,
            g: c.rgb.g,
            b: c.rgb.b,
            weight: c.count
        }));

        // 执行 K-means 聚类
        const centroids = kMeans(points, targetColorCount);
        console.log('聚类中心数量:', centroids.length);

        // 将聚类中心匹配到最近的色卡颜色
        const centroidColors = centroids.map(cent => {
            const hex = rgbToHex(cent.r, cent.g, cent.b);
            return findClosestPaletteColor(hex);
        });

        // 为每个原颜色找到最近的聚类中心色
        const colorMapping = new Map(); // 原 hex -> 新 hex
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

        // 更新画布数据
        let changedCount = 0;
        for (let row = 0; row < state.gridHeight; row++) {
            for (let col = 0; col < state.gridWidth; col++) {
                const oldHex = state.gridData[row][col];
                const newHex = colorMapping.get(oldHex);
                if (newHex && newHex !== oldHex) {
                    state.gridData[row][col] = newHex;
                    changedCount++;
                }
            }
        }

        // 重新绘制
        drawFullGrid();

        // 统计简化后的颜色种类
        const newColorCount = new Set(state.gridData.flat()).size;
        alert(`颜色简化完成！\n简化前: ${usedColors.length} 种\n简化后: ${newColorCount} 种\n共修改 ${changedCount} 个格子。`);
    } catch (err) {
        console.error('颜色简化出错:', err);
        alert('颜色简化失败，请查看控制台错误信息：' + err.message);
    }
}

/**
 * K-means 聚类算法（加权）
 * @param {Array} points 点数组，每个点包含 {r,g,b,weight}
 * @param {number} k 聚类数量
 * @param {number} maxIter 最大迭代次数
 * @returns {Array} 聚类中心数组 [{r,g,b}]
 */
function kMeans(points, k, maxIter = 30) {
    if (k <= 0) return [];
    if (k >= points.length) return points.map(p => ({ r: p.r, g: p.g, b: p.b }));

    // 随机初始化中心（基于权重随机选择）
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
        // 分配每个点到最近的中心
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

        // 更新中心（加权平均）
        const newCentroids = [];
        for (let i = 0; i < k; i++) {
            const cluster = clusters[i];
            if (cluster.length === 0) {
                // 如果某簇为空，则随机取一个全局点（避免中心丢失）
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

        // 检查是否收敛
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