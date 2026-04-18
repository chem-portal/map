const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- CLOUD CONFIG ---
const CLOUD_API_URL = "https://script.google.com/macros/s/AKfycbwgt8PcKuPDZ9mQUTJtmqsh7-xuJ8QrhA2S12KaqkPukKmx91KPpGU7feOL2mIBUfx4QQ/exec";
let isAdmin = false;

// --- State & DOM ---
let savedMapsData = [];
let currentIndex = 0;
let isCloudLoading = false;
let cloudDataLookup = {};

const loader = document.getElementById('loader');
const mainViewer = document.getElementById('main-viewer');
const emptyState = document.getElementById('empty-state');
const mainBase = document.getElementById('main-base');
const mainTop = document.getElementById('main-top');
const currentCodeEl = document.getElementById('current-code');
const currentFilesEl = document.getElementById('current-filenames');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const alphaSlider = document.getElementById('global-alpha');
const scaleXSlider = document.getElementById('scale-x');
const scaleYSlider = document.getElementById('scale-y');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnLogin = document.getElementById('btn-login');
const btnSaveCloud = document.getElementById('btn-save-cloud');

// --- Local Storage & Folders ---
let localBhunkshaFiles = {};
let localPdfFiles = {};

document.getElementById('btn-bhunksha').addEventListener('click', () => document.getElementById('input-bhunksha').click());
document.getElementById('btn-pdf').addEventListener('click', () => document.getElementById('input-pdf').click());

let alertShown = false;

document.getElementById('input-bhunksha').addEventListener('change', (e) => {
    if(!alertShown) { alert("Please ensure Image names match PDF names exactly (e.g. 0001.png and 0001.pdf) and are in separate folders."); alertShown = true; }
    const files = e.target.files;
    localBhunkshaFiles = {}; // Reset for new folder
    for(let f of files) {
        if(f.name.toLowerCase().endsWith('.png') || f.name.toLowerCase().endsWith('.jpg')) {
            // Remove extension and pad to 4 digits
            let code = f.name.replace(/\.[^/.]+$/, "").padStart(4, '0');
            localBhunkshaFiles[code] = f;
        }
    }
    document.getElementById('status-bhunksha').textContent = `${Object.keys(localBhunkshaFiles).length} images found`;
    checkAndStartLocal();
});

document.getElementById('input-pdf').addEventListener('change', (e) => {
    if(!alertShown) { alert("Please ensure Image names match PDF names exactly (e.g. 0001.png and 0001.pdf) and are in separate folders."); alertShown = true; }
    const files = e.target.files;
    localPdfFiles = {}; // Reset for new folder
    for(let f of files) {
        if(f.name.toLowerCase().endsWith('.pdf')) {
            // Remove extension and pad to 4 digits
            let code = f.name.replace(/\.[^/.]+$/, "").padStart(4, '0');
            localPdfFiles[code] = f;
        }
    }
    document.getElementById('status-pdf').textContent = `${Object.keys(localPdfFiles).length} PDFs found`;
    checkAndStartLocal();
});

// Manual Match Trigger
document.getElementById('btn-compare').addEventListener('click', checkAndStartLocal);

