import { state } from './state.js';

export function getColorStats() {
    const countMap = new Map();
    for (let row = 0; row < state.gridHeight; row++) {
        for (let col = 0; col < state.gridWidth; col++) {
            const hex = state.gridData[row][col];
            countMap.set(hex, (countMap.get(hex) || 0) + 1);
        }
    }
    return Array.from(countMap.entries()).map(([hex, count]) => {
        const name = state.hexToNameMap.get(hex.toUpperCase());
        return { hex, name, count };
    });
}

export function sortByNameAsc(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export function updateStatsWithSort(sortBy) {
    const statsContainer = document.getElementById('statsContainer');
    const colors = getColorStats();

    if (colors.length === 0) {
        statsContainer.innerHTML = '<div style="color: #7b6e5d; text-align: center; padding: 12px;">绘制图案后统计将自动更新</div>';
        return;
    }

    let sortedColors;
    if (sortBy === 'count-desc') {
        sortedColors = [...colors].sort((a, b) => b.count - a.count);
    } else if (sortBy === 'name-asc') {
        sortedColors = [...colors].sort(sortByNameAsc);
    } else {
        sortedColors = colors;
    }

    let html = '';
    sortedColors.forEach(({ hex, name, count }) => {
        const displayName = name || '空白';
        html += `
            <div class="stat-item">
                <div class="stat-color" style="background-color: ${hex};"></div>
                <div class="stat-label">${displayName}</div>
                <div class="stat-count">${count}</div>
            </div>
        `;
    });
    statsContainer.innerHTML = html;

    document.getElementById('sortByCountDesc').classList.toggle('active-sort', sortBy === 'count-desc');
    document.getElementById('sortByNameAsc').classList.toggle('active-sort', sortBy === 'name-asc');
}