'use client';

import { useState } from 'react';
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

export default function Home() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [studyMode, setStudyMode] = useState<'new' | 'practice'>('new');
  const [activeList, setActiveList] = useState<'new' | 'ok' | 'practice' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSentence, setShowSentence] = useState(false);
  const [currentCard, setCurrentCard] = useState<Flashcard>({
    english: 'Example',
    turkish: 'Örnek',
    status: 'new'
  });

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });

  const generateExampleSentence = async (word: string) => {
    try {
      setIsLoading(true);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: "You are a helpful language tutor. Create a B2 level example sentence using the given word. The sentence should be academic and formal in nature."
        }, {
          role: "user",
          content: `Create a B2 level academic example sentence using the word "${word}".`
        }],
        temperature: 0.7,
        max_tokens: 100
      });

      const sentence = response.choices[0]?.message?.content || '';
      
      // Update the current card and cards array with the new sentence
      const updatedCard = { ...currentCard, exampleSentence: sentence };
      const updatedCards = [...cards];
      updatedCards[currentCardIndex] = updatedCard;
      
      setCurrentCard(updatedCard);
      setCards(updatedCards);
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

        // Create cards and shuffle them, now including example sentences
        const newCards: Flashcard[] = shuffleArray(
          jsonData.map((row: ExcelRow) => ({
            english: row.English || row.english || Object.values(row)[0] || '',
            turkish: row.Turkish || row.turkish || Object.values(row)[1] || '',
            status: 'new',
            exampleSentence: row.ExampleSentence || undefined
          }))
        );

        setCards(newCards);
        if (newCards.length > 0) {
          setCurrentCard(newCards[0]);
          setCurrentCardIndex(0);
        }
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
      nextIndex = 0;
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
    const updatedCards = [...cards];
    updatedCards[currentCardIndex].status = status;
    setCards(updatedCards);
    setShowSentence(false);
    moveToNextCard();
  };

  const switchStudyMode = (mode: 'new' | 'practice') => {
    setStudyMode(mode);
    const availableCards = cards.filter(card => card.status === mode);
    if (availableCards.length > 0) {
      const firstCard = availableCards[0];
      const firstCardIndex = cards.findIndex(
        card => card.english === firstCard.english && card.turkish === firstCard.turkish
      );
      setCurrentCardIndex(firstCardIndex);
      setCurrentCard(firstCard);
      setIsFlipped(false);
      setShowSentence(false);
    }
  };

  const mastered = cards.filter(card => card.status === 'ok').length;
  const practice = cards.filter(card => card.status === 'practice').length;

  // Add these new computed values
  const knownWords = cards.filter(card => card.status === 'ok');
  const newWords = cards.filter(card => card.status === 'new');
  const practiceWords = cards.filter(card => card.status === 'practice');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-100 to-white p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Flashcard Learning
        </h1>

        {/* File Upload and Save Buttons */}
        <div className="mb-8 text-center flex justify-center gap-4">
          <label className="bg-blue-500 text-white px-4 py-2 rounded-full cursor-pointer hover:bg-blue-600 transition-colors">
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
              className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 transition-colors"
            >
              Cümlelerle Kaydet
            </button>
          )}
        </div>
        {cards.length > 0 && (
          <p className="mt-2 text-sm text-gray-600 text-center">
            Toplam {cards.length} kelime yüklendi
          </p>
        )}
        
        {/* Main Card Area */}
        <div className="w-full max-w-md mx-auto mb-8">
          {/* Study Mode Selector */}
          {cards.length > 0 && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => switchStudyMode('new')}
                className={`flex-1 py-2 rounded-full transition-colors ${
                  studyMode === 'new'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-blue-100'
                }`}
              >
                Yeni Kelimeler ({newWords.length})
              </button>
              <button
                onClick={() => switchStudyMode('practice')}
                className={`flex-1 py-2 rounded-full transition-colors ${
                  studyMode === 'practice'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-yellow-100'
                }`}
              >
                Pratik Kelimeler ({practiceWords.length})
              </button>
            </div>
          )}

          {/* Shuffle Button */}
          {cards.length > 0 && (
            <button
              onClick={moveToNextCard}
              className="w-full mb-4 px-4 py-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
            >
              Kelimeleri Karıştır
            </button>
          )}

          {/* Flashcard */}
          <div className="relative w-full aspect-[3/2] perspective-1000">
            <div
              className="relative w-full h-full cursor-pointer transition-transform duration-500"
              style={{ transformStyle: 'preserve-3d' }}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* Front side */}
              <div
                className={`absolute w-full h-full bg-blue-50 rounded-xl shadow-lg p-6 flex flex-col items-center justify-center backface-hidden ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                <p className="text-2xl font-semibold text-gray-800 mb-4">
                  {currentCard.english}
                </p>
                {!isLoading && !currentCard.exampleSentence && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      generateExampleSentence(currentCard.english);
                    }}
                    className="mt-2 px-4 py-1 bg-indigo-500 text-white text-sm rounded-full hover:bg-indigo-600 transition-colors"
                  >
                    Örnek Cümle Oluştur
                  </button>
                )}
                {!isLoading && currentCard.exampleSentence && !showSentence && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSentence(true);
                    }}
                    className="mt-2 px-4 py-1 bg-indigo-500 text-white text-sm rounded-full hover:bg-indigo-600 transition-colors"
                  >
                    Cümleyi Göster
                  </button>
                )}
                {isLoading && (
                  <p className="text-sm text-gray-500 mt-2">Cümle oluşturuluyor...</p>
                )}
                {currentCard.exampleSentence && showSentence && (
                  <div className="mt-2 text-center">
                    <p className="text-sm text-gray-600 italic">
                      {currentCard.exampleSentence}
                    </p>
                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSentence(false);
                        }}
                        className="px-3 py-1 bg-gray-400 text-white text-xs rounded-full hover:bg-gray-500 transition-colors"
                      >
                        Cümleyi Gizle
                      </button>
                      {!isLoading && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            generateExampleSentence(currentCard.english);
                          }}
                          className="px-3 py-1 bg-indigo-500 text-white text-xs rounded-full hover:bg-indigo-600 transition-colors"
                        >
                          Yeni Cümle Oluştur
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Back side */}
              <div
                className={`absolute w-full h-full bg-green-50 rounded-xl shadow-lg p-6 flex items-center justify-center backface-hidden rotate-y-180 ${
                  isFlipped ? 'rotate-y-0' : ''
                }`}
              >
                <p className="text-2xl font-semibold text-gray-800">
                  {currentCard.turkish}
                </p>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={() => handleCardStatus('ok')}
              className="px-6 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
            >
              OK
            </button>
            <button
              onClick={() => handleCardStatus('practice')}
              className="px-6 py-2 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition-colors"
            >
              Need More Practice
            </button>
          </div>

          {/* Progress Indicators */}
          <div className="mt-8 flex justify-between text-sm text-gray-600">
            <span>Öğrenildi: {mastered}</span>
            <span>Pratik Gerekli: {practice}</span>
          </div>
        </div>

        {/* Word Lists Section */}
        <div className="mt-8 bg-white rounded-xl p-4 shadow-lg">
          {/* List Selection Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveList(activeList === 'ok' ? null : 'ok')}
              className={`flex-1 py-2 px-4 rounded-full transition-colors ${
                activeList === 'ok'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-green-100'
              }`}
            >
              Bildiğim Kelimeler ({knownWords.length})
            </button>
            <button
              onClick={() => setActiveList(activeList === 'new' ? null : 'new')}
              className={`flex-1 py-2 px-4 rounded-full transition-colors ${
                activeList === 'new'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-blue-100'
              }`}
            >
              Yeni Kelimeler ({newWords.length})
            </button>
            <button
              onClick={() => setActiveList(activeList === 'practice' ? null : 'practice')}
              className={`flex-1 py-2 px-4 rounded-full transition-colors ${
                activeList === 'practice'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-yellow-100'
              }`}
            >
              Pratik Gereken ({practiceWords.length})
            </button>
          </div>

          {/* Active List Content */}
          {activeList && (
            <div className="max-h-60 overflow-y-auto mt-4">
              {activeList === 'ok' && knownWords.map((word, index) => (
                <div key={index} className="bg-green-50 p-2 rounded mb-2 text-sm">
                  <span className="font-medium">{word.english}</span>
                  <span className="text-gray-500"> - {word.turkish}</span>
                </div>
              ))}
              {activeList === 'new' && newWords.map((word, index) => (
                <div key={index} className="bg-blue-50 p-2 rounded mb-2 text-sm">
                  <span className="font-medium">{word.english}</span>
                  <span className="text-gray-500"> - {word.turkish}</span>
                </div>
              ))}
              {activeList === 'practice' && practiceWords.map((word, index) => (
                <div key={index} className="bg-yellow-50 p-2 rounded mb-2 text-sm">
                  <span className="font-medium">{word.english}</span>
                  <span className="text-gray-500"> - {word.turkish}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
