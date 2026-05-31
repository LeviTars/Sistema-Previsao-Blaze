# Melhorias para aumentar a assertividade da previsao

Analise feita em 2026-05-31 sobre o projeto `sistema-previsao`.

## Status da implementacao

Implementacao inicial concluida em 2026-05-31:

- schema ampliado com qualidade de dados, payload bruto e tabela `Prediction`;
- coleta com fonte, id externo, validacao de cor/numero e reconciliacao de previsoes;
- backend registrando previsoes por rodada-base e expondo estatisticas reais;
- motor Python retornando `NO_BET`, probabilidades, calibragem, votos dos modelos e motivos;
- backtest walk-forward criado em `analysis/backtest.py`;
- frontend exibindo decisao, acerto real, calibragem, probabilidades e fatores do sinal.

Observacao: a calibragem real depende de historico/backtest suficiente. Ate existir calibragem empirica, o motor bloqueia entradas como `NO_BET`, que e o comportamento correto para aumentar assertividade e reduzir falsos sinais.

## Premissa importante

O sistema tenta prever resultados do Blaze Double, um jogo com distribuicao teorica de 15 numeros:

- `WHITE`: 1/15, cerca de 6,67%.
- `RED`: 7/15, cerca de 46,67%.
- `BLACK`: 7/15, cerca de 46,67%.

Se a geracao for realmente independente e "provably fair", historico passado nao deve permitir prever a proxima rodada com vantagem estavel. Entao, a melhor melhoria de assertividade nao e aumentar nomes como "IA", "Quantum" ou "confianca"; e medir, calibrar e cortar sinais ruins. O objetivo tecnico deve ser:

- reduzir falsos sinais;
- medir acerto fora da amostra;
- calibrar probabilidade real;
- entrar somente quando o sistema demonstrar vantagem estatistica verificavel;
- mostrar incerteza com honestidade.

## Como o sistema funciona hoje

- O `CollectorService` busca resultados periodicamente e salva no banco (`backend/src/collector/collector.service.ts`).
- O backend busca ate 1000 rodadas recentes e envia ao microservico Python (`backend/src/analysis/analysis.controller.ts`).
- O Python calcula frequencias, gap do branco, streak, entropia, padroes, Markov, Bayes, indicadores e XGBoost (`analysis/main.py`).
- O frontend mostra esteira, metricas e um sinal unico com `confidence`, `quantum_score` e `kelly_fraction` (`frontend/src/components`).

## Principais gargalos de assertividade

### 1. Nao existe medicao real de acerto dos sinais

Hoje o sistema calcula uma sugestao, mas nao registra qual foi a previsao feita antes da proxima rodada nem confere se ela acertou depois.

Impacto: nao ha como saber se `confidence=80%` realmente acerta 80%, nem se o algoritmo bate uma linha base simples.

Melhorias:

- Criar uma tabela `Prediction` no Prisma com:
  - data/hora da previsao;
  - rodada base usada;
  - cor prevista;
  - probabilidades para `RED`, `BLACK`, `WHITE`;
  - `confidence`;
  - modelos que participaram;
  - resultado real depois;
  - status `PENDING`, `HIT`, `MISS`, `VOID`.
- Criar endpoint para registrar previsao antes da proxima rodada.
- Criar worker ou rotina de reconciliacao para preencher o resultado real.
- Exibir no frontend:
  - acerto das ultimas 50/100/500 previsoes;
  - acerto por tipo de padrao;
  - acerto por faixa de confianca;
  - ROI teorico separado de taxa de acerto.

Prioridade: P0.

### 2. Falta backtesting walk-forward

O XGBoost e os modelos manuais sao aplicados sobre historico recente, mas nao existe um simulador que percorra o passado como se estivesse em tempo real.

Impacto: o sistema pode parecer bom no presente e falhar fora da amostra.

Melhorias:

- Criar script `analysis/backtest.py`.
- Para cada ponto do historico:
  - usar somente rodadas anteriores;
  - gerar previsao para a proxima;
  - comparar com resultado real;
  - armazenar metricas.
