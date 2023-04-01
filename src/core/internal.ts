import { exactly } from './inputs'
import { Join } from './types/join'
import type { InputSource, MapToCapturedGroupsArr, MapToGroups, MapToValues } from './types/sources'
import { IfUnwrapped, wrap } from './wrap'

const GROUPED_AS_REPLACE_RE = /^(?:\(\?:(.+)\)|(\(?.+\)?))$/
const GROUPED_REPLACE_RE = /^(?:\(\?:(.+)\)([?+*]|{[\d,]+})?|(.+))$/

export interface Input<
  in V extends string,
  G extends string = never,
  C extends (string | undefined)[] = []
> {
  /** this adds a new pattern to the current input */
  and: {
    <I extends InputSource[], CG extends any[] = MapToCapturedGroupsArr<I>>(...inputs: I): Input<
      `${V}${Join<MapToValues<I>, '', ''>}`,
      G | MapToGroups<I>,
      [...C, ...CG]
    >
    /** this adds a new pattern to the current input, with the pattern reference to a named group. */
    referenceTo: <N extends G>(groupName: N) => Input<`${V}\\k<${N}>`, G, C>
  }
  /** this provides an alternative to the current input */
  or: <I extends InputSource[], CG extends any[] = MapToCapturedGroupsArr<I>>(
    ...inputs: I
  ) => Input<`(?:${V}|${Join<MapToValues<I>, '', ''>})`, G | MapToGroups<I>, [...C, ...CG]>
  /** this is a positive lookbehind. Make sure to check [browser support](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#browser_compatibility) as not all browsers support lookbehinds (notably Safari) */
  after: <I extends InputSource[], CG extends any[] = MapToCapturedGroupsArr<I>>(
    ...inputs: I
  ) => Input<`(?<=${Join<MapToValues<I>, '', ''>})${V}`, G | MapToGroups<I>, [...CG, ...C]>
  /** this is a positive lookahead */
  before: <I extends InputSource[], CG extends any[] = MapToCapturedGroupsArr<I>>(
    ...inputs: I
  ) => Input<`${V}(?=${Join<MapToValues<I>, '', ''>})`, G, [...C, ...CG]>
  /** these is a negative lookbehind. Make sure to check [browser support](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#browser_compatibility) as not all browsers support lookbehinds (notably Safari) */
  notAfter: <I extends InputSource[], CG extends any[] = MapToCapturedGroupsArr<I, true>>(
    ...inputs: I
  ) => Input<`(?<!${Join<MapToValues<I>, '', ''>})${V}`, G, [...CG, ...C]>
  /** this is a negative lookahead */
  notBefore: <I extends InputSource[], CG extends any[] = MapToCapturedGroupsArr<I, true>>(
    ...inputs: I
  ) => Input<`${V}(?!${Join<MapToValues<I>, '', ''>})`, G, [...C, ...CG]>
  /** repeat the previous pattern an exact number of times */
  times: {
    <N extends number>(number: N): Input<IfUnwrapped<V, `(?:${V}){${N}}`, `${V}{${N}}`>, G, C>
    /** specify that the expression can repeat any number of times, _including none_ */
    any: () => Input<IfUnwrapped<V, `(?:${V})*`, `${V}*`>, G, C>
    /** specify that the expression must occur at least `N` times */
    atLeast: <N extends number>(
      number: N
    ) => Input<IfUnwrapped<V, `(?:${V}){${N},}`, `${V}{${N},}`>, G, C>
    /** specify that the expression must occur at most `N` times */
    atMost: <N extends number>(
      number: N
    ) => Input<IfUnwrapped<V, `(?:${V}){0,${N}}`, `${V}{0,${N}}`>, G, C>
    /** specify a range of times to repeat the previous pattern */
    between: <Min extends number, Max extends number>(
      min: Min,
      max: Max
    ) => Input<IfUnwrapped<V, `(?:${V}){${Min},${Max}}`, `${V}{${Min},${Max}}`>, G, C>
  }
  /** this defines the entire input so far as a named capture group. You will get type safety when using the resulting RegExp with `String.match()`. Alias for `groupedAs` */
  as: <K extends string>(
    key: K
  ) => Input<
    V extends `(?:${infer S})` ? `(?<${K}>${S})` : `(?<${K}>${V})`,
    G | K,
    [V extends `(?:${infer S})` ? `(?<${K}>${S})` : `(?<${K}>${V})`, ...C]
  >
  /** this defines the entire input so far as a named capture group. You will get type safety when using the resulting RegExp with `String.match()` */
  groupedAs: <K extends string>(
    key: K
  ) => Input<
    V extends `(?:${infer S})` ? `(?<${K}>${S})` : `(?<${K}>${V})`,
    G | K,
    [V extends `(?:${infer S})` ? `(?<${K}>${S})` : `(?<${K}>${V})`, ...C]
  >
  /** this capture the entire input so far as an anonymous group */
  grouped: () => Input<
    V extends `(?:${infer S})${infer E}` ? `(${S})${E}` : `(${V})`,
    G,
    [V extends `(?:${infer S})${'' | '?' | '+' | '*' | `{${string}}`}` ? `(${S})` : `(${V})`, ...C]
  >
  /** this allows you to match beginning/ends of lines with `at.lineStart()` and `at.lineEnd()` */
  at: {
    lineStart: () => Input<`^${V}`, G, C>
    lineEnd: () => Input<`${V}$`, G, C>
  }
  /** this allows you to mark the input so far as optional */
  optionally: () => Input<IfUnwrapped<V, `(?:${V})?`, `${V}?`>, G, C>
  toString: () => string
}

export const createInput = <
  Value extends string,
  Groups extends string = never,
  CaptureGroupsArr extends (string | undefined)[] = []
>(
  s: Value | Input<Value, Groups, CaptureGroupsArr>
): Input<Value, Groups, CaptureGroupsArr> => {
  const groupedAsFn = (key: string) =>
    createInput(`(?<${key}>${`${s}`.replace(GROUPED_AS_REPLACE_RE, '$1$2')})`)

  return {
    toString: () => s.toString(),
    and: Object.assign((...inputs: InputSource[]) => createInput(`${s}${exactly(...inputs)}`), {
      referenceTo: (groupName: string) => createInput(`${s}\\k<${groupName}>`),
    }),
    or: (...inputs) => createInput(`(?:${s}|${exactly(...inputs)})`),
    after: (...input) => createInput(`(?<=${exactly(...input)})${s}`),
    before: (...input) => createInput(`${s}(?=${exactly(...input)})`),
    notAfter: (...input) => createInput(`(?<!${exactly(...input)})${s}`),
    notBefore: (...input) => createInput(`${s}(?!${exactly(...input)})`),
    times: Object.assign((number: number) => createInput(`${wrap(s)}{${number}}`), {
      any: () => createInput(`${wrap(s)}*`),
      atLeast: (min: number) => createInput(`${wrap(s)}{${min},}`),
      atMost: (max: number) => createInput(`${wrap(s)}{0,${max}}`),
      between: (min: number, max: number) => createInput(`${wrap(s)}{${min},${max}}`),
    }),
    optionally: () => createInput(`${wrap(s)}?`),
    as: groupedAsFn,
    groupedAs: groupedAsFn,
    grouped: () => createInput(`${s}`.replace(GROUPED_REPLACE_RE, '($1$3)$2')),
    at: {
      lineStart: () => createInput(`^${s}`),
      lineEnd: () => createInput(`${s}$`),
    },
  }
}
