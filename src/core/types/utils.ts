import { ExactEscapeChar } from './escape'

type StrictExclude<T, U> = T extends U ? (U extends T ? never : T) : T

type UnionToTuple<Union extends string | number, Acc extends any[] = []> = ((
  k: () => Union
) => any) extends (k: infer Fn) => any
  ? Fn extends () => infer Current
    ? StrictExclude<Union, Current> extends never
      ? [...Acc, Current]
      : UnionToTuple<StrictExclude<Union, Current>, [...Acc, Current]>
    : never
  : never

type ContainStringInLiteral<S extends string | number> = S extends ''
  ? false
  : S extends `${infer First}${infer Rest}`
  ? string extends First
    ? true
    : `${number}` extends First
    ? true
    : ContainStringInLiteral<Rest>
  : true

type ConcateUnionOfLiteralString<
  Union extends string | number,
  Prefix extends string = '',
  Suffix extends string = '',
  LiteralPrefix extends string = Prefix extends Prefix
    ? ContainStringInLiteral<Prefix> extends true
      ? never
      : Prefix
    : never,
  LiteralSuffix extends string = Suffix extends Suffix
    ? ContainStringInLiteral<Suffix> extends true
      ? never
      : Suffix
    : never,
  Tuple extends any[] = UnionToTuple<Union>
> = {
  [K in keyof Tuple]: Tuple[K] extends infer Value extends string | number
    ? Value extends Value
      ? ContainStringInLiteral<Value> extends true
        ? `${Prefix}${Value}${Suffix}` & {}
        :
            | `${LiteralPrefix}${Value}${LiteralSuffix}`
            | ([Prefix, Suffix] extends [LiteralPrefix, LiteralSuffix]
                ? never
                : `${Prefix}${Value}${Suffix}` & {})
      : never
    : never
}[number]

type RemoveObjIntersect<S> = S extends {} & infer L ? L : never

type StringToUnion<
  S extends string,
  Original extends string,
  Result extends string | undefined = undefined,
  Count extends any[] = []
> = Count['length'] extends 8
  ? Original
  : S extends `${ReplaceString<
      StrictExclude<ShorthandMap[keyof ShorthandMap], string | number>,
      '\\',
      ''
    >}${infer Rest}`
  ? S extends `${infer SpecialChar}${Rest}`
    ? StringToUnion<Rest, Original, Result | SpecialChar, [...Count, '']>
    : never
  : S extends ''
  ? Exclude<Result, undefined>
  : RemoveObjIntersect<S> extends `${infer First}${infer Rest}`
  ? StringToUnion<
      Rest,
      Original,
      Result | (string extends First ? First & {} : First),
      [...Count, '']
    >
  : S

type EscapeToken = '$^'
type CharSetToken = '$^]'
type DefaultEscapedChars = ['(', ')', '{', '}']

type ShorthandMap = {
  s: ' '
  t: '\t'
  n: `\n`
  r: `\r`
  k: `${EscapeToken}k`
  w: '\\(any wordChar\\)' | (string & {})
  d: '\\(any digit\\)' | number
  b: '' //TODO '\\(word boundary\\)' ?
}

type ExtractNonCapOrGroupInner<S extends string> = S extends
  | `?:${infer Inner}`
  | `?<${string}>${infer Inner}`
  ? Inner
  : S

type EmumerateRepeat<
  S extends string,
  Repeat extends string,
  Result extends string = S,
  Current extends any[] = ['']
> = Repeat extends `${infer From},${infer To}`
  ?
      | `${EmumerateRepeat<S, From>}${string & {}}`
      | `${EscapeToken}${IndexOf<DefaultEscapedChars, '('>}[${S}] repeat ${To extends ''
          ? `${From} or more`
          : `${From} to ${To}`} times${EscapeToken}${IndexOf<DefaultEscapedChars, ')'>}`
  : `${Current['length']}` extends Repeat
  ? Result
  : EmumerateRepeat<S, Repeat, `${Result}${S}`, [...Current, '']>

type LastCharOf<S extends string> = S extends `${infer First}${infer Rest}`
  ? Rest extends ''
    ? First
    : LastCharOf<Rest>
  : S

type IndexOf<
  Arr extends string[],
  Item extends Arr[number],
  Index extends any[] = []
> = Item extends Arr[Index['length']]
  ? Index['length']
  : Index['length'] extends Arr['length']
  ? -1
  : IndexOf<Arr, Item, [...Index, '']>