function checkAndStartLocal() {
    const bhunkshaCount = Object.keys(localBhunkshaFiles).length;
    const pdfCount = Object.keys(localPdfFiles).length;

    if(bhunkshaCount > 0 && pdfCount > 0) {
        let matchedData = [];
        let localDataStore = JSON.parse(localStorage.getItem('censusLocalMaps')) || {};
        
        // Use existing cloud lookup or wait if loading
        if (isCloudLoading) {
            alert("Cloud data is still syncing. Please wait a moment and try again.");
            return;
        }

        for(let code in localBhunkshaFiles) {
            if(localPdfFiles[code]) {
                let localSaved = localDataStore[code] || {};
                let cloudSaved = cloudDataLookup[code] || {};
                
                // Priority: 1. Local Browser Storage, 2. Cloud Sync Data, 3. Default Values
                const getVal = (key, fallback) => {
                    if (localSaved[key] !== undefined) return localSaved[key];
                    if (cloudSaved[key] !== undefined) return cloudSaved[key];
                    return fallback;
                };

                matchedData.push({
                    code: code,
                    posX: getVal('posX', 0),
                    posY: getVal('posY', 0),
                    scaleX: getVal('scaleX', 1.35),
                    scaleY: getVal('scaleY', 1),
                    rotation: getVal('rotation', 0),
                    alpha: getVal('alpha', 1),
                    pdfUrl: URL.createObjectURL(localPdfFiles[code]),
                    pngUrl: URL.createObjectURL(localBhunkshaFiles[code]),
                    isLocal: true
                });
            }
        }

        if(matchedData.length > 0) {
            matchedData.sort((a,b) => a.code.localeCompare(b.code));
            savedMapsData = matchedData;
            currentIndex = 0;
            showViewer();
        } else {
            alert(`No matching files found between ${bhunkshaCount} images and ${pdfCount} PDFs.\nEnsure filenames match exactly (e.g. 0001.png and 0001.pdf).`);
        }
    } else if (bhunkshaCount > 0 || pdfCount > 0) {
        console.log(`Waiting for both folders. Bhunksha: ${bhunkshaCount}, PDF: ${pdfCount}`);
    }
}

// --- Initialization ---
window.addEventListener('load', async () => {
    await loadFromCloud();
});

function checkReady() {
    // Helper to ensure components are ready if needed
    console.log("System Ready");
}

async function loadFromCloud() {
    isCloudLoading = true;
    loader.classList.remove('hidden');
    document.getElementById('loader-text').textContent = "Syncing with Cloud...";
    try {
        const response = await fetch(CLOUD_API_URL + "?_t=" + Date.now());
        const cloudData = await response.json();
        
        cloudDataLookup = {}; 
        if (cloudData.length > 0) {
            savedMapsData = cloudData.map(item => {
                const mapObj = {
                    code: item.code.toString().padStart(4, '0'),
                    posX: parseFloat(item.posX) || 0,
                    posY: parseFloat(item.posY) || 0,
                    scaleX: parseFloat(item.scaleX) || 1.35,
                    scaleY: parseFloat(item.scaleY) || 1,
                    rotation: parseFloat(item.rotation) || 0,
                    alpha: parseFloat(item.alpha) || 1,
                    pdfUrl: `./pdf/${item.code.toString().padStart(4, '0')}.pdf`, 
                    pngUrl: `./bhunksha/${item.code.toString().padStart(4, '0')}.png`,
                    pdfName: `${item.code}.pdf`,
                    pngName: `${item.code}.png`
                };
                cloudDataLookup[mapObj.code] = mapObj;
                return mapObj;
            });
            showViewer();
        }
    } catch (err) {
        console.error("Cloud load error:", err);
    }
    isCloudLoading = false;
    loader.classList.add('hidden');
}

function showViewer() {
    if (savedMapsData.length > 0) {
        mainViewer.classList.remove('hidden');
        emptyState.classList.add('hidden');
        updateViewer();
    }
}

