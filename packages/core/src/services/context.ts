import type { SqlDb as Db } from '../db/sql'
import type { Repos } from '../repositories'
import { monthOf, todayIso, type IsoDate, type Month } from '@shared/months'

export interface Clock {
  today(): IsoDate
}

export const systemClock: Clock = { today: () => todayIso() }

/** `D` deja que cada app conserve el tipo concreto de su base (better-sqlite3, expo-sqlite). */
export interface ServiceContext<D extends Db = Db> {
  db: D
  repos: Repos
  clock: Clock
}

export const currentMonthOf = (clock: Clock): Month => monthOf(clock.today())