type ReplaceString<
  S extends string,
  Target extends string,
  Replace extends string
> = S extends `${infer Before}${Target}${infer Rest}`
  ? ReplaceString<`${Before}${Replace}${Rest}`, Target, Replace>
  : S

type ResolveBackReference<
  Inner extends string,
  ResolvedInner extends string,
  Rest extends string,
  Token extends string = EscapeToken
> = Inner extends `?<${infer GroupName}>${string}`
  ? ReplaceString<Rest, `(?:${Token}k)<${GroupName}>`, ResolvedInner>
  : Rest

type HasBackReference<
  Inner extends string,
  Rest extends string,
  Token extends string = EscapeToken
> = Inner extends `?<${infer GroupName}>${string}`
  ? Rest extends `${string}(${Token}k)<${GroupName}>${string}`
    ? true
    : false
  : false

/**
 * main types
 */

type RestoreStringFromToken<
  S extends string,
  Token extends string,
  TokenizedStrings extends string[],
  CurrentChar extends string = TokenizedStrings extends [...any[], infer Last] ? Last : '',
  Index extends number = TokenizedStrings extends [...infer Remain, any] ? Remain['length'] : 0,
  CharSetDesc extends string = `(any char in [${CurrentChar}])`,
  ResolveCharSet extends string = StringToUnion<CurrentChar, CharSetDesc>
> = S extends S
  ? RemoveObjIntersect<S> extends `${infer ResultBefore}${Token}${Index}${infer ResultAfter}`
    ? Token extends CharSetToken
      ? CurrentChar extends `^${infer NegateCharSet}`
        ? RestoreStringFromToken<
            ConcateUnionOfLiteralString<
              `(any char NOT in [${NegateCharSet}])` | (string & {}),
              ResultBefore,
              ResultAfter
            >,
            Token,
            TokenizedStrings extends [...infer Remain, any] ? [...Remain, CurrentChar] : []
          >
        : `${ResultBefore}${ResultAfter}` extends `${string}[]${string}` //? eg: when matching `(any char in [..charset..])`
        ? RestoreStringFromToken<
            ConcateUnionOfLiteralString<CharSetDesc, ResultBefore, ResultAfter>,
            Token,
            TokenizedStrings extends [...infer Remain, any] ? [...Remain, CurrentChar] : []
          >
        : ResolveCharSet extends infer ResolveCharSetString extends string
        ? RestoreStringFromToken<
            ConcateUnionOfLiteralString<ResolveCharSetString, ResultBefore, ResultAfter>,
            Token,
            TokenizedStrings extends [...infer Remain, any] ? [...Remain, ResolveCharSetString] : []
          >
        : never
      : RestoreStringFromToken<
          ConcateUnionOfLiteralString<CurrentChar, ResultBefore, ResultAfter>,
          Token,
          TokenizedStrings
        >
    : Index extends 0
    ? S
    : RestoreStringFromToken<
        S,
        Token,
        TokenizedStrings extends [...infer Remain, any] ? Remain : []
      >
  : never

//? keeping for future reference
// type ResolveSequenceNumber<S extends string> =
//   S extends `${infer First}${infer Second}${infer Rest}`
//     ? First extends `${number}`
//       ? `${number}` extends First
//         ? never
//         : First
//       : `${First}${Second}` extends '\\d'
//       ? ResolveSequenceNumber<Rest>
//       : never
//     : never

type TokenizeEscapeChars<
  S extends string,
  EscapedChars extends any[] = [...DefaultEscapedChars],
  ResovlingCharSets extends boolean = false,
  WrapPrefix extends string = ResovlingCharSets extends true ? '' : '(?:',
  WrapSuffix extends string = ResovlingCharSets extends true ? '' : ')'
