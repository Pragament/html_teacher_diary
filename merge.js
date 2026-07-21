const fs = require('fs');
let ui = fs.readFileSync('js/ui.js', 'utf8');
const chunk = fs.readFileSync('js/ui_restore_chunk.js', 'utf8');

const targetStr = "async function loadSettingsUI() {\r\n    const settings = getSettings();\r\n    document.getElementById('settingsPeriods').value = settings.periodsPerDay || 8;\r\n}";
const targetStr2 = "async function loadSettingsUI() {\n    const settings = getSettings();\n    document.getElementById('settingsPeriods').value = settings.periodsPerDay || 8;\n}";

if (ui.includes(targetStr)) {
    ui = ui.replace(targetStr, chunk);
} else if (ui.includes(targetStr2)) {
    ui = ui.replace(targetStr2, chunk);
} else {
    // maybe we just replace from loadSettingsUI to the next block
    const idx1 = ui.indexOf('async function loadSettingsUI() {');
    const idx2 = ui.indexOf('// ================================================================', idx1 + 10);
    if (idx1 > -1 && idx2 > -1) {
        ui = ui.substring(0, idx1) + chunk + "\n" + ui.substring(idx2);
    } else {
        console.log("Could not find the target string in ui.js");
    }
}

fs.writeFileSync('js/ui.js', ui);
console.log('Restored ui.js size:', ui.length);
