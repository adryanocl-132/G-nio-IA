/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BrainCircuit, 
  BarChart3, 
  CalendarDays, 
  Video, 
  MessageSquareQuote, 
  Send, 
  Loader2, 
  ArrowRight,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Copy,
  ClipboardCheck,
  Volume2,
  Mic,
  MicOff,
  Headphones,
  History as HistoryIcon,
  Clock,
  User,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { BRAND_CONTEXTS, generateStrategicPlan, textToSpeech } from './services/geminiService';

interface HistoryItem {
  id: string;
  brand: string;
  timestamp: string;
  title: string;
  plan: string;
  strategyType: 'mensal' | 'semanal';
  performanceData: string;
  newIdeas: string;
  trafficData: { budget: string; results: string };
}

export default function App() {
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [strategyType, setStrategyType] = useState<'mensal' | 'semanal'>('mensal');
  const [performanceData, setPerformanceData] = useState<string>('');
  const [newIdeas, setNewIdeas] = useState<string>('');
  const [trafficData, setTrafficData] = useState({ budget: '', results: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isListeningInput, setIsListeningInput] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [refinementText, setRefinementText] = useState<string>('');
  const [isRefining, setIsRefining] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('genio_ia_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const saveToHistory = (newPlan: string, overrideId?: string) => {
    const titleMatch = newPlan.match(/# (.*)|## (.*)/);
    const title = titleMatch ? (titleMatch[1] || titleMatch[2]).trim() : `Planejamento ${selectedBrand}`;
    
    const id = overrideId || Date.now().toString();
    const newItem: HistoryItem = {
      id: id,
      brand: selectedBrand,
      timestamp: new Date().toLocaleString('pt-BR'),
      title: title,
      plan: newPlan,
      strategyType: strategyType,
      performanceData: performanceData,
      newIdeas: newIdeas,
      trafficData: trafficData
    };

    // Remove existing if it's an update, then add to top
    const filteredHistory = history.filter(item => item.id !== id);
    const updatedHistory = [newItem, ...filteredHistory];
    
    setHistory(updatedHistory);
    setActiveHistoryId(id);
    localStorage.setItem('genio_ia_history', JSON.stringify(updatedHistory));
  };

  const startInputVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    
    recognition.onstart = () => setIsListeningInput(true);
    recognition.onend = () => setIsListeningInput(false);
    
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setPerformanceData(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListeningInput(false);
    };

    recognition.start();
  };

  const loadFromHistory = (item: HistoryItem) => {
    setSelectedBrand(item.brand);
    setPlan(item.plan);
    setStrategyType(item.strategyType);
    setPerformanceData(item.performanceData || '');
    setNewIdeas(item.newIdeas || '');
    setTrafficData(item.trafficData || { budget: '', results: '' });
    setActiveHistoryId(item.id);
    setShowHistory(false);
  };

  const playRawPCM = async (base64: string) => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
    }

    const binary = atob(base64);
    const int16Array = new Int16Array(binary.length / 2);
    const view = new DataView(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) {
      view.setUint8(i, binary.charCodeAt(i));
    }
    for (let i = 0; i < int16Array.length; i++) {
      int16Array[i] = view.getInt16(i * 2, true);
    }
    
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const context = audioContextRef.current;
    const buffer = context.createBuffer(1, float32Array.length, 24000);
    buffer.getChannelData(0).set(float32Array);
    
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => setIsPlaying(false);
    
    audioSourceRef.current = source;
    setIsPlaying(true);
    source.start();
  };

  const handleListenToPlan = async () => {
    if (!plan) return;
    if (isPlaying) {
      audioSourceRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    setIsAudioLoading(true);
    try {
      // Create a shorter summary for the audio to be more natural and less exhaustive
      const summaryText = plan.split('--- LISTA DE TAREFAS')[0]; // Presentation only
      const audioBase64 = await textToSpeech(summaryText);
      if (audioBase64) {
        await playRawPCM(audioBase64);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao gerar áudio.');
    } finally {
      setIsAudioLoading(false);
    }
  };

  const startVoiceConversation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsAudioLoading(true);
      try {
        const response = await textToSpeech(`O usuário disse: "${transcript}". Responda de forma natural e breve, baseando-se no contexto do planejamento atual: ${plan?.substring(0, 500)}...`);
        if (response) {
          await playRawPCM(response);
        }
      } catch (err) {
        console.error(err);
        setError('Erro na conversa por voz.');
      } finally {
        setIsAudioLoading(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  const copyToNotion = () => {
    if (!plan) return;
    const taskListMatch = plan.match(/--- LISTA DE TAREFAS \(COPIAR PARA NOTION\) ---([\s\S]*)/i);
    const textToCopy = taskListMatch ? taskListMatch[1].trim() : plan;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const copyFullSolution = () => {
    if (!plan) return;
    navigator.clipboard.writeText(plan).then(() => {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 3000);
    });
  };

  const copyForWhatsApp = () => {
    if (!plan || !selectedBrand) return;
    
    // Clean markdown for WhatsApp
    const cleanPlan = plan
      .replace(/# /g, '*')
      .replace(/## /g, '*')
      .replace(/\*\*\*/g, '*')
      .replace(/\*\*/g, '*')
      .replace(/- \[ \]/g, '•')
      .replace(/- /g, '• ')
      .split('--- LISTA DE TAREFAS')[0]; // Analysis only

    const message = `Fala! Segue o diagnóstico estratégico para *${selectedBrand}* que acabamos de gerar.\n\n${cleanPlan.trim()}\n\n*Vamos pra cima!* 🚀`;
    
    navigator.clipboard.writeText(message).then(() => {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 3000);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand || !performanceData.trim()) return;

    setIsLoading(true);
    setError(null);
    setPlan(null);

    try {
      const result = await generateStrategicPlan(
        selectedBrand, 
        performanceData, 
        strategyType, 
        newIdeas, 
        trafficData
      );
      setPlan(result);
      saveToHistory(result, activeHistoryId || undefined);
    } catch (err) {
      setError('Ocorreu um erro ao gerar o planejamento. Por favor, tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (plan && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [plan]);

  const handleRefine = async () => {
    if (!refinementText.trim() || !plan) return;
    
    setIsRefining(true);
    setError(null);
    
    try {
      // Create a refinement prompt that includes context of existing plan
      const updatedPerformance = `${performanceData}\n\n[NOVAS INFORMAÇÕES ADICIONADAS EM ${new Date().toLocaleString('pt-BR')}]:\n${refinementText}`;
      setPerformanceData(updatedPerformance);
      
      const result = await generateStrategicPlan(
        selectedBrand,
        updatedPerformance,
        strategyType,
        newIdeas,
        trafficData
      );
      
      setPlan(result);
      saveToHistory(result, activeHistoryId || undefined);
      setRefinementText('');
    } catch (err) {
      setError('Erro ao refinar a estratégia.');
      console.error(err);
    } finally {
      setIsRefining(false);
    }
  };

  const handleNewDiagnostic = () => {
    setPlan(null);
    setPerformanceData('');
    setNewIdeas('');
    setTrafficData({ budget: '', results: '' });
    setSelectedBrand('');
    setActiveHistoryId(null);
    setRefinementText('');
  };

  const brandColors: Record<string, string> = {
    'Óticas Carol': 'bg-blue-400',
    'Sunglass Hut': 'bg-amber-500',
    'GrandVision': 'bg-indigo-400',
    'Perfumaria Hamouda': 'bg-amber-600',
    'Arena Premium': 'bg-green-400',
    'Samsung Smart Center Cohafuma': 'bg-sky-400',
    'Clínica Dentária do Trabalhador': 'bg-red-400',
    'Tamara Care': 'bg-rose-300'
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar - Minimalist sidebar */}
      <aside className="fixed bottom-0 left-0 right-0 h-16 md:h-full md:w-20 bg-slate-900 text-white flex md:flex-col z-30 items-center justify-around md:justify-start border-t md:border-t-0 md:border-r border-slate-800">
        <div className="md:flex-1 md:py-12 flex md:flex-col gap-8 md:gap-12 items-center w-full justify-around md:justify-start">
           <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-3 md:p-4 rounded-2xl transition-all ${showHistory ? 'bg-amber-500 text-slate-900 shadow-xl shadow-amber-500/20' : 'text-slate-500 hover:text-white'}`}
            title="Histórico de Conversas"
           >
            <HistoryIcon className="w-5 h-5 md:w-6 md:h-6" />
           </button>

           <div className="hidden md:block rotate-90 origin-center whitespace-nowrap text-[9px] font-black text-slate-700 tracking-[0.6em] uppercase mt-24">
            ADRYANO COSTA
          </div>
          
          <button 
            onClick={handleNewDiagnostic}
            className="md:hidden p-3 text-slate-500 hover:text-white"
          >
            <BrainCircuit className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-30"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 md:left-20 w-full max-w-sm bg-white border-r border-slate-200 z-40 shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black uppercase tracking-tighter text-2xl text-slate-900 italic">Histórico</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Soluções Anteriores</p>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-3 hover:bg-slate-50 rounded-xl text-slate-300 hover:text-slate-900 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="text-center py-20 px-6 opacity-30">
                    <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Aguardando seu primeiro comando.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="w-full text-left p-5 rounded-3xl border border-slate-100 hover:border-amber-400 transition-all group bg-slate-50/50 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/60"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase text-white shadow-sm ${brandColors[item.brand] || 'bg-slate-400'}`}>
                          {item.brand}
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold">{item.timestamp}</span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mb-2 line-clamp-2 leading-tight group-hover:text-amber-600 transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{item.strategyType === 'mensal' ? 'Foco Mensal' : 'Foco Semanal'}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col h-full overflow-hidden pb-16 md:pb-0">
        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-10 pb-24 sm:pb-10 space-y-10 custom-scrollbar">
          
          {/* STEP 1: INITIAL STATE / BRAND SELECTION */}
          {!selectedBrand && !plan && !isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto mt-6 md:mt-12 text-center"
            >
              <div className="mb-12">
                <div className="flex flex-col items-center gap-2 mb-8">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                    Gênio <span className="text-amber-500 italic">IA</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 uppercase tracking-[0.4em] font-black">Estrategista de Adryano Costa</p>
                </div>
                <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter leading-tight">Qual marca vamos planejar hoje?</h1>
                <p className="text-slate-400 max-w-lg mx-auto text-sm">Selecione uma das marcas do seu portfólio para iniciar o diagnóstico estratégico sênior.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.keys(BRAND_CONTEXTS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedBrand(key);
                      setActiveHistoryId(null);
                    }}
                    className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-amber-400 transition-all group flex flex-col items-center gap-4 active:scale-95"
                  >
                    <div className={`w-4 h-4 rounded-full ${brandColors[key] || 'bg-slate-400'} shadow-sm group-hover:scale-125 transition-transform`}></div>
                    <span className="font-bold text-sm text-slate-600 group-hover:text-slate-900">{key}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 2: DATA INPUT FORM (Hidden on home, shown after brand selection) */}
          {selectedBrand && !plan && !isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={() => setSelectedBrand('')}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1 italic">Insira os resultados e novas ideias para criarmos novas soluções.</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Marca Selecionada: <span className="text-amber-600">{selectedBrand}</span></p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Strategy & Performance */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Linha de Raciocínio
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setStrategyType('mensal')}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                            strategyType === 'mensal'
                              ? 'border-slate-900 bg-slate-900 text-white shadow-xl'
                              : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                          }`}
                        >
                          <CalendarDays className="w-5 h-5 mb-2" />
                          <span className="font-bold text-xs">Mensal</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStrategyType('semanal')}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                            strategyType === 'semanal'
                              ? 'border-slate-900 bg-slate-900 text-white shadow-xl'
                              : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                          }`}
                        >
                          <Sparkles className="w-5 h-5 mb-2" />
                          <span className="font-bold text-xs">Semanal</span>
                        </button>
                      </div>
                    </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Resultados do Período
                    </label>
                    <button
                      type="button"
                      onClick={startInputVoice}
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                        isListeningInput 
                          ? 'bg-red-500 text-white animate-pulse' 
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                      {isListeningInput ? 'Gravando...' : 'Voz'}
                    </button>
                  </div>
                  <textarea
                    value={performanceData}
                    onChange={(e) => setPerformanceData(e.target.value)}
                    placeholder="Quais posts deram certo? O que o público falou? Como foram as vendas?"
                    className="w-full min-h-[180px] p-5 rounded-2xl border-2 border-slate-100 bg-white/50 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all resize-none text-slate-700 text-sm"
                    required
                  />
                </div>
                  </div>

                  {/* Ideas & Traffic */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Novas Ideias (Incorporate no Plano)
                      </label>
                      <textarea
                        value={newIdeas}
                        onChange={(e) => setNewIdeas(e.target.value)}
                        placeholder="Ex: Quero fazer uma live de sorteio especial. Uma collab com influenciador X..."
                        className="w-full min-h-[140px] p-5 rounded-2xl border-2 border-slate-100 bg-white/50 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all resize-none text-slate-700 text-sm"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Tráfego Pago (Opcional)
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input 
                          type="text"
                          placeholder="Verba (Ex: R$ 500)"
                          value={trafficData.budget}
                          onChange={(e) => setTrafficData({...trafficData, budget: e.target.value})}
                          className="w-full p-4 rounded-xl border-2 border-slate-100 bg-white/50 focus:bg-white outline-none text-xs"
                        />
                        <input 
                          type="text"
                          placeholder="Resultados (Ex: 20 vendas)"
                          value={trafficData.results}
                          onChange={(e) => setTrafficData({...trafficData, results: e.target.value})}
                          className="w-full p-4 rounded-xl border-2 border-slate-100 bg-white/50 focus:bg-white outline-none text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={isLoading || !performanceData.trim()}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-slate-900 font-black py-5 px-8 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-amber-200 active:scale-[0.98] uppercase tracking-widest text-sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Refinando Estratégia...
                      </>
                    ) : (
                      <>
                        Gerar Inteligência Estratégica
                        <ArrowRight className="w-6 h-6" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="mb-6"
              >
                <BrainCircuit className="w-16 h-16 text-amber-500" />
              </motion.div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Refinando a Estratégia</h3>
              <p className="text-slate-500 max-w-sm">O Gênio está analisando seus dados e convertendo tudo para uma linguagem clara e focada em resultados.</p>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}

            {plan && (
              <motion.div 
                ref={resultsRef}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
              >
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden">
                  <div className="bg-slate-900 px-6 py-4 sm:px-8 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-3 text-amber-400">
                        {strategyType === 'mensal' ? <CalendarDays className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        <h3 className="font-bold uppercase tracking-widest text-xs">
                          {strategyType === 'mensal' ? 'Diagnóstico Mensal Estrutural' : 'Plano Semanal de Venda Direta'}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                        <button
                          onClick={handleListenToPlan}
                          disabled={isAudioLoading}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                            isPlaying 
                            ? 'bg-amber-500 text-slate-900' 
                            : 'bg-slate-800 text-slate-400 hover:text-amber-400'
                          }`}
                        >
                          {isAudioLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isPlaying ? (
                            <Volume2 className="w-3 h-3 animate-pulse" />
                          ) : (
                            <Headphones className="w-3 h-3" />
                          )}
                          {isAudioLoading ? 'Processando Voz...' : isPlaying ? 'Parar Áudio' : 'Ouvir Diagnóstico'}
                        </button>

                        <button
                          onClick={startVoiceConversation}
                          disabled={isAudioLoading || isListening}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            isListening 
                            ? 'bg-red-500 text-white animate-pulse' 
                            : 'bg-slate-800 text-slate-400 hover:text-amber-400'
                          }`}
                        >
                          <Mic className="w-3 h-3" />
                          {isListening ? 'Ouvindo...' : 'Conversar por Voz'}
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-800 px-2 py-1 rounded">
                      Documento Oficial
                    </div>
                  </div>
                  
                    <div className="p-8 sm:p-12">
                      <div className="markdown-content">
                        <ReactMarkdown>{plan}</ReactMarkdown>
                      </div>

                      {/* Input for refinement */}
                      <div className="mt-12 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          Adicionar Novas Informações e Atualizar Solução
                        </h4>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <textarea
                            value={refinementText}
                            onChange={(e) => setRefinementText(e.target.value)}
                            placeholder="Algo mudou? Tem novos números ou uma ideia que surgiu agora? Digite aqui para atualizar o diagnóstico..."
                            className="flex-1 p-4 rounded-2xl border-2 border-white bg-white focus:border-amber-400 outline-none transition-all text-sm text-slate-700 min-h-[100px] resize-none"
                          />
                          <button
                            onClick={handleRefine}
                            disabled={isRefining || !refinementText.trim()}
                            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {isRefining ? 'Atualizando...' : 'Atualizar'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col gap-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                        <button 
                          onClick={copyToNotion}
                          className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold transition-all uppercase tracking-widest shadow-md ${
                            copied 
                            ? 'bg-green-500 text-white' 
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {copied ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? 'Copiado para Notion!' : 'Lista para Notion'}
                        </button>

                        <button 
                          onClick={copyFullSolution}
                          className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold transition-all uppercase tracking-widest shadow-md ${
                            copiedFull 
                            ? 'bg-green-500 text-white' 
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          {copiedFull ? <CheckCircle2 className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
                          {copiedFull ? 'Tudo Copiado!' : 'Copiar Toda Solução'}
                        </button>

                        <button 
                          onClick={copyForWhatsApp}
                          className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold transition-all uppercase tracking-widest shadow-md border-2 ${
                            copiedWhatsApp 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'bg-white border-slate-900 text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          {copiedWhatsApp ? <CheckCircle2 className="w-4 h-4" /> : <MessageSquareQuote className="w-4 h-4" />}
                          {copiedWhatsApp ? 'Pronto para Enviar!' : 'Copiar para Terceiros'}
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => window.print()}
                          className="flex items-center justify-center gap-2 px-6 py-3 text-slate-400 hover:text-slate-900 text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest"
                        >
                          Imprimir Relatório
                        </button>

                        <button 
                          onClick={handleNewDiagnostic}
                          className="flex items-center gap-2 px-8 py-3 bg-slate-100 hover:bg-amber-500 hover:text-slate-900 text-slate-500 text-xs font-black rounded-xl transition-all uppercase tracking-widest shadow-sm shadow-slate-200"
                        >
                          Novo Diagnóstico
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
