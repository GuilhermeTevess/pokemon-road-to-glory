import {ITEMS, itemUsage} from '../../data/items';
import type {ItemKind} from '../../data/items';
import {ItemIcon, Modal} from '../components';

const GROUPS: {title: string; kinds: ItemKind[]; text: string}[] = [
  {title: 'Pokébolas', kinds: ['ball'], text: 'Use na batalha, pelo botão Pokébola. A chance aumenta com o HP baixo do selvagem e com status (sono, paralisia...).'},
  {title: 'Cura', kinds: ['heal', 'revive'], text: 'Poções funcionam na batalha (gastam o turno) ou entre batalhas. Reviver só fora da batalha.'},
  {title: 'Treino', kinds: ['candy', 'evolution', 'tm'], text: 'Use entre batalhas em "Time e mochila", escolhendo o Pokémon.'},
  {title: 'Itens de segurar', kinds: ['held'], text: 'Equipe num Pokémon em "Time e mochila". Eles funcionam sozinhos na batalha, como no Showdown.'},
  {title: 'Viagem', kinds: ['map', 'incense'], text: 'Use entre batalhas. O Mapa libera troca de bioma; o Incenso deixa os raros mais comuns.'},
];

export function HelpModal({onClose}: {onClose: () => void}) {
  return (
    <Modal onClose={onClose} wide>
      <h2>Como jogar</h2>
      <ol className="help-steps">
        <li>Escolha um inicial e um bioma. Cada ronda é uma batalha contra um Pokémon selvagem.</li>
        <li>Vença para ganhar XP e dinheiro, ou capture com Pokébolas (até 6 no time; o resto vai para a Caixa).</li>
        <li>Depois de cada ronda, escolha 1 de 3 itens. Dá para sortear de novo ou comprar na Loja.</li>
        <li>A cada 5 rondas você pode trocar de bioma. A cada 10, o time é curado. Chefes nas rondas 10 e 20, lendário na 30.</li>
        <li>Toque no cartão do selvagem para ver as fraquezas. Cada golpe mostra se é super efetivo.</li>
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
