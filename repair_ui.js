const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

if (code.endsWith('}\n')) code = code.slice(0, -2);
if (code.endsWith('}')) code = code.slice(0, -1);

code = code.replace(
`function openLightbox(url) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = url;
    lightbox.classList.add('active');`,
`function openLightbox(url) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = url;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}`
);

code = code.replace(
`    document.body.style.overflow = 'hidden';
}

function closeLightbox() {`,
`function closeLightbox() {`
);

fs.writeFileSync('js/ui.js', code);
console.log('ui.js repaired successfully');