> = S extends S
  ? RemoveObjIntersect<S> extends `${infer Before}\\${infer After}`
    ? After extends `${infer EscapeChar}${infer Rest}`
      ? EscapeChar extends EscapedChars[number]
        ? TokenizeEscapeChars<
            ConcateUnionOfLiteralString<
              `${EscapeToken}${IndexOf<EscapedChars, EscapeChar>}`,
              `${Before}${WrapPrefix}`,
              `${WrapSuffix}${Rest}`
            >,
            EscapedChars,
            ResovlingCharSets
          >
        : EscapeChar extends ExactEscapeChar
        ? TokenizeEscapeChars<
            ConcateUnionOfLiteralString<
              `${EscapeToken}${EscapedChars['length']}`,
              `${Before}${WrapPrefix}`,
              `${WrapSuffix}${Rest}`
            >,
            [...EscapedChars, EscapeChar],
            ResovlingCharSets
          >
        : EscapeChar extends keyof ShorthandMap
        ? TokenizeEscapeChars<
            ConcateUnionOfLiteralString<
              ShorthandMap[EscapeChar],
              // | (EscapeChar extends 'd' ? ResolveSequenceNumber<Rest> : never),//? might cause having too many union types
              `${Before}${WrapPrefix}`,
              `${WrapSuffix}${Rest}`
            >,
            EscapedChars,
            ResovlingCharSets
          >
        : TokenizeEscapeChars<
            ConcateUnionOfLiteralString<
              `${EscapeToken}${EscapedChars['length']}`,
              `${Before}${WrapPrefix}`,
              `${WrapSuffix}${After}`
            >,
            [...EscapedChars, '\\'],
            ResovlingCharSets
          >
      : never
    : (
        ResovlingCharSets extends true ? S : ResolveWrapedAndAnyof<S, EscapedChars>
      ) extends infer ResolvedStringOrCaptureResults
    ? ResolvedStringOrCaptureResults extends string
      ? RestoreStringFromToken<ResolvedStringOrCaptureResults, EscapeToken, EscapedChars>
      : ResolvedStringOrCaptureResults extends CaptureResult<
          infer CaptureIndex,
          infer Matches extends string,
          infer OuterCaptureIndex
        >
      ? CaptureResult<
          CaptureIndex,
          RestoreStringFromToken<Matches, EscapeToken, EscapedChars>,
          OuterCaptureIndex
        >
      : never
    : never
  : never

type _ResolveUnwraped<
  S extends string,
  Before extends string,
  Prefix extends string,
  LastChar extends string,
  Rest extends string,
  Current extends string[] = [],
  EscapedChars extends any[] = []
> = RemoveObjIntersect<S> extends `${Before}${infer Op}${Rest}`
  ? Op extends `{${infer Repeat}}`
    ? Repeat extends `${number | `${number},${number | ''}`}`
      ? `${number}` extends Repeat
        ? ResolveUnwraped<
            `${Prefix}${LastChar}${EscapeToken}${IndexOf<
              DefaultEscapedChars,
              '{'
            >}${Repeat}${EscapeToken}${IndexOf<
              DefaultEscapedChars,
              '}'
            >}${Rest extends `$${number}${infer RRest}` ? `${number}${RRest}` : Rest}`,
            EscapedChars,
            Current
          >
        : ResolveWrapedAndAnyof<
            `${Prefix}(?:${LastChar}){${Repeat}}${Rest extends `$${number}${infer RRest}`
              ? `${number}${RRest}`
              : Rest}`,
            EscapedChars
          >
      : ResolveUnwraped<
          ConcateUnionOfLiteralString<
            `${IndexOf<DefaultEscapedChars, '{'>}${Repeat}${EscapeToken}${IndexOf<
              DefaultEscapedChars,
              '}'
            >}`,
            `${Prefix}${LastChar}${EscapeToken}`,
            Rest
          >,
          EscapedChars,
          Current
        >
    : ResolveWrapedAndAnyof<`${Prefix}(?:${LastChar})${Op}${Rest}`, EscapedChars>
  : never

type ResolveUnwraped<
  S extends string,
  EscapedChars extends any[] = [],
  Current extends string[] = [],
  Ops extends string[] = ['?', '*', '+', `{${string}}`]