- Medir:
  - accuracy;
  - balanced accuracy;
  - precision/recall por cor;
  - Brier score;
  - log loss;
  - matriz de confusao;
  - lucro/prejuizo teorico por estrategia, separado da acuracia.
- Comparar contra baselines:
  - sempre `RED`;
  - sempre `BLACK`;
  - cor mais frequente na janela;
  - aleatorio ponderado por 7/15, 7/15, 1/15;
  - nao entrar.

Prioridade: P0.

### 3. A confianca nao e uma probabilidade calibrada

Em `generate_suggestion` (`analysis/main.py`), o `final_score` mistura Markov, Bayes, memoria, atracao numerica, Z-Score, RSI, padrao visual e XGBoost. Depois esse score vira `confidence` e tambem alimenta Kelly.

Impacto: `confidence=75%` nao significa necessariamente 75% de chance real. Isso distorce decisao e gestao de banca.

Melhorias:

- Separar `score interno` de `probabilidade calibrada`.
- Calibrar saidas com:
  - Platt scaling;
  - isotonic regression;
  - ou calibracao por buckets.
- Exibir `confidence` somente depois de validada em backtest.
- Armazenar curva de calibracao:
  - sinais de 50-60%;
  - 60-70%;
  - 70-80%;
  - 80-90%;
  - 90%+.
- Se uma faixa de 80% acerta 52%, a UI deve mostrar 52% ou bloquear o selo de alta confianca.

Prioridade: P0.

### 4. Kelly esta usando score nao calibrado

O `kelly_fraction` e calculado a partir do `final_score` em `analysis/main.py`. Para branco, usa a confianca do `WHITE HUNTER`; para vermelho/preto, usa `2p - 1`.

Impacto: se `p` nao e probabilidade real, Kelly aumenta risco em vez de controlar risco.

Melhorias:

- Calcular Kelly somente com probabilidade calibrada e odds reais.
- Considerar payout real, regras da plataforma, protecao no branco e eventuais custos.
- Implementar `fractional Kelly` mais conservador por padrao:
  - 1/10 Kelly;
  - limite por dia;
  - limite por drawdown;
  - bloqueio apos sequencia de perdas.
- Se a probabilidade calibrada nao superar o break-even, retornar `NO_BET`.

Prioridade: P0.

### 5. Nao ha contrato claro de "previsao para a proxima rodada"

O frontend atualiza a cada 3s, o coletor coleta a cada 30s e a analise usa a rodada mais recente do banco. Falta registrar explicitamente que o sinal foi gerado antes da rodada que sera julgada.

Impacto: pode haver confusao entre analisar a rodada que acabou de sair e prever a proxima. Isso tambem impede auditoria correta.

Melhorias:

- Adicionar campo `base_roll_id` e `target_round_time` ou `target_external_id` na previsao.
- Mostrar na UI: "Sinal gerado apos rodada X, valido para proxima rodada".
- Invalidar sinal se chegar uma nova rodada antes do usuario ver.
- Nunca recalcular retroativamente uma previsao ja emitida.

Prioridade: P0.

### 6. A coleta precisa guardar identificador externo e payload bruto

O schema atual tem `id`, `color`, `roll_value`, `timestamp`, `server_seed` e `hash` (`backend/prisma/schema.prisma`). O coletor usa `hash` ou `server_seed` para deduplicar (`collector.service.ts`).

Impacto: se a API mudar, repetir seed, omitir seed ou alterar formato, o historico pode ter duplicatas ou perdas. Isso contamina qualquer modelo.

Melhorias:

- Adicionar no banco:
  - `external_id`;
  - `source`;
  - `raw_payload`;
  - `collected_at`;
  - `round_status`;
  - `sequence_number`, se existir na API.
- Criar unique composto por fonte e identificador externo.
- Validar consistencia:
  - `WHITE` deve ter `roll_value=0`;
  - `RED` deve estar entre 1 e 7;
  - `BLACK` deve estar entre 8 e 14;
  - timestamp nao pode ser invalido;
  - rodada futura deve ser rejeitada ou marcada.
- Separar `server_seed` de `hash` real, se a API fornecer ambos.

