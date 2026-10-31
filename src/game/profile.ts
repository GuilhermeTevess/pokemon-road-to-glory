// Perfil de qualquer treinador (você, um amigo da carreira ou um rival do mundo):
// insígnias e como ganhou, lendas, parceiro, favorito e estatísticas. Sem golpes nem IVs.
import {getLegend} from '../data/legends';
import type {CareerFight, PlayerDoc} from './career';
import {legendsBeaten, seasonPoints} from './league';
import type {RunState} from './types';
import {favoriteOf} from './world';
import type {WorldBot} from './world';

export interface Profile {
  name: string;
  avatar: string;
  kind: 'me' | 'player' | 'bot';
  region?: string;
  partner?: string;
  favorite?: string;
  points: number;
  banked: number;
  log: {label: string; pts: number; wave?: number}[];
  badges: {gym: string; wave: number; team: string[]; tries: number}[];
  legends: string[];
  usage: Record<string, number>;
  fights: CareerFight[];
}

export function profileOfBot(b: WorldBot): Profile {
  return {
    name: b.name, avatar: b.avatar, kind: 'bot', region: b.region, partner: b.partner, favorite: favoriteOf(b.usage),
    points: b.points, banked: b.banked, log: [...b.log].reverse(), badges: b.badges, legends: b.legends.map(id => getLegend(id)?.name ?? id), usage: b.usage, fights: b.fights,
  };
}

export function profileOfPeer(p: PlayerDoc): Profile {
  return {
    name: p.name, avatar: p.avatar, kind: 'player', partner: p.partner, favorite: favoriteOf(p.usage),
    points: p.points, banked: p.banked, log: p.log ?? [], badges: p.badges ?? [], legends: p.legends ?? [], usage: p.usage ?? {}, fights: p.fights ?? [],
  };
}

export function profileOfRun(run: RunState, me: {name: string; avatar?: string}): Profile {
  return {
    name: me.name, avatar: me.avatar ?? 'red', kind: 'me', region: run.region,
    partner: run.party.find(m => m.partner)?.species, favorite: favoriteOf(run.usage ?? run.career?.usage) ?? run.party[0]?.species,
    points: seasonPoints(run), banked: 0, log: [...(run.pointLog ?? [])].reverse(),
    badges: (run.badges ?? []).map(id => ({gym: id, ...(run.badgeInfo?.[id] ?? {wave: 0, team: [], tries: 1})})),
    legends: legendsBeaten(run), usage: run.usage ?? run.career?.usage ?? {}, fights: run.fights ?? run.career?.fights ?? [],
  };
}
