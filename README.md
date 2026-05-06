# Blaze Double - Sistema de Previsão 🚀

Este sistema é uma plataforma avançada de análise estatística e previsão para o jogo **Double da Blaze**. Ele utiliza uma arquitetura de microsserviços para coletar dados, realizar processamento matemático complexo e fornecer sinais em tempo real através de uma interface moderna.

---

## 🏗️ Arquitetura do Sistema

O projeto é dividido em três componentes principais:

### 1. 🐍 Microsserviço de Análise (Python/FastAPI)
O "cérebro" do sistema, responsável por toda a lógica matemática e de IA.
- **Tecnologias:** FastAPI, Pandas, NumPy, XGBoost, Scikit-learn.
- **Funcionalidades:**
    - **Supreme AI Engine:** Modelo XGBoost treinado dinamicamente para prever a próxima cor.
    - **Análise Estatística:** Frequências, Gaps, Entropia de Shannon e Z-Score.
    - **Detecção de Padrões:** Reconhecimento de sequências como Xadrez (1x1), Duplas (2x2), Surfe e Espelhamento.
    - **Gestão de Banca:** Sugestão de entrada baseada no Critério de Kelly.
    - **Auditoria de Integridade:** Verificação de sementes (Provably Fair) via SHA-256.

### 2. 🛡️ Backend (Node.js/NestJS)
A camada de integração e gerenciamento de dados.
- **Tecnologias:** NestJS, Prisma ORM, TypeScript.
- **Funcionalidades:**
    - API REST para comunicação com o frontend.
    - Integração com o microsserviço de análise.
    - Persistência de dados e histórico de rodadas.

### 3. 💻 Frontend (Next.js)
Interface do usuário moderna e responsiva para visualização dos dados.
- **Tecnologias:** Next.js, Tailwind CSS, TypeScript.
- **Funcionalidades:**
    - Dashboard em tempo real.
    - Visualização de métricas (Quantum Score, Market State, Entropia).
    - Alertas de sinais e sugestões de entrada.

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+
- Python 3.9+
- PostgreSQL (ou outro banco suportado pelo Prisma)

### Passo 1: Análise (Python)
```bash
cd analysis
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate no Windows
pip install -r requirements.txt
python main.py
```

### Passo 2: Backend (NestJS)
```bash
cd backend
npm install
# Configure o .env com sua DATABASE_URL
npx prisma generate
npx prisma db push
npm run start:dev
```

### Passo 3: Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

---

## 📊 Métricas Principais
- **Quantum Score:** Nível de convergência entre múltiplos modelos matemáticos (0-100%).
- **Market State:** Estado do mercado (STABLE, VORTEX, TRENDING, NEUTRAL).
- **Entropy:** Medida de desordem dos resultados recentes.
- **Kelly Fraction:** Percentual sugerido da banca para cada entrada.

---

## ⚠️ Aviso Legal
Este software é para fins educacionais e de análise estatística. O uso em plataformas de apostas envolve riscos financeiros. Não garantimos lucros e não nos responsabilizamos por perdas decorrentes do uso das informações fornecidas por este sistema.