> = RemoveObjIntersect<S> extends `${infer Before}${Ops[Current['length']]}${infer Rest}`
  ? Before extends ''
    ? S
    : LastCharOf<Before> extends infer LastChar extends string
    ? Before extends `${infer Prefix}${string extends LastChar ? '' : LastChar}`
      ? _ResolveUnwraped<
          Rest extends `${number}${infer RRest}`
            ? `${number}${RRest}` extends Rest
              ? RemoveObjIntersect<S> extends `${infer BeforeCB}{${infer InCB}}${number}${RRest}`
                ? `${BeforeCB}{${InCB}}$${number}${RRest}`
                : S
              : S
            : S,
          Before,
          Prefix,
          LastChar,
          Rest extends `${number}${infer RRest}`
            ? `${number}${RRest}` extends Rest
              ? `$${number}${RRest}`
              : Rest
            : Rest,
          Current,
          EscapedChars
        >
      : Before extends string //? Before might be `string`
      ? _ResolveUnwraped<
          Rest extends `${number}${infer RRest}`
            ? `${number}${RRest}` extends Rest
              ? RemoveObjIntersect<S> extends `${infer BeforeCB}{${infer InCB}}${number}${RRest}`
                ? `${BeforeCB}{${InCB}}$${number}${RRest}`
                : S
              : S
            : S,
          string,
          string,
          string,
          Rest extends `${number}${infer RRest}`
            ? `${number}${RRest}` extends Rest
              ? `$${number}${RRest}`
              : Rest
            : Rest,
          Current,
          EscapedChars
        >
      : never
    : never
  : Current['length'] extends Ops['length']
  ? S extends S
    ? RemoveObjIntersect<S> extends `${infer Before}.${infer After}`
      ? ResolveUnwraped<
          ConcateUnionOfLiteralString<
            | `${EscapeToken}${IndexOf<
                DefaultEscapedChars,
                '('
              >}any character${EscapeToken}${IndexOf<DefaultEscapedChars, ')'>}`
            | (string & {}),
            Before,
            After
          >,
          EscapedChars,
          Current
        >
      : S
    : never
  : ResolveUnwraped<S, EscapedChars, [...Current, '']>

type TokenizeCharSets<
  S extends string,
  CharSets extends any[] = [],
  Prefix extends string = ''
> = S extends `${infer Before}[${infer After}`
  ? Before extends `${infer BeforeEscape}\\`
    ? TokenizeCharSets<After, CharSets, `${Prefix}${BeforeEscape}\\[`>
    : After extends `${infer Inner}]${infer Rest}`
    ? Inner extends `${infer BeforeEscape}\\`
      ? Rest extends `${infer AfterBeforeEscape}]${infer RRest}`
        ? TokenizeCharSets<
            `${Before}(?:${CharSetToken}${CharSets['length']})${RRest}`,
            [...CharSets, `${BeforeEscape}]${AfterBeforeEscape}`],
            Prefix
          >
        : never
      : TokenizeCharSets<
          `${Before}(?:${CharSetToken}${CharSets['length']})${Rest}`,
          [...CharSets, Inner],
          Prefix
        >
    : MatchError<'missing closing `]`.'>
  : TokenizeEscapeChars<`${Prefix}${S}`> extends infer ResolvedStringOrCaptureResults
  ? ResolvedStringOrCaptureResults extends string
    ? RestoreStringFromToken<
        ResolvedStringOrCaptureResults,
        CharSetToken,
        { [K in keyof CharSets]: TokenizeEscapeChars<CharSets[K], [], true> }
      >
    : ResolvedStringOrCaptureResults extends CaptureResult<
        infer CaptureIndex,
        infer Matches extends string,
        infer OuterCaptureIndex
      >
    ? CaptureResult<
        CaptureIndex,
        RestoreStringFromToken<
          Matches,
          CharSetToken,
          { [K in keyof CharSets]: TokenizeEscapeChars<CharSets[K], [], true> }
        >,
        OuterCaptureIndex
      >
    : never
  : never

type ResolveWraped<
  ResolvedInner extends string,
  Wrapper extends string,
  Prefix extends string,
  Rest extends string,
  EscapedChars extends any[] = [],
  CaptureIndex extends any[] = [],
  OuterCaptureIndex extends any[] = []
