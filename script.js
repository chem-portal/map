const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const CLOUD_API_URL = "https://script.google.com/macros/s/AKfycbwgt8PcKuPDZ9mQUTJtmqsh7-xuJ8QrhA2S12KaqkPukKmx91KPpGU7feOL2mIBUfx4QQ/exec";
let isAdmin = false;

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
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const alphaSlider = document.getElementById('global-alpha');
const scaleXSlider = document.getElementById('scale-x');
const scaleYSlider = document.getElementById('scale-y');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnLogin = document.getElementById('btn-login');
const btnSaveCloud = document.getElementById('btn-save-cloud');

let localBhunkshaFiles = {};
let localPdfFiles = {};

document.getElementById('btn-bhunksha').addEventListener('click', () => document.getElementById('input-bhunksha').click());
document.getElementById('btn-pdf').addEventListener('click', () => document.getElementById('input-pdf').click());

document.getElementById('input-bhunksha').addEventListener('change', (e) => {
    const files = e.target.files;
    localBhunkshaFiles = {}; 
    for(let f of files) {
        if(f.name.toLowerCase().endsWith('.png') || f.name.toLowerCase().endsWith('.jpg')) {
            let code = f.name.replace(/\.[^/.]+$/, "").padStart(4, '0');
            localBhunkshaFiles[code] = f;
        }
    }
    document.getElementById('status-bhunksha').textContent = `${Object.keys(localBhunkshaFiles).length} images found`;
    checkAndStartLocal();
});

document.getElementById('input-pdf').addEventListener('change', (e) => {
    const files = e.target.files;
    localPdfFiles = {};
    for(let f of files) {
        if(f.name.toLowerCase().endsWith('.pdf')) {
            let code = f.name.replace(/\.[^/.]+$/, "").padStart(4, '0');
            localPdfFiles[code] = f;
        }
    }
    document.getElementById('status-pdf').textContent = `${Object.keys(localPdfFiles).length} PDFs found`;
    checkAndStartLocal();
});

document.getElementById('btn-compare').addEventListener('click', checkAndStartLocal);

function checkAndStartLocal() {
    if(Object.keys(localBhunkshaFiles).length > 0 && Object.keys(localPdfFiles).length > 0) {
        let matchedData = [];
        let localDataStore = JSON.parse(localStorage.getItem('censusLocalMaps')) || {};
        for(let code in localBhunkshaFiles) {
            if(localPdfFiles[code]) {
                let localSaved = localDataStore[code] || {};
                let cloudSaved = cloudDataLookup[code] || {};
                const getVal = (key, fallback) => {
                    if (localSaved[key] !== undefined) return localSaved[key];
                    if (cloudSaved[key] !== undefined) return cloudSaved[key];
                    return fallback;
                };
                matchedData.push({
                    code: code,
                    posX: parseFloat(getVal('posX', 0)),
                    posY: parseFloat(getVal('posY', 0)),
                    scaleX: parseFloat(getVal('scaleX', 1.35)),
                    scaleY: parseFloat(getVal('scaleY', 1)),
                    rotation: parseFloat(getVal('rotation', 0)),
                    alpha: parseFloat(getVal('alpha', 1)),
                    pdfUrl: URL.createObjectURL(localPdfFiles[code]),
                    pngUrl: URL.createObjectURL(localBhunkshaFiles[code]),
                    isRel: true // Force relative mode for new sessions
                });
            }
        }
        if(matchedData.length > 0) {
            matchedData.sort((a,b) => a.code.localeCompare(b.code));
            savedMapsData = matchedData;
            currentIndex = 0;
            showViewer();
        }
    }
}

window.addEventListener('load', async () => { await loadFromCloud(); });

