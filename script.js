const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const paletteEl = document.getElementById('palette');
const selectedColorEl = document.getElementById('selectedColor');
const selectedHexEl = document.getElementById('selectedHex');
const gridSizeEl = document.getElementById('gridSize');
const pencilBtn = document.getElementById('pencilBtn');
const eraserBtn = document.getElementById('eraserBtn');
const fillBtn = document.getElementById('fillBtn');
const fillEraserBtn = document.getElementById('fillEraserBtn');
const undoBtn = document.getElementById('undoBtn');
const importBtn = document.getElementById('importBtn');
const importInput = document.getElementById('importInput');
const cropOverlay = document.getElementById('cropOverlay');
const cropCanvas = document.getElementById('cropCanvas');
const cropCtx = cropCanvas.getContext('2d', { alpha: true });
const cropScale = document.getElementById('cropScale');
const cropOutputSize = document.getElementById('cropOutputSize');
const cropCancelBtn = document.getElementById('cropCancelBtn');
const cropApplyBtn = document.getElementById('cropApplyBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');

let gridSize = 32;
let currentColor = '#000000';
let isDrawing = false;
let pixels = [];
let currentTool = 'pencil';
let undoStack = [];
let cellSize = 16;
let hoverCell = null;
let cropState = null;

const PREVIEW_MAX = 512;
const MAX_UNDO = 80;

function toHex(v) {
  return v.toString(16).padStart(2, '0');
}

function xterm256Palette() {
  const base16 = [
    '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
    '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
  ];

  const colors = [...base16];
  const levels = [0, 95, 135, 175, 215, 255];

  for (const r of levels) {
    for (const g of levels) {
      for (const b of levels) {
        colors.push(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
      }
    }
  }

  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10;
    colors.push(`#${toHex(v)}${toHex(v)}${toHex(v)}`);
  }

  return colors;
}

const palette = xterm256Palette();
const paletteRgb = palette.map((hex) => {
  const h = hex.replace('#', '');
  return {
    hex,
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16)
  };
});

function createEmptyPixels(size) {
  return new Array(size * size).fill(null);
}

function pushUndoState() {
  undoStack.push([...pixels]);
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
}

function undo() {
  if (!undoStack.length) return;
  pixels = undoStack.pop();
  drawPixelGrid();
}

function setTool(tool) {
  currentTool = tool;
  pencilBtn.classList.toggle('active-tool', tool === 'pencil');
  eraserBtn.classList.toggle('active-tool', tool === 'eraser');
  fillBtn.classList.toggle('active-tool', tool === 'fill');
  fillEraserBtn.classList.toggle('active-tool', tool === 'fill-eraser');
  canvas.style.cursor = (tool === 'fill' || tool === 'fill-eraser') ? 'copy' : 'crosshair';
}

function drawPixelGrid() {
  const cell = cellSize;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = y * gridSize + x;
      const color = pixels[idx];
      const px = x * cell;
      const py = y * cell;

      ctx.fillStyle = ((x + y) % 2 === 0) ? '#151b25' : '#1b2230';
      ctx.fillRect(px, py, cell, cell);

      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(px, py, cell, cell);
      }
    }
  }

  const majorEvery = gridSize >= 64 ? 16 : 8;

  for (let i = 0; i <= gridSize; i++) {
    const p = i * cell;
    const isMajor = i % majorEvery === 0;
    ctx.strokeStyle = isMajor ? '#000000C0' : '#0000008A';
    ctx.lineWidth = isMajor ? 1.4 : 1;

    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(canvas.width, p);
    ctx.stroke();
  }

  if (hoverCell && hoverCell.x >= 0 && hoverCell.y >= 0 && hoverCell.x < gridSize && hoverCell.y < gridSize) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(hoverCell.x * cell + 1, hoverCell.y * cell + 1, cell - 2, cell - 2);
  }
}

function setPixelFromMouse(event) {
  const rect = canvas.getBoundingClientRect();
  const relX = event.clientX - rect.left;
  const relY = event.clientY - rect.top;
  const x = Math.floor(relX / (rect.width / gridSize));
  const y = Math.floor(relY / (rect.height / gridSize));

  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return;

  const index = y * gridSize + x;
  pixels[index] = currentTool === 'eraser' ? null : currentColor;
  drawPixelGrid();
}

