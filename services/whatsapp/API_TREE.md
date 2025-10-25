## 1. Status & Health

```
GET /api/status
```

* Açıklama: Tüm servisin ve WhatsApp istemcisinin anlık durumunu döner.
* Response Örneği:

```json
{
  "isReady": false,
  "isAuthenticated": false,
  "hasQr": true,
  "qrCode": "QR_CODE_STRING",
  "hasSession": true,
  "isConnecting": false,
  "status": "qr_required"
}
```

```
GET /api/whatsapp/status
```

* Açıklama: Sadece WhatsApp istemcisinin durumu.
* Response:

```json
{
  "isReady": false,
  "isAuthenticated": false,
  "hasQr": true,
  "qrCode": "QR_CODE_STRING",
  "hasSession": true,
  "isConnecting": false,
  "status": "qr_required"
}
```

```
POST /api/request-qr
```

* Açıklama: Mevcut session varsa siler ve yeni QR kod oluşturur.
* Response:

```json
{ "status": "qr_requested", "hasSession": false }
```

## 2. Templates Yönetimi

```
GET /api/templates
```

* Açıklama: Tüm mesaj şablonlarını döner.
* Response:

```json
[
  { "trigger": "merhaba", "reply": "Merhaba! Nasılsın?" },
  ...
]
```

```
POST /api/templates
```

* Açıklama: Yeni template ekler.
* Body:

```json
{ "trigger": "selam", "reply": "Selam! Yardımcı olabilirim." }
```

* Response:

```json
{ "success": true }
```

```
DELETE /api/templates/:index
```

* Açıklama: Belirtilen index’teki template’i siler.
* Response:

```json
{ "success": true }
```

## 3. Persona Yönetimi

```
GET /api/persona
```

* Açıklama: Şu anki persona ayarlarını döner.
* Response:

```json
{
  "brand": "XYZ Şirketi",
  "address": "Örnek Mah. 123, İstanbul",
  "tone": "Samimi, kısa ve anlaşılır",
  "extra_instructions": "Asla spam yapma, her zaman yardımcı ol."
}
```

```
POST /api/persona
```

* Açıklama: Persona ayarlarını günceller.
* Body:

```json
{
  "brand": "ABC Şirketi",
  "address": "Yeni adres",
  "tone": "Resmi ve kısa",
  "extra_instructions": "Her zaman hızlı cevap ver."
}
```

* Response:

```json
{ "success": true }
```

## 4. Conversations / Mesaj Geçmişi

```
GET /api/conversations
```

* Açıklama: Tüm konuşma geçmişini döner.
* Response:

```json
{
  "phone1": { "phone": "phone1", "lastMessage": "...", "messageCount": 10, "history": [...] },
  "phone2": { ... }
}
```

```
GET /api/conversations/:phone
```

* Açıklama: Belirli telefon numarasına ait konuşmayı döner.
* Response:

```json
{
  "phone": "phone1",
  "history": [
    { "role": "user", "content": "Merhaba" },
    { "role": "assistant", "content": "Merhaba! Nasılsın?" }
  ],
  "messageCount": 2
}
```

```
DELETE /api/conversations/:phone
```

* Açıklama: Belirli telefon numarasına ait konuşmayı siler.
* Response:

```json
{ "success": true }
```

```
DELETE /api/conversations
```

* Açıklama: Tüm konuşmaları siler.
* Response:

```json
{ "success": true }
```

## 5. WhatsApp Kontrol & Yönetim

```
POST /api/logout
```

* Açıklama: WhatsApp hesabından çıkış yapar ve session’ı siler.
* Response:

```json
{ "success": true }
```

```
POST /api/restart
```

* Açıklama: WhatsApp client’ını yeniden başlatır.
* Response:

```json
{ "success": true, "message": "Yeniden başlatılıyor" }
```

## 6. Socket.io Events (Opsiyonel)

| Event             | Açıklama                                                    |
| ----------------- | ----------------------------------------------------------- |
| `qr`              | Yeni QR kod geldiğinde emit edilir.                         |
| `whatsapp_status` | WhatsApp istemcisi durum değişikliklerinde emit edilir.     |
| `message`         | Yeni mesaj geldiğinde ve yanıt gönderildiğinde emit edilir. |
| `get_status`      | Client bu event’i tetiklediğinde anlık durum gönderilir.    |
| `get_qr`          | Client bu event’i tetiklediğ                                |
