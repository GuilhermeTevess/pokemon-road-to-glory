import {ITEMS, itemUsage} from '../../data/items';
import type {ItemKind} from '../../data/items';
import {ItemIcon, Modal} from '../components';

const GROUPS: {title: string; kinds: ItemKind[]; text: string}[] = [
  {title: 'Pokébolas', kinds: ['ball'], text: 'Use na batalha, pelo botão Pokébola. A chance aumenta com o HP baixo do selvagem e com status (sono, paralisia...).'},
  {title: 'Cura', kinds: ['heal', 'revive'], text: 'Poções funcionam na batalha (gastam o turno) ou entre batalhas. Reviver só fora da batalha.'},
  {title: 'Treino', kinds: ['candy', 'evolution', 'tm'], text: 'Use entre batalhas em "Time e mochila", escolhendo o Pokémon.'},
  {title: 'EVs', kinds: ['vitamin'], text: 'Vitaminas dão EVs na hora, no Pokémon e na ficha da linha. Os itens Power (de segurar) dão EVs a cada vitória. Distribua o banco de EVs na ficha da coleção.'},
  {title: 'Itens de segurar', kinds: ['held'], text: 'Equipe num Pokémon em "Time e mochila". Eles funcionam sozinhos na batalha, como no Showdown.'},
  {title: 'Viagem', kinds: ['map', 'incense'], text: 'Use entre batalhas. O Mapa libera troca de bioma; o Incenso deixa os raros mais comuns.'},
];

export function HelpModal({onClose}: {onClose: () => void}) {
  return (
    <Modal onClose={onClose} wide>
      <h2>Como jogar</h2>
      <ol className="help-steps">
        <li>Monte seu time inicial e escolha um bioma. Cada ronda é uma batalha contra um Pokémon selvagem.</li>
        <li>Vença para ganhar XP e dinheiro, ou capture com Pokébolas (até 6 no time; o resto vai para o PC).</li>
        <li>Depois de cada ronda, escolha 1 de 3 itens. Dá para sortear de novo ou comprar na Loja.</li>
        <li>A cada 5 rondas você pode trocar de bioma. A cada 10, o time é curado. Chefes nas rondas 10 e 20, lendário na 30.</li>
        <li>Toque no cartão do selvagem para ver as fraquezas. Cada golpe mostra se é super efetivo e o que faz.</li>
        <li>O painel ao lado mostra seu time, a Mochila, o PC e as fraquezas do time. Toque num Pokémon para ver detalhes.</li>
        <li>Cada treinador tem sua coleção. Monte o time inicial com 6 pontos: cada Pokémon tem um custo (o número no canto). Tudo que você capturar vira opção.</li>
        <li>Cada linha evolutiva ganha doces (capturar, vencer, evoluir) e corações de amizade (lutar no time). Na ficha da coleção, gaste doces em golpe inicial, custo menor e chance de shiny.</li>
        <li>Corações dão mais EXP. Escolha um parceiro por time (o coração na montagem): ele ganha corações em dobro e, com eles, pode curar status sozinho, aguentar com 1 HP e acertar mais críticos.</li>
        <li>Na ficha também tem o Tutor (natures e habilidades) e os EVs: vitórias enchem um banco que você distribui.</li>
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
