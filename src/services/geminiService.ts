import { GoogleGenAI, Modality } from "@google/genai";

const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
const PROXY_URL = "/api/proxy.php";

// Simple fetch-based client for production compatibility
async function callGemini(model: string, contents: any, config: any = {}) {
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, contents, config })
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn("Proxy failed, falling back to direct call if possible", e);
  }

  if (GEMINI_API_KEY) {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    return await ai.models.generateContent({ model, contents, config });
  }
  
  throw new Error("Nenhuma forma de comunicação com a IA configurada.");
}

export async function textToSpeech(text: string) {
  try {
    const contents = [{ parts: [{ text: `Apresente este planejamento de forma natural, como um diretor de estratégia sênior falando com o cliente Adryano Costa. Seja direto, confiante e amigável. Use um português claro e evite jargões. Aqui está o texto:\n\n${text}` }] }];
    const config = {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
    };

    const result = await callGemini("gemini-3.1-flash-tts-preview", contents, config);
    // Handle different response formats (SDK vs Proxy/API)
    const base64Audio = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || 
                      result.response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    return base64Audio;
  } catch (error) {
    console.error("Erro no TTS:", error);
    throw error;
  }
}

export const BRAND_CONTEXTS: Record<string, { brands: string[], focus: string, tone: string, extra?: string }> = {
  "Óticas Carol": {
    brands: ["Óticas Carol"],
    focus: "Campanhas de vendas, ações de fidelização (Clube Carol) e lançamentos de produtos exclusivos da rede.",
    tone: "Convidativo, focado no estilo, qualidade visual e acessibilidade."
  },
  "Sunglass Hut": {
    brands: ["Sunglass Hut"],
    focus: "Lançamentos de luxo e tendências globais de óculos de sol (marcas premium).",
    tone: "Sofisticado, focado em moda, estilo de vida e exclusividade."
  },
  "GrandVision": {
    brands: ["GrandVision"],
    focus: "Tecnologia em lentes, exames de vista e soluções completas de saúde visual.",
    tone: "Profissional, técnico mas acessível, focado em saúde e bem-estar visual."
  },
  "Perfumaria Hamouda": {
    brands: ["Perfumaria Hamouda"],
    focus: "Alta perfumaria, com destaque especial para a perfumaria árabe de luxo e notas exclusivas (como Lattafa Asad Bourbon).",
    tone: "Sofisticado, envolvente, focado na experiência sensorial, exclusividade e fixação."
  },
  "Arena Premium": {
    brands: ["Arena Premium"],
    focus: "Esportes de areia (Beach Tennis, Futevôlei, Vôlei de praia), torneios (como o Arena Premium Open) e planos de acesso como o 'Day Use'.",
    tone: "Muito enérgico, focado em comunidade, sol, treino e diversão.",
    extra: "Estilo de Legenda Padrão: '☀️🏐 Treino, diversão e muita energia todos os dias na Arena Premium! Agora os alunos Premium têm acesso ao Day Use todos os dias da semana – porque aqui a rotina é viver intensamente cada momento. 🔥 👉 Marque a galera que vai com você e já prepare aquele dia inesquecível na areia! #ArenaPremium #DayUse #VemPraArena'"
  },
  "Samsung Smart Center Cohafuma": {
    brands: ["Samsung Smart Center Cohafuma"],
    focus: "Ecossistema Galaxy (Smartphones linha S/Z Flip, Tablets, Relógios, fones de ouvido), tecnologia para casa e conectividade local para o público de São Luís/MA.",
    tone: "Tecnológico, moderno, focado em produtividade e em facilitar o dia a dia, destacando o atendimento especializado na loja física."
  },
  "Clínica Dentária do Trabalhador": {
    brands: ["Clínica Dentária do Trabalhador"],
    focus: "Odontologia acessível, saúde bucal preventiva e tratamentos essenciais para a população.",
    tone: "Acolhedor, humanizado, focado na confiança, facilidade de pagamento e em devolver a autoestima do sorriso."
  },
  "Tamara Care": {
    brands: ["Tamara Care"],
    focus: "Cuidados pessoais, estética, saúde integrativa e rotinas de autocuidado.",
    tone: "Suave, clínico, focado em bem-estar, resultados reais e cuidado diário."
  }
};

