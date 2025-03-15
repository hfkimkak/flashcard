'use client';

import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import OpenAI from 'openai';

interface Flashcard {
  english: string;
  turkish: string;
  status: 'new' | 'ok' | 'practice';
  exampleSentence?: string;
}

interface ExcelRow {
  English?: string;
  english?: string;
  Turkish?: string;
  turkish?: string;
  ExampleSentence?: string;
  [key: string]: string | undefined;
}

interface SavedWordList {
  name: string;
  cards: Flashcard[];
  createdAt: string;
}

type ListType = 'new' | 'ok' | 'practice' | null;
type StudyModeType = 'new' | 'practice';

export default function Home() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [studyMode, setStudyMode] = useState<StudyModeType>('new');
  const [activeList, setActiveList] = useState<ListType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSentence, setShowSentence] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedWordList[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [listName, setListName] = useState('');
  const [currentListName, setCurrentListName] = useState<string | null>(null);
  const [showAddWordForm, setShowAddWordForm] = useState(false);
  const [newWord, setNewWord] = useState({ english: '', turkish: '' });
  const [currentCard, setCurrentCard] = useState<Flashcard>({
    english: 'Example',
    turkish: 'Örnek',
    status: 'new'
  });
  const [saveCategory, setSaveCategory] = useState<'all' | 'new' | 'ok' | 'practice'>('all');
  const [showSavedLists, setShowSavedLists] = useState(false);
  const [editingWord, setEditingWord] = useState<Flashcard | null>(null);
  const [editedEnglish, setEditedEnglish] = useState('');
  const [editedTurkish, setEditedTurkish] = useState('');

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });

  // Load saved lists from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('wordLists');
    if (saved) {
      setSavedLists(JSON.parse(saved));
    }
  }, []);

  // Save current cards to localStorage
  const saveCurrentList = () => {
    if (!listName.trim()) return;

    let cardsToSave = cards;
    if (saveCategory === 'ok') {
      cardsToSave = cards.filter(card => card.status === 'ok');
    } else if (saveCategory === 'practice') {
      cardsToSave = cards.filter(card => card.status === 'practice');
    } else if (saveCategory === 'new') {
      cardsToSave = cards.filter(card => card.status === 'new');
    }

    const newList: SavedWordList = {
      name: listName,
      cards: cardsToSave,
      createdAt: new Date().toISOString()
    };

    const updatedLists = [...savedLists, newList];
    setSavedLists(updatedLists);
    localStorage.setItem('wordLists', JSON.stringify(updatedLists));
    setShowSaveDialog(false);
    setListName('');
    setSaveCategory('all');
    setCurrentListName(listName);
  };

  // Load a saved list
  const loadSavedList = (list: SavedWordList) => {
    setCards(list.cards);
    if (list.cards.length > 0) {
      setCurrentCard(list.cards[0]);
      setCurrentCardIndex(0);
    }
    setCurrentListName(list.name);
  };

  // Delete a saved list
  const deleteSavedList = (name: string) => {
    const updatedLists = savedLists.filter(list => list.name !== name);
    setSavedLists(updatedLists);
    localStorage.setItem('wordLists', JSON.stringify(updatedLists));
    if (currentListName === name) {
      setCurrentListName(null);
    }
  };

  // Call updateCurrentList whenever cards change
  const updateCurrentList = useCallback(() => {
    if (!currentListName) return;
    
    // Mevcut liste adıyla eşleşen listeyi bul
    const currentListIndex = savedLists.findIndex(list => list.name === currentListName);
    if (currentListIndex === -1) return;
    
    // Eğer kartlar değişmediyse güncelleme yapma
    if (JSON.stringify(savedLists[currentListIndex].cards) === JSON.stringify(cards)) return;
    
    const updatedLists = [...savedLists];
    updatedLists[currentListIndex] = {
      ...updatedLists[currentListIndex],
      cards
    };
    
    setSavedLists(updatedLists);
    localStorage.setItem('wordLists', JSON.stringify(updatedLists));
  }, [currentListName, cards, savedLists]);

  // Kartlar değiştiğinde listeyi güncelle
  useEffect(() => {
    if (currentListName && cards.length > 0) {
      const timeoutId = setTimeout(() => {
        updateCurrentList();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [cards, updateCurrentList, currentListName]);

  const generateExampleSentence = async (word: string) => {
    try {
      setIsLoading(true);
      
      const prompt = `
Lütfen "${word}" kelimesi için aşağıdaki formatta kapsamlı bir açıklama ve örnek cümleler oluşturun:

"${word}" kelimesi, [TÜRKÇE KARŞILIĞI] anlamına gelir ve [KULLANIM BAĞLAMI]. Bu terim, [EK BİLGİ].

Anlamı:
1. [BİRİNCİ ANLAM]: [AÇIKLAMA]
2. [İKİNCİ ANLAM]: [AÇIKLAMA]
3. [ÜÇÜNCÜ ANLAM veya KULLANIM]: [AÇIKLAMA]

Özetle:
"${word}", [ÖZET TANIM]. [EK AÇIKLAMA].

Örnekler:
- [İNGİLİZCE ÖRNEK CÜMLE 1]. ([TÜRKÇE ÇEVİRİSİ])
- [İNGİLİZCE ÖRNEK CÜMLE 2]. ([TÜRKÇE ÇEVİRİSİ])
- [İNGİLİZCE ÖRNEK CÜMLE 3]. ([TÜRKÇE ÇEVİRİSİ])

Lütfen her bir anlam için farklı bağlamlarda örnek cümleler oluşturun ve her cümlenin Türkçe çevirisini de ekleyin.
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Sen İngilizce-Türkçe dil öğreniminde uzmanlaşmış bir eğitim asistanısın. Kelimelerin anlamlarını, kullanımlarını ve örnek cümlelerini kapsamlı bir şekilde açıklayabilirsin.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const exampleSentence = response.choices[0].message.content?.trim() || '';
      
      // Güncel kartı güncelle
      const updatedCards = [...cards];
      updatedCards[currentCardIndex] = {
        ...updatedCards[currentCardIndex],
        exampleSentence
      };
      
      setCards(updatedCards);
      setCurrentCard({
        ...currentCard,
        exampleSentence
      });
      
      setShowSentence(true);
    } catch (error) {
      console.error('Error generating example sentence:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Shuffle function with proper typing
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const saveToExcel = async () => {
    try {
      // Create worksheet data
      const wsData = cards.map(card => ({
        English: card.english,
        Turkish: card.turkish,
        ExampleSentence: card.exampleSentence || ''
      }));

      // Create a new workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(wsData);

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, "Flashcards");

      // Save the file
      XLSX.writeFile(wb, "flashcards_with_examples.xlsx");
    } catch (error) {
      console.error('Error saving to Excel:', error);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];

        // Excel'den yüklenen kelimeleri yeni kartlar olarak oluştur
        const newCards: Flashcard[] = shuffleArray(
          jsonData.map((row: ExcelRow) => ({
              english: (row.English || row.english || Object.values(row)[0] || '').trim(),
              turkish: (row.Turkish || row.turkish || Object.values(row)[1] || '').trim(),
              status: 'new',
              exampleSentence: row.ExampleSentence || undefined
            }))
        );

        // Kartları sıfırla ve yeni kartları ekle
        setCards(newCards);
        
        // İlk kartı göster
        if (newCards.length > 0) {
          setCurrentCard(newCards[0]);
          setCurrentCardIndex(0);
        }

        // Çalışma modunu 'new' olarak ayarla
        setStudyMode('new');
      };
      reader.readAsBinaryString(file);
    }
  };

  const moveToNextCard = () => {
    const availableCards = cards.filter(card => card.status === studyMode);
    const currentIndexInFiltered = availableCards.findIndex(
      card => card.english === currentCard.english && card.turkish === currentCard.turkish
    );

    if (availableCards.length === 0) return;

    let nextIndex = currentIndexInFiltered + 1;
    if (nextIndex >= availableCards.length) {
      // Listenin sonuna geldiğimizde başa dönmek yerine, 
      // kullanıcıya listenin sonuna geldiğini bildirelim
      if (availableCards.length > 0) {
        // Eğer hala kartlar varsa, kullanıcıya listenin sonuna geldiğini bildiren bir mesaj gösterelim
        alert("Çalışma listesinin sonuna geldiniz. Başa dönmek için 'OK' tuşuna basın.");
        // Kullanıcı isterse başa dönebilir
      nextIndex = 0;
      } else {
        return; // Hiç kart yoksa işlem yapma
      }
    }

    const nextCard = availableCards[nextIndex];
    const nextCardIndex = cards.findIndex(
      card => card.english === nextCard.english && card.turkish === nextCard.turkish
    );
    setCurrentCardIndex(nextCardIndex);
    setCurrentCard(nextCard);
    setIsFlipped(false);
    setShowSentence(false);
  };

  const handleCardStatus = (status: 'ok' | 'practice') => {
    try {
      // Kart listesi boşsa işlem yapma
      if (cards.length === 0) return;

      // Geçerli kart indeksi kontrolü
      if (currentCardIndex < 0 || currentCardIndex >= cards.length) {
        console.error('Invalid card index:', currentCardIndex);
        return;
      }

      const updatedCards = [...cards];
      updatedCards[currentCardIndex] = {
        ...updatedCards[currentCardIndex],
        status: status
      };
      
      setCards(updatedCards);
      setShowSentence(false);

      // Kartları filtreleyip bir sonraki kartı seçme
      const availableCards = updatedCards.filter(card => card.status === studyMode);
      
      // Eğer mevcut modda hiç kart kalmadıysa, diğer moda geç
      if (availableCards.length === 0) {
        const otherMode = studyMode === 'new' ? 'practice' : 'new';
        const otherModeCards = updatedCards.filter(card => card.status === otherMode);
        
        if (otherModeCards.length > 0) {
          setStudyMode(otherMode);
          const firstCard = otherModeCards[0];
          const firstCardIndex = updatedCards.findIndex(card => 
            card.english === firstCard.english && card.turkish === firstCard.turkish
          );
          
          if (firstCardIndex !== -1) {
            setCurrentCardIndex(firstCardIndex);
            setCurrentCard(firstCard);
          }
        } else {
          // Hiç kart kalmadıysa başlangıç durumuna dön
          const defaultCard: Flashcard = {
            english: 'Tüm kartlar tamamlandı',
            turkish: 'Yeni bir liste yükleyin',
            status: 'new' as const
          };
          setCurrentCard(defaultCard);
          setCurrentCardIndex(0);
        }
        setIsFlipped(false);
        return;
      }

      // Mevcut kartın filtrelenmiş listedeki indeksini bul
      const currentIndexInFiltered = availableCards.findIndex(
        card => card.english === currentCard.english && card.turkish === currentCard.turkish
      );

      // Bir sonraki kartın indeksini hesapla
      let nextIndex = 0;
      if (currentIndexInFiltered !== -1) {
        // Eğer mevcut kart filtrelenmiş listede bulunuyorsa, bir sonraki kartı seç
        nextIndex = (currentIndexInFiltered + 1) % availableCards.length;
      } else {
        // Eğer mevcut kart artık filtrelenmiş listede değilse (örneğin OK'e taşındıysa),
        // kaldığı yerden devam et, başa dönme
        // Mevcut kartın orijinal listedeki indeksini bul
        const originalIndex = updatedCards.findIndex(
          card => card.english === currentCard.english && card.turkish === currentCard.turkish
        );
        
        // Orijinal listedeki bu indeksten sonraki, studyMode'a uygun ilk kartı bul
        let foundNextCard = false;
        for (let i = originalIndex + 1; i < updatedCards.length; i++) {
          if (updatedCards[i].status === studyMode) {
            nextIndex = availableCards.findIndex(
              card => card.english === updatedCards[i].english && card.turkish === updatedCards[i].turkish
            );
            foundNextCard = true;
            break;
          }
        }
        
        // Eğer sonraki kartlar arasında uygun bir kart bulunamadıysa, 
        // listenin başından itibaren ara (bu sadece bir güvenlik önlemi)
        if (!foundNextCard) {
          nextIndex = 0;
        }
      }

      // Bir sonraki kartı seç
      const nextCard = availableCards[nextIndex];
      if (nextCard) {
        const nextCardIndex = updatedCards.findIndex(
          card => card.english === nextCard.english && card.turkish === nextCard.turkish
        );
        if (nextCardIndex !== -1) {
          setCurrentCardIndex(nextCardIndex);
          setCurrentCard(nextCard);
        }
      }
      setIsFlipped(false);
    } catch (error) {
      console.error('Error in handleCardStatus:', error);
      // Hata durumunda güvenli bir duruma dön
      if (cards.length > 0) {
        setCurrentCard(cards[0]);
        setCurrentCardIndex(0);
      }
    }
  };

  const switchStudyMode = (mode: 'new' | 'practice') => {
    setStudyMode(mode);
    const availableCards = cards.filter(card => card.status === mode);
    if (availableCards.length > 0) {
      // Kullanıcıya baştan başlamak isteyip istemediğini soralım
      const startFromBeginning = confirm(
        `${mode === 'new' ? 'Yeni' : 'Pratik'} çalışma moduna geçtiniz. Baştan başlamak ister misiniz? 'İptal'e basarsanız, kaldığınız yerden devam edeceksiniz.`
      );
      
      let selectedCard: Flashcard | undefined;
      let selectedCardIndex: number = 0;
      
      if (startFromBeginning) {
        // Baştan başla
        selectedCard = availableCards[0];
      } else {
        // Mevcut kartın indeksini bul
        const currentOriginalIndex = cards.findIndex(
          card => card.english === currentCard.english && card.turkish === currentCard.turkish
        );
        
        // Mevcut karttan sonraki, seçilen moda uygun ilk kartı bul
        let foundNextCard = false;
        for (let i = currentOriginalIndex + 1; i < cards.length; i++) {
          if (cards[i].status === mode) {
            selectedCard = cards[i];
            foundNextCard = true;
            break;
          }
        }
        
        // Eğer sonraki kartlar arasında uygun bir kart bulunamadıysa, 
        // listenin başından itibaren ilk uygun kartı seç
        if (!foundNextCard) {
          selectedCard = availableCards[0];
        }
      }
      
      // selectedCard'ın tanımlı olduğundan emin olalım
      if (selectedCard) {
        selectedCardIndex = cards.findIndex(
          card => card.english === selectedCard!.english && card.turkish === selectedCard!.turkish
        );
        
        setCurrentCardIndex(selectedCardIndex);
        setCurrentCard(selectedCard);
      setIsFlipped(false);
      setShowSentence(false);
      }
    }
  };

  // Add these new computed values
  const knownWords = cards.filter(card => card.status === 'ok');
  const newWords = cards.filter(card => card.status === 'new');
  const practiceWords = cards.filter(card => card.status === 'practice');

  const addNewWord = () => {
    if (!newWord.english.trim() || !newWord.turkish.trim()) return;

    const newWordCard: Flashcard = {
      english: newWord.english.trim(),
      turkish: newWord.turkish.trim(),
      status: 'new'
    };

    setCards(prevCards => {
      const updatedCards = [...prevCards, newWordCard];
      // Eğer bu ilk kelime ise, currentCard ve currentCardIndex'i güncelle
      if (prevCards.length === 0) {
        setCurrentCard(newWordCard);
        setCurrentCardIndex(0);
      }
      return updatedCards;
    });
    
    setNewWord({ english: '', turkish: '' });
    setShowAddWordForm(false);
  };

  // Download saved list
  const downloadList = (list: SavedWordList) => {
    try {
      const dataStr = JSON.stringify(list, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      // Mobil cihaz kontrolü
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        // Mobil cihazlar için
        const reader = new FileReader();
        reader.onload = (e) => {
          const link = document.createElement('a');
          link.href = e.target?.result as string;
          link.download = `${list.name}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        };
        reader.readAsDataURL(dataBlob);
      } else {
        // Masaüstü için
        const link = document.createElement('a');
        link.href = url;
        link.download = `${list.name}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading list:', error);
      alert('Liste indirilirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  // Upload saved list
  const handleListUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const uploadedList = JSON.parse(e.target?.result as string) as SavedWordList;
          
          // Listede gerekli alanların kontrolü
          if (!uploadedList.name || !Array.isArray(uploadedList.cards)) {
            alert('Geçersiz liste formatı');
            return;
          }

          // Aynı isimde liste var mı kontrolü
          const existingList = savedLists.find(list => list.name === uploadedList.name);
          if (existingList) {
            if (!confirm('Bu isimde bir liste zaten var. Üzerine yazmak ister misiniz?')) {
              return;
            }
            // Varolan listeyi güncelle
            const updatedLists = savedLists.map(list =>
              list.name === uploadedList.name ? uploadedList : list
            );
            setSavedLists(updatedLists);
            localStorage.setItem('wordLists', JSON.stringify(updatedLists));
          } else {
            // Yeni liste olarak ekle
            const updatedLists = [...savedLists, uploadedList];
            setSavedLists(updatedLists);
            localStorage.setItem('wordLists', JSON.stringify(updatedLists));
          }

          // Listeyi yükle
          loadSavedList(uploadedList);
        } catch (error) {
          console.error('Error parsing uploaded list:', error);
          alert('Liste yüklenirken bir hata oluştu');
        }
      };
      reader.readAsText(file);
    }
  };

  // Kelime durumunu değiştirme fonksiyonu
  const changeWordStatus = (word: Flashcard, newStatus: 'new' | 'ok' | 'practice') => {
    const updatedCards = cards.map(card =>
      card.english === word.english ? { ...card, status: newStatus } : card
    );
    setCards(updatedCards);
  };

  // Önceki karta geçiş fonksiyonu
  const moveToPreviousCard = () => {
    const availableCards = cards.filter(card => card.status === studyMode);
    const currentIndexInFiltered = availableCards.findIndex(
      card => card.english === currentCard.english && card.turkish === currentCard.turkish
    );

    if (availableCards.length === 0) return;

    let prevIndex = currentIndexInFiltered - 1;
    if (prevIndex < 0) {
      prevIndex = availableCards.length - 1;
    }

    const prevCard = availableCards[prevIndex];
    const prevCardIndex = cards.findIndex(
      card => card.english === prevCard.english && card.turkish === prevCard.turkish
    );
    setCurrentCardIndex(prevCardIndex);
    setCurrentCard(prevCard);
    setIsFlipped(false);
    setShowSentence(false);
  };

  // Kelime düzenleme fonksiyonu
  const startEditingWord = (word: Flashcard) => {
    setEditingWord(word);
    setEditedEnglish(word.english);
    setEditedTurkish(word.turkish);
  };

  const saveEditedWord = () => {
    if (!editingWord || !editedEnglish.trim() || !editedTurkish.trim()) return;

    const updatedCards = cards.map(card =>
      card.english === editingWord.english
        ? { ...card, english: editedEnglish, turkish: editedTurkish }
        : card
    );

    setCards(updatedCards);
    
    // Eğer düzenlenen kelime mevcut kart ise, onu da güncelle
    if (currentCard.english === editingWord.english) {
      setCurrentCard({
        ...currentCard,
        english: editedEnglish,
        turkish: editedTurkish
      });
    }

    // Düzenleme modunu kapat
    setEditingWord(null);
    setEditedEnglish('');
    setEditedTurkish('');
  };

  const cancelEditing = () => {
    setEditingWord(null);
    setEditedEnglish('');
    setEditedTurkish('');
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-100 to-white p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          HFK Kelime Öğrenme Platformu
        </h1>

        {/* Study Controls - Compact Version */}
        {cards.length > 0 && (
          <div className="w-full max-w-md mx-auto mb-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => switchStudyMode('new')}
                className={`flex-1 py-1.5 px-3 text-sm rounded-full transition-colors ${
                  studyMode === 'new'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-blue-100'
                }`}
              >
                Yeni Kelimeler ({newWords.length})
              </button>
              <button
                onClick={() => switchStudyMode('practice')}
                className={`flex-1 py-1.5 px-3 text-sm rounded-full transition-colors ${
                  studyMode === 'practice'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-yellow-100'
                }`}
              >
                Pratik Kelimeler ({practiceWords.length})
              </button>
              <button
                onClick={moveToNextCard}
                className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
              >
                Karıştır
              </button>
            </div>
            {practiceWords.length > 0 && (
              <button
                onClick={() => {
                  localStorage.setItem('currentListName', currentListName || '');
                  window.open('/practice-exam', '_blank');
                }}
                className="w-full mt-2 py-1.5 px-3 text-sm bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
              >
                Pratik Sınavını Başlat ({practiceWords.length} kelime)
              </button>
            )}
          </div>
        )}

        {/* Main Card Area */}
        <div className="w-full max-w-md mx-auto mb-8">
          {/* Kelime Kartı */}
          <div className="section max-w-3xl mx-auto">
            <div className="relative perspective-1000 mx-auto" style={{ maxWidth: "650px" }}>
              {/* Navigasyon Butonları */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between px-4 z-10 pointer-events-none">
                <button
                  onClick={moveToPreviousCard}
                  className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors pointer-events-auto"
                >
                  &#8592;
                </button>
                <button
                  onClick={moveToNextCard}
                  className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors pointer-events-auto"
                >
                  &#8594;
                </button>
              </div>

              {/* Kelime Kartı */}
              <div
                className="relative w-full aspect-[4/3] cursor-pointer transition-transform duration-500 transform-style-3d mb-12"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Ön Yüz - İngilizce */}
                <div
                  className={`absolute w-full h-full flashcard backface-hidden ${
                    isFlipped ? 'rotate-y-180' : 'rotate-y-0'
                  }`}
                >
                  <div className="flex flex-col items-center justify-between w-full h-full p-6">
                    <h2 className="flashcard-word mb-4">{currentCard.english}</h2>
                    
                    <div className="flex-grow overflow-auto w-full mb-2">
                      {isLoading ? (
                        <div className="mt-2 text-gray-500 flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading...
                        </div>
                      ) : currentCard.exampleSentence && showSentence ? (
                        <div className="w-full">
                          <div className="mb-2">
                            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 pl-2 text-left">
                              {currentCard.exampleSentence.split('\n\n')
                                .filter(section => section.includes('Örnekler:'))
                                .flatMap(section => 
                                  section.split('\n')
                                    .filter(line => line.startsWith('-'))
                                    .map(line => line.substring(1).trim())
                                )
                                .map((sentence, index) => (
                                  <li key={index} className="italic">{sentence}</li>
                                ))
                              }
                            </ul>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Arka Yüz - Türkçe */}
                <div
                  className={`absolute w-full h-full flashcard backface-hidden rotate-y-180 ${
                    isFlipped ? 'rotate-y-0' : 'rotate-y-180'
                  }`}
                >
                  <div className="flex flex-col items-start text-left overflow-y-auto h-full p-6">
                    <h2 className="flashcard-word text-center w-full mb-4">{currentCard.turkish}</h2>
                    
                    {currentCard.exampleSentence ? (
                      <div className="w-full">
                        <div className="mb-4">
                          <p className="text-gray-700 text-sm leading-relaxed">
                            <span className="font-bold">{currentCard.english}</span> kelimesi, {currentCard.turkish.toLowerCase()} anlamına gelir ve genellikle belirli bir bağlamda kullanılır. Bu terim, çeşitli durumlarda farklı anlamlar taşıyabilir.
                          </p>
                        </div>
                        
                        <div className="mb-4">
                          <p className="font-semibold text-gray-800 mb-1">Anlamı:</p>
                          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1 pl-2">
                            {currentCard.exampleSentence.split('\n\n')
                              .filter(section => section.includes('Anlamı:'))
                              .flatMap(section => 
                                section.split('\n')
                                  .filter(line => /^\d+\./.test(line))
                                  .map(line => line.replace(/^\d+\.\s*/, '').trim())
                              )
                              .map((meaning, index) => (
                                <li key={index}>{meaning}</li>
                              ))
                            }
                          </ol>
                        </div>
                        
                        <div className="mb-4">
                          <p className="font-semibold text-gray-800 mb-1">Özetle:</p>
                          <p className="text-sm text-gray-700">
                            {currentCard.exampleSentence.split('\n\n')
                              .filter(section => section.includes('Özetle:'))
                              .map(section => section.replace('Özetle:', '').trim())
                              .join(' ')}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Control Buttons - Outside the Card */}
          <div className="mt-24 mb-4 flex flex-col items-center space-y-4">
            {!currentCard.exampleSentence && !isLoading && (
              <button
                onClick={() => generateExampleSentence(currentCard.english)}
                className="w-full max-w-md px-3 py-1.5 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
              >
                Generate Example
              </button>
            )}
            
            {currentCard.exampleSentence && !isLoading && (
              <div className="flex gap-2 w-full max-w-md">
                <button
                  onClick={() => setShowSentence(!showSentence)}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
                >
                  {showSentence ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => generateExampleSentence(currentCard.english)}
                  className="flex-1 px-3 py-1.5 text-sm bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
                >
                  New
                </button>
              </div>
            )}

            <div className="flex justify-center gap-2 w-full max-w-md mt-4">
              <button
                onClick={() => handleCardStatus('ok')}
                className="flex-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
              >
                Know
              </button>
              <button
                onClick={() => handleCardStatus('practice')}
                className="flex-1 px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition-colors"
              >
                Practice
              </button>
            </div>
          </div>
        </div>

        {/* Control Sections */}
        <div className="w-full max-w-2xl mx-auto space-y-2">
          {/* Lists and Excel Operations Section */}
          <div className="relative">
            <button
              onClick={() => setShowSavedLists(!showSavedLists)}
              className="w-full bg-gray-100 hover:bg-gray-200 transition-colors py-2.5 rounded-xl text-gray-700 font-medium flex items-center justify-between px-4"
            >
              <span>Liste İşlemleri</span>
              <svg
                className={`w-5 h-5 transition-transform ${showSavedLists ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSavedLists && (
              <div className="bg-white rounded-xl p-4 shadow-lg mt-2">
                {/* Main Buttons */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => {
                      setCards([]);
                      setCurrentCard({
                        english: 'Yeni Liste',
                        turkish: 'Kelime eklemek için "Yeni Kelime Ekle" butonunu kullanın',
                        status: 'new'
                      });
                      setCurrentCardIndex(0);
                      setCurrentListName(null);
                      setShowAddWordForm(true);
                    }}
                    className="bg-purple-500 hover:bg-purple-600 transition-colors py-2 rounded-xl text-white text-sm font-medium"
                  >
                    Yeni Liste Oluştur
                  </button>
                  <button
                    onClick={() => setShowAddWordForm(true)}
                    className="bg-blue-500 hover:bg-blue-600 transition-colors py-2 rounded-xl text-white text-sm font-medium"
                  >
                    Yeni Kelime Ekle
                  </button>
                  <label className="bg-green-500 hover:bg-green-600 transition-colors py-2 rounded-xl text-white text-sm font-medium text-center cursor-pointer">
                Liste Yükle
                <input
                  type="file"
                  accept=".json"
                  onChange={handleListUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => setShowSaveDialog(true)}
                    className="bg-yellow-500 hover:bg-yellow-600 transition-colors py-2 rounded-xl text-white text-sm font-medium"
              >
                {currentListName ? 'Listeyi Farklı Kaydet' : 'Listeyi Kaydet'}
              </button>
                </div>

                {/* Excel Operations */}
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <h3 className="text-gray-700 font-medium mb-3">Excel İşlemleri</h3>
                  <div className="flex gap-2">
                    <label className="flex-1 bg-blue-500 hover:bg-blue-600 transition-colors py-2 rounded-xl text-white text-sm font-medium text-center cursor-pointer">
                      Excel Dosyası Yükle
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {cards.length > 0 && (
              <button
                        onClick={saveToExcel}
                        className="flex-1 bg-green-500 hover:bg-green-600 transition-colors py-2 rounded-xl text-white text-sm font-medium"
              >
                        Excel Olarak Kaydet
              </button>
                    )}
            </div>
          </div>
          
          {/* Add Word Form */}
          {showAddWordForm && (
                  <div className="border-t border-gray-200 pt-4 mb-4">
                    <h3 className="text-gray-700 font-medium mb-3">Yeni Kelime Ekle</h3>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={newWord.english}
                  onChange={(e) => setNewWord(prev => ({ ...prev, english: e.target.value }))}
                  placeholder="İngilizce kelime"
                        className="px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <input
                  type="text"
                  value={newWord.turkish}
                  onChange={(e) => setNewWord(prev => ({ ...prev, turkish: e.target.value }))}
                  placeholder="Türkçe kelime"
                        className="px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowAddWordForm(false)}
                          className="px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={addNewWord}
                          className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
                  >
                    Ekle
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Dialog */}
          {showSaveDialog && (
                  <div className="border-t border-gray-200 pt-4 mb-4">
                    <h3 className="text-gray-700 font-medium mb-3">Listeyi Kaydet</h3>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="Liste adı girin"
                        className="px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                      <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSaveCategory('all')}
                          className={`py-2 px-4 rounded-xl transition-colors ${
                      saveCategory === 'all'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-blue-100'
                    }`}
                  >
                    Tüm Kelimeler ({cards.length})
                  </button>
                  <button
                    onClick={() => setSaveCategory('ok')}
                          className={`py-2 px-4 rounded-xl transition-colors ${
                      saveCategory === 'ok'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                    }`}
                  >
                          Bildiğim ({knownWords.length})
                  </button>
                  <button
                    onClick={() => setSaveCategory('practice')}
                          className={`py-2 px-4 rounded-xl transition-colors ${
                      saveCategory === 'practice'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-yellow-100'
                    }`}
                  >
                          Pratik ({practiceWords.length})
                  </button>
                </div>
                <div className="flex gap-2 justify-end mt-2">
                  <button
                    onClick={() => {
                      setShowSaveDialog(false);
                      setListName('');
                      setSaveCategory('all');
                    }}
                          className="px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={saveCurrentList}
                          className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Saved Lists */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-gray-700 font-medium mb-3">Kayıtlı Listeler</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {savedLists.map((list) => (
              <div
                key={list.name}
                className={`p-4 rounded-xl shadow-md ${
                  currentListName === list.name ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{list.name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadSavedList(list)}
                              className="px-3 py-1 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors"
                    >
                      Yükle
                    </button>
                    <button
                      onClick={() => downloadList(list)}
                              className="px-3 py-1 bg-green-500 text-white text-sm rounded-xl hover:bg-green-600 transition-colors"
                    >
                      İndir
                    </button>
                    <button
                      onClick={() => deleteSavedList(list.name)}
                              className="px-3 py-1 bg-red-500 text-white text-sm rounded-xl hover:bg-red-600 transition-colors"
                    >
                      Sil
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{list.cards.length} kelime</p>
                <p className="text-xs text-gray-500">
                  {new Date(list.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
                </div>
              </div>
            )}
        </div>

          {/* Word List Section */}
          <div className="relative">
            <button
              onClick={() => setActiveList(activeList ? null : 'new')}
              className="w-full bg-gray-100 hover:bg-gray-200 transition-colors py-2.5 rounded-xl text-gray-700 font-medium flex items-center justify-between px-4"
            >
              <span>Kelime Listesi</span>
              <svg
                className={`w-5 h-5 transition-transform ${activeList ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {activeList && (
              <div className="bg-white rounded-xl p-4 shadow-lg mt-2">
                {/* Liste Seçim Butonları */}
            <div className="flex gap-2 mb-4">
              <button
                    onClick={() => setActiveList('new')}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm transition-colors ${
                      activeList === 'new'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-blue-100'
                }`}
              >
                Yeni Kelimeler ({newWords.length})
              </button>
              <button
                    onClick={() => setActiveList('practice')}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm transition-colors ${
                      activeList === 'practice'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-yellow-100'
                }`}
              >
                    Pratik ({practiceWords.length})
              </button>
            <button
                    onClick={() => setActiveList('ok')}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm transition-colors ${
                activeList === 'ok'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-green-100'
              }`}
            >
                    Bildiğim ({knownWords.length})
            </button>
          </div>

                {/* Kelime Listesi */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(activeList === 'new' ? newWords :
                    activeList === 'practice' ? practiceWords :
                    activeList === 'ok' ? knownWords : []
                  ).map((card, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      {editingWord && editingWord.english === card.english ? (
                        <div className="flex-1 flex flex-col gap-2">
                          <input
                            type="text"
                            value={editedEnglish}
                            onChange={(e) => setEditedEnglish(e.target.value)}
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="İngilizce"
                          />
                          <input
                            type="text"
                            value={editedTurkish}
                            onChange={(e) => setEditedTurkish(e.target.value)}
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Türkçe"
                          />
                          <div className="flex gap-2 mt-1">
            <button
                              onClick={saveEditedWord}
                              className="flex-1 px-2 py-1 text-xs rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                            >
                              Kaydet
            </button>
            <button
                              onClick={cancelEditing}
                              className="flex-1 px-2 py-1 text-xs rounded-full bg-gray-500 text-white hover:bg-gray-600 transition-colors"
                            >
                              İptal
            </button>
          </div>
                        </div>
                      ) : (
                            <>
                          <div className="flex-1" onClick={() => startEditingWord(card)}>
                            <p className="font-medium">{card.english}</p>
                            <p className="text-sm text-gray-600">{card.turkish}</p>
                          </div>
                          <div className="flex gap-2">
                              <button
                              onClick={() => startEditingWord(card)}
                              className="px-2 py-1 text-xs rounded-full bg-gray-500 text-white hover:bg-gray-600 transition-colors"
                              >
                              Düzenle
                              </button>
                            {activeList !== 'ok' && (
                              <button
                                onClick={() => changeWordStatus(card, 'ok')}
                                className="px-2 py-1 text-xs rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                              >
                                Biliyorum
                              </button>
                          )}
                            {activeList !== 'practice' && (
                              <button
                                onClick={() => changeWordStatus(card, 'practice')}
                                className="px-2 py-1 text-xs rounded-full bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
                              >
                                Pratik
                              </button>
                          )}
                            {activeList !== 'new' && (
                              <button
                                onClick={() => changeWordStatus(card, 'new')}
                                className="px-2 py-1 text-xs rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                              >
                                Yeni
                              </button>
                            )}
                          </div>
                            </>
                          )}
                        </div>
                  ))}
                      </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </main>
  );
}
