# 🏰 Age of Blocks

<div align="center">

![Age of Blocks Banner](https://img.shields.io/badge/Age%20of%20Blocks-Strategy%20Game-blue?style=for-the-badge)
[![Play Now](https://img.shields.io/badge/Play%20Now-ageofblocks.games-success?style=for-the-badge)](https://www.ageofblocks.games/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**Gerçek zamanlı çok oyunculu strateji ve kule savunma oyunu**

[Şimdi Oyna](https://www.ageofblocks.games/) • [Özellikler](#-özellikler) • [Oyun Modları](#-oyun-modları) • [Kontroller](#-kontroller)

</div>

---

## 📖 Hakkında

Age of Blocks, blok tarzı inşa mekaniği ve stratejik savaş unsurlarını birleştiren bir çok oyunculu kule savunma oyunudur. Yapılar inşa edin, kaynak üretin, birimler oluşturun ve rakiplerinizi yenin!

## ✨ Özellikler

- 🏗️ **Yapı İnşa Sistemi** - Kaynak üretimi ve birim oluşturmak için yapılar inşa edin
- ⚔️ **Stratejik Savaş** - Çeşitli birim tipleriyle taktiksel çatışmalar
- 🎯 **Yükseltme Sistemi** - Yapılarınızı ve birimlerinizi geliştirin
- 🌐 **Gerçek Zamanlı Çok Oyunculu** - WebSocket tabanlı anlık senkronizasyon
- 🎨 **Pixel Art Grafikleri** - Nostaljik görsel deneyim
- 🎮 **Çoklu Oyun Modları** - Tek oyunculu ve çok oyunculu seçenekler
- 🚀 **Düşük Gecikme** - Socket.IO ile optimize edilmiş ağ performansı

## 🎮 Oyun Modları

### Tek Oyunculu
- **AI ile Mücadele** - Yapay zeka rakibine karşı becerilerini test et

### Çok Oyunculu
- **1v1** - Bire bir düello
- **2v2** - Takım savaşı
- **3v3** - Geniş kapsamlı takım çatışmaları
- **FFA (Free For All)** - Herkes kendisi için savaşır

## 🎯 Kontroller

| Tuş | Aksiyon |
|-----|---------|
| **1-8** | Yapı seçimi |
| **Fare Tıklama** | Yapı yerleştirme |
| **ESC** | Seçimi iptal et / Duraklat |
| **P** | Oyunu duraklat/devam ettir |

## 🛠️ Teknoloji Yığını

- **Frontend**
  - HTML5 Canvas - Render motoru
  - Vanilla JavaScript - Oyun mantığı
  - CSS3 - Stil ve animasyonlar

- **Backend**
  - Node.js - Sunucu ortamı
  - Express.js - Web framework
  - Socket.IO - Gerçek zamanlı iletişim

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- Node.js (v14 veya üzeri)
- npm veya yarn

### Adımlar

1. **Repoyu klonlayın**
```bash
git clone https://github.com/huseyineneserturk/age-of-blocks.git
cd age-of-blocks
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Sunucuyu başlatın**
```bash
npm start
```

4. **Tarayıcınızda açın**
```
http://localhost:3000
```

## 📁 Proje Yapısı

```
age-of-blocks/
├── server/              # Sunucu tarafı kodlar
│   ├── server.js        # Express ve Socket.IO yapılandırması
│   └── game/            # Oyun mantığı
├── src/                 # Client tarafı kodlar
│   ├── game.js          # Ana oyun döngüsü
│   ├── ui.js            # Kullanıcı arayüzü
│   └── network.js       # Ağ iletişimi
├── style.css            # Stil dosyaları
├── index.html           # Ana HTML
└── README.md
```

## 🎲 Oynanış

1. **Yapı Seç** - 1-8 tuşlarını kullanarak inşa etmek istediğiniz yapıyı seçin
2. **Yerleştir** - Haritada istediğiniz konuma tıklayarak yapıyı yerleştirin
3. **Kaynak Üret** - Yapılarınız otomatik olarak kaynak üretir
4. **Birim Oluştur** - Kaynakları kullanarak savaşçı birimler oluşturun
5. **Saldır ve Savun** - Rakibinizin üssünü yok edin, kendi üssünüzü koruyun

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyorum! Lütfen şu adımları takip edin:

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/YeniOzellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/YeniOzellik`)
5. Pull Request açın

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👨‍💻 Geliştirici

**Hüseyin Enes Ertürk**

- GitHub: [@huseyineneserturk](https://github.com/huseyineneserturk)
- Website: [ageofblocks.games](https://www.ageofblocks.games/)

## 🙏 Teşekkürler

Age of Blocks'u oynadığınız için teşekkürler! Geri bildirimleriniz ve önerileriniz için issue açabilirsiniz.

---

<div align="center">

**⭐ Projeyi beğendiyseniz yıldız vermeyi unutmayın! ⭐**

Made with ❤️ by Hüseyin Enes Ertürk

</div>