function floodFill(startX, startY, replacementColor) {
  const startIndex = startY * gridSize + startX;
  const targetColor = pixels[startIndex];

  if (targetColor === replacementColor) return;

  const queue = [[startX, startY]];
  const visited = new Uint8Array(gridSize * gridSize);

  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) continue;

    const index = y * gridSize + x;
    if (visited[index]) continue;
    visited[index] = 1;

    if (pixels[index] !== targetColor) continue;

    pixels[index] = replacementColor;
    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }

  drawPixelGrid();
}

function canvasGridPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const relX = event.clientX - rect.left;
  const relY = event.clientY - rect.top;
  const x = Math.floor(relX / (rect.width / gridSize));
  const y = Math.floor(relY / (rect.height / gridSize));
  return { x, y };
}

function initPalette() {
  paletteEl.innerHTML = '';

  palette.forEach((hex, idx) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.style.background = hex;
    swatch.title = hex;

    if (idx === 0) {
      swatch.classList.add('active');
    }

    swatch.addEventListener('click', () => {
      currentColor = hex;
      selectedColorEl.style.background = hex;
      selectedHexEl.textContent = hex;

      document.querySelectorAll('.swatch.active').forEach(el => el.classList.remove('active'));
      swatch.classList.add('active');
    });

    paletteEl.appendChild(swatch);
  });

  selectedColorEl.style.background = currentColor;
  selectedHexEl.textContent = currentColor;
}

function resizeGrid(newSize) {
  gridSize = newSize;
  cellSize = Math.max(4, Math.floor(PREVIEW_MAX / gridSize));
  canvas.width = gridSize * cellSize;
  canvas.height = gridSize * cellSize;
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  pixels = createEmptyPixels(newSize);
  undoStack = [];
  drawPixelGrid();
}

function clearCanvas() {
  pushUndoState();
  pixels = createEmptyPixels(gridSize);
  drawPixelGrid();
}

function nearestPaletteHex(r, g, b) {
  let bestHex = paletteRgb[0].hex;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const entry of paletteRgb) {
    const dr = r - entry.r;
    const dg = g - entry.g;
    const db = b - entry.b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestHex = entry.hex;
      if (distance === 0) {
        break;
      }
    }
  }

  return bestHex;
}

