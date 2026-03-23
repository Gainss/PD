export const state = {
    gridData: [],
    gridWidth: 52,
    gridHeight: 52,
    isDrawing: false,
    currentMode: 'brush',
    currentColor: '#4A6EA8',
    hexToNameMap: new Map(),
    nameToHexMap: new Map(),
    canvas: null,
    ctx: null,
    BASE_CELL_SIZE: 20,
    currentSort: 'count-desc',
    clearModeActive: false,
    currentGridSize: '52',
    showColorNames: true   // 新增：是否显示色号，默认开启
};