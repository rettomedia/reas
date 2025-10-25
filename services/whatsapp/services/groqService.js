import dotenv from "dotenv";
dotenv.config();

import Groq from 'groq-sdk';
import fs from 'fs';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const messageHistory = {};

let persona = {
    brand: "Retto IT",
    address: "Türkiye",
    tone: "Samimi, kısa ve anlaşılır",
    extra_instructions: "Asla spam yapma, her zaman yardımcı ol."
};

if (fs.existsSync('./persona.json')) {
    persona = JSON.parse(fs.readFileSync('./persona.json', 'utf-8'));
}

export async function handleMessage(client, message, io) {
    const from = message.from;
    if (!messageHistory[from]) messageHistory[from] = [];
    messageHistory[from].push({ role: 'user', content: message.body });

    const systemPrompt = `
    Sen ${persona.brand} markasının WhatsApp asistanısın.
    Adres: ${persona.address}
    Tarz: ${persona.tone}
    ${persona.extra_instructions}
    `;

    const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            ...messageHistory[from],
        ],
    });

    const aiReply = completion.choices[0]?.message?.content || "Anlayamadım 😅";
    await client.sendMessage(from, aiReply);

    messageHistory[from].push({role: 'assistant', content: aiReply});
    io.emit('message', { from, body: message.body, reply: aiReply });
}