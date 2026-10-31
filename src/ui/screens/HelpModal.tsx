import {ITEMS, itemUsage} from '../../data/items';
import type {ItemKind} from '../../data/items';
import {ItemIcon, Modal} from '../components';

const GROUPS: {title: string; kinds: ItemKind[]; text: string}[] = [
  {title: 'Pokébolas', kinds: ['ball'], text: 'Use na batalha, pelo botão Pokébola. A chance aumenta com o HP baixo do selvagem e com status (sono, paralisia...).'},
  {title: 'Cura', kinds: ['heal', 'revive'], text: 'Poções funcionam na batalha (gastam o turno) ou entre batalhas. Reviver só fora da batalha.'},
  {title: 'Treino', kinds: ['candy', 'evolution', 'tm'], text: 'Use entre batalhas em "Time e mochila", escolhendo o Pokémon.'},
  {title: 'EVs', kinds: ['vitamin'], text: 'Vitaminas dão EVs na hora, no Pokémon e na ficha da linha. Os itens Power (de segurar) dão EVs a cada vitória. Distribua o banco de EVs na ficha da coleção.'},
  {title: 'Itens de segurar', kinds: ['held'], text: 'Equipe num Pokémon em "Time e mochila". Eles funcionam sozinhos na batalha, como no Showdown.'},
  {title: 'Viagem', kinds: ['map', 'incense'], text: 'Use entre batalhas. Você fica 10 rondas em cada bioma e 20 em cada região; depois o próximo é sorteado. Os Mapas deixam você escolher, os Passes dobram a estadia, e o Incenso deixa os raros mais comuns.'},
];

export function HelpModal({onClose}: {onClose: () => void}) {
  return (
    <Modal onClose={onClose} wide>
      <h2>Como jogar</h2>
      <ol className="help-steps">
        <li>Monte seu time inicial e escolha um bioma. Cada ronda é uma batalha contra um Pokémon selvagem.</li>
        <li>Vença para ganhar XP e dinheiro, ou capture com Pokébolas (até 6 no time; o resto vai para o PC).</li>
        <li>Depois de cada ronda, escolha 1 de 3 itens. Dá para sortear de novo ou comprar na Loja.</li>
        <li>Você fica 20 rondas em cada região e 10 em cada bioma; depois o próximo é sorteado. A cada 10 rondas o time é curado e aparece um chefe da região. Torneios nas rondas 30, 60, 90 e 120.</li>
        <li>O Rastro da lenda (no painel) sobe vencendo chefes e ajudando nos eventos. Quanto maior, mais chance de uma lenda da região te desafiar. Perder para ela não acaba a run.</li>
        <li>Viajantes pedem ajuda nos eventos. Ajudar dá uma dica sobre um lendário no Diário (no painel), com a região e o bioma onde procurar. Alguns ficam em biomas ocultos, que quase nunca aparecem sem a dica.</li>
        <li>Ginásios: no botão Ginásios do painel, compre o ingresso e escolha a ronda da luta. Junte as insígnias da região para completar a caderneta.</li>
        <li>Às vezes dois selvagens aparecem juntos (dupla): escolha o golpe de cada um dos seus dois Pokémon em campo. Para capturar, derrote um e jogue a Pokébola no outro.</li>
        <li>Toque no cartão do selvagem para ver as fraquezas. Cada golpe mostra se é super efetivo e o que faz.</li>
        <li>O painel ao lado mostra seu time, a Mochila, o PC e as fraquezas do time. Toque num Pokémon para ver detalhes.</li>
        <li>Quer saber quem aparece em cada bioma? Abra o Guia no menu de cima: ele mostra a chance de cada Pokémon por bioma, região e ronda.</li>
        <li>Antes de um torneio, “Estudar no PC” mostra só o que é público do adversário: as últimas lutas dele no noticiário (2 destaques por luta) e os Pokémon que você mesmo já enfrentou.</li>
        <li>Cada treinador tem sua coleção. Monte o time inicial com 6 pontos: cada Pokémon tem um custo (o número no canto). Tudo que você capturar vira opção.</li>
        <li>Cada linha evolutiva ganha doces (capturar, vencer, evoluir) e corações de amizade (lutar no time). Na ficha da coleção, gaste doces em golpe inicial, custo menor e chance de shiny.</li>
        <li>Corações dão mais EXP. Escolha um parceiro por time (o coração na montagem): ele ganha corações em dobro e, com eles, pode curar status sozinho, aguentar com 1 HP e acertar mais críticos.</li>
        <li>De vez em quando aparece um evento entre as rondas (casa abandonada, rival, vidente...). Ele não gasta ronda.</li>
        <li>Na Creche (menu inicial) dois Pokémon da coleção fazem ovos. Leve um ovo na run: ele choca depois de algumas rondas vencidas. O Manual do Criador explica tudo.</li>
        <li>Toda run dá Glória quando acaba. No menu Glória você compra melhorias para todas as próximas runs (mais pontos de time, mais raros, mais biomas...).</li>
        <li>Na ficha também tem o Tutor (natures e habilidades) e os EVs: vitórias enchem um banco que você distribui.</li>
        <li>A temporada tem 120 rondas. Nas rondas 30, 60, 90 e 120 tem torneio (League Cup, Regional, Internacional e Mundial): 8 treinadores, mata-mata, time curado antes de cada luta. Perder tira você do torneio, mas a run continua.</li>
        <li>Torneios dão Glória, dinheiro, Championship Points (CP), fama e títulos. No menu Torneios você vê as chaves antigas, os times de cada um e como cada partida aconteceu.</li>
      </ol>
      <h3>Itens</h3>
      <div className="help-items">
        {GROUPS.map(g => (
          <div key={g.title} className="help-group panel">
            <strong>{g.title}</strong>
            <p className="hint">{g.text}</p>
            <div className="help-icons">
              {ITEMS.filter(i => g.kinds.includes(i.kind)).map(i => (
                <span key={i.id} className="help-item" title={`${i.desc} ${itemUsage(i)}`}>
                  <ItemIcon id={i.id} size={24} /> {i.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