async function loadFromCloud() {
    isCloudLoading = true;
    loader.classList.remove('hidden');
    try {
        const response = await fetch(CLOUD_API_URL + "?_t=" + Date.now());
        const cloudData = await response.json();
        cloudDataLookup = {}; 
        if (cloudData.length > 0) {
            cloudData.forEach(item => {
                const code = item.code.toString().padStart(4, '0');
                cloudDataLookup[code] = {
                    ...item,
                    code: code,
                    posX: parseFloat(item.posX),
                    posY: parseFloat(item.posY),
                    scaleX: parseFloat(item.scaleX),
                    scaleY: parseFloat(item.scaleY),
                    rotation: parseFloat(item.rotation),
                    alpha: parseFloat(item.alpha)
                };
            });
            if (!mainViewer.classList.contains('hidden')) {
                savedMapsData.forEach(m => { if (cloudDataLookup[m.code]) Object.assign(m, cloudDataLookup[m.code]); });
                updateViewer();
            }
        }
    } catch (err) { console.error(err); }
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
    loader.classList.remove('hidden');
    try {
        const pdf = await pdfjsLib.getDocument(data.pdfUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height; canvas.width = viewport.width;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        mainBase.src = canvas.toDataURL('image/png');
    } catch (err) { mainBase.src = data.pdfUrl; }
    mainTop.src = data.pngUrl;
    loader.classList.add('hidden');
    updateTransform();
}

function updateTransform() {
    const data = savedMapsData[currentIndex];
    if(!data) return;
    const bigView = document.querySelector('.big-view');
    const x = data.posX * bigView.clientWidth;
    const y = data.posY * bigView.clientHeight;
    mainTop.style.transform = `translate(${x}px, ${y}px) rotate(${data.rotation || 0}deg) scale(${scaleXSlider.value}, ${scaleYSlider.value})`;
    mainTop.style.opacity = data.alpha;
    alphaSlider.value = data.alpha;
    scaleXSlider.value = data.scaleX;
    scaleYSlider.value = data.scaleY;
}

function saveLocalData() {
    if(isAdmin) return;
    const data = savedMapsData[currentIndex];
    if(!data) return;
    let localDataStore = JSON.parse(localStorage.getItem('censusLocalMaps')) || {};
    localDataStore[data.code] = { ...data };
    localStorage.setItem('censusLocalMaps', JSON.stringify(localDataStore));
}

// --- Navigation ---
btnPrev.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; updateViewer(); } });
btnNext.addEventListener('click', () => { if (currentIndex < savedMapsData.length - 1) { currentIndex++; updateViewer(); } });
window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') btnNext.click();
    if (e.key === 'ArrowLeft') btnPrev.click();
});

// --- Admin ---
const loginModal = document.getElementById('login-modal');
const loginPassInput = document.getElementById('login-password');
btnLogin.addEventListener('click', () => loginModal.classList.remove('hidden'));
document.getElementById('btn-login-cancel').addEventListener('click', () => loginModal.classList.add('hidden'));
document.getElementById('btn-login-submit').addEventListener('click', () => {
    if (loginPassInput.value === "1520") {
        isAdmin = true;
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        btnLogin.textContent = "🔓 Admin Active";
        loginModal.classList.add('hidden');
        alert("Admin Mode Active.");
    } else alert("Wrong Password.");
});

async function saveToCloud() {
    if (!isAdmin) return;
    const data = savedMapsData[currentIndex];
    btnSaveCloud.textContent = "⌛ Saving...";
    try {
        await fetch(CLOUD_API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
        alert(`Saved ${data.code} to Cloud!`);
    } catch (err) { alert("Error."); }
    btnSaveCloud.textContent = "☁️ Save One";
}
btnSaveCloud.addEventListener('click', saveToCloud);

// --- Controls ---
alphaSlider.addEventListener('input', () => { 
    if(savedMapsData[currentIndex]) {
        savedMapsData[currentIndex].alpha = parseFloat(alphaSlider.value);
        mainTop.style.opacity = alphaSlider.value;
    }
});
scaleXSlider.addEventListener('input', () => {
    if(savedMapsData[currentIndex]) {
        savedMapsData[currentIndex].scaleX = parseFloat(scaleXSlider.value);
        updateTransform();
    }
});
scaleYSlider.addEventListener('input', () => {
    if(savedMapsData[currentIndex]) {
        savedMapsData[currentIndex].scaleY = parseFloat(scaleYSlider.value);
        updateTransform();
    }
});
scaleXSlider.addEventListener('change', saveLocalData);
scaleYSlider.addEventListener('change', saveLocalData);

window.nudgePos = (dx, dy) => {
    const data = savedMapsData[currentIndex];
    if (!data) return;
    const bigView = document.querySelector('.big-view');
    data.posX += (dx / bigView.clientWidth);
    data.posY += (dy / bigView.clientHeight);
    updateTransform();
    saveLocalData();
};
window.nudgeScale = (axis, amt) => {
    const data = savedMapsData[currentIndex];
    if (!data) return;
    if(axis === 'x') data.scaleX += amt; else data.scaleY += amt;
    updateTransform();
    saveLocalData();
};

let rotateInterval;
function handleRotation(dir) {
    const data = savedMapsData[currentIndex];
    if(data) { data.rotation += dir * 0.2; updateTransform(); }
}
document.getElementById('btn-rotate-cw').addEventListener('mousedown', () => rotateInterval = setInterval(() => handleRotation(1), 30));
document.getElementById('btn-rotate-ccw').addEventListener('mousedown', () => rotateInterval = setInterval(() => handleRotation(-1), 30));
window.addEventListener('mouseup', () => { clearInterval(rotateInterval); saveLocalData(); });

// --- Dragging (Locked to Map Container) ---
let isDragging = false;
let startX, startY;
mainTop.addEventListener('mousedown', (e) => {
    isDragging = true;
    mainTop.style.cursor = 'grabbing';
    const rect = mainTop.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const bigView = document.querySelector('.big-view');
    const bounds = bigView.getBoundingClientRect();
    const data = savedMapsData[currentIndex];
    data.posX = (e.clientX - bounds.left - startX) / bigView.clientWidth;
    data.posY = (e.clientY - bounds.top - startY) / bigView.clientHeight;
    updateTransform();
});
window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    mainTop.style.cursor = 'grab';
    saveLocalData();
});

