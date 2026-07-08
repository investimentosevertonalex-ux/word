# Word (app para Android) — como instalar

Este é um app web instalável (PWA): você coloca os arquivos num link grátis (uma vez) e
depois instala no Android em 2 toques. Não precisa de PC, APK nem liberar "fontes desconhecidas".

## Parte 1 — Colocar o app num link (uma vez)

O app precisa ficar num endereço https. Escolha UMA opção:

### Opção A — Netlify Drop (arrastar e soltar, mais simples)
1. No computador, entre em https://app.netlify.com/drop
2. Arraste a pasta `word-app` inteira para a página (pode pedir um login grátis com e-mail/Google).
3. Em segundos aparece um link tipo `https://algo-aleatorio.netlify.app`. Esse é o seu app.

### Opção B — tiiny.host
1. Entre em https://tiiny.host
2. Envie o `word-app.zip` (ou a pasta). Ele te dá um link https na hora.

### Opção C — GitHub Pages (se você já usa GitHub)
1. Crie um repositório, suba os arquivos da pasta `word-app` (o `index.html` na raiz).
2. Em Settings › Pages, publique a branch. O link será `https://SEU-USUARIO.github.io/REPO/`.

> Importante: mantenha a estrutura (o `index.html` na raiz e a pasta `icons` junto).
> Os arquivos NÃO contêm sua chave da API — ela só é digitada no app e fica guardada no seu celular.

## Parte 2 — Instalar no Android

1. Abra o link (do passo anterior) no **Chrome do Android**.
2. Toque no menu **⋮** › **Adicionar à tela inicial** (ou **Instalar app**). Às vezes aparece um aviso "Instalar" automático.
3. Confirme. O ícone do **Word** aparece na tela inicial e abre em tela cheia, como um app.

(No iPhone é parecido: abra no **Safari** › botão Compartilhar › **Adicionar à Tela de Início**.)

## Parte 3 — Configurar (primeira vez)

1. Abra o app e toque na engrenagem ⚙ (canto superior direito).
2. Cole sua **chave da API do OpenRouter** (openrouter.ai › Keys).
3. Escolha o **modelo** e, se quiser, a instrução de sistema, temperatura e esforço de raciocínio.
4. Salve. Pronto — é só escrever na caixa e tocar no aviãozinho (ou Enter) para enviar.

## Funciona igual ao de computador
- Mesma cara de Word (barra azul, faixa de opções, folha branca, barra de status).
- Chat com streaming, texto corrido na folha.
- Anexar imagem, PDF e arquivo de texto (toque no clipe) — e colar imagem.
- Configurações: chave, modelo, instrução de sistema, temperatura e esforço de raciocínio.

## Observações
- Precisa de internet para conversar (as respostas vêm do OpenRouter).
- A chave fica salva só no seu aparelho (armazenamento local do navegador).
- Imagens exigem um modelo com visão (ex.: claude-sonnet, gpt, gemini). PDF funciona em qualquer modelo (pode ter custo de OCR em modelos sem suporte nativo).
