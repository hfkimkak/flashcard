'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Word {
  english: string;
  turkish: string;
  status: 'new' | 'ok' | 'practice';
  exampleSentence?: string;
}

export default function PracticeExam() {
  const [words, setWords] = useState<Word[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get practice words from localStorage
    const savedLists = localStorage.getItem('wordLists');
    if (savedLists) {
      const lists = JSON.parse(savedLists);
      const currentListName = localStorage.getItem('currentListName');
      
      let practiceWords: Word[] = [];
      
      if (currentListName) {
        // Belirli bir liste seçilmişse sadece o listedeki pratik kelimeleri al
        const currentList = lists.find((list: any) => list.name === currentListName);
        if (currentList) {
          practiceWords = currentList.cards.filter((card: Word) => card.status === 'practice');
        }
      } else {
        // Liste seçilmemişse tüm listelerdeki pratik kelimeleri birleştir
        practiceWords = lists.flatMap((list: any) => 
          list.cards.filter((card: Word) => card.status === 'practice')
        );
      }
      
      // Kelimeleri karıştır
      const shuffledWords = shuffleArray(practiceWords);
      setWords(shuffledWords);
      
      // Initialize first question
      if (shuffledWords.length > 0) {
        const options = generateOptions(0, shuffledWords);
        setShuffledOptions(options);
      }
    }
    setIsLoading(false);
  }, []);

  const generateOptions = (index: number, wordList: Word[]) => {
    const correctAnswer = wordList[index].turkish;
    const otherWords = wordList.filter((_, i) => i !== index);
    const wrongOptions = otherWords
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(word => word.turkish);
    
    return shuffleArray([correctAnswer, ...wrongOptions]);
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);

    if (currentQuestionIndex < words.length - 1) {
      setCurrentQuestionIndex(prev => {
        const nextIndex = prev + 1;
        const options = generateOptions(nextIndex, words);
        setShuffledOptions(options);
        return nextIndex;
      });
    } else {
      // Calculate score
      const correctAnswers = newAnswers.filter(
        (answer, index) => answer === words[index].turkish
      );
      setScore(correctAnswers.length);
      setShowResults(true);
    }
  };

  const restartExam = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setShowResults(false);
    setScore(0);
    const options = generateOptions(0, words);
    setShuffledOptions(options);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Pratik için kelime bulunamadı</h2>
          <p className="text-gray-600 mb-4">Lütfen önce pratik listesine kelime ekleyin.</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full">
          <h2 className="text-2xl font-bold text-center mb-6">Sınav Sonuçları</h2>
          <div className="text-center mb-8">
            <p className="text-4xl font-bold text-blue-500 mb-2">
              {score} / {words.length}
            </p>
            <p className="text-gray-600">
              Başarı Oranı: {((score / words.length) * 100).toFixed(1)}%
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {words.map((word, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  userAnswers[index] === word.turkish
                    ? 'bg-green-100'
                    : 'bg-red-100'
                }`}
              >
                <p className="font-medium">{word.english}</p>
                <p className="text-sm">
                  Doğru cevap: <span className="font-medium">{word.turkish}</span>
                </p>
                {userAnswers[index] !== word.turkish && (
                  <p className="text-sm text-red-600">
                    Sizin cevabınız: {userAnswers[index]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={restartExam}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Tekrar Dene
            </button>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Pratik Sınavı</h2>
            <p className="text-gray-600">
              {currentQuestionIndex + 1} / {words.length}
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentQuestionIndex + 1) / words.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-medium text-center mb-2">
            {words[currentQuestionIndex].english}
          </h3>
          <p className="text-gray-600 text-center">
            Bu kelimenin Türkçe karşılığı nedir?
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {shuffledOptions.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(option)}
              className="w-full p-4 text-left rounded-lg border-2 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
} 