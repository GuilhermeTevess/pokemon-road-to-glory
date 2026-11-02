# Segurança do online (Firebase)

## O que mudou

1. **Login anônimo automático.** Ninguém digita nada nem cria conta. Quando o jogo abre, o navegador ganha uma identidade secreta do Firebase e manda junto em tudo que grava. Ela fica guardada no navegador, junto com o save.
2. **Regras do banco** (`firestore.rules`). O banco só aceita quem tem essa identidade e:
   - cada documento lembra quem criou (`owner`); só o dono muda ou apaga (seu jogador, seu time compartilhado, sua sala, suas mensagens);
   - chave de torneio, mundo dos bots e vaga na sala não mudam depois de criados;
   - ninguém consegue se passar por outro dono, criar pastas novas, gravar campos extras ou documentos gigantes (máx. ~600 KB);
   - qualquer outra parte do banco fica fechada.
3. **O jogo confere os outros jogadores.** Um jogador com time impossível (7 Pokémon, nível 999, IV 50, 5 golpes, pontos infinitos) fica de fora do ranking e dos torneios.

## Passo a passo no Firebase (uns 5 minutos)

> Siga **nesta ordem**. Se colar as regras antes do passo 2, o online para até o site atualizar.

### 1. Ligar o login anônimo
1. Entre em <https://console.firebase.google.com> e abra o projeto **pokemon-road-to-glory**.
2. No menu da esquerda: **Criação** (Build) → **Authentication**.
3. Se aparecer, clique em **Vamos começar** (Get started).
4. Aba **Método de login** (Sign-in method) → **Anônimo** (Anonymous) → ligue **Ativar** → **Salvar**.

### 2. Juntar o PR
Aprove e junte o PR. Espere uns 2 minutos o site atualizar e abra o jogo uma vez (recarregue a página).

### 3. Colar as regras
1. No menu da esquerda: **Criação** → **Firestore Database** → aba **Regras** (Rules).
2. Apague tudo que estiver lá.
3. Copie todo o arquivo [`firestore.rules`](../firestore.rules) do GitHub (botão "Copy raw file") e cole.
4. Clique em **Publicar** (Publish).

Pronto. Peça para os amigos **recarregarem a página** (quem estava com o jogo aberto antes ainda usa a versão antiga).

### Se der errado
Na mesma aba **Regras** tem o histórico à esquerda: clique na versão anterior e em **Restaurar**. O online volta como era antes.

Se o login anônimo falhar, confira em <https://console.cloud.google.com/apis/credentials> (projeto pokemon-road-to-glory) se a chave "Browser key" tem restrição de API; se tiver, adicione **Identity Toolkit API** e **Token Service API** na lista.

## O que ainda dá para fazer (sem enrolação)

O jogo roda inteiro no navegador de cada um. Então quem programa sempre consegue mexer **nas próprias coisas**:

- **O próprio save** (fica no navegador): dá para se dar níveis, itens, dinheiro. Isso vale para o modo offline e para o que a pessoa manda para o online, desde que pareça "possível" (ex.: um time inteiro nível 100 cedo demais passa nas conferências).
- **Os próprios pontos e resultados** no ranking da carreira, dentro de valores possíveis.
- **Lutas ao vivo**: cada aparelho calcula a batalha e manda as escolhas; um navegador modificado pode mandar dados falsos para o próprio lado.

O que **não** dá mais: mexer no jogador, no time, nas salas ou nas mensagens **dos outros**, apagar coisas dos outros, mudar a chave do torneio depois de criada, ou encher o banco de lixo.

Deixar 100% à prova de trapaça precisaria de um servidor calculando todas as batalhas (como o Showdown tem). Dá para fazer no futuro (Firebase Functions, plano pago), mas é um projeto grande. Para um grupo de amigos, a regra de ouro é: se alguém aparecer com algo absurdo, dá para ver no perfil dele (histórico, times usados).

### Por que não ligamos o App Check
O App Check confere se o pedido veio do site de verdade. Mas quem trapaceia vai usar o site de verdade (abrindo o console do navegador), então ele quase não ajuda aqui e daria mais trabalho de configurar. Fica como opção para depois.

### E se alguém tentar gastar o banco?
Se o projeto estiver no plano gratuito (Spark), o Firebase **não cobra**: se passar do limite do dia, o online só para até o dia seguinte. Não ative o plano pago sem colocar um alerta de orçamento.
