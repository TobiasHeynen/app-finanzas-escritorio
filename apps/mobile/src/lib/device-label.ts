import { Platform } from 'react-native'

/** Cómo se nombra el dispositivo en los textos: la versión web es la del iPhone. */
export const IS_IPHONE_WEB = Platform.OS === 'web'
export const DEVICE = IS_IPHONE_WEB ? 'iPhone' : 'celu'
