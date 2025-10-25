import fs from 'fs';
const FILE = './templates.json';

let templates = [];
if (fs.existsSync(FILE))
    templates = JSON.parse(fs.readFileSync(FILE, 'utf-8'));

export function getTemplates() {
    return templates;
}

export function addTemplate(trigger, reply) {
    templates.push({ trigger, reply });
    fs.writeFileSync(FILE, JSON.stringify(templates, null, 2));
    return { success: true };
}

export function deleteTemplate(index) {
    if (index < 0 || index >= templates.length) return { error: 'Şablon bulunamadı' };
    templates.splice(index, 1);
    fs.writeFileSync(FILE, JSON.stringify(templates, null, 2));
    return { success: true };
}
