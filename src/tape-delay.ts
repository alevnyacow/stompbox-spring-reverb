import type { Entries, TapeDelay, EntryType } from '@stompbox/tape-delay'
import { springReverbWithCtx } from './handler'

function uncapitalize<T extends string>(str: T): Uncapitalize<T> {
    if (!str) return str as Uncapitalize<T>;
    return (str.charAt(0).toLowerCase() + str.slice(1)) as Uncapitalize<T>;
}

export const tapeDelayContext = <T extends Entries>(container: TapeDelay<T>) => {
    return <K extends (keyof T)[]>(...instances: K) => {
        type TapeDelayCtx = {
            [key in K[number] as Uncapitalize<key & string>]: EntryType<T[key]>
        }
        
        const getCtx = () => {
            // @ts-ignore
            let result: TapeDelayCtx = {}
            for (const instanceKey of instances) {
                const instance = container.instance(instanceKey)
                // @ts-ignore
                result[uncapitalize(instanceKey as any as string)] = instance
            }
            return result
        }

        return springReverbWithCtx(getCtx)
    }
}