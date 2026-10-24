# Family Plan - Controle Financeiro Familiar

Aplicativo local e responsivo de controle financeiro familiar (*Local-First*), projetado para sincronização fácil entre Windows e dispositivos móveis na rede local via QR Code.

---

## 🚀 Principais Recursos

- **Dashboard Principal:**
  - Card de saldo bancário ultra-clean com ações rápidas para entradas e despesas.
  - Indicadores de entradas confirmadas e pendentes (*Previsto / A receber*).
  - Indicadores de despesas confirmadas e pendentes (*Previsto / A pagar*).
  - Gráficos visuais de evolução mensal, despesas por categoria e ritmo diário de gastos.

- **Rastreador de Despesas Parceladas e Recorrências:**
  - Gerenciamento inteligente de séries recorrentes e compras parceladas.
  - Diálogos inteligentes para exclusão e edição em lote (*"Apenas este"* ou *"Este e os próximos"*).
  - Acompanhamento do progresso das parcelas com badges informativos (ex: *Parcela 2/5*).

- **Gestão Completa de Cartões de Crédito:**
  - Cadastro de múltiplos cartões (Nubank, Inter, Itaú, Elo, etc.) com limites, dia de fechamento e dia de vencimento.
  - Distribuição automática das compras nas faturas corretas baseada na data de fechamento (*Smart Invoice Cycle*).
  - Acompanhamento de faturas abertas vs. previstas para o próximo mês.
  - Visualização consolidada de comprometimento dos próximos 6 meses.
  - Geração de pagamento de fatura (*"Pagar Fatura"*) com débito unificado no extrato principal.

- **Relatórios Analíticos e Exportação:**
  - Projeção de fluxo de caixa e análise histórica.
  - Exportação completa dos lançamentos em formato CSV e PDF.

- **Módulo de Combustível:**
  - Registro de abastecimentos (gasolina/etanol), cálculo de consumo médio, custo por litro e integração direta com as despesas.

- **Sincronização Local e Modo Offline:**
  - Armazenamento em banco de dados SQLite local no computador com suporte a WAL mode.
  - Sincronização via rede Wi-Fi com celulares através de QR Code escaneável.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Ícones & Gráficos:** [Lucide React](https://lucide.dev/), [Recharts](https://recharts.org/)
- **Backend / Servidor Local:** [Node.js](https://nodejs.org/) (Express + SQLite nativo via `node:sqlite`)
- **Exportação & Utilidades:** [jsPDF](https://github.com/parallax/jsPDF), [QRCode](https://github.com/soldair/node-qrcode)

---

## 📦 Instalação e Execução

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 22 ou superior recomendada para suporte ao módulo nativo `node:sqlite`).
- [Git](https://git-scm.com/).

### 1. Clonar o repositório
```bash
git clone https://github.com/tomaz-f/family-plan.git
cd family-plan
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Executar em modo de desenvolvimento
```bash
npm run dev
```

### 4. Executar em modo de produção
Para compilar e iniciar o servidor de produção local:
```bash
npm run build
npm start
```

O aplicativo estará disponível em:
- **No computador:** `http://localhost:3456`
- **No celular (mesma rede Wi-Fi):** Acesse a URL ou escaneie o QR Code exibido nas configurações do app.

---

## 🔒 Privacidade e Segurança

- Todos os dados financeiros e transações são salvos exclusivamente de forma local no seu dispositivo (`data/familyplan.db`).
- Arquivos de banco de dados (`*.db`, `*.db-wal`, `*.db-shm`) e extratos pessoais estão estritamente bloqueados e ignorados pelo `.gitignore`.