> = Rest extends `?${infer RRest}`
  ?
      | ResolveWrapedAndAnyof<
          ConcateUnionOfLiteralString<
            ResolvedInner,
            Prefix,
            ResolveBackReference<Wrapper, ResolvedInner, RRest>
          >,
          EscapedChars,
          CaptureIndex,
          OuterCaptureIndex
        >
      | (HasBackReference<Wrapper, RRest> extends true
          ? never
          : ResolveWrapedAndAnyof<
              ConcateUnionOfLiteralString<'', Prefix, RRest>,
              EscapedChars,
              CaptureIndex,
              OuterCaptureIndex
            >)
  : Rest extends `${'*' | '+' | `{${infer Repeat}}`}${infer RRest}` //TODO check combination with \\w and \\d
  ? string extends Repeat
    ?
        | ResolveWrapedAndAnyof<
            ConcateUnionOfLiteralString<
              `${EscapeToken}${IndexOf<DefaultEscapedChars, '('>}${Rest extends `+${string}`
                ? '1 or more'
                : '0 or more'} [${ResolvedInner}]${EscapeToken}${IndexOf<
                DefaultEscapedChars,
                ')'
              >}`,
              Prefix,
              ResolveBackReference<Wrapper, ResolvedInner, RRest>
            >,
            EscapedChars,
            CaptureIndex,
            OuterCaptureIndex
          >
        | ResolveWrapedAndAnyof<
            ConcateUnionOfLiteralString<
              Rest extends `+${string}`
                ?
                    | (`${ResolvedInner}${ResolvedInner extends `${number}`
                        ? `${number}` | ''
                        : string & {}}${ResolvedInner}` & {})
                    | (string extends ResolvedInner ? ResolvedInner & {} : ResolvedInner)
                :
                    | (`${ResolvedInner}${ResolvedInner extends `${number}`
                        ? `${number}` | ''
                        : string & {}}${ResolvedInner}` & {})
                    | (string extends ResolvedInner ? ResolvedInner & {} : ResolvedInner)
                    | '',
              Prefix,
              ResolveBackReference<Wrapper, ResolvedInner, RRest>
            >,
            EscapedChars,
            CaptureIndex,
            OuterCaptureIndex
          >
    : Repeat extends `${number | `${number},${number | ''}`}` //TODO check combination with \\w and \\d
    ? `${number}` extends Repeat
      ? ResolveWrapedAndAnyof<
          `${Prefix}${ResolvedInner}{${number}}${ResolveBackReference<
            Wrapper,
            ResolvedInner,
            RRest
          >}`,
          EscapedChars,
          CaptureIndex,
          OuterCaptureIndex
        >
      : ResolveWrapedAndAnyof<
          ConcateUnionOfLiteralString<
            EmumerateRepeat<ResolvedInner, Repeat>,
            Prefix,
            ResolveBackReference<Wrapper, ResolvedInner, RRest>
          >,
          EscapedChars,
          CaptureIndex,
          OuterCaptureIndex
        >
    : ResolveWrapedAndAnyof<
        `${Prefix}${ResolvedInner}{${Repeat}}${ResolveBackReference<
          Wrapper,
          ResolvedInner,
          RRest
        >}`,
        EscapedChars,
        CaptureIndex,
        OuterCaptureIndex
      > //TODO check combination with \\w and \\d
  : ResolveWrapedAndAnyof<
      ConcateUnionOfLiteralString<
        ResolvedInner,
        Prefix,
        ResolveBackReference<Wrapper, ResolvedInner, Rest>
      >,
      EscapedChars,
      CaptureIndex,
      OuterCaptureIndex
    >

type ResolveWrapedAndAnyof<
  S extends string,
  EscapedChars extends any[] = [],
  CaptureIndex extends any[] = [''],
  OuterCaptureIndex extends any[] = []
> = RemoveObjIntersect<S> extends `${infer Prefix}(${infer After}`
  ? StrAfterMatchingParen<After> extends infer Rest extends string
    ? After extends `${infer Inner})${Rest}`
      ? Inner extends Inner
        ? string extends Inner
          ? ResolveWraped<
              string,
              string,
              Prefix,
              Rest,
              EscapedChars,
              [
                ...IfNonCapturing<Inner, CaptureIndex, [...CaptureIndex, '']>,
                ...CountParenPairs<Inner>
              ],
              OuterCaptureIndex
            > & {}
          : ResolveWrapedAndAnyof<
              ExtractNonCapOrGroupInner<Inner>,
              EscapedChars,
              IfNonCapturing<Inner, CaptureIndex, [...CaptureIndex, '']>,
              CaptureIndex
            > extends infer ResolvedInner
          ? ResolvedInner extends ResolvedInner
            ? RemoveObjIntersect<ResolvedInner> extends infer ResolvedInnerString extends string
              ?
                  | ResolveWraped<
                      ResolvedInnerString,
                      Inner,
                      Prefix,
                      Rest,
                      EscapedChars,
                      [
                        ...IfNonCapturing<Inner, CaptureIndex, [...CaptureIndex, '']>,
                        ...CountParenPairs<Inner>
                      ],
                      OuterCaptureIndex
                    >
                  | (ResolvedInner extends string
                      ? IfNonCapturing<
                          Inner,
                          never,
                          CaptureResult<CaptureIndex, ResolvedInner, OuterCaptureIndex>
                        >
                      : never)
              : ResolvedInner
            : never
          : never
        : never
      : MatchError<'missing closing `)`.'>
    : never
  : RemoveObjIntersect<S> extends `${infer First}|${infer Rest}`
  ?
      | ResolveUnwraped<First, EscapedChars>
      | ResolveWrapedAndAnyof<Rest, EscapedChars, [...CaptureIndex, ''], OuterCaptureIndex>
  : S extends S
  ? ResolveUnwraped<S, EscapedChars>
  : never