// --- Replace Feature ---
const btnReplaceImg = document.getElementById('btn-replace-img');
const replaceImgInput = document.getElementById('replace-file-input');
const btnReplacePdf = document.getElementById('btn-replace-pdf');
const replacePdfInput = document.getElementById('replace-pdf-input');

if(btnReplaceImg && replaceImgInput) {
    btnReplaceImg.onclick = () => replaceImgInput.click();
    replaceImgInput.onchange = (e) => {
        const file = e.target.files[0];
        if(file && savedMapsData[currentIndex]) {
            savedMapsData[currentIndex].pngUrl = URL.createObjectURL(file);
            updateViewer();
        }
    };
}
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

// --- Sidebar Toggle ---
document.getElementById('btn-toggle-tab').addEventListener('click', () => {
    mainViewer.classList.toggle('controls-hidden');
    document.getElementById('btn-toggle-tab').textContent = mainViewer.classList.contains('controls-hidden') ? '▶' : '◀';
    updateTransform(); 
});

// --- Download ---
document.getElementById('btn-download-single').addEventListener('click', async () => {
    const data = savedMapsData[currentIndex];
    const canvas = document.createElement('canvas');
    canvas.width = 2000; canvas.height = 1414;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, 2000, 1414);
    
    const baseImg = new Image(); baseImg.src = mainBase.src;
    const topImg = new Image(); topImg.src = data.pngUrl;
    await Promise.all([new Promise(r => baseImg.onload = r), new Promise(r => topImg.onload = r)]);
    
    ctx.drawImage(baseImg, 0, 0, 2000, 1414);
    ctx.save();
    ctx.globalAlpha = data.alpha;
    ctx.translate(data.posX * 2000, data.posY * 1414);
    if (data.rotation) ctx.rotate(data.rotation * Math.PI / 180);
    ctx.scale(data.scaleX, data.scaleY);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(topImg, 0, 0, 2000, 1414);
    ctx.restore();
    
    const link = document.createElement('a');
    link.download = `Superimposed_${data.code}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

async function processMapZip(mapsToDownload, zipFilename) {
    if (!mapsToDownload || mapsToDownload.length === 0) return;
    loader.classList.remove('hidden');
    const zip = new JSZip();
    for (let i = 0; i < mapsToDownload.length; i++) {
        const data = mapsToDownload[i];
        const canvas = document.createElement('canvas');
        canvas.width = 2000; canvas.height = 1414;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, 2000, 1414);
        const pdf = await pdfjsLib.getDocument(data.pdfUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const pCanvas = document.createElement('canvas');
        pCanvas.width = viewport.width; pCanvas.height = viewport.height;
        await page.render({ canvasContext: pCanvas.getContext('2d'), viewport }).promise;
        const topImg = new Image(); topImg.src = data.pngUrl;
        await new Promise(resolve => topImg.onload = resolve);
        ctx.drawImage(pCanvas, 0, 0, 2000, 1414);
        ctx.save();
        ctx.globalAlpha = data.alpha;
        ctx.translate(data.posX * 2000, data.posY * 1414);
        if (data.rotation) ctx.rotate(data.rotation * Math.PI / 180);
        ctx.scale(data.scaleX, data.scaleY);
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(topImg, 0, 0, 2000, 1414);
        ctx.restore();
        const blob = await new Promise(r => canvas.toBlob(r));
        zip.file(`Superimposed_${data.code}.png`, blob);
    }
    const content = await zip.generateAsync({type:"blob"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = zipFilename;
    link.click();
    loader.classList.add('hidden');
}

document.getElementById('btn-download-all').addEventListener('click', () => processMapZip(savedMapsData, 'AllMaps.zip'));
document.getElementById('btn-download-batch').addEventListener('click', () => {
    const start = parseInt(document.getElementById('input-batch-start').value);
    const end = parseInt(document.getElementById('input-batch-end').value);
    const filtered = savedMapsData.filter(m => { const n = parseInt(m.code); return n >= start && n <= end; });
    processMapZip(filtered, `Batch_${start}_${end}.zip`);
});
