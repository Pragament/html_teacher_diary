const fs = require('fs');
let code = fs.readFileSync('js/ui.js', 'utf8');

const badCode = `    if (fetchTriggerBtn) fetchTriggerBtn.disabled = true;
    } finally {
        btn.disabled = false;
        cancelBtn.disabled = false;
        if (fetchTriggerBtn) fetchTriggerBtn.disabled = false;
        btn.textContent = originalBtnText;
    }
}`;

const goodCode = `    if (fetchTriggerBtn) fetchTriggerBtn.disabled = true;
}`;

code = code.replace(badCode, goodCode);

fs.writeFileSync('js/ui.js', code);
console.log('Fixed syntax error in handleFetchConfigSubmit');