export type ResolveRegex<
  S extends string,
  MatchingString extends string = string,
  Results extends string | CaptureResult = TokenizeCharSets<S>,
  AllPossibleMatchesString extends string = Extract<Results, string>,
  MatchResultsTuple extends [string, ...CaptureResult[]] = ConstructMatchResultTuple<
    Exclude<Results, string>,
    [AllPossibleMatchesString]
  >
> = {
  allPossibleMatchesString: AllPossibleMatchesString
  MatchResultsTuple: MatchResultsTuple
  StringMatchStringUnionTuple: string extends MatchingString
    ? {
        [I in keyof MatchResultsTuple]: MatchResultsTuple[I] extends CaptureResult<
          any,
          infer Matches,
          any
        >
          ? Matches
          : MatchResultsTuple[I]
      }
    : never
  LiteralMatchStringUnionTuple: string extends MatchingString
    ? never
    : MatchResultsTuple extends [
        any,
        ...infer CaptureResults extends CaptureResult<any[], string, any[]>[]
      ]
    ? ExtractExactMatch<
        MatchingString,
        Exclude<MatchResultsTuple[0], ''>,
        false
      > extends infer RootMatch
      ? RootMatch extends string
        ? ResolveNestMatches<RootMatch, CaptureResults> extends infer ResolvedNestMatches
          ? {
              [I in keyof ResolvedNestMatches]: ResolvedNestMatches[I] extends never
                ? undefined
                : ResolvedNestMatches[I]
            }
          : never
        : never
      : never
    : never
}

type ResolveNestMatches<
  RootMatch extends string,
  CaptureResults extends CaptureResult<any[], string, any[]>[],
  ResultTuple extends any[] = [RootMatch],
  Matches extends string = CaptureResults extends [
    CaptureResult<any, infer Matches, any[]>,
    ...any[]
  ]
    ? Matches
    : never,
  OuterCaptureIndex extends any[] = CaptureResults extends [
    CaptureResult<any, string, infer OuterCaptureIndex>,
    ...any[]
  ]
    ? OuterCaptureIndex
    : never,
  Rest = CaptureResults extends [any, ...infer Rest] ? Rest : 'END'
> = Rest extends CaptureResult<any[], string, any[]>[]
  ? OuterCaptureIndex['length'] extends 0
    ? ResolveNestMatches<
        RootMatch,
        Rest,
        [...ResultTuple, ExtractExactMatch<RootMatch, Exclude<Matches, ''>, true>]
      >
    : ResolveNestMatches<
        RootMatch,
        Rest,
        [
          ...ResultTuple,
          ExtractExactMatch<ResultTuple[OuterCaptureIndex['length']], Exclude<Matches, ''>, true>
        ]
      >
  : ResultTuple

type ConstructMatchResultTuple<
  Map extends CaptureResult,
  ResultTuple extends any[] = [],
  CurrentIndex extends any[] = ['']
> = Extract<
  Map,
  {
    captureIndex: CurrentIndex
  }
> extends never
  ? ResultTuple
  : ConstructMatchResultTuple<
      Map,
      [
        ...ResultTuple,
        Extract<
          Map,
          {
            captureIndex: CurrentIndex
          }
        >
      ],
      [...CurrentIndex, '']
    >

type GetMatchString<
  S extends string,
  PossibleMatch extends string,
  Prefix extends string = ''
> = `${number}` extends PossibleMatch // `${string}${number}${string}` only match string with 1 char before number
  ? S extends `${infer PrefixChar}${number}${infer Suffix}`
    ? S extends `${PrefixChar}${infer Match}${Suffix}`
      ? Match
      : never
    : S extends `${infer FirstChar}${infer Rest}`
    ? FirstChar extends `${number}`
      ? S
      : GetMatchString<Rest, PossibleMatch, `${Prefix}${FirstChar}`>
    : never
  : S extends `${infer Prefix}${PossibleMatch}${infer Suffix}`
  ? S extends `${Prefix}${infer Match}${Suffix}`
    ? Match
    : never
  : never