function parseImportSize(value) {
  const allowed = new Set([8, 16, 32, 64, 128]);
  const size = Number.parseInt(String(value), 10);
  if (!allowed.has(size)) {
    return null;
  }
  return size;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function redrawCropOverlay() {
  if (!cropState) return;
  const { image, drawWidth, drawHeight, drawScale, selection } = cropState;

  cropCanvas.width = drawWidth;
  cropCanvas.height = drawHeight;
  cropCanvas.style.width = `${drawWidth}px`;
  cropCanvas.style.height = `${drawHeight}px`;

  cropCtx.clearRect(0, 0, drawWidth, drawHeight);
  cropCtx.drawImage(image, 0, 0, drawWidth, drawHeight);

  const sx = selection.x * drawScale;
  const sy = selection.y * drawScale;
  const ss = selection.size * drawScale;

  cropCtx.fillStyle = 'rgba(0,0,0,0.45)';
  cropCtx.fillRect(0, 0, drawWidth, drawHeight);
  cropCtx.drawImage(
    image,
    selection.x,
    selection.y,
    selection.size,
    selection.size,
    sx,
    sy,
    ss,
    ss
  );

  cropCtx.strokeStyle = '#ffffff';
  cropCtx.lineWidth = 2;
  cropCtx.strokeRect(sx + 1, sy + 1, ss - 2, ss - 2);
}

function openCropOverlay(image) {
  const maxPreviewWidth = 860;
  const maxPreviewHeight = 560;
  const scale = Math.min(maxPreviewWidth / image.width, maxPreviewHeight / image.height, 1);

  const drawWidth = Math.max(1, Math.round(image.width * scale));
  const drawHeight = Math.max(1, Math.round(image.height * scale));

  const maxSquare = Math.min(image.width, image.height);
  const initialPercent = Number.parseInt(cropScale.value, 10) || 100;
  const initialSize = Math.max(1, Math.floor(maxSquare * (initialPercent / 100)));

  cropState = {
    image,
    drawWidth,
    drawHeight,
    drawScale: scale,
    maxSquare,
    selection: {
      size: initialSize,
      x: Math.floor((image.width - initialSize) / 2),
      y: Math.floor((image.height - initialSize) / 2)
    },
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0
  };

  cropOutputSize.value = String(gridSize);
  cropOverlay.classList.remove('hidden');
  redrawCropOverlay();
}

function closeCropOverlay() {
  cropOverlay.classList.add('hidden');
  cropState = null;
}

function cropCanvasToImageCoords(event) {
  if (!cropState) return null;
  const rect = cropCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * cropCanvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * cropCanvas.height;
  return {
    x: Math.floor(x / cropState.drawScale),
    y: Math.floor(y / cropState.drawScale)
  };
}

function importFromCurrentCrop() {
  if (!cropState) return;

  const targetSize = parseImportSize(cropOutputSize.value);
  if (!targetSize) {
    window.alert('Ugyldig output størrelse.');
    return;
  }

  const { image, selection } = cropState;
  const offscreen = document.createElement('canvas');
  offscreen.width = targetSize;
  offscreen.height = targetSize;
  const offCtx = offscreen.getContext('2d', { alpha: true });
  offCtx.imageSmoothingEnabled = true;
  offCtx.clearRect(0, 0, targetSize, targetSize);
  offCtx.drawImage(
    image,
    selection.x,
    selection.y,
    selection.size,
    selection.size,
    0,
    0,
    targetSize,
    targetSize
  );

  const imageData = offCtx.getImageData(0, 0, targetSize, targetSize).data;
  const importedPixels = new Array(targetSize * targetSize).fill(null);

  for (let i = 0; i < targetSize * targetSize; i++) {
    const p = i * 4;
    const r = imageData[p];
    const g = imageData[p + 1];
    const b = imageData[p + 2];
    const a = imageData[p + 3];

    if (a < 32) {
      importedPixels[i] = null;
    } else {
      importedPixels[i] = nearestPaletteHex(r, g, b);
    }
  }

  resizeGrid(targetSize);
  pushUndoState();
  pixels = importedPixels;
  drawPixelGrid();
  closeCropOverlay();
}

function importPngFile(file) {
  if (!file) return;
  const filename = file.name.toLowerCase();
  const isSupportedType = file.type === 'image/png'
    || file.type === 'image/jpeg'
    || filename.endsWith('.png')
    || filename.endsWith('.jpg')
    || filename.endsWith('.jpeg');

  if (!isSupportedType) {
    window.alert('Vælg en PNG, JPG eller JPEG fil.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      openCropOverlay(img);
    };

    img.onerror = () => {
      window.alert('Kunne ikke læse billedet. Prøv en anden PNG/JPG/JPEG fil.');
    };

    img.src = String(reader.result);
  };

  reader.onerror = () => {
    window.alert('Kunne ikke åbne filen.');
  };

  reader.readAsDataURL(file);
}

function importImageFromClipboard(event) {
  const clipboardItems = event.clipboardData?.items;
  if (!clipboardItems?.length) return;

  for (const item of clipboardItems) {
    if (!item.type.startsWith('image/')) {
      continue;
    }

    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    event.preventDefault();
    importPngFile(file);
    return;
  }
}

function downloadPNG() {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = gridSize;
  exportCanvas.height = gridSize;
  const exportCtx = exportCanvas.getContext('2d', { alpha: true });

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const color = pixels[y * gridSize + x];
      if (color) {
        exportCtx.fillStyle = color;
        exportCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const suggested = `item_${gridSize}x${gridSize}_${stamp}`;
  const input = window.prompt('Filnavn (uden .png):', suggested);

  if (input === null) {
    return;
  }

  let filename = input.trim();
  if (!filename) {
    filename = suggested;
  }
  if (filename.toLowerCase().endsWith('.png')) {
    filename = filename.slice(0, -4);
  }

  filename = filename.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
  if (!filename) {
    filename = suggested;
  }

  const url = exportCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.png`;
  link.click();
}

canvas.addEventListener('mousedown', (event) => {
  if (currentTool === 'fill' || currentTool === 'fill-eraser') {
    const { x, y } = canvasGridPosition(event);
    if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return;
    pushUndoState();
    const replacement = currentTool === 'fill-eraser' ? null : currentColor;
    floodFill(x, y, replacement);
    return;
  }

  isDrawing = true;
  pushUndoState();
  setPixelFromMouse(event);
});

canvas.addEventListener('mousemove', (event) => {
  if (!isDrawing) return;
  setPixelFromMouse(event);
});

window.addEventListener('mouseup', () => {
  isDrawing = false;
});

canvas.addEventListener('mousemove', (event) => {
  const { x, y } = canvasGridPosition(event);
  const isInside = x >= 0 && y >= 0 && x < gridSize && y < gridSize;
  hoverCell = isInside ? { x, y } : null;
  if (!isDrawing) {
    drawPixelGrid();
  }
});

canvas.addEventListener('mouseleave', () => {
  hoverCell = null;
  if (!isDrawing) {
    drawPixelGrid();
  }
});

cropCanvas.addEventListener('mousedown', (event) => {
  if (!cropState) return;
  const coords = cropCanvasToImageCoords(event);
  if (!coords) return;

  const { selection } = cropState;
  const inside = coords.x >= selection.x
    && coords.x < selection.x + selection.size
    && coords.y >= selection.y
    && coords.y < selection.y + selection.size;

  if (!inside) {
    const half = Math.floor(selection.size / 2);
    selection.x = clamp(coords.x - half, 0, cropState.image.width - selection.size);
    selection.y = clamp(coords.y - half, 0, cropState.image.height - selection.size);
    redrawCropOverlay();
    return;
  }

  cropState.dragging = true;
  cropState.dragOffsetX = coords.x - selection.x;
  cropState.dragOffsetY = coords.y - selection.y;
});

cropCanvas.addEventListener('mousemove', (event) => {
  if (!cropState || !cropState.dragging) return;
  const coords = cropCanvasToImageCoords(event);
  if (!coords) return;

  const { selection } = cropState;
  selection.x = clamp(coords.x - cropState.dragOffsetX, 0, cropState.image.width - selection.size);
  selection.y = clamp(coords.y - cropState.dragOffsetY, 0, cropState.image.height - selection.size);
  redrawCropOverlay();
});

window.addEventListener('mouseup', () => {
  if (cropState) {
    cropState.dragging = false;
  }
});

cropScale.addEventListener('input', () => {
  if (!cropState) return;

  const percent = Number.parseInt(cropScale.value, 10) || 100;
  const nextSize = Math.max(1, Math.floor(cropState.maxSquare * (percent / 100)));

  const centerX = cropState.selection.x + cropState.selection.size / 2;
  const centerY = cropState.selection.y + cropState.selection.size / 2;

  cropState.selection.size = nextSize;
  cropState.selection.x = clamp(Math.round(centerX - nextSize / 2), 0, cropState.image.width - nextSize);
  cropState.selection.y = clamp(Math.round(centerY - nextSize / 2), 0, cropState.image.height - nextSize);
  redrawCropOverlay();
});

cropCancelBtn.addEventListener('click', closeCropOverlay);
cropApplyBtn.addEventListener('click', importFromCurrentCrop);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && cropState) {
    closeCropOverlay();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
  }
});

window.addEventListener('paste', importImageFromClipboard);

gridSizeEl.addEventListener('change', () => {
  resizeGrid(Number(gridSizeEl.value));
});

pencilBtn.addEventListener('click', () => setTool('pencil'));
eraserBtn.addEventListener('click', () => setTool('eraser'));
fillBtn.addEventListener('click', () => setTool('fill'));
fillEraserBtn.addEventListener('click', () => setTool('fill-eraser'));
undoBtn.addEventListener('click', undo);
importBtn.addEventListener('click', () => {
  importInput.value = '';
  importInput.click();
});
importInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  importPngFile(file);
});
clearBtn.addEventListener('click', clearCanvas);
downloadBtn.addEventListener('click', downloadPNG);

initPalette();
setTool('pencil');
resizeGrid(gridSize);
