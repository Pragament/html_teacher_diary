const fs = require('fs');
let code = fs.readFileSync('js/principal.js', 'utf8');
code = code.replace(/\\`/g, '`');
fs.writeFileSync('js/principal.js', code);
console.log('Fixed escape characters');
