# Kelime Öğrenme Uygulaması

Modern ve etkileşimli bir kelime öğrenme deneyimi sunan web uygulaması. İngilizce kelime öğrenmeyi daha eğlenceli ve etkili hale getirmek için tasarlanmıştır.

## 🌟 Özellikler

### 📝 Kelime Listesi Yönetimi
- **Çoklu Liste Desteği**: Farklı konular veya seviyeler için ayrı kelime listeleri oluşturma
- **Liste İşlemleri**: 
  - Yeni liste oluşturma
  - Liste silme
  - Liste adı değiştirme
  - Listeler arası kelime taşıma

### 🎴 Kelime Kartları
- **Kelime Ekleme**: İngilizce-Türkçe kelime çiftleri oluşturma
- **Örnek Cümle Desteği**: Her kelime için örnek cümle ekleme imkanı
- **Kelime Durumları**: 
  - Yeni (new)
  - Öğrenildi (ok)
  - Pratik Gerekiyor (practice)

### 📚 Pratik Sınavı
- **Otomatik Soru Üretimi**: Pratik listesindeki kelimelerden otomatik soru oluşturma
- **Çoktan Seçmeli Format**: Her soru için 4 seçenek
- **İlerleme Takibi**: Doğru/yanlış cevap istatistikleri
- **Anlık Geri Bildirim**: Cevapların doğruluğunu anında görme
- **Sayfa Başına 20 Soru**: Kolay yönetilebilir sınav uzunluğu

### 🎯 Dilbilgisi Sınavı
- **AI Destekli Soru Üretimi**: GPT-3.5 ile otomatik cümle ve seçenek oluşturma
- **Boşluk Doldurma**: Kelimelerin cümle içinde doğru kullanımını test etme
- **Bağımsız Sınav Oturumu**: 
  - Her yeni sınavda tüm kelimeler sıfırdan başlar
  - Sınav içi ilerleme takibi
  - "Tekrar Dene" özelliği ile 5 kez doğru bilinen kelimeleri filtreleme
- **Klavye Navigasyonu**: Sağ/sol ok tuşları ile sorular arası geçiş
- **Görsel Geri Bildirim**: Doğru bilme sayısına göre renk kodlaması

### 🎨 Kullanıcı Arayüzü
- **Modern Tasarım**: Temiz ve kullanıcı dostu arayüz
- **Responsive Yapı**: Tüm ekran boyutlarına uyumlu tasarım
- **İlerleme Göstergeleri**: 
  - Sınav ilerleme çubuğu
  - Kelime öğrenme durumu renk kodları
  - Soru sayacı

## 🚀 Teknik Özellikler
- Next.js 13 App Router
- TypeScript
- Tailwind CSS
- OpenAI GPT-3.5 API entegrasyonu
- LocalStorage tabanlı veri saklama
- React Hooks ve Modern React pratikleri

## 💡 Kullanım İpuçları

### Kelime Listesi Oluşturma
1. Ana sayfada "Yeni Liste Oluştur" butonuna tıklayın
2. Liste adını girin
3. "+" butonu ile yeni kelimeler ekleyin
4. Her kelime için İngilizce ve Türkçe karşılığını girin
5. İsteğe bağlı olarak örnek cümle ekleyin

### Pratik Yapma
1. Kelimeleri "Pratik Gerekiyor" durumuna getirin
2. "Pratik Sınavını Başlat" butonuna tıklayın
3. Soruları yanıtlayın ve sonuçlarınızı görün
4. Gerekirse "Tekrar Dene" ile pratik yapmaya devam edin

### Dilbilgisi Sınavı
1. "Dilbilgisi Sınavını Başlat" butonuna tıklayın
2. Cümlelerdeki boşlukları doğru kelimelerle doldurun
3. Sağ/sol ok tuşlarını kullanarak sorular arasında geçiş yapın
4. Sınav sonunda performansınızı görün
5. "Tekrar Dene" ile aynı oturumda pratik yapmaya devam edin

## ⚙️ Kurulum

1. Repoyu klonlayın:
```bash
git clone [repo-url]
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. `.env.local` dosyası oluşturun ve OpenAI API anahtarınızı ekleyin:
```
NEXT_PUBLIC_OPENAI_API_KEY=your-api-key
```

4. Uygulamayı başlatın:
```bash
npm run dev
```

## 🔒 Güvenlik
- API anahtarınızı güvende tutun
- `.env.local` dosyasını asla paylaşmayın
- Üretim ortamında uygun güvenlik önlemlerini alın

## 🤝 Katkıda Bulunma
1. Bu repoyu fork edin
2. Yeni bir branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun
