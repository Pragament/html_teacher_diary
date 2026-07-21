const fs = require('fs');
let ui = fs.readFileSync('js/ui.js', 'utf8');

const regex = /function editDay\(dateStr\) \{([\s\S]*?)function deleteDay\(dateStr\) \{([\s\S]*?)function editDay\(dateStr\) \{([\s\S]*?)function deleteDay\(dateStr\) \{([\s\S]*?)\}/;

const match = ui.match(regex);
if (match) {
    // Replace the entire duplicated block with just one instance
    ui = ui.replace(regex, `function editDay(dateStr) {$3function deleteDay(dateStr) {$4}`);
    fs.writeFileSync('js/ui.js', ui);
    console.log('Fixed deleteDay duplication');
} else {
    console.log('Could not find bad chunk');
}
