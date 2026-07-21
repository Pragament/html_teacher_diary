const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

// The function starts with async function handleFetchConfigSubmit() {
const startIndex = code.indexOf('async function handleFetchConfigSubmit');
if (startIndex !== -1) {
    // Find the end of the function. We know it ends before window.showFetchConfigModal
    const endIndex = code.indexOf('window.showFetchConfigModal', startIndex);
    if (endIndex !== -1) {
        code = code.substring(0, startIndex) + code.substring(endIndex);
        fs.writeFileSync('js/ui.js', code);
        console.log('Removed handleFetchConfigSubmit');
    } else {
        console.log('Could not find end index');
    }
} else {
    console.log('Could not find start index');
}