async function updateViewer() {
    if (savedMapsData.length === 0) return;
    const data = savedMapsData[currentIndex];
    currentCodeEl.textContent = `Map ID: ${data.code}`;
    currentFilesEl.textContent = `File: ${data.code}`;
    
    loader.classList.remove('hidden');
    document.getElementById('loader-text').textContent = "Rendering PDF Base...";

    try {
        // Load PDF using PDF.js
        const loadingTask = pdfjsLib.getDocument(data.pdfUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        // Use a consistent scale for high quality but faster rendering (1.5 instead of 2.5)
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        mainBase.src = canvas.toDataURL('image/png');
    } catch (err) {
        console.error("PDF Render Error:", err);
        // Fallback to direct src if it's an image or if rendering fails
        mainBase.src = data.pdfUrl;
    }
    
    mainTop.src = data.pngUrl;
    loader.classList.add('hidden');

    alphaSlider.value = data.alpha;
    scaleXSlider.value = data.scaleX;
    scaleYSlider.value = data.scaleY;
    
    mainTop.style.opacity = data.alpha;
    updateTransform();
}

function updateTransform() {
    const data = savedMapsData[currentIndex];
    if (!data) return;
    mainTop.style.transform = `translate(${data.posX}px, ${data.posY}px) rotate(${data.rotation || 0}deg) scale(${scaleXSlider.value}, ${scaleYSlider.value})`;
}

function saveLocalData() {
    if(isAdmin) return; // Admins save to cloud
    const data = savedMapsData[currentIndex];
    if(!data) return;
    
    data.alpha = parseFloat(alphaSlider.value);
    data.scaleX = parseFloat(scaleXSlider.value);
    data.scaleY = parseFloat(scaleYSlider.value);
    
    let localDataStore = JSON.parse(localStorage.getItem('censusLocalMaps')) || {};
    localDataStore[data.code] = {
        posX: data.posX,
        posY: data.posY,
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        rotation: data.rotation || 0,
        alpha: data.alpha
    };
    localStorage.setItem('censusLocalMaps', JSON.stringify(localDataStore));
}

// --- Admin Logic ---
const loginModal = document.getElementById('login-modal');
const loginPasswordInput = document.getElementById('login-password');
const btnLoginCancel = document.getElementById('btn-login-cancel');
const btnLoginSubmit = document.getElementById('btn-login-submit');

btnLogin.addEventListener('click', () => {
    loginModal.classList.remove('hidden');
    loginPasswordInput.value = '';
    loginPasswordInput.focus();
});

btnLoginCancel.addEventListener('click', () => {
    loginModal.classList.add('hidden');
});

btnLoginSubmit.addEventListener('click', () => {
    const pass = loginPasswordInput.value;
    if (pass === "1520") {
        isAdmin = true;
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        btnLogin.textContent = "🔓 Admin Active";
        btnLogin.style.opacity = "1";
        loginModal.classList.add('hidden');
        alert("Login Successful! You can now edit and save to cloud.");
    } else {
        alert("Incorrect Password.");
    }
});

loginPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnLoginSubmit.click();
    }
});


async function saveToCloud() {
    if (!isAdmin) return;
    const data = savedMapsData[currentIndex];
    data.alpha = parseFloat(alphaSlider.value);
    data.scaleX = parseFloat(scaleXSlider.value);
    data.scaleY = parseFloat(scaleYSlider.value);
    data.rotation = data.rotation || 0;

    btnSaveCloud.textContent = "⌛ Saving...";
    btnSaveCloud.disabled = true;

    try {
        await fetch(CLOUD_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(data)
        });
        alert(`Cloud Save Sent!\nMap: ${data.code}\nPos: ${data.posX.toFixed(1)}, ${data.posY.toFixed(1)}\nScale: ${data.scaleX.toFixed(3)}, ${data.scaleY.toFixed(3)}`);
        cloudDataLookup[data.code] = {...data};
    } catch (err) {
        console.error("Cloud save error:", err);
        alert("Error saving to cloud.");
    }

    btnSaveCloud.textContent = "☁️ Save One";
    btnSaveCloud.disabled = false;
}

async function saveAllToCloud() {
    if (!isAdmin) return;
    if (!confirm("This will save ALL current map alignments to the cloud. Continue?")) return;
    
    const btn = document.getElementById('btn-save-all-cloud');
    btn.textContent = "⌛ Syncing All...";
    btn.disabled = true;

    try {
        for (let i = 0; i < savedMapsData.length; i++) {
            const data = savedMapsData[i];
            await fetch(CLOUD_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(data)
            });
        }
        alert("Bulk sync complete! All changes pushed to cloud.");
    } catch (err) {
        console.error("Bulk sync error:", err);
        alert("An error occurred during bulk sync.");
    }

    btn.textContent = "☁️ Sync All";
    btn.disabled = false;
}