Prioridade: P0.

### 7. O mock gera dados que parecem historico, mas nao simulam uma fonte real

O endpoint mock (`backend/src/mock/mock.controller.ts`) gera novas rodadas aleatorias a cada chamada, com novos UUIDs. Isso e util para tela, mas ruim para validar modelo.

Impacto: o coletor pode salvar "historicos" sinteticos repetidos com timestamps artificiais. O modelo aprende ruido.

Melhorias:

- Marcar dados mock com `source='mock'`.
- Nunca misturar mock com dados reais em treino/backtest.
- Criar um mock deterministico com seed fixa para testes.
- Criar fixtures historicas reais, imutaveis e versionadas.

Prioridade: P0.

### 8. Janela maxima de 1000 rodadas e pequena para treino serio

O backend envia ate 1000 rodadas (`backend/src/analysis/analysis.controller.ts`). Para modelos, isso e pouco, principalmente para `WHITE`, que aparece em media apenas 66 vezes a cada 1000 rodadas.

Impacto: o modelo tem pouca amostra da classe rara e tende a overfitting.

Melhorias:

- Armazenar e treinar com dezenas/centenas de milhares de rodadas, quando disponivel.
- Separar:
  - janela curta para estado atual;
  - janela longa para treino;
  - janela de validacao;
  - janela de teste.
- Para `WHITE`, usar metricas proprias da classe rara, nao apenas accuracy geral.

Prioridade: P1.

### 9. O XGBoost nao tem validacao, calibracao nem tratamento de classe rara

`SupremeAIPredictor` treina com janelas de 10 cores e 10 valores (`analysis/main.py`). Nao ha split temporal, early stopping, metricas, pesos por classe ou calibracao.

Impacto: a IA pode memorizar ruido e produzir probabilidade confiante sem vantagem real.

Melhorias:

- Treinar com split temporal:
  - treino: passado distante;
  - validacao: passado recente;
  - teste: periodo mais novo ainda nao usado.
- Usar `sample_weight` ou estrategia especifica para `WHITE`.
- Persistir metadados do modelo:
  - tamanho do treino;
  - periodo usado;
  - metricas fora da amostra;
  - versao das features;
  - data do treino.
- Salvar um arquivo `model_card.json`.
- Bloquear uso do modelo se a metrica fora da amostra cair abaixo do baseline.
- Rodar treinamento offline ou em job dedicado, nao dentro do endpoint de previsao.

Prioridade: P1.

### 10. O `last_training_size` nao e persistido

O modelo carrega `joblib`, mas `last_training_size` volta para `0` ao reiniciar. Quando houver 500+ rodadas, isso pode disparar retreino novamente.

Impacto: instabilidade operacional e previsoes baseadas em modelos re-treinados sem rastreabilidade.

Melhorias:

- Persistir `last_training_size`, `trained_until_timestamp` e hash do dataset.
- Criar lock de treino robusto.
- Versionar modelos em vez de sobrescrever sempre `supreme_xgb.joblib`.

Prioridade: P1.

### 11. A formula Bayesiana atual nao esta calibrada

`bayesian_probability` usa prior teorico, observacao das ultimas 10 e evidencia da janela. Quando ha menos de 50 rodadas, divide pela janela fixa mesmo que a amostra seja menor.

Impacto: pode inflar ou distorcer probabilidades, principalmente no comeco da coleta.

Melhorias:

- Usar `len(recent)` real no calculo.
- Substituir por modelo Beta-Binomial simples por cor.
- Usar suavizacao:
  - prior teorico como pseudo-contagem;
  - evidencia de janela com tamanho real;
  - intervalo de confianca.
- Retornar probabilidade e incerteza, nao apenas ponto unico.

Prioridade: P1.

### 12. Z-Score usa janela fixa mesmo com amostra menor

`calculate_z_score` usa `window=50` para esperado e desvio, mesmo que `recent` tenha menos de 50 linhas.

Impacto: no inicio, o indicador fica matematicamente enviesado.

Melhorias:

- Trocar `window` por `n = len(recent)`.
- Nao usar Z-Score com `n` pequeno.
- Exigir amostra minima por metrica.

