document.addEventListener('DOMContentLoaded', () => {
    // DOM Elementleri
    const world = document.getElementById('world');
    const viewport = document.getElementById('viewport');
    const svgLayer = document.getElementById('connections-layer');
    const blocksLayer = document.getElementById('blocks-layer');

    // State (Durum) Değişkenleri
    let scale = 1;
    let pan = { x: 0, y: 0 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    let isDraggingBlock = false;
    let draggedBlock = null;
    let dragStart = { x: 0, y: 0 }; 
    let blockStart = { x: 0, y: 0 }; 

    let isConnecting = false;
    let connectionSource = null;
    let tempLine = null;
    
    let blockIdCounter = 1;
    let connections = []; 

    const defaultColors = {
        giris: "#3498db",
        gelisme: "#f1c40f",
        sonuc: "#9b59b6"
    };

    function getContrastColor(hexcolor) {
        if (hexcolor.indexOf('#') === 0) hexcolor = hexcolor.slice(1);
        if (hexcolor.length === 3) hexcolor = hexcolor[0] + hexcolor[0] + hexcolor[1] + hexcolor[1] + hexcolor[2] + hexcolor[2];
        var r = parseInt(hexcolor.substr(0, 2), 16);
        var g = parseInt(hexcolor.substr(2, 2), 16);
        var b = parseInt(hexcolor.substr(4, 2), 16);
        var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? 'black' : 'white';
    }

    // --- 1. ZOOM VE PAN ---
    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        if (e.deltaY < 0) scale = Math.min(scale + zoomSpeed, 3);
        else scale = Math.max(scale - zoomSpeed, 0.2);
        updateWorldTransform();
    });

    viewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.block') || e.target.classList.contains('connector')) return;
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        viewport.style.cursor = 'grabbing';
    });

    function updateWorldTransform() {
        world.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${scale})`;
    }

    // --- 2. BLOK YÖNETİMİ ---

    document.getElementById('create-giris').onclick = () => createBlock('giris');
    document.getElementById('create-gelisme').onclick = () => createBlock('gelisme');
    document.getElementById('create-sonuc').onclick = () => createBlock('sonuc');
    document.getElementById('color-picker').oninput = (e) => document.body.style.backgroundColor = e.target.value;
    
    // YENİ: TÜMÜNÜ TEMİZLE
    document.getElementById('clear-all').onclick = () => {
        if(confirm('Tüm çalışmayı silmek istediğine emin misin?')) {
            clearCanvas();
        }
    };

    function clearCanvas() {
        blocksLayer.innerHTML = '';
        svgLayer.innerHTML = '';
        connections = [];
        blockIdCounter = 1;
        pan = { x: 0, y: 0 };
        scale = 1;
        updateWorldTransform();
    }

    function createBlock(type) {
        const id = blockIdCounter++;
        const el = document.createElement('div');
        el.className = `block ${type} disconnected`;
        el.dataset.id = id;
        
        const centerX = (-pan.x + window.innerWidth/2) / scale;
        const centerY = (-pan.y + window.innerHeight/2) / scale;
        el.style.left = `${centerX - 100}px`; 
        el.style.top = `${centerY - 70}px`;

        const defColor = defaultColors[type];
        const contrastColor = getContrastColor(defColor);

        // YENİ: DELETE BUTONU EKLENDİ (span.delete-btn)
        el.innerHTML = `
            <div class="block-header" style="background-color: ${defColor}; color: ${contrastColor}">
                <span contenteditable="true" class="header-text">${type.toUpperCase()} ${id}</span>
                <div style="display:flex; align-items:center;">
                    <input type="color" class="block-color-picker" value="${defColor}">
                    <span class="delete-btn" title="Bloğu Sil">×</span>
                </div>
            </div>
            <div class="block-content" contenteditable="true">İçerik...</div>
            <div class="block-footer">Bağlantı Yok</div>
            <div class="connector input" data-type="input" data-block="${id}"></div>
            <div class="connector output" data-type="output" data-block="${id}"></div>
        `;

        // BLOK SÜRÜKLEME
        el.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('block-color-picker') || 
                e.target.classList.contains('delete-btn') || // Silme butonuna basınca sürükleme
                e.target.getAttribute('contenteditable') === "true" ||
                e.target.classList.contains('connector')) 
            {
                return;
            }
            e.stopPropagation(); 
            isDraggingBlock = true;
            draggedBlock = el;
            dragStart = { x: e.clientX, y: e.clientY };
            blockStart = { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 };
            blocksLayer.appendChild(el); 
            el.classList.add('active-drag');
        });

        // RENK DEĞİŞTİRME
        const colorInput = el.querySelector('.block-color-picker');
        const header = el.querySelector('.block-header');
        colorInput.addEventListener('mousedown', (e) => e.stopPropagation());
        colorInput.addEventListener('input', (e) => {
            const newColor = e.target.value;
            header.style.backgroundColor = newColor;
            header.style.color = getContrastColor(newColor);
        });

        // YENİ: BLOK SİLME FONKSİYONU
        const deleteBtn = el.querySelector('.delete-btn');
        deleteBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Sürüklemeyi engelle
            deleteBlock(id);
        });

        // KONEKTÖR BAŞLATMA
        const outConnector = el.querySelector('.connector.output');
        outConnector.addEventListener('mousedown', (e) => startConnectionDrag(e, id, outConnector));

        // İSİM DEĞİŞİKLİĞİ
        const headerText = el.querySelector('.header-text');
        headerText.addEventListener('input', () => {
            connections.forEach(conn => {
                if (conn.from == id) updateFooterInfo(conn.to);
                if (conn.to == id) updateFooterInfo(conn.from);
            });
        });

        blocksLayer.appendChild(el);
    }

    function deleteBlock(id) {
        const el = document.querySelector(`.block[data-id="${id}"]`);
        if (!el) return;

        // 1. Bu bloğa bağlı tüm bağlantıları bul ve temizle
        // Etkilenen (bağlantısı kopan) diğer blokların ID'lerini topla
        let affectedBlockIds = new Set();

        // Geriye kalan connections listesini filtrele
        connections = connections.filter(conn => {
            if (conn.from == id || conn.to == id) {
                // SVG çizgisini DOM'dan sil
                conn.line.remove();
                
                // Diğer tarafın ID'sini etkilenenler listesine ekle
                if (conn.from == id) affectedBlockIds.add(conn.to);
                if (conn.to == id) affectedBlockIds.add(conn.from);
                
                return false; // Bu bağlantıyı diziden çıkar
            }
            return true;
        });

        // 2. Bloğu DOM'dan sil
        el.remove();

        // 3. Etkilenen diğer blokların footer bilgilerini ve renklerini güncelle
        affectedBlockIds.forEach(affectedId => {
            updateFooterInfo(affectedId);
            updateBlockColors(affectedId);
        });
    }

    // --- 3. GLOBAL HAREKET ---
    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            pan.x += dx;
            pan.y += dy;
            panStart = { x: e.clientX, y: e.clientY };
            updateWorldTransform();
        }
        if (isDraggingBlock && draggedBlock) {
            e.preventDefault();
            const dx = (e.clientX - dragStart.x) / scale;
            const dy = (e.clientY - dragStart.y) / scale;
            draggedBlock.style.left = `${blockStart.x + dx}px`;
            draggedBlock.style.top = `${blockStart.y + dy}px`;
            updateLinesForBlock(draggedBlock.dataset.id);
        }
        if (isConnecting && tempLine) {
            const mouseWorldX = (e.clientX - pan.x) / scale;
            const mouseWorldY = (e.clientY - pan.y) / scale;
            const svgOff = 50000;
            tempLine.setAttribute('x2', mouseWorldX + svgOff);
            tempLine.setAttribute('y2', mouseWorldY + svgOff);
        }
    });

    document.addEventListener('mouseup', (e) => {
        isPanning = false;
        viewport.style.cursor = 'grab';
        if (isDraggingBlock) {
            if (draggedBlock) draggedBlock.classList.remove('active-drag');
            isDraggingBlock = false;
            draggedBlock = null;
        }
        if (isConnecting) {
            const target = document.elementFromPoint(e.clientX, e.clientY);
            if (target && target.classList.contains('connector') && target.dataset.type === 'input') {
                const targetId = target.dataset.block;
                if (targetId !== connectionSource.blockId) {
                    finalizeConnection(connectionSource.blockId, targetId);
                }
            }
            if (tempLine) tempLine.remove();
            tempLine = null;
            isConnecting = false;
        }
    });

    // --- 4. BAĞLANTI MANTIĞI ---
    function startConnectionDrag(e, sourceId, element) {
        e.stopPropagation();
        e.preventDefault();
        isConnecting = true;
        connectionSource = { blockId: sourceId };
        const rect = element.getBoundingClientRect();
        const centerX = (rect.left + rect.width/2 - pan.x) / scale;
        const centerY = (rect.top + rect.height/2 - pan.y) / scale;
        const svgOff = 50000;
        tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tempLine.setAttribute('x1', centerX + svgOff);
        tempLine.setAttribute('y1', centerY + svgOff);
        tempLine.setAttribute('x2', centerX + svgOff);
        tempLine.setAttribute('y2', centerY + svgOff);
        tempLine.classList.add('connection-line', 'temp');
        svgLayer.appendChild(tempLine);
    }

    function finalizeConnection(sourceId, targetId) {
        if (connections.find(c => c.from == sourceId && c.to == targetId)) return;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('connection-line');
        svgLayer.appendChild(line);
        connections.push({ from: sourceId, to: targetId, line: line });
        updateLinesForBlock(sourceId);
        updateFooterInfo(sourceId);
        updateFooterInfo(targetId);
        updateBlockColors(sourceId);
        updateBlockColors(targetId);
    }

    function updateLinesForBlock(blockId) {
        connections.forEach(conn => {
            if (conn.from == blockId || conn.to == blockId) {
                const b1 = document.querySelector(`.block[data-id="${conn.from}"]`);
                const b2 = document.querySelector(`.block[data-id="${conn.to}"]`);
                if (!b1 || !b2) return;
                const c1 = b1.querySelector('.connector.output').getBoundingClientRect();
                const c2 = b2.querySelector('.connector.input').getBoundingClientRect();
                const x1 = (c1.left + c1.width/2 - pan.x) / scale + 50000;
                const y1 = (c1.top + c1.height/2 - pan.y) / scale + 50000;
                const x2 = (c2.left + c2.width/2 - pan.x) / scale + 50000;
                const y2 = (c2.top + c2.height/2 - pan.y) / scale + 50000;
                conn.line.setAttribute('x1', x1);
                conn.line.setAttribute('y1', y1);
                conn.line.setAttribute('x2', x2);
                conn.line.setAttribute('y2', y2);
            }
        });
    }

    function updateFooterInfo(blockId) {
        const block = document.querySelector(`.block[data-id="${blockId}"]`);
        if (!block) return;
        const outgoing = connections.filter(c => c.from == blockId).map(c => c.to);
        const incoming = connections.filter(c => c.to == blockId).map(c => c.from);
        let text = "";
        if (outgoing.length > 0) {
            const names = outgoing.map(id => {
                const el = document.querySelector(`.block[data-id="${id}"] .header-text`);
                return el ? el.innerText : id;
            });
            text += "Gidiyor: " + names.join(", ");
        }
        if (incoming.length > 0) {
            const names = incoming.map(id => {
                const el = document.querySelector(`.block[data-id="${id}"] .header-text`);
                return el ? el.innerText : id;
            });
            text += (text ? " | " : "") + "Geliyor: " + names.join(", ");
        }
        if (text === "") text = "Bağlantı Yok";
        block.querySelector('.block-footer').innerText = text;
    }

    function updateBlockColors(id) {
        const el = document.querySelector(`.block[data-id="${id}"]`);
        if (!el) return;
        const isConnected = connections.some(c => c.from == id || c.to == id);
        if (isConnected) {
            el.classList.add('connected');
            el.classList.remove('disconnected');
        } else {
            el.classList.add('disconnected');
            el.classList.remove('connected');
        }
    }
});