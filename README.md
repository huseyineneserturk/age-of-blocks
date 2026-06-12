# Age of Blocks — War Fronts

Gerçek zamanlı strateji (RTS) — tarayıcıda, Age of Empires mantığıyla:
asker eğit, **orduyu kendin yönet**, haritayı kontrol et, düşman kalesini yık.

## Geliştirme

```bash
npm install
npm run dev        # istemci → http://localhost:5173
npm run server     # çok oyunculu maç sunucusu → :3001
npm run typecheck
npx tsx test/astar.test.ts && npx tsx test/combat.test.ts && \
npx tsx test/environment.test.ts && npx tsx test/ai.test.ts && \
npx tsx test/polish.test.ts && npx tsx test/net.test.ts
```

**Çok oyunculu:** Menüden "Oda Kur" → kodu rakibe ver → rakip "Katıl".
Sunucu otoritelidir: istemciler yalnızca komut gönderir (hile koruması).
Farklı sunucu adresi: `?server=https://...` URL parametresi.

Eski oyun (v1, canlıdaki sürüm) `legacy/` altındadır.

## Oynanış

- **Sol tık / sürükle:** seç · **Sağ tık:** yürüt / saldır / rally · **A:** saldırı emri
- **WASD / orta tuş:** kamera · **Tekerlek:** zoom · **Minimap:** tıkla-git
- **1-9, 0:** bina kur
- Counter döngüsü: kılıç > okçu > mızrak > süvari > kılıç (+ büyücü AoE, mancınık anti-bina)
- Çevre: 🌲 orman pususu · ⛰️ tepe +menzil · 🪨 kırılabilir kaya geçidi · 🗿 nötr kamp buffı
- Fog of war, paralı araştırma (3'ten 1 seç), kill ödülü, 3 zorlukta RTS AI

## Mimari

```
src/
  engine/   # kamera, input, grid, A* pathfinding
  data/     # birim/bina/harita tabloları
  game/     # sim: world, combat, economy, ai, fog (20Hz sabit tick)
  render/   # canvas renderer, figürler, efektler, minimap
  ui/       # HUD
test/       # headless sim testleri (tsx)
```