Prioridade: P1.

### 13. Padroes visuais nao tratam branco como evento especial

`detect_visual_patterns` opera sobre as cores recentes, mas algumas regras como xadrez e duplas podem envolver `WHITE` e ainda retornar `RED` ou `BLACK`.

Impacto: sinais podem ser gerados por padroes que nao fazem sentido para vermelho/preto.

Melhorias:

- Criar regras separadas:
  - padroes apenas `RED/BLACK`;
  - padroes com interrupcao por `WHITE`;
  - padroes especificos de `WHITE`.
- Invalidar padroes visuais quando `WHITE` aparecer no trecho, exceto se a regra explicitamente permitir.
- Medir acerto de cada padrao isoladamente antes de dar bonus.

Prioridade: P1.

### 14. "White Hunter" pode reforcar falacia do atraso

O sistema usa `white_gap`, Bayes e um `puxador_score` para sinalizar branco. Como `WHITE` e raro, gaps longos acontecem naturalmente em distribuicao geometrica.

Impacto: gap alto pode parecer oportunidade mesmo quando nao altera a chance real da proxima rodada.

Melhorias:

- Modelar gap do branco como distribuicao geometrica.
- Mostrar probabilidade condicional validada historicamente:
  - chance de branco apos gap 10;
  - apos gap 20;
  - apos gap 30;
  - comparar com 6,67%.
- So criar sinal de branco se o backtest mostrar aumento real e consistente.
- Separar alerta informativo de sinal de entrada.

Prioridade: P1.

### 15. O ensemble usa pesos fixos sem otimizacao

Em `generate_suggestion`, pesos como Markov 0.15, Bayes 0.2, memoria 0.25, atracao numerica 0.2 e IA 0.4 foram definidos manualmente.

Impacto: pesos podem reforcar ruido ou duplicar a mesma informacao.

Melhorias:

- Aprender pesos por validacao walk-forward.
- Usar meta-modelo simples:
  - logistic regression;
  - gradient boosting calibrado;
  - stacking com validacao temporal.
- Permitir `NO_BET` como classe de decisao.
- Remover qualquer componente que nao supere baseline isoladamente.

Prioridade: P1.

### 16. Markov de ordem 3 precisa de suporte minimo

`calculate_markov_high_order` retorna transicoes quando encontra o estado atual no historico, mas nao exige quantidade minima de matches.

Impacto: uma probabilidade pode sair de poucos exemplos e parecer forte.

Melhorias:

- Retornar tambem `support`.
- Ignorar Markov se `support < 20`, por exemplo.
- Testar ordens 1, 2, 3 e escolher por validacao.
- Usar suavizacao de Laplace para evitar probabilidade extrema.

Prioridade: P1.

### 17. Memoria historica tambem precisa de suporte minimo

`find_historical_pattern_match` procura sequencia exata, mas retorna distribuicao mesmo com poucos matches.

Impacto: uma coincidencia rara pode virar sinal forte.

Melhorias:

- Retornar `matches_count`.
- Aplicar suporte minimo.
- Usar similaridade aproximada somente se validada.
- Registrar quais matches geraram o sinal para auditoria.

Prioridade: P1.

### 18. Atracao numerica pode ser ruido

`calculate_numerical_attraction` verifica quais cores seguiram o mesmo numero atual no passado.

Impacto: se os numeros forem gerados de forma independente, essa relacao deve ser ruido.

Melhorias:

- Medir ganho incremental desse componente em backtest.
- Remover ou reduzir peso se nao superar baseline.
- Exigir amostra minima por numero.

Prioridade: P1.

### 19. Auditoria de seed nao deve ser usada como sinal preditivo

`verify_seed_integrity` tenta validar cadeia SHA-256 e detectar sementes reutilizadas.

Impacto: integridade da seed pode indicar confiabilidade dos dados, mas nao aumenta chance de prever a proxima cor. Se a verificacao estiver errada, pode criar alarmes falsos.

Melhorias:

- Separar auditoria de integridade da previsao.
- Usar seed integrity para aceitar/rejeitar dado, nao para aumentar confianca.
- Confirmar o protocolo real da API usada.
- Persistir `client_seed`, `server_seed`, `server_seed_hash`, `nonce` e campos reais se existirem.

Prioridade: P1.

### 20. Fallback do backend retorna estrutura incompleta

Quando o Python esta offline, o backend retorna sugestao sem `kelly_fraction` e sem `seed_integrity`, enquanto os tipos do frontend esperam esses campos.

Impacto: nao afeta assertividade diretamente, mas pode quebrar UI ou mascarar indisponibilidade analitica.

Melhorias:

- Padronizar contrato de resposta.
- Retornar `analysis_status: DEGRADED`.
- Nunca mostrar sinal quando o motor preditivo esta offline.

Prioridade: P1.

### 21. Falta cache por watermark de dados

O frontend chama analise a cada 3s, mas a coleta padrao roda a cada 30s.

Impacto: varias analises iguais sao recalculadas, podendo retreinar ou gerar logs excessivos. Isso tambem dificulta rastrear qual sinal era valido.

Melhorias:

- Criar cache de analise no backend por `latest_roll_id`.
- Recalcular somente quando chegar rodada nova.
- Retornar `analysis_generated_at` e `based_on_latest_roll`.

Prioridade: P2.

### 22. Falta observabilidade de dados e modelo

Nao ha dashboard tecnico para qualidade da coleta, latencia, quantidade de duplicatas, taxa de erro do microservico ou drift.

Impacto: queda de assertividade pode passar despercebida.

Melhorias:

- Registrar metricas:
  - rodadas coletadas por hora;
  - duplicatas rejeitadas;
  - atraso medio da coleta;
  - falhas da API;
  - tempo de analise;
  - versao do modelo em uso;
  - acerto por versao.
- Criar endpoint `/api/metrics` ou logs estruturados.

Prioridade: P2.

### 23. Falta teste automatizado da logica estatistica

O teste e2e padrao ainda espera `/` retornar `Hello World!`, mas o app atual nao tem esse controller.

Impacto: regressao em logica critica pode passar sem ser vista.

Melhorias:

- Criar testes unitarios para:
  - parse da API real;
  - deduplicacao;
  - calculo de frequencia;
  - gap do branco;
  - streak;
  - entropia;
  - Bayes;
  - Markov;
  - padroes visuais;
  - contrato de fallback.
- Criar fixtures com sequencias conhecidas.
- Rodar `pytest` no microservico Python.

Prioridade: P2.

### 24. A UI mostra termos fortes antes de haver evidencias

Termos como "Sinal Quantico", "Ressonancia", "Alta convergencia", "Entrada" e "IA Suprema" podem passar confianca maior que a validacao atual permite.

Impacto: o usuario pode interpretar score interno como garantia.

Melhorias:

- Mostrar "probabilidade calibrada" e "historico de acerto".
- Substituir `confidence` por:
  - `probability_calibrated`;
  - `model_edge`;
  - `sample_support`;
  - `last_100_hit_rate`.
- Exibir "sem entrada" como estado normal.
- Mostrar aviso quando nao houver amostra suficiente.

Prioridade: P2.

### 25. Falta explicabilidade do sinal

Hoje a mensagem retorna um texto unico. O usuario nao ve quais modelos concordaram, com quais probabilidades e qual suporte historico.

Impacto: fica dificil confiar, auditar e melhorar.

Melhorias:

- Retornar no payload:
  - `model_votes`;
  - `features_used`;
  - `support_count`;
  - `raw_scores`;
  - `calibrated_probabilities`;
  - `reason_codes`.
- Exibir no frontend uma tabela compacta de fatores.

Prioridade: P2.

## Roadmap recomendado

### Fase 1: Fundacao de medicao

1. Criar tabela `Prediction`.
2. Registrar cada previsao emitida.
3. Reconciliar previsoes com resultados reais.
4. Criar backtest walk-forward.
5. Adicionar baselines.
6. Bloquear Kelly ate existir probabilidade calibrada.

Resultado esperado: saber se o sistema acerta mais que o baseline.

### Fase 2: Qualidade dos dados