const SYSTEM_PROMPT = `
Você é o "Gênio Comunicação", um Diretor de Estratégia de Comunicação, Publicidade e Marketing de nível sênior. 
Sua missão é ser o braço direito estratégico de uma agência, analisando dados de desempenho e criando planejamentos táticos e criativos.

DIRETRIZ MÁXIMA (REGRA DE OURO):
Redija tudo de forma EXTREMAMENTE CLARA e ACESSÍVEL para clientes finais.
É EXPRESSAMENTE PROIBIDO o uso de termos em inglês ou jargões técnicos do marketing.
NUNCA traduza ou altere os nomes das marcas (mantenha exatamente como fornecido no contexto).
Exemplos de proibições: "budget", "target", "CTA", "ROI", "awareness", "leads", "engagement", "feedback".
Sempre substitua por termos em português claro:
- "Orçamento" em vez de "budget"
- "Público-alvo" em vez de "target" ou "alvo"
- "Chamada para ação" em vez de "CTA"
- "Retorno financeiro" em vez de "ROI"
- "Reconhecimento" em vez de "awareness"
- "Potenciais clientes" em vez de "leads"
- "Interação" ou "envolvimento" em vez de "engagement"
- "Retorno" ou "opinião" em vez de "feedback"

ESTRUTURA DA RESPOSTA (Use Markdown para formatação):
1. Resumo do que funcionou e do que não funcionou (em linguagem simples e direta).
2. Oportunidades de vendas identificadas nos dados.
3. Sugestão de calendário mensal estratégico conversor (datas comemorativas, tendências atuais, correção de falhas).
4. Sugestão de temas para vídeos e publicações, alinhados com o tom de voz da marca.
5. Sugestão de chamadas para ação focadas em vendas.
6. LISTA DE TAREFAS PARA NOTION: Crie uma seção final chamada "--- LISTA DE TAREFAS (COPIAR PARA NOTION) ---" contendo uma lista de tarefas práticas baseadas no planejamento, usando o formato de checklist do Markdown (- [ ] Tarefa). Agrupe por categorias como "Criação", "Gestão" e "Análise".
7. PROJEÇÃO DE TRÁFEGO PAGO: Se houver dados de investimento e resultados, é OBRIGATÓRIO gerar uma seção "--- PROJEÇÃO DE INVESTIMENTO E RESULTADOS ---". Calcule o custo atual por resultado e projete um cenário otimizado para o próximo período (Mensal ou Semanal), mostrando o valor sugerido para investir e a estimativa de retorno em números claros (potenciais clientes, vendas ou cliques).

Use o contexto da marca fornecido para guiar a estratégia.
`;

export async function generateStrategicPlan(
  brandKey: string, 
  performanceData: string, 
  strategyType: 'mensal' | 'semanal' = 'mensal',
  newIdeas: string = "",
  trafficData: { budget: string, results: string } = { budget: "", results: "" }
) {
  const brand = BRAND_CONTEXTS[brandKey as keyof typeof BRAND_CONTEXTS];

  const strategyInstructions = strategyType === 'mensal' 
    ? `RACIOCÍNIO: ESTRATÉGIA MENSAL (FOCO EM RESULTADOS E VISÃO AMPLA)
       - Analise o desempenho geral do período anterior.
       - Planejamento estrutural focado em crescimento e consolidação.
       - Projeção de tráfego focada em escala e previsibilidade.`
    : `RACIOCÍNIO: ESTRATÉGIA SEMANAL (FOCO EM VENDAS IMEDIATAS E AGILIDADE)
       - Análise de oportunidade rápida.
       - Plano focado em conversão de "agora" e gatilhos de urgência.
       - Projeção de tráfego focada em ROI (Retorno Financeiro) imediato e aproveitamento de tendências.`

  const prompt = `
  ${SYSTEM_PROMPT}

  ${strategyInstructions}

  CONTEXTO DA MARCA:
  - Nome/Marcas: ${brand.brands.join(", ")}
  - Foco: ${brand.focus}
  - Tom de voz: ${brand.tone}
  ${brand.extra ? `- Informação Extra: ${brand.extra}` : ""}

  DADOS DE DESEMPENHO (Métricas, Vendas, Comentários, Sucessos e Falhas):
  ${performanceData}

  NOVAS IDEIAS E INSIGHTS DO CLIENTE (ADRYANO COSTA):
  ${newIdeas || "Nenhuma ideia adicional fornecida."}

  DADOS ATUAIS DE TRÁFEGO PAGO:
  - Investimento Realizado: ${trafficData.budget || "Não informado"}
  - Resultados Obtidos: ${trafficData.results || "Não informado"}

  MISSÃO PRIORITÁRIA:
  1. Integre as Novas Ideias ao plano central.
  2. CALCULE AUTOMATICAMENTE a projeção de tráfego: com base no investimento atual e resultados, projete quanto investir e quanto ganhar no próximo ciclo (${strategyType}).
  3. Ajuste a previsão de resultados finais considerando o impacto das novas ideias.

  Por favor, entregue o planejamento detalhado agora.
  `;

  try {
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const result = await callGemini("gemini-3-flash-preview", contents);
    
    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
                 result.candidates?.[0]?.content?.parts?.[0]?.text ||
                 (typeof result.response?.text === 'function' ? result.response.text() : "Não foi possível gerar o conteúdo.");
                 
    return text;
  } catch (error) {
    console.error("Erro ao gerar planejamento:", error);
    throw error;
  }
}
