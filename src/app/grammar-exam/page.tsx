'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import OpenAI from 'openai';

interface Word {
  english: string;
  turkish: string;
  status: 'new' | 'ok' | 'practice';
  exampleSentence?: string;
}

interface SavedList {
  name: string;
  cards: Word[];
  createdAt: string;
}

interface Question {
  sentence: string;
  word: string;
  options: string[];
  correctAnswer: string;
  wordType: string;
  blankPosition: number;
}

export default function GrammarExam() {
  const [words, setWords] = useState<Word[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const openai = useMemo(() => new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  }), []);

  const generateQuestion = useCallback(async (word: Word): Promise<Question> => {
    try {
      const prompt = `Generate a fill-in-the-blank question for the word "${word.english}". Return a JSON object with exactly this format:
{
  "sentence": "Write a sentence where ONLY '${word.english}' fits perfectly",
  "wordType": "the part of speech (noun/verb/adjective/adverb)",
  "options": ["three", "different", "words"]
}

Rules:
1. The sentence must be specific so that ONLY "${word.english}" is the correct answer
2. The three options must:
   - Be the same part of speech
   - NOT be synonyms of "${word.english}"
   - Be clearly incorrect in the context

Example for "sprint":
{
  "sentence": "Athletes must sprint to finish the race quickly",
  "wordType": "verb",
  "options": ["sleep", "cry", "sing"]
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a quiz generator. Always respond with a valid JSON object containing exactly: sentence, wordType, and options (array of 3 strings).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      let result;
      try {
        const content = response.choices[0].message.content;
        if (!content) throw new Error('No content in response');
        
        result = JSON.parse(content);
        
        // Strict validation of the response format
        if (typeof result.sentence !== 'string' || result.sentence.trim() === '') {
          throw new Error('Invalid or missing sentence');
        }
        if (typeof result.wordType !== 'string' || result.wordType.trim() === '') {
          throw new Error('Invalid or missing wordType');
        }
        if (!Array.isArray(result.options) || result.options.length !== 3 || 
            !result.options.every((opt: string) => typeof opt === 'string' && opt.trim() !== '')) {
          throw new Error('Invalid options array');
        }

        // Ensure the target word is in the sentence
        if (!result.sentence.toLowerCase().includes(word.english.toLowerCase())) {
          result.sentence = `${result.sentence} ${word.english}`;
        }
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        // More specific fallback response
        result = {
          sentence: `The students ${word.english} their homework carefully.`,
          wordType: 'verb',
          options: ['jump', 'sleep', 'dance']
        };
      }
      
      // Find the position of the word in the sentence
      const words = result.sentence.toLowerCase().split(' ');
      const blankPosition = words.findIndex((w: string) => 
        w.includes(word.english.toLowerCase()) || 
        w.replace(/[.,!?]/, '') === word.english.toLowerCase()
      );

      // Cümleyi temizle ve fazla boşlukları kaldır
      const cleanSentence = result.sentence
        .replace(/\s+/g, ' ')  // Birden fazla boşluğu tek boşluğa indir
        .trim();               // Baş ve sondaki boşlukları kaldır

      return {
        sentence: cleanSentence,
        word: word.english,
        options: [...result.options, word.english].sort(() => Math.random() - 0.5),
        correctAnswer: word.english,
        wordType: result.wordType,
        blankPosition: blankPosition !== -1 ? blankPosition : 0
      };
    } catch (error) {
      console.error('Error generating question:', error);
      // More meaningful fallback
      return {
        sentence: `Please ${word.english} the instructions carefully.`,
        word: word.english,
        options: ['ignore', 'forget', 'skip', word.english].sort(() => Math.random() - 0.5),
        correctAnswer: word.english,
        wordType: 'verb',
        blankPosition: 1
      };
    }
  }, [openai]);

  const generateAllQuestions = useCallback(async (practiceWords: Word[]) => {
    setIsGenerating(true);
    try {
      // Önce tüm soruları oluştur
      const generatedQuestions = await Promise.all(
        practiceWords.map(word => generateQuestion(word))
      );
      
      // Fisher-Yates shuffle algoritması ile soruları karıştır
      const shuffledQuestions = [...generatedQuestions];
      for (let i = shuffledQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
      }
      
      setQuestions(shuffledQuestions);
    } catch (error) {
      console.error('Error generating questions:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [generateQuestion]);

  useEffect(() => {
    const loadWords = async () => {
      const savedLists = localStorage.getItem('wordLists');
      if (savedLists) {
        const lists = JSON.parse(savedLists) as SavedList[];
        const currentListName = localStorage.getItem('currentListName');
        
        let practiceWords: Word[] = [];
        
        if (currentListName) {
          const currentList = lists.find((list) => list.name === currentListName);
          if (currentList) {
            practiceWords = currentList.cards.filter((card) => card.status === 'practice');
          }
        } else {
          practiceWords = lists.flatMap((list) => 
            list.cards.filter((card) => card.status === 'practice')
          );
        }

        setWords(practiceWords);
        await generateAllQuestions(practiceWords);
      }
      setIsLoading(false);
    };

    loadWords();
  }, [generateAllQuestions]);

  const handleAnswer = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        goToNextQuestion();
      } else if (event.key === 'ArrowLeft') {
        goToPreviousQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentQuestionIndex]);

  const finishExam = () => {
    const correctAnswers = userAnswers.filter(
      (ans, index) => ans === questions[index].correctAnswer
    );
    setScore(correctAnswers.length);
    setShowResults(true);
  };

  const restartExam = async () => {
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setShowResults(false);
    setScore(0);
    setIsLoading(true);
    await generateAllQuestions(words);
    setIsLoading(false);
  };

  if (isLoading || isGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isGenerating ? 'Sorular oluşturuluyor...' : 'Yükleniyor...'}
          </p>
        </div>
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
              {score} / {questions.length}
            </p>
            <p className="text-gray-600">
              Başarı Oranı: {((score / questions.length) * 100).toFixed(1)}%
            </p>
          </div>

          <div className="space-y-6 mb-8">
            {questions.map((question, index) => {
              const userAnswer = userAnswers[index];
              const isCorrect = userAnswer === question.correctAnswer;
              
              return (
                <div
                  key={index}
                  className={`p-6 rounded-lg ${
                    isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="mb-4">
                    <p className="text-gray-700 mb-2">
                      {question.sentence.split(' ').map((word, i, arr) => {
                        const isLast = i === arr.length - 1;
                        return i === question.blankPosition ? (
                          <span key={i}>
                            {isCorrect ? (
                              <span className="text-green-600 font-bold mx-1">{userAnswer}</span>
                            ) : (
                              <span className="text-red-600 font-bold mx-1">{userAnswer}</span>
                            )}
                          </span>
                        ) : (
                          <span key={i}>{word}{!isLast ? ' ' : ''}</span>
                        );
                      })}
                    </p>
                  </div>

                  {!isCorrect && (
                    <div className="text-sm">
                      <p className="text-red-600">
                        Sizin cevabınız: {userAnswer}
                      </p>
                      <p className="text-green-600">
                        Doğru cevap: {question.correctAnswer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
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

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Dilbilgisi Sınavı</h2>
            <p className="text-gray-600">
              {currentQuestionIndex + 1} / {questions.length}
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="mb-8">
          <div className="p-6 bg-gray-50 rounded-lg mb-4">
            <p className="text-lg text-center">
              {currentQuestion.sentence}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-8">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswer(option)}
              className={`w-full p-4 text-left rounded-lg border-2 
                ${userAnswers[currentQuestionIndex] === option 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'hover:border-blue-500 hover:bg-blue-50'} 
                transition-all duration-200`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={goToPreviousQuestion}
            className={`px-4 py-2 rounded-lg ${
              currentQuestionIndex === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
            disabled={currentQuestionIndex === 0}
          >
            ← Önceki Soru
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={finishExam}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Sınavı Bitir
            </button>
          ) : (
            <button
              onClick={goToNextQuestion}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Sonraki Soru →
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 