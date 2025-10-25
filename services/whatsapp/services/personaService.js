import fs from 'fs';

const FILE = './persona.json';

let persona = {
    brand: "XYZ Şirketi",
    address: "Örnek Mah. 123, İstanbul",
    tone: "Samimi, kısa ve anlaşılır",
    extra_instructions: "Asla spam yapma, her zaman yardımcı ol."
};

if (fs.existsSync(FILE)) {
    persona = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
}

export function getPersona() {
    return persona;
}

export function updatePersona(newPersona) {
    persona = newPersona;
    fs.writeFileSync(FILE, JSON.stringify(persona, null, 2));
}
