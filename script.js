const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- CLOUD CONFIG ---
const CLOUD_API_URL = "https://script.google.com/macros/s/AKfycbwgt8PcKuPDZ9mQUTJtmqsh7-xuJ8QrhA2S12KaqkPukKmx91KPpGU7feOL2mIBUfx4QQ/exec";
let isAdmin = false;

// --- State & DOM ---
let savedMapsData = [];
let currentIndex = 0;

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
    document.getElementById('status-bhunksha').textContent = `${files.length} files`;
    for(let f of files) {
        if(f.name.toLowerCase().endsWith('.png') || f.name.toLowerCase().endsWith('.jpg')) {
            let code = f.name.split('.')[0];
            localBhunkshaFiles[code] = f;
        }
    }
    checkAndStartLocal();
});

document.getElementById('input-pdf').addEventListener('change', (e) => {
    if(!alertShown) { alert("Please ensure Image names match PDF names exactly (e.g. 0001.png and 0001.pdf) and are in separate folders."); alertShown = true; }
    const files = e.target.files;
    document.getElementById('status-pdf').textContent = `${files.length} files`;
    for(let f of files) {
        if(f.name.toLowerCase().endsWith('.pdf')) {
            let code = f.name.split('.')[0];
            localPdfFiles[code] = f;
        }
    }
    checkAndStartLocal();
});

function checkAndStartLocal() {
    if(Object.keys(localBhunkshaFiles).length > 0 && Object.keys(localPdfFiles).length > 0) {
        let matchedData = [];
        let localDataStore = JSON.parse(localStorage.getItem('censusLocalMaps')) || {};

        for(let code in localBhunkshaFiles) {
            if(localPdfFiles[code]) {
                let localSaved = localDataStore[code] || {};
                matchedData.push({
                    code: code,
                    posX: localSaved.posX || 0,
                    posY: localSaved.posY || 0,
                    scaleX: localSaved.scaleX || 1.35,
                    scaleY: localSaved.scaleY || 1,
                    alpha: localSaved.alpha !== undefined ? localSaved.alpha : 1,
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
            alert("No matching files found. Ensure names match (e.g. 0001.png and 0001.pdf).");
        }
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
    loader.classList.remove('hidden');
    document.getElementById('loader-text').textContent = "Syncing with Cloud...";
    try {
        const response = await fetch(CLOUD_API_URL);
        const cloudData = await response.json();
        
        if (cloudData.length > 0) {
            savedMapsData = cloudData.map(item => ({
                code: item.code.toString().padStart(4, '0'),
                posX: parseFloat(item.posX) || 0,
                posY: parseFloat(item.posY) || 0,
                scaleX: parseFloat(item.scaleX) || 1.35,
                scaleY: parseFloat(item.scaleY) || 1,
                alpha: parseFloat(item.alpha) || 1,
                // Files are expected to be in relative folders on GitHub
                pdfUrl: `./pdf/${item.code.toString().padStart(4, '0')}.pdf`, 
                pngUrl: `./bhunksha/${item.code.toString().padStart(4, '0')}.png`,
                pdfName: `${item.code}.pdf`,
                pngName: `${item.code}.png`
            }));
            showViewer();
        }
    } catch (err) {
        console.error("Cloud load error:", err);
    }
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
        
        // Use a consistent scale for high quality
        const viewport = page.getViewport({ scale: 2.5 });
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
    mainTop.style.transform = `translate(${data.posX}px, ${data.posY}px) scale(${scaleXSlider.value}, ${scaleYSlider.value})`;
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

    btnSaveCloud.textContent = "⌛ Saving...";
    btnSaveCloud.disabled = true;

    try {
        await fetch(CLOUD_API_URL, {
            method: 'POST',
            mode: 'no-cors', // Apps Script requires no-cors for simple POST
            body: JSON.stringify(data)
        });
        alert(`Map ${data.code} saved to cloud!`);
    } catch (err) {
        console.error("Cloud save error:", err);
        alert("Error saving to cloud.");
    }

    btnSaveCloud.textContent = "☁️ Save to Cloud";
    btnSaveCloud.disabled = false;
}

btnSaveCloud.addEventListener('click', saveToCloud);

// --- Navigation & UI ---
btnPrev.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; updateViewer(); } });
btnNext.addEventListener('click', () => { if (currentIndex < savedMapsData.length - 1) { currentIndex++; updateViewer(); } });

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
    outputCanvas.width = baseImg.naturalWidth; outputCanvas.height = baseImg.naturalHeight;
    ctx.drawImage(baseImg, 0, 0);
    const displayWidth = baseImg.clientWidth;
    const ratio = baseImg.naturalWidth / displayWidth;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(posX * ratio, posY * ratio);
    ctx.scale(sx, sy);
    ctx.drawImage(topImg, 0, 0, baseImg.naturalWidth, baseImg.naturalHeight);
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
