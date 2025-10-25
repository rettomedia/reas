## 1. Mail Dinleme Başlatma

**Endpoint:** `POST /email/listen`

**Açıklama:** IMAP bilgilerini kullanarak mail kutusunu dinlemeye başlar. Yeni mailler geldikçe cache'e eklenir.

**Request Body:**

```json
{
  "user": "email@example.com",
  "password": "app-password",
  "host": "imap.gmail.com",
  "port": 993,
  "tls": true
}
```

**Response:**

```json
{
  "status": "Listening started"
}
```

---

## 2. Mailleri Listeleme

**Endpoint:** `GET /email/mails`

**Açıklama:** Cache'de bulunan mailleri getirir. Yeni mailler asenkron olarak geldikçe bu liste güncellenir.

**Response:**

```json
{
  "success": true,
  "mails": [
    {
      "from": "\"YouTube\" <noreply@youtube.com>",
      "to": "\"Ekin Ilter Varli\" <ekiniltervarli@gmail.com>",
      "subject": "Test: ...",
      "date": "2016-05-12T21:46:35.000Z",
      "preview": "Here are the newest videos from each of your subscriptions...",
      "attachments": []
    },
    ...
  ]
}
```

---

## 3. Dinlemeyi Durdurma

**Endpoint:** `POST /email/stop`

**Açıklama:** Mail dinlemeyi durdurur ve IMAP bağlantısını kapatır.

**Response:**

```json
{
  "status": "Listening stopped"
}
```

---

## 4. API Özet

| Endpoint        | Method | Açıklama                    |
| --------------- | ------ | --------------------------- |
| `/email/listen` | POST   | Mail dinlemeyi başlatır     |
| `/email/mails`  | GET    | Cache'deki mailleri getirir |
| `/email/stop`   | POST   | Dinlemeyi durdurur          |

**Notlar:**

* Mailler asenkron olarak cache'e eklenir ve frontend isteklere anlık cevap verir.
* `preview` alanı, mailin kısa önizlemesini sağlar.
* `attachments` array'i maile bağlı ekleri içerir (varsa).


**TODO**: Groq email analiz sistemi eklenecek!