# Documentação Técnica: Sistema de Previsão Supremo (Blaze Double)

Este documento descreve a arquitetura, as funcionalidades e a lógica analítica do sistema de inteligência de mercado para o jogo Double.

## 🏗️ Arquitetura do Sistema

O sistema é baseado em uma arquitetura de microsserviços distribuídos, garantindo alta performance e separação de responsabilidades.

- **Frontend (Next.js)**: Painel de controle e visualização em tempo real (Porta 3000).
- **Backend (NestJS)**: Núcleo de processamento e gerenciamento de dados (Porta 3001).
- **IA/Análise (FastAPI)**: Microsserviço Python para cálculos e predições (Porta 8000).
- **Banco de Dados**: PostgreSQL (Supabase) gerenciado via Prisma ORM.

## 🧠 Motores de Análise (Ensemble Model)

O sistema utiliza um **Consenso Algorítmico** entre vários modelos para garantir máxima assertividade:

1. **XGBoost (Supreme IA)**: Modelo de Machine Learning que aprende com milhares de rodadas passadas para identificar padrões não lineares.
2. **Cadeias de Markov (Ordem 3)**: Analisa a probabilidade de transição entre cores baseado na sequência imediata.
3. **Probabilidade Bayesiana**: Ajusta as chances em tempo real, especialmente para o Branco, conforme novos dados chegam.
4. **Entropia de Shannon**: Mede o nível de desordem do mercado para detectar e evitar estados caóticos (Vortex).
5. **Z-Score & RSI**: Indicadores técnicos que identificam sobre-exposição ou atraso de cores específicas.

## 🛡️ Segurança e Auditoria (Provably Fair)

Para garantir que a Blaze não altere os resultados, o sistema audita a **Cadeia de Sementes SHA-256**:
- **Lógica**: Valida se a semente da rodada atual, após passar por um hash SHA-256, resulta na semente da rodada anterior.
- **Confiabilidade**: É um método criptográfico inviolável que prova a integridade do histórico.

## 💰 Gestão de Risco (Critério de Kelly)

Toda entrada sugerida é acompanhada de uma recomendação de alocação de banca calculada matematicamente:
- Protege contra quebras (drawdowns) usando o modelo "Half-Kelly".
- Limita o risco a um máximo sugerido de 5% da banca por sinal.

## 🚀 Status de Operação

- **Versão**: 5.0.42 (Suprema)
- **Modo**: Tempo Real (API Blaze Live)
- **Otimização**: WinError 1450 Fixed / Cold Start Logic Fixed.
