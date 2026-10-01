import type { Db } from '../db/connection'
import type { Repos } from '../repositories'
import { monthOf, todayIso, type IsoDate, type Month } from '@shared/months'

export interface Clock {
  today(): IsoDate
}

export const systemClock: Clock = { today: () => todayIso() }

export interface ServiceContext {
  db: Db
  repos: Repos
  clock: Clock
}

export const currentMonthOf = (clock: Clock): Month => monthOf(clock.today())
