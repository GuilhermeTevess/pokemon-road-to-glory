// Conquistas: objetivos permanentes do treinador (não dão bônus, só a medalha).
import {getBiome} from '../data/biomes';
import {LEGENDS} from '../data/legends';
import {REGIONS} from '../data/regions';
import {careerOf, statsOf} from './meta';
import type {Collection} from './meta';
import type {RunState} from './types';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  check: (col: Collection, run: RunState | null) => boolean;
}

const titles = (col: Collection, kind: 'cup' | 'regional' | 'international' | 'worlds') => (careerOf(col).titles[kind] ?? 0) > 0;
const caught = (col: Collection) => Object.values(col.entries).filter(e => e.caught > 0).length;

export const ACHIEVEMENTS: Achievement[] = [
  {id: 'first-win', name: 'Primeiro passo', desc: 'Vencer uma batalha.', icon: 'star', check: col => statsOf(col).defeated >= 1},
  {id: 'catch-10', name: 'Colecionador', desc: 'Ter 10 linhas de Pokémon na coleção.', icon: 'star', check: col => caught(col) >= 10},
  {id: 'catch-50', name: 'Pokédex ambulante', desc: 'Ter 50 linhas de Pokémon na coleção.', icon: 'star', check: col => caught(col) >= 50},
  {id: 'shiny', name: 'Brilho raro', desc: 'Ter um Pokémon shiny.', icon: 'star', check: col => Object.values(col.entries).some(e => e.shiny)},
  {id: 'wave-30', name: 'Pegando o ritmo', desc: 'Chegar à ronda 30.', icon: 'map', check: col => statsOf(col).bestWave >= 30},
  {id: 'wave-60', name: 'Meio caminho', desc: 'Chegar à ronda 60.', icon: 'map', check: col => statsOf(col).bestWave >= 60},
  {id: 'season', name: 'Temporada completa', desc: 'Chegar ao fim das 120 rondas.', icon: 'trophy', check: col => statsOf(col).stageClears >= 1},
  {id: 'cup', name: 'Campeão de League Cup', desc: 'Vencer uma League Cup.', icon: 'trophy', check: col => titles(col, 'cup')},
  {id: 'regional', name: 'Campeão Regional', desc: 'Vencer um Regional Championship.', icon: 'trophy', check: col => titles(col, 'regional')},
  {id: 'international', name: 'Campeão Internacional', desc: 'Vencer um International Championship.', icon: 'trophy', check: col => titles(col, 'international')},
  {id: 'worlds', name: 'Campeão Mundial', desc: 'Vencer o World Championship.', icon: 'trophy', check: col => titles(col, 'worlds')},
  {id: 'star', name: 'Estrela', desc: 'Chegar a 1200 de fama.', icon: 'star', check: col => careerOf(col).fame >= 1200},
  {id: 'rich', name: 'Bolso cheio', desc: 'Ganhar ₽ 100.000 somando todas as runs.', icon: 'star', check: col => statsOf(col).moneyEarned >= 100000},
  {id: 'traveler', name: 'Bom samaritano', desc: 'Ajudar um viajante e ganhar uma dica.', icon: 'map', check: (_c, run) => (run?.diary?.length ?? 0) + (run?.found?.length ?? 0) > 0},
  {id: 'hint', name: 'Seguindo pistas', desc: 'Encontrar um lendário pela dica de um viajante.', icon: 'map', check: (_c, run) => (run?.found?.length ?? 0) > 0},
  {id: 'hidden', name: 'Lugar secreto', desc: 'Entrar num bioma oculto.', icon: 'map', check: (_c, run) => !!run && !!getBiome(run.biome).region},
  {id: 'badge', name: 'Primeira insígnia', desc: 'Ganhar uma insígnia de ginásio.', icon: 'trophy', check: (_c, run) => (run?.badges?.length ?? 0) > 0},
  ...REGIONS.map(r => ({
    id: `book-${r.id}`,
    name: r.id === 'alola' ? 'Provas de Alola' : `Caderneta de ${r.name}`,
    desc: r.id === 'alola' ? 'Completar as 7 provas de Alola.' : `Ganhar as 8 insígnias de ${r.name}.`,
    icon: 'trophy',
    check: (col: Collection) => (col.badgeBooks?.[r.id] ?? 0) > 0,
  })),
  ...LEGENDS.map(l => ({
    id: `legend-${l.id}`,
    name: `Vencer ${l.name}`,
    desc: `Vencer ${l.name}, lenda de ${REGIONS.find(r => r.id === l.region)?.name}.`,
    icon: 'star',
    check: (col: Collection) => (col.legends?.[l.id] ?? 0) > 0,
  })),
  {id: 'all-legends', name: 'Lenda das lendas', desc: 'Vencer todos os treinadores lendários.', icon: 'trophy', check: col => LEGENDS.every(l => (col.legends?.[l.id] ?? 0) > 0)},
];

/** Marca as conquistas novas e devolve os nomes delas (para avisar o jogador). */
export function checkAchievements(col: Collection, run: RunState | null): string[] {
  const done = (col.achievements ??= {});
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (done[a.id] || !a.check(col, run)) continue;
    done[a.id] = Date.now();
    fresh.push(a.name);
  }
  return fresh;
}
