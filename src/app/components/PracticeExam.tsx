import { useState, useEffect } from 'react';
import OpenAI from 'openai';

interface PracticeQuestion {
  word: string;
  wordType: string;
  sentence: string;
  options: string[];
  correctAnswer: string;
  userAnswer?: string;
}

interface PracticeExamProps {
  words: Array<{
    english: string;
    turkish: string;
  }>;
  onClose: () => void;
}

export default function PracticeExam({ words, onClose }: PracticeExamProps) {
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const questionsPerPage = 20;

  const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
  });

  useEffect(() => {
    generateQuestions();
  }, []);

  const generateQuestions = async () => {
    setLoading(true);
    const generatedQuestions: PracticeQuestion[] = [];
    
    // Kelime havuzu oluştur (tekrar eden şıkları önlemek için)
    const wordPool = new Set(words.map(w => w.english.toLowerCase()));
    
    for (const word of words) {
      try {
        const prompt = `Generate a practice question for the English word "${word.english}" (Turkish: "${word.turkish}"). 

First, identify the DETAILED grammatical type of the word (e.g., "countable noun", "transitive verb", "comparative adjective", "time adverb", etc.).

Then, create a sentence with a blank space (exactly 10 underscores: "__________") where the word should be used. The sentence should:
1. Provide clear context that makes ONLY the correct answer sensible
2. Make other options grammatically possible but semantically nonsensical
3. NOT include the word itself or any close synonyms

Finally, provide THREE alternative options that:
1. Match the EXACT same grammatical subtype as "${word.english}" (e.g., if it's a countable noun, all alternatives must be countable nouns)
2. Are of similar structural complexity (similar length, similar formation)
3. Are semantically VERY DIFFERENT from "${word.english}" (not synonyms, not related concepts)
4. Would create a nonsensical meaning if used in the sentence
5. Are from completely different semantic domains than "${word.english}"

Example for "umbrella" (countable noun):
- BAD alternatives: parasol, sunshade, shield (semantically related)
- GOOD alternatives: bicycle, potato, window (same type, unrelated meaning)

Return ONLY a JSON object with the following format:
{
  "wordType": "detailed_grammatical_type",
  "sentence": "This sentence must contain __________ as a placeholder, not the actual word",
  "alternatives": ["structurally_similar_word1", "structurally_similar_word2", "structurally_similar_word3"]
}`;

        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a language learning assistant specializing in creating challenging test questions. Focus on structural similarity but semantic difference when providing alternatives. Ensure all alternatives are the EXACT same grammatical subtype but from completely different semantic domains. Make the sentence context clear enough that only the correct answer makes logical sense.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 500,
          response_format: { type: "json_object" }
        });

        let result: {
          wordType: string;
          sentence: string;
          alternatives: string[];
        };
        try {
          const content = response.choices[0].message.content;
          if (!content) throw new Error('Empty response from OpenAI');
          result = JSON.parse(content) as {
            wordType: string;
            sentence: string;
            alternatives: string[];
          };
          
          // Validate the response structure
          if (!result.wordType || !result.sentence || !Array.isArray(result.alternatives) || result.alternatives.length !== 3) {
            throw new Error('Invalid response structure');
          }

          // Ensure sentence contains exactly 10 underscores as placeholder
          const placeholder = '__________';
          if (!result.sentence.includes(placeholder)) {
            result.sentence = result.sentence.replace(/_{5,}/, placeholder);
            if (!result.sentence.includes(placeholder)) {
              throw new Error('Sentence does not contain proper placeholder');
            }
          }

          // Check if the word appears in the sentence
          if (result.sentence.toLowerCase().includes(word.english.toLowerCase())) {
            throw new Error('Sentence contains the target word');
          }
          
          // Alternatifleri kontrol et ve tekrarları önle
          const uniqueAlternatives = result.alternatives
            .filter((alt: string) => 
              alt.toLowerCase() !== word.english.toLowerCase() && // Doğru cevap olmamalı
              !result.alternatives.find((a: string, i: number) => 
                result.alternatives.indexOf(a) < i && a.toLowerCase() === alt.toLowerCase() // Kendi içinde tekrar olmamalı
              )
            );
            
          // Eğer yeterli alternatif yoksa, kelime havuzundan ekle
          while (uniqueAlternatives.length < 3) {
            // Kelime havuzundan rastgele bir kelime seç
            const poolArray = Array.from(wordPool);
            const randomWord = poolArray[Math.floor(Math.random() * poolArray.length)];
            
            // Eğer bu kelime doğru cevap değilse ve zaten alternatiflerde yoksa ekle
            if (
              randomWord.toLowerCase() !== word.english.toLowerCase() && 
              !uniqueAlternatives.some((alt: string) => alt.toLowerCase() === randomWord.toLowerCase())
            ) {
              uniqueAlternatives.push(randomWord);
            }
          }
          
          // Sadece 3 alternatif al
          const finalAlternatives = uniqueAlternatives.slice(0, 3);
          
          // Shuffle the options
          const options = [word.english, ...finalAlternatives];
          const shuffledOptions = [...new Set(options)].sort(() => Math.random() - 0.5);
          
          // Eğer şıklar arasında tekrar varsa düzelt
          if (new Set(shuffledOptions).size !== shuffledOptions.length) {
            throw new Error('Duplicate options detected');
          }

          generatedQuestions.push({
            word: word.english,
            wordType: result.wordType,
            sentence: result.sentence,
            options: shuffledOptions,
            correctAnswer: word.english
          });
        } catch (parseError) {
          console.error('Error parsing OpenAI response:', parseError);
          continue; // Skip this word and continue with the next
        }
      } catch (error) {
        console.error('Error generating question:', error);
        // Continue with the next word even if this one fails
        continue;
      }
    }

    // Soruları karıştır
    const shuffledQuestions = [...generatedQuestions].sort(() => Math.random() - 0.5);
    setQuestions(shuffledQuestions);
    setLoading(false);
  };

  const handleAnswer = (questionIndex: number, answer: string) => {
    const actualIndex = currentPage * questionsPerPage + questionIndex;
    setQuestions(prev => prev.map((q, i) => 
      i === actualIndex ? { ...q, userAnswer: answer } : q
    ));
  };

  const checkAnswers = () => {
    setShowResults(true);
  };

  const calculateScore = () => {
    const correctAnswers = questions.filter(q => q.userAnswer === q.correctAnswer).length;
    return Math.round((correctAnswers / questions.length) * 100);
  };

  const getCurrentPageQuestions = () => {
    const start = currentPage * questionsPerPage;
    return questions.slice(start, start + questionsPerPage);
  };

  const totalPages = Math.ceil(questions.length / questionsPerPage);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <div className="flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p>Sorular hazırlanıyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Pratik Sınavı</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {showResults && (
          <div className="mb-6 p-4 bg-gray-100 rounded-xl">
            <p className="text-xl font-bold">
              Sonuç: {calculateScore()}%
            </p>
            <p className="text-sm text-gray-600">
              {questions.filter(q => q.userAnswer === q.correctAnswer).length} / {questions.length} doğru
            </p>
          </div>
        )}

        <div className="space-y-8">
          {getCurrentPageQuestions().map((question, index) => (
            <div 
              key={index} 
              className={`p-4 border rounded-xl ${
                showResults && question.userAnswer !== question.correctAnswer 
                  ? 'border-red-300 bg-red-50' 
                  : showResults && question.userAnswer === question.correctAnswer
                  ? 'border-green-300 bg-green-50'
                  : ''
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <p className="font-medium">Soru {index + 1 + (currentPage * questionsPerPage)}</p>
                <span className="text-sm bg-gray-200 px-2 py-1 rounded-full text-gray-700">{question.wordType}</span>
              </div>
              
              <p className="mb-4">{question.sentence}</p>

              <div className="grid grid-cols-2 gap-3">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    onClick={() => !showResults && handleAnswer(index, option)}
                    className={`p-3 rounded-xl text-sm font-medium transition-colors ${
                      question.userAnswer === option
                        ? showResults
                          ? option === question.correctAnswer
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                          : 'bg-blue-500 text-white'
                        : showResults && option === question.correctAnswer
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    disabled={showResults}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 bg-gray-100 rounded-xl disabled:opacity-50"
            >
              Önceki
            </button>
            <span className="px-4 py-2">
              Sayfa {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-4 py-2 bg-gray-100 rounded-xl disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>

          {!showResults && (
            <button
              onClick={checkAnswers}
              className="px-6 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
            >
              Cevapları Kontrol Et
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 