// Manual Export/Import
document.getElementById('btn-export-json').addEventListener('click', () => {
    const json = JSON.stringify(savedMapsData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MapAlignments_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
});

document.getElementById('btn-import-json').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                data.forEach(item => {
                    if (item.code) {
                        // Ensure code is padded correctly
                        const paddedCode = item.code.toString().padStart(4, '0');
                        cloudDataLookup[paddedCode] = item;
                    }
                });
                alert("Data imported successfully! Select your folders again to apply changes.");
            } catch (err) {
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

document.getElementById('btn-debug-cloud').addEventListener('click', async () => {
    try {
        const response = await fetch(CLOUD_API_URL + "?_t=" + Date.now());
        const raw = await response.text();
        console.log("Raw Cloud JSON:", raw);
        alert("Latest Cloud Data fetched! Check Browser Console (F12) for full details.\n\nSummary: " + raw.substring(0, 150) + "...");
    } catch (err) {
        alert("Debug fetch failed: " + err.message);
    }
});

btnSaveCloud.addEventListener('click', saveToCloud);
document.getElementById('btn-save-all-cloud').addEventListener('click', saveAllToCloud);
document.getElementById('btn-refresh-cloud').addEventListener('click', loadFromCloud);

// --- Navigation & UI ---
btnPrev.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; updateViewer(); } });
btnNext.addEventListener('click', () => { if (currentIndex < savedMapsData.length - 1) { currentIndex++; updateViewer(); } });

const inputJumpMap = document.getElementById('input-jump-map');
inputJumpMap.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        let targetCode = inputJumpMap.value.trim();
        if (!targetCode) return;
        // Pad with zeros to match standard code format
        targetCode = targetCode.padStart(4, '0');
        const foundIndex = savedMapsData.findIndex(m => m.code === targetCode);
        if (foundIndex !== -1) {
            currentIndex = foundIndex;
            updateViewer();
            inputJumpMap.value = '';
            inputJumpMap.blur();
        } else {
            alert(`Map ID ${targetCode} not found!`);
        }
    }
});

btnFullscreen.addEventListener('click', () => {
    mainViewer.classList.toggle('is-fullscreen');
    btnFullscreen.textContent = mainViewer.classList.contains('is-fullscreen') ? '🗗' : '🔳';
});

document.getElementById('btn-toggle-tab').addEventListener('click', () => {
    mainViewer.classList.toggle('controls-hidden');
    document.getElementById('btn-toggle-tab').textContent = mainViewer.classList.contains('controls-hidden') ? '▶' : '◀';
});

// Precision Nudge
window.nudgeScale = (axis, amount) => {
    const slider = axis === 'x' ? scaleXSlider : scaleYSlider;
    slider.value = parseFloat(slider.value) + amount;
    updateTransform();
    saveLocalData();
};

window.nudgePos = (dx, dy) => {
    const data = savedMapsData[currentIndex];
    if (!data) return;
    data.posX += dx;
    data.posY += dy;
    updateTransform();
    saveLocalData();
};

// --- Sliders ---
alphaSlider.addEventListener('change', () => { mainTop.style.opacity = alphaSlider.value; saveLocalData(); });
alphaSlider.addEventListener('input', () => { mainTop.style.opacity = alphaSlider.value; });
scaleXSlider.addEventListener('change', () => { updateTransform(); saveLocalData(); });
scaleXSlider.addEventListener('input', updateTransform);
scaleYSlider.addEventListener('change', () => { updateTransform(); saveLocalData(); });
scaleYSlider.addEventListener('input', updateTransform);

// --- Rotation ---
let rotateInterval;
function handleRotation(dir) {
    const data = savedMapsData[currentIndex];
    if (!data) return;
    if (data.rotation === undefined) data.rotation = 0;
    
    data.rotation += dir * 0.2; // Small nudge
    updateTransform();
}
function startRotation(dir) {
    handleRotation(dir);
    // Continuous rotation
    rotateInterval = setInterval(() => {
        handleRotation(dir);
    }, 30);
}
function stopRotation() {
    clearInterval(rotateInterval);
    saveLocalData();
}