type ExtractExactMatch<
  S extends string,
  PossibleMatchs extends string,
  ByPassCheck extends boolean,
  AllPossibleMatchs extends string = PossibleMatchs
> = GetFirstMatch<
  S,
  PossibleMatchs extends PossibleMatchs
    ? GetMatchString<S, PossibleMatchs> extends infer Match extends string
      ? ByPassCheck extends true
        ? Match
        : Extract<ValidateMatch<Match, AllPossibleMatchs>, { valid: false }> extends never
        ? Match
        : never
      : never
    : never
>

type GetFirstMatch<S extends string, Matches extends string> = GetLongestStringInUnion<
  S extends `${string}${Matches}${infer After}`
    ? Matches extends Matches
      ? `${string}${Matches}${string}` extends After
        ? never
        : Matches extends infer Match extends string
        ? Match extends Match
          ? Extract<
              After extends After
                ? After extends `${string}${Match}${string}`
                  ? { found: true }
                  : { found: false }
                : never,
              { found: true }
            > extends never
            ? Match
            : never
          : never
        : never
      : never
    : never
>

type GetLongestStringInUnion<
  S extends string | [Original: string, Rest: string],
  U extends [Original: string, Rest: string] = S extends [string, string]
    ? S
    : S extends S
    ? [S, S]
    : never,
  Currents extends [string, string] = U extends [
    infer Original extends string,
    `${string}${infer Rest}`
  ]
    ? Rest extends ''
      ? false
      : [Original, Rest]
    : never
> = Exclude<Currents, false> extends never
  ? S extends string
    ? S
    : S[0]
  : GetLongestStringInUnion<Exclude<Currents, false>>

type ValidateMatch<
  //! have to implement checks for other conditions
  Match extends string,
  PossibleMatchs extends string,
  SpecialTokens extends string = '(any wordChar)' | '(any digit)' | '(any character)'
> = SpecialTokens extends SpecialTokens
  ? RemoveObjIntersect<
      Extract<PossibleMatchs, `${string}${SpecialTokens}${string}`>
    > extends infer Matcher
    ? Matcher extends Matcher
      ? { Matcher: Matcher } extends { Matcher: never }
        ? { valid: true }
        : Matcher extends `${infer First}${SpecialTokens}${infer Rest}`
        ? string extends First
          ? never
          : Match extends `${First}${infer Char}${ReplaceString<
              ReplaceString<Rest, '(any wordChar)' | '(any character)', string>,
              '(any digit)',
              `${number}`
            >}`
          ? LengthOfString<Char> extends 1
            ? { valid: true }
            : { valid: false } //'more than one'
          : never
        : never
      : never
    : never
  : never

type LengthOfString<S extends string, T extends string[] = []> = S extends `${infer F}${infer R}`
  ? LengthOfString<R, [F, ...T]>
  : T['length']

type MatchError<S extends string> = S

type CaptureResult<
  CaptureIndex extends any[] = any[],
  Matches extends string = string,
  OuterCaptureIndex extends any[] = never
> = {
  captureIndex: CaptureIndex
  matches: Matches
  outerCaptureIndex: OuterCaptureIndex
}

type IfNonCapturing<S extends string, Yes, No> = S extends `?:${string}` ? Yes : No

type CountParenPairs<S extends string, Acc extends any[] = []> = S extends `${string}(${infer Rest}`
  ? StrAfterMatchingParen<Rest> extends infer RRest extends string
    ? Rest extends `${infer Inner})${RRest}`
      ? [
          ...IfNonCapturing<
            Inner,
            CountParenPairs<Inner, Acc>,
            CountParenPairs<Inner, [...Acc, '']>
          >,
          ...CountParenPairs<RRest>
        ]
      : Acc extends [...infer R, '']
      ? R
      : Acc
    : never
  : Acc

type StrAfterMatchingParen<S extends string> = S extends `${infer Before})${infer After}`
  ? Before extends `${infer Prefix}(${infer Suffix}`
    ? StrAfterMatchingParen<`${Prefix}${Suffix}${After}`>
    : After
  : S
