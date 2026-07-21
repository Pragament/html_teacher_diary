const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

const targetStr = `function openLightbox(url) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = url;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}`;

const replacementStr = `function openLightbox(url) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = url;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
    }
    document.body.style.overflow = '';
}`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('js/ui.js', code);
    console.log('Restored closeLightbox');
} else {
    console.log('Target string not found');
}