const btnRotateCw = document.getElementById('btn-rotate-cw');
const btnRotateCcw = document.getElementById('btn-rotate-ccw');

btnRotateCw.addEventListener('mousedown', () => startRotation(1));
btnRotateCw.addEventListener('mouseup', stopRotation);
btnRotateCw.addEventListener('mouseleave', stopRotation);

btnRotateCcw.addEventListener('mousedown', () => startRotation(-1));
btnRotateCcw.addEventListener('mouseup', stopRotation);
btnRotateCcw.addEventListener('mouseleave', stopRotation);

// --- Dragging ---
let isDragging = false;
let startX, startY;
mainTop.addEventListener('mousedown', (e) => {
    const data = savedMapsData[currentIndex];
    isDragging = true;
    startX = e.clientX - data.posX;
    startY = e.clientY - data.posY;
    e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const data = savedMapsData[currentIndex];
    data.posX = e.clientX - startX;
    data.posY = e.clientY - startY;
    updateTransform();
});
window.addEventListener('mouseup', () => { 
    if(isDragging) {
        isDragging = false; 
        saveLocalData();
    }
});

// --- Download ---
document.getElementById('btn-download-single').addEventListener('click', () => {
    const data = savedMapsData[currentIndex];
    downloadSuperimposed(data.code, mainBase, mainTop, alphaSlider.value, data.posX, data.posY, scaleXSlider.value, scaleYSlider.value);
});

async function downloadSuperimposed(code, baseImg, topImg, alpha, posX, posY, sx, sy) {
    const outputCanvas = document.createElement('canvas');
    const ctx = outputCanvas.getContext('2d');
    
    // Set to A4 Landscape Resolution (approx 150-200 DPI for A4)
    outputCanvas.width = 2000; 
    outputCanvas.height = 1414;

    // Fill white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

    // Get actual container dimensions for accurate ratio mapping
    const workspace = document.getElementById('overlay-workspace');
    const displayWidth = workspace.clientWidth || 1200;
    const displayHeight = workspace.clientHeight || 848;
    
    const ratioX = outputCanvas.width / displayWidth;
    const ratioY = outputCanvas.height / displayHeight;

    // Draw base (PDF render) stretched to fill A4 area
    ctx.drawImage(baseImg, 0, 0, outputCanvas.width, outputCanvas.height);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(posX * ratioX, posY * ratioY);
    
    const data = savedMapsData[currentIndex];
    if (data && data.rotation) {
        ctx.rotate(data.rotation * Math.PI / 180);
    }
    
    ctx.scale(sx, sy);
    
    // Apply Multiply blend mode to match viewer
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(topImg, 0, 0, outputCanvas.width, outputCanvas.height);
    ctx.restore();

    outputCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `Superimposed_${code}.png`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
}

