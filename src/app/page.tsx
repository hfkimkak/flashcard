'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

interface Flashcard {
  english: string;
  turkish: string;
  status: 'new' | 'ok' | 'practice';
}

export default function Home() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentCard, setCurrentCard] = useState<Flashcard>({
    english: 'Example',
    turkish: 'Örnek',
    status: 'new'
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const newCards: Flashcard[] = jsonData.map((row: any) => ({
          english: row.English || row.english || Object.values(row)[0],
          turkish: row.Turkish || row.turkish || Object.values(row)[1],
          status: 'new'
        }));

        setCards(newCards);
        if (newCards.length > 0) {
          setCurrentCard(newCards[0]);
          setCurrentCardIndex(0);
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleCardStatus = (status: 'ok' | 'practice') => {
    const updatedCards = [...cards];
    updatedCards[currentCardIndex].status = status;
    setCards(updatedCards);

    // Move to next card if available
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setCurrentCard(cards[currentCardIndex + 1]);
      setIsFlipped(false);
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

        {/* File Upload */}
        <div className="mb-8 text-center">
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
            <p className="mt-2 text-sm text-gray-600">
              Toplam {cards.length} kelime yüklendi
            </p>
          )}
        </div>
        
        {/* Main Card Area */}
        <div className="w-full max-w-md mx-auto mb-8">
          {/* Flashcard */}
          <div className="relative w-full aspect-[3/2] perspective-1000">
            <div
              className="relative w-full h-full cursor-pointer transition-transform duration-500"
              style={{ transformStyle: 'preserve-3d' }}
              onClick={handleFlip}
            >
              {/* Front side */}
              <div
                className={`absolute w-full h-full bg-white rounded-xl shadow-lg p-6 flex items-center justify-center backface-hidden ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                <p className="text-2xl font-semibold text-gray-800">
                  {currentCard.english}
                </p>
              </div>
              
              {/* Back side */}
              <div
                className={`absolute w-full h-full bg-white rounded-xl shadow-lg p-6 flex items-center justify-center backface-hidden rotate-y-180 ${
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
        <div className="grid grid-cols-3 gap-4 mt-8 bg-white rounded-xl p-4 shadow-lg">
          {/* Known Words */}
          <div className="border-r border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-green-600 mb-4 text-center">
              Bildiğim Kelimeler ({knownWords.length})
            </h3>
            <div className="max-h-60 overflow-y-auto">
              {knownWords.map((word, index) => (
                <div key={index} className="bg-green-50 p-2 rounded mb-2 text-sm">
                  <span className="font-medium">{word.english}</span>
                  <span className="text-gray-500"> - {word.turkish}</span>
                </div>
              ))}
            </div>
          </div>

          {/* New Words */}
          <div className="border-r border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-blue-600 mb-4 text-center">
              Yeni Kelimeler ({newWords.length})
            </h3>
            <div className="max-h-60 overflow-y-auto">
              {newWords.map((word, index) => (
                <div key={index} className="bg-blue-50 p-2 rounded mb-2 text-sm">
                  <span className="font-medium">{word.english}</span>
                  <span className="text-gray-500"> - {word.turkish}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Practice Words */}
          <div className="p-4">
            <h3 className="text-lg font-semibold text-yellow-600 mb-4 text-center">
              Pratik Gereken ({practiceWords.length})
            </h3>
            <div className="max-h-60 overflow-y-auto">
              {practiceWords.map((word, index) => (
                <div key={index} className="bg-yellow-50 p-2 rounded mb-2 text-sm">
                  <span className="font-medium">{word.english}</span>
                  <span className="text-gray-500"> - {word.turkish}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