1. Adicionar `external_id`, `source`, `raw_payload`, `collected_at`.
2. Validar cor, numero e timestamp.
3. Separar dados mock de dados reais.
4. Criar fixtures historicas.
5. Cachear analise por rodada mais recente.

Resultado esperado: dataset confiavel para treino e auditoria.

### Fase 3: Modelagem calibrada

1. Corrigir Bayes, Z-Score e suporte minimo dos padroes.
2. Adicionar probabilidades para as tres cores.
3. Treinar XGBoost com split temporal.
4. Calibrar probabilidades.
5. Aprender pesos do ensemble via backtest.
6. Versionar modelos e metricas.

Resultado esperado: sinais com probabilidade mais honesta.

### Fase 4: Produto e decisao

1. Exibir acerto historico por faixa de confianca.
2. Exibir explicabilidade do sinal.
3. Mostrar `NO_BET` como saida principal quando nao houver edge.
4. Adicionar limites de risco e drawdown.
5. Alertar quando integridade/dados estiverem degradados.

Resultado esperado: menos entradas ruins e decisao mais transparente.

## Melhorias de schema sugeridas

Exemplo conceitual:

```prisma
model Roll {
  id            String   @id @default(uuid()) @db.Uuid
  external_id   String?
  source        String   @default("unknown")
  color         Color
  roll_value    Int
  timestamp     DateTime
  collected_at  DateTime @default(now())
  server_seed   String?
  seed_hash     String?
  hash          String?
  raw_payload   Json?

  predictions_based_on Prediction[] @relation("BaseRoll")
  predictions_target   Prediction[] @relation("TargetRoll")

  @@unique([source, external_id])
  @@index([timestamp(sort: Desc)])
  @@index([source, timestamp])
  @@map("rolls")
}

model Prediction {
  id                  String           @id @default(uuid()) @db.Uuid
  created_at          DateTime         @default(now())
  model_version        String
  base_roll_id         String          @db.Uuid
  target_roll_id       String?         @db.Uuid
  predicted_color      Color?
  prob_red             Float
  prob_black           Float
  prob_white           Float
  confidence_raw       Float
  confidence_calibrated Float?
  decision             PredictionDecision
  reason_codes         Json?
  result_color         Color?
  outcome              PredictionOutcome @default(PENDING)

  base_roll   Roll  @relation("BaseRoll", fields: [base_roll_id], references: [id])
  target_roll Roll? @relation("TargetRoll", fields: [target_roll_id], references: [id])

  @@index([created_at(sort: Desc)])
  @@index([model_version])
  @@index([outcome])
}

enum PredictionDecision {
  BET_RED
  BET_BLACK
  BET_WHITE
  NO_BET
}

enum PredictionOutcome {
  PENDING
  HIT
  MISS
  VOID
}
```

## Checklist objetivo

- [ ] Registrar previsoes antes da rodada alvo.
- [ ] Medir acerto real por periodo e por modelo.
- [ ] Implementar backtest walk-forward.
- [ ] Comparar contra baselines simples.
- [ ] Calibrar probabilidades antes de exibir confianca.
- [ ] Desativar Kelly enquanto a probabilidade nao for calibrada.
- [ ] Adicionar suporte minimo para Markov, memoria e padroes.
- [ ] Corrigir Bayes/Z-Score para usar tamanho real da amostra.
- [ ] Separar dados mock de dados reais.
- [ ] Guardar identificador externo e payload bruto.
- [ ] Versionar modelos e metricas.
- [ ] Exibir `NO_BET` como resultado normal.
- [ ] Mostrar hit rate historico no frontend.
- [ ] Criar testes unitarios e fixtures.

## Conclusao

O sistema ja tem uma boa estrutura tecnica inicial: coleta, banco, API, microservico analitico e dashboard. O ponto central para melhorar a assertividade e transformar o motor atual de "gerador de sinais" em um motor medido, auditavel e calibrado.

A ordem mais eficiente e: medir previsoes reais, criar backtest, corrigir qualidade dos dados, calibrar probabilidades e so entao ajustar modelos e estrategia de entrada.