// --- Bulk Download ---
async function processMapZip(mapsToDownload, zipFilename) {
    if (!mapsToDownload || mapsToDownload.length === 0) {
        alert("No maps to download in this range!");
        return;
    }

    loader.classList.remove('hidden');
    const progressText = document.getElementById('loader-progress');
    const zip = new JSZip();

    const workspace = document.getElementById('overlay-workspace');
    const screenW = workspace.clientWidth || 1200;
    const screenH = workspace.clientHeight || 848;

    try {
        for (let i = 0; i < mapsToDownload.length; i++) {
            progressText.textContent = `Processing map ${i + 1} of ${mapsToDownload.length}...`;
            const data = mapsToDownload[i];

            // Render PDF Base
            let baseCanvas;
            try {
                const loadingTask = pdfjsLib.getDocument(data.pdfUrl);
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.5 });
                baseCanvas = document.createElement('canvas');
                const baseCtx = baseCanvas.getContext('2d');
                baseCanvas.width = viewport.width;
                baseCanvas.height = viewport.height;
                
                // Fill white background for PDF
                baseCtx.fillStyle = "white";
                baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
                
                await page.render({ canvasContext: baseCtx, viewport: viewport }).promise;
            } catch (err) {
                console.error(`PDF Render fail for ${data.code}:`, err);
                // Create blank fallback
                baseCanvas = document.createElement('canvas');
                baseCanvas.width = 1200; baseCanvas.height = 720;
                const baseCtx = baseCanvas.getContext('2d');
                baseCtx.fillStyle = "white";
                baseCtx.fillRect(0, 0, 1200, 720);
            }

            // Load PNG Top
            const topImg = new Image();
            topImg.src = data.pngUrl;
            await new Promise(resolve => {
                topImg.onload = resolve;
                topImg.onerror = resolve; // Continue even if top image fails
            });

            // Create Final Output Canvas (A4 Landscape: 2000x1414)
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = 2000;
            finalCanvas.height = 1414;
            const finalCtx = finalCanvas.getContext('2d');
            
            // Fill white background
            finalCtx.fillStyle = "white";
            finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            // Draw Base stretched to fill A4
            finalCtx.drawImage(baseCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
            
            const ratioX = finalCanvas.width / screenW;
            const ratioY = finalCanvas.height / screenH;

            finalCtx.save();
            finalCtx.globalAlpha = data.alpha;
            finalCtx.translate(data.posX * ratioX, data.posY * ratioY);
            
            if (data.rotation) {
                finalCtx.rotate(data.rotation * Math.PI / 180);
            }
            
            finalCtx.scale(data.scaleX, data.scaleY);
            
            // Apply Multiply blend mode to match viewer
            finalCtx.globalCompositeOperation = 'multiply';
            finalCtx.drawImage(topImg, 0, 0, finalCanvas.width, finalCanvas.height);
            finalCtx.restore();

            const blob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/png'));
            zip.file(`Superimposed_${data.code}.png`, blob);
        }

        progressText.textContent = "Generating ZIP file...";
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.download = zipFilename;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (err) {
        console.error("Bulk Download Error:", err);
        alert("An error occurred during bulk download. Please check the console.");
    } finally {
        progressText.textContent = "";
        loader.classList.add('hidden');
    }
}

document.getElementById('btn-download-all').addEventListener('click', () => {
    processMapZip(savedMapsData, 'Census_Maps_All.zip');
});

document.getElementById('btn-download-batch').addEventListener('click', () => {
    if (!savedMapsData || savedMapsData.length === 0) {
        alert("No maps loaded!");
        return;
    }
    
    let startVal = parseInt(document.getElementById('input-batch-start').value);
    let endVal = parseInt(document.getElementById('input-batch-end').value);
    
    if (isNaN(startVal) || isNaN(endVal) || startVal > endVal) {
        alert("Please enter a valid range (e.g. From 14 To 20).");
        return;
    }
    
    // Filter maps where the numeric value of the code is within the range
    const filteredMaps = savedMapsData.filter(map => {
        const numCode = parseInt(map.code, 10);
        return numCode >= startVal && numCode <= endVal;
    });
    
    processMapZip(filteredMaps, `Census_Maps_${startVal}_to_${endVal}.zip`);
});

// --- Initial Setup Helper ---
// If the user wants to add maps for the first time
window.manualAdd = async (code) => {
    if(!isAdmin) return;
    const newMap = {
        code: code.toString().padStart(4, '0'),
        posX: 0, posY: 0, scaleX: 1, scaleY: 1, alpha: 1,
        pdfUrl: `./pdf/${code.toString().padStart(4, '0')}.pdf`, 
        pngUrl: `./bhunksha/${code.toString().padStart(4, '0')}.png`
    };
    savedMapsData.push(newMap);
    showViewer();
    currentIndex = savedMapsData.length - 1;
    updateViewer();
};
// PDF Replace Logic
const btnReplacePdf = document.getElementById('btn-replace-pdf');
const replacePdfInput = document.getElementById('replace-pdf-input');
if(btnReplacePdf && replacePdfInput) {
    btnReplacePdf.onclick = () => replacePdfInput.click();
    replacePdfInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file && savedMapsData[currentIndex]) {
            savedMapsData[currentIndex].pdfUrl = URL.createObjectURL(file);
            updateViewer();
        }
    };
}
