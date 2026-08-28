import type {
  AlgorithmChallenge,
  ChallengeSkillDefinition,
  CodeMappingEntry,
  CodePracticeRuntime,
  LogicCodeStep,
  StructuredScaffold,
  StructuredScaffoldNode,
  VerificationBatchBase,
} from '../challenges/types'

export const CODE_LANGUAGE_IDS = ['cpp', 'python', 'javascript', 'java'] as const

export type CodeLanguageId = typeof CODE_LANGUAGE_IDS[number]

export interface CodeLanguageDefinition {
  id: CodeLanguageId
  label: string
  editorLabel: string
}

export const CODE_LANGUAGES: CodeLanguageDefinition[] = [
  { id: 'cpp', label: 'C++', editorLabel: 'C++' },
  { id: 'python', label: 'Python', editorLabel: 'Python' },
  { id: 'javascript', label: 'JavaScript', editorLabel: 'JavaScript' },
  { id: 'java', label: 'Java', editorLabel: 'Java' },
]

export const codeLanguage = (languageId: CodeLanguageId) =>
  CODE_LANGUAGES.find((language) => language.id === languageId) ?? CODE_LANGUAGES.at(-1)!

interface SignatureInfo {
  name: string
  returnType: string
  parameters: Array<{ type: string; name: string }>
  arrays: Set<string>
  strings: Set<string>
}

const parseSignature = (signature: string): SignatureInfo => {
  const normalized = signature
    .replace(/\{\s*$/, '')
    .replace(/^public\s+/, '')
    .trim()
  const match = normalized.match(/^(.+?)\s+([A-Za-z_$][\w$]*)\s*\((.*)\)$/)
  if (!match) {
    return { name: 'solve', returnType: 'int', parameters: [], arrays: new Set(), strings: new Set() }
  }
  const parameters = match[3].trim()
    ? match[3].split(',').map((parameter) => {
        const parts = parameter.trim().split(/\s+/)
        return { type: parts.slice(0, -1).join(' '), name: parts.at(-1) ?? 'input' }
      })
    : []
  return {
    name: match[2],
    returnType: match[1],
    parameters,
    arrays: new Set(parameters.filter(({ type }) => type.endsWith('[]')).map(({ name }) => name)),
    strings: new Set(parameters.filter(({ type }) => type === 'String').map(({ name }) => name)),
  }
}

const cppType = (type: string, parameter = false) => {
  if (type === 'String') return parameter ? 'const string&' : 'string'
  if (type === 'int[]') return parameter ? 'vector<int>&' : 'vector<int>'
  if (type === 'List<Integer>') return 'vector<int>'
  return type
}

export const translateMethodSignature = (signature: string, languageId: CodeLanguageId) => {
  const info = parseSignature(signature)
  if (languageId === 'java') return signature.replace(/\{\s*$/, '').trim()
  if (languageId === 'javascript') {
    return `function ${info.name}(${info.parameters.map(({ name }) => name).join(', ')})`
  }
  if (languageId === 'python') {
    return `def ${info.name}(${info.parameters.map(({ name }) => name).join(', ')})`
  }
  return `${cppType(info.returnType)} ${info.name}(${info.parameters
    .map(({ type, name }) => `${cppType(type, true)} ${name}`)
    .join(', ')})`
}

const splitArguments = (source: string) => {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < source.length; index += 1) {
    if ('([{'.includes(source[index])) depth += 1
    if (')]}'.includes(source[index])) depth -= 1
    if (source[index] === ',' && depth === 0) {
      parts.push(source.slice(start, index).trim())
      start = index + 1
    }
  }
  parts.push(source.slice(start).trim())
  return parts
}

const replaceCall = (
  source: string,
  method: string,
  replacement: (receiver: string, args: string[]) => string,
) => {
  let output = source
  const marker = `.${method}(`
  let cursor = 0
  while ((cursor = output.indexOf(marker, cursor)) >= 0) {
    let receiverStart = cursor - 1
    while (receiverStart >= 0 && /[\w$.[\]]/.test(output[receiverStart])) receiverStart -= 1
    receiverStart += 1
    const receiver = output.slice(receiverStart, cursor)
    let depth = 1
    let end = cursor + marker.length
    while (end < output.length && depth > 0) {
      if (output[end] === '(') depth += 1
      if (output[end] === ')') depth -= 1
      end += 1
    }
    if (depth !== 0) break
    const argsSource = output.slice(cursor + marker.length, end - 1)
    const next = replacement(receiver, splitArguments(argsSource))
    output = `${output.slice(0, receiverStart)}${next}${output.slice(end)}`
    cursor = receiverStart + next.length
  }
  return output
}

const replaceJavaTernaryWithPython = (line: string) => {
  const assignment = line.match(/^(\s*[A-Za-z_$][\w$]*\s*=\s*)(.+?)\s*\?\s*(.+?)\s*:\s*(.+?)(;?)$/)
  if (!assignment) return line
  return `${assignment[1]}${assignment[3]} if ${assignment[2]} else ${assignment[4]}${assignment[5]}`
}

const translateJavaExpression = (source: string, languageId: Exclude<CodeLanguageId, 'java'>) => {
  let output = source
  if (languageId === 'cpp') {
    output = output
      .replace(/Math\.max\(/g, 'max(')
      .replace(/Arrays\.equals\(([^,]+),\s*([^)]+)\)/g, '$1 == $2')
      .replace(/\.charAt\(([^)]+)\)/g, '[$1]')
      .replace(/\.length\(\)/g, '.size()')
      .replace(/\.length\b/g, '.size()')
      .replace(/\.add\(/g, '.push_back(')
    output = replaceCall(output, 'substring', (receiver, args) => (
      `${receiver}.substr(${args[0]}, ${args[1]} - ${args[0]})`
    ))
    output = replaceCall(output, 'getOrDefault', (receiver, args) => (
      `(${receiver}.count(${args[0]}) ? ${receiver}[${args[0]}] : ${args[1]})`
    ))
    output = replaceCall(output, 'put', (receiver, args) => `${receiver}[${args[0]}] = ${args[1]}`)
    return output
  }
  if (languageId === 'javascript') {
    output = output
      .replace(/Arrays\.equals\(([^,]+),\s*([^)]+)\)/g, 'arraysEqual($1, $2)')
      .replace(/\.length\(\)/g, '.length')
      .replace(/\.add\(/g, '.push(')
    output = replaceCall(output, 'substring', (receiver, args) => `${receiver}.slice(${args.join(', ')})`)
    output = replaceCall(output, 'getOrDefault', (receiver, args) => `(${receiver}.get(${args[0]}) ?? ${args[1]})`)
    output = replaceCall(output, 'put', (receiver, args) => `${receiver}.set(${args.join(', ')})`)
    return output
  }
  output = output
    .replace(/Math\.max\(/g, 'max(')
    .replace(/Arrays\.equals\(([^,]+),\s*([^)]+)\)/g, '$1 == $2')
    .replace(/([A-Za-z_$][\w$]*)\.charAt\(([^)]+)\)/g, '$1[$2]')
    .replace(/([A-Za-z_$][\w$]*)\.length\(\)/g, 'len($1)')
    .replace(/([A-Za-z_$][\w$]*)\.length\b/g, 'len($1)')
    .replace(/\.add\(/g, '.append(')
    .replace(/&&/g, 'and')
    .replace(/\|\|/g, 'or')
    .replace(/!(?!=)/g, 'not ')
  output = replaceCall(output, 'substring', (receiver, args) => `${receiver}[${args[0]}:${args[1]}]`)
  output = replaceCall(output, 'getOrDefault', (receiver, args) => `${receiver}.get(${args.join(', ')})`)
  output = replaceCall(output, 'put', (receiver, args) => `${receiver}[${args[0]}] = ${args[1]}`)
  return output
}

const translateJavaLine = (line: string, languageId: Exclude<CodeLanguageId, 'java'>) => {
  let output = line.trim()
  if (!output) return ''
  if (languageId === 'cpp') {
    output = output
      .replace(/^Map<Integer,\s*Integer>\s+([\w$]+)\s*=\s*new HashMap<>\(\);$/, 'unordered_map<int, int> $1;')
      .replace(/^List<Integer>\s+([\w$]+)\s*=\s*new ArrayList<>\(\);$/, 'vector<int> $1;')
      .replace(/^int\[\]\s+([\w$]+)\s*=\s*new int\[(.+)\];$/, 'vector<int> $1($2, 0);')
    return translateJavaExpression(output, languageId)
  }
  if (languageId === 'javascript') {
    output = output
      .replace(/^Map<Integer,\s*Integer>\s+([\w$]+)\s*=\s*new HashMap<>\(\);$/, 'const $1 = new Map();')
      .replace(/^List<Integer>\s+([\w$]+)\s*=\s*new ArrayList<>\(\);$/, 'const $1 = [];')
      .replace(/^int\[\]\s+([\w$]+)\s*=\s*new int\[(.+)\];$/, 'const $1 = new Array($2).fill(0);')
      .replace(/^(?:int|String)\s+([\w$]+)\s*=/, 'let $1 =')
    return translateJavaExpression(output, languageId)
  }
  output = output
    .replace(/^Map<Integer,\s*Integer>\s+([\w$]+)\s*=\s*new HashMap<>\(\);$/, '$1 = {}')
    .replace(/^List<Integer>\s+([\w$]+)\s*=\s*new ArrayList<>\(\);$/, '$1 = []')
    .replace(/^int\[\]\s+([\w$]+)\s*=\s*new int\[(.+)\];$/, '$1 = [0] * $2')
    .replace(/^(?:int|String)\s+([\w$]+)\s*=/, '$1 =')
    .replace(/;\s*$/, '')
    .replace(/^(.+?)\+\+$/, '$1 += 1')
    .replace(/^(.+?)--$/, '$1 -= 1')
  output = replaceJavaTernaryWithPython(output)
  return translateJavaExpression(output, languageId)
}

export const translateJavaSource = (
  source: string,
  languageId: CodeLanguageId,
  options: { baseDepth?: number } = {},
) => {
  if (languageId === 'java') return source
  if (languageId !== 'python') {
    return source.split('\n').map((line) => {
      const indentation = line.match(/^\s*/)?.[0] ?? ''
      return `${indentation}${translateJavaLine(line, languageId)}`
    }).join('\n')
  }

  let depth = options.baseDepth ?? 0
  const minimumDepth = depth
  const output: string[] = []
  for (const rawLine of source.split('\n')) {
    let line = rawLine.trim()
    if (!line) {
      output.push('')
      continue
    }
    const closes = line.match(/^}+/)?.[0].length ?? 0
    if (closes) {
      depth = Math.max(minimumDepth, depth - closes)
      line = line.slice(closes).trim()
      if (!line) {
        output.push(`${'    '.repeat(depth)}# end block`)
        continue
      }
    }
    const opens = line.endsWith('{')
    line = line.replace(/\{\s*$/, '').trim()
    if (line === 'else') line = 'else:'
    else if (/^(while|if|for)\s*\([^{}]*\)$/.test(line)) {
      const match = line.match(/^(while|if|for)\s*\((.*)\)$/)!
      if (match[1] === 'for') {
        const forMatch = match[2].match(/^int\s+([\w$]+)\s*=\s*0\s*;\s*\1\s*<\s*(.+?)\s*;\s*\1\+\+$/)
        line = forMatch
          ? `for ${forMatch[1]} in range(${translateJavaExpression(forMatch[2], 'python')}):`
          : `for ${translateJavaExpression(match[2], 'python')}:`
      } else {
        line = `${match[1]} ${translateJavaExpression(match[2], 'python')}:`
      }
    } else {
      line = translateJavaLine(line, 'python')
    }
    output.push(`${'    '.repeat(depth)}${line}`)
    if (opens && line.endsWith(':')) depth += 1
  }
  return output.join('\n')
}

const replaceKnownStringAccess = (source: string, strings: Set<string>) => {
  let output = source
  for (const name of strings) {
    output = output.replace(new RegExp(`\\b${name}\\s*\\[([^\\]]+)\\]`, 'g'), `${name}.charAt($1)`)
  }
  return output
}

const replaceLengthsForJava = (
  source: string,
  strings: Set<string>,
  languageId: 'cpp' | 'javascript' | 'python',
) => {
  let output = source
  for (const name of strings) {
    if (languageId === 'cpp') {
      output = output.replace(new RegExp(`\\b${name}\\.size\\(\\)`, 'g'), `${name}.length()`)
    } else if (languageId === 'javascript') {
      output = output.replace(new RegExp(`\\b${name}\\.length\\b`, 'g'), `${name}.length()`)
    } else {
      output = output.replace(new RegExp(`len\\(\\s*${name}\\s*\\)`, 'g'), `${name}.length()`)
    }
  }
  return output
}

const normalizeCppSource = (source: string, signature: string) => {
  const info = parseSignature(signature)
  const maps = new Set([...source.matchAll(/(?:unordered_map<int,\s*int>|map<int,\s*int>)\s+([\w$]+)/g)].map((match) => match[1]))
  const arrays = new Set([...info.arrays])
  let output = source.replace(/\bstd::/g, '')
  output = output.replace(/(?:unordered_map<int,\s*int>|map<int,\s*int>)\s+([\w$]+)\s*;/g, (_, name) => {
    maps.add(name)
    return `Map<Integer, Integer> ${name} = new HashMap<>();`
  })
  output = output.replace(/vector<int>\s+([\w$]+)\s*\((.+),\s*0\s*\)\s*;/g, (_, name, length) => {
    arrays.add(name)
    return `int[] ${name} = new int[${length}];`
  })
  output = output.replace(/vector<int>\s+([\w$]+)\s*;/g, 'List<Integer> $1 = new ArrayList<>();')
  output = output.replace(/\b(?:auto|size_t)\s+([\w$]+)\s*=/g, 'int $1 =')
  output = output.replace(/\bmax\s*\(/g, 'Math.max(').replace(/\.push_back\(/g, '.add(')
  output = replaceCall(output, 'substr', (receiver, args) => {
    const end = args[1]?.match(new RegExp(`^(.+)\\s*-\\s*${args[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))?.[1]
    return `${receiver}.substring(${args[0]}, ${end ?? `${args[0]} + ${args[1]}`})`
  })
  for (const mapName of maps) {
    const escaped = mapName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    output = output.replace(
      new RegExp(`\\(?${escaped}\\.count\\(([^)]+)\\)\\s*\\?\\s*${escaped}\\[\\1\\]\\s*:\\s*([^;)]+)\\)?`, 'g'),
      `${mapName}.getOrDefault($1, $2)`,
    )
    output = output.replace(new RegExp(`\\b${escaped}\\[([^\\]]+)\\]\\s*=\\s*([^;]+);`, 'g'), `${mapName}.put($1, $2);`)
  }
  output = replaceLengthsForJava(output, info.strings, 'cpp')
  output = output.replace(/\.size\(\)/g, '.length')
  output = replaceKnownStringAccess(output, info.strings)
  for (const left of arrays) {
    for (const right of arrays) {
      if (left === right) continue
      output = output.replace(
        new RegExp(`\\b${left}\\s*==\\s*${right}\\b`, 'g'),
        `Arrays.equals(${left}, ${right})`,
      )
    }
  }
  return output
}

const normalizeJavascriptSource = (source: string, signature: string) => {
  const info = parseSignature(signature)
  const maps = new Set<string>()
  const arrays = new Set([...info.arrays])
  let output = source
    .replace(/===/g, '==')
    .replace(/!==/g, '!=')
    .replace(/arraysEqual\(([^,]+),\s*([^)]+)\)/g, 'Arrays.equals($1, $2)')
    .replace(/\.push\(/g, '.add(')
  output = output.replace(/(?:const|let|var)\s+([\w$]+)\s*=\s*new Map\(\)\s*;/g, (_, name) => {
    maps.add(name)
    return `Map<Integer, Integer> ${name} = new HashMap<>();`
  })
  output = output.replace(/(?:const|let|var)\s+([\w$]+)\s*=\s*new Array\((.+)\)\.fill\(0\)\s*;/g, (_, name, length) => {
    arrays.add(name)
    return `int[] ${name} = new int[${length}];`
  })
  output = output.replace(/(?:const|let|var)\s+([\w$]+)\s*=\s*\[\]\s*;/g, 'List<Integer> $1 = new ArrayList<>();')
  output = output.replace(/(?:const|let|var)\s+([\w$]+)\s*=\s*([^;]+);/g, 'int $1 = $2;')
  output = replaceCall(output, 'slice', (receiver, args) => `${receiver}.substring(${args.join(', ')})`)
  output = replaceCall(output, 'set', (receiver, args) => `${receiver}.put(${args.join(', ')})`)
  for (const mapName of maps) {
    const escaped = mapName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    output = output.replace(
      new RegExp(`\\(?${escaped}\\.get\\(([^)]+)\\)\\s*\\?\\?\\s*([^)]+)\\)?`, 'g'),
      `${mapName}.getOrDefault($1, $2)`,
    )
  }
  output = replaceLengthsForJava(output, info.strings, 'javascript')
  return output
}

interface PythonContext {
  declared: Set<string>
  arrays: Set<string>
  maps: Set<string>
  lists: Set<string>
  strings: Set<string>
}

const pythonExpressionToJava = (source: string, context: PythonContext) => {
  let output = source.trim()
  output = output
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\s+/g, '!')
    .replace(/\bmax\s*\(/g, 'Math.max(')
  for (const stringName of context.strings) {
    output = output.replace(new RegExp(`len\\(\\s*${stringName}\\s*\\)`, 'g'), `${stringName}.length()`)
    output = output.replace(new RegExp(`\\b${stringName}\\[([^:\\]]+):([^\\]]+)\\]`, 'g'), `${stringName}.substring($1, $2)`)
    output = output.replace(new RegExp(`\\b${stringName}\\[([^\\]]+)\\]`, 'g'), `${stringName}.charAt($1)`)
  }
  for (const arrayName of context.arrays) {
    output = output.replace(new RegExp(`len\\(\\s*${arrayName}\\s*\\)`, 'g'), `${arrayName}.length`)
  }
  output = output.replace(/([\w$]+)\.get\(([^,]+),\s*([^)]+)\)/g, '$1.getOrDefault($2, $3)')
  output = output.replace(/\.append\(/g, '.add(')
  for (const left of context.arrays) {
    for (const right of context.arrays) {
      output = output.replace(new RegExp(`\\b${left}\\s*==\\s*${right}\\b`, 'g'), `Arrays.equals(${left}, ${right})`)
    }
  }
  const ternary = output.match(/^(.+?)\s+if\s+(.+?)\s+else\s+(.+)$/)
  if (ternary) output = `${ternary[2]} ? ${ternary[1]} : ${ternary[3]}`
  return output
}

const normalizePythonSource = (source: string, signature: string) => {
  const info = parseSignature(signature)
  const context: PythonContext = {
    declared: new Set(info.parameters.map(({ name }) => name)),
    arrays: new Set(info.arrays),
    maps: new Set(),
    lists: new Set(),
    strings: new Set(info.strings),
  }
  const output: string[] = []
  const scopes: number[] = []
  const lines = source.replace(/\t/g, '    ').split('\n')

  const closeScopes = (indent: number) => {
    while (scopes.length && indent <= scopes.at(-1)!) {
      output.push(`${'  '.repeat(scopes.length - 1)}}`)
      scopes.pop()
    }
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const indent = rawLine.length - rawLine.trimStart().length
    closeScopes(indent)

    const forMatch = trimmed.match(/^for\s+([\w$]+)\s+in\s+range\(len\(([\w$]+)\)\)\s*:\s*$/)
    if (forMatch) {
      const [, variable, array] = forMatch
      context.declared.add(variable)
      const lengthAccess = context.strings.has(array) ? `${array}.length()` : `${array}.length`
      output.push(`${'  '.repeat(scopes.length)}for (int ${variable} = 0; ${variable} < ${lengthAccess}; ${variable}++) {`)
      scopes.push(indent)
      continue
    }
    const control = trimmed.match(/^(while|if|elif)\s+(.+)\s*:\s*$/)
    if (control) {
      const keyword = control[1] === 'elif' ? 'else if' : control[1]
      output.push(`${'  '.repeat(scopes.length)}${keyword} (${pythonExpressionToJava(control[2], context)}) {`)
      scopes.push(indent)
      continue
    }
    if (/^else\s*:\s*$/.test(trimmed)) {
      output.push(`${'  '.repeat(scopes.length)}else {`)
      scopes.push(indent)
      continue
    }
    if (trimmed.startsWith('return ')) {
      output.push(`${'  '.repeat(scopes.length)}return ${pythonExpressionToJava(trimmed.slice(7), context)};`)
      continue
    }

    const augmented = trimmed.match(/^(.+?)\s*(\+=|-=)\s*(.+)$/)
    if (augmented) {
      output.push(`${'  '.repeat(scopes.length)}${pythonExpressionToJava(augmented[1], context)} ${augmented[2]} ${pythonExpressionToJava(augmented[3], context)};`)
      continue
    }
    const assignment = trimmed.match(/^(.+?)\s*=\s*(.+)$/)
    if (!assignment) {
      output.push(`${'  '.repeat(scopes.length)}${pythonExpressionToJava(trimmed, context)};`)
      continue
    }
    const target = assignment[1].trim()
    const rawValue = assignment[2].trim()
    const mapTarget = target.match(/^([\w$]+)\[(.+)\]$/)
    if (mapTarget && context.maps.has(mapTarget[1])) {
      output.push(`${'  '.repeat(scopes.length)}${mapTarget[1]}.put(${pythonExpressionToJava(mapTarget[2], context)}, ${pythonExpressionToJava(rawValue, context)});`)
      continue
    }
    if (!context.declared.has(target) && /^[A-Za-z_$][\w$]*$/.test(target)) {
      context.declared.add(target)
      if (rawValue === '{}') {
        context.maps.add(target)
        output.push(`${'  '.repeat(scopes.length)}Map<Integer, Integer> ${target} = new HashMap<>();`)
        continue
      }
      if (rawValue === '[]') {
        context.lists.add(target)
        output.push(`${'  '.repeat(scopes.length)}List<Integer> ${target} = new ArrayList<>();`)
        continue
      }
      const array = rawValue.match(/^\[0\]\s*\*\s*(.+)$/)
      if (array) {
        context.arrays.add(target)
        output.push(`${'  '.repeat(scopes.length)}int[] ${target} = new int[${pythonExpressionToJava(array[1], context)}];`)
        continue
      }
      output.push(`${'  '.repeat(scopes.length)}int ${target} = ${pythonExpressionToJava(rawValue, context)};`)
      continue
    }
    output.push(`${'  '.repeat(scopes.length)}${pythonExpressionToJava(target, context)} = ${pythonExpressionToJava(rawValue, context)};`)
  }
  while (scopes.length) {
    output.push(`${'  '.repeat(scopes.length - 1)}}`)
    scopes.pop()
  }
  return output.join('\n')
}

export const normalizeLanguageSource = (
  source: string,
  languageId: CodeLanguageId,
  methodSignature: string,
) => {
  if (languageId === 'java') return source
  if (languageId === 'cpp') return normalizeCppSource(source, methodSignature)
  if (languageId === 'javascript') return normalizeJavascriptSource(source, methodSignature)
  return normalizePythonSource(source, methodSignature)
}

const translateScaffoldNode = (
  node: StructuredScaffoldNode,
  languageId: CodeLanguageId,
): StructuredScaffoldNode | null => {
  if (languageId === 'java') return node
  if (languageId === 'python') {
    if (node.kind === 'fixed') {
      if (node.value.trim() === '}') return null
      if (node.value.trim() === '} else {') return { ...node, value: 'else:' }
      return { ...node, value: translateJavaSource(node.value, languageId, { baseDepth: node.depth }).trim() }
    }
    if (node.kind === 'slot') return { ...node, suffix: '' }
    const forSlots = node.segments
      .filter((segment): segment is Extract<typeof segment, { kind: 'slot' }> => segment.kind === 'slot')
      .map((segment) => segment.slotId)
    if (node.segments.some((segment) => segment.kind === 'fixed' && segment.value === 'for (') && forSlots.length) {
      return {
        ...node,
        segments: [
          { kind: 'fixed', value: 'for ' },
          { kind: 'slot', slotId: forSlots[0] },
          { kind: 'fixed', value: ':' },
        ],
      }
    }
    return {
      ...node,
      segments: node.segments.map((segment) => {
        if (segment.kind === 'slot') return segment
        const value = segment.value
          .replace(/^(while|if)\s*\($/, '$1 ')
          .replace(/^\)\s*\{$/, ':')
          .replace(/^;$/, '')
        return { ...segment, value }
      }),
    }
  }
  if (node.kind === 'fixed') {
    return { ...node, value: translateJavaSource(node.value, languageId).trim() }
  }
  return node
}

const translatePythonScaffoldBody = (body: StructuredScaffoldNode[]) => {
  const output: StructuredScaffoldNode[] = []
  const minimumDepth = body[0]?.depth ?? 0
  let depth = minimumDepth

  for (const node of body) {
    if (node.kind === 'fixed' && node.value.trim() === '}') {
      depth = Math.max(minimumDepth, depth - 1)
      continue
    }
    if (node.kind === 'fixed' && node.value.trim() === '} else {') {
      depth = Math.max(minimumDepth, depth - 1)
      output.push({ kind: 'fixed', depth, value: 'else:' })
      depth += 1
      continue
    }

    const translated = translateScaffoldNode(node, 'python')
    if (!translated) continue
    output.push({ ...translated, depth })

    if (node.kind === 'composite') {
      const opensScope = node.segments.some((segment) => (
        segment.kind === 'fixed' && segment.value.includes('{')
      ))
      if (opensScope) depth += 1
    }
  }

  return output
}

export const translateScaffold = (
  scaffold: StructuredScaffold,
  methodSignature: string,
  languageId: CodeLanguageId,
): StructuredScaffold => {
  const pythonForAliases = new Map<string, string>()
  if (languageId === 'python') {
    for (const node of scaffold.body) {
      if (node.kind !== 'composite') continue
      if (!node.segments.some((segment) => segment.kind === 'fixed' && segment.value === 'for (')) continue
      const slotIds = node.segments
        .filter((segment): segment is Extract<typeof segment, { kind: 'slot' }> => segment.kind === 'slot')
        .map((segment) => segment.slotId)
      slotIds.slice(1).forEach((slotId) => pythonForAliases.set(slotId, slotIds[0]))
    }
  }

  const slots = scaffold.slots
    .filter((slot) => !pythonForAliases.has(slot.id))
    .map((slot) => {
      if (languageId !== 'python' || ![...pythonForAliases.values()].includes(slot.id)) return slot
      const merged = scaffold.slots.filter((candidate) => (
        candidate.id === slot.id || pythonForAliases.get(candidate.id) === slot.id
      ))
      return {
        ...slot,
        label: '遍历范围',
        responsibility: `${merged.map((candidate) => candidate.responsibility).join('、')}使用“变量 in range(...)”填写。`,
        conceptIds: [...new Set(merged.flatMap((candidate) => candidate.conceptIds))],
      }
    })

  return {
    ...scaffold,
    slots,
    methodOpen: languageId === 'python'
      ? `${translateMethodSignature(methodSignature, languageId)}:`
      : `${translateMethodSignature(methodSignature, languageId)} {`,
    methodClose: languageId === 'python' ? '' : '}',
    body: languageId === 'python'
      ? translatePythonScaffoldBody(scaffold.body)
      : scaffold.body
        .map((node) => translateScaffoldNode(node, languageId))
        .filter((node): node is StructuredScaffoldNode => node !== null),
  }
}

const scaffoldSlotAliases = (
  scaffold: StructuredScaffold,
  languageId: CodeLanguageId,
) => {
  const aliases = new Map<string, string>()
  if (languageId !== 'python') return aliases
  for (const node of scaffold.body) {
    if (node.kind !== 'composite') continue
    if (!node.segments.some((segment) => segment.kind === 'fixed' && segment.value === 'for (')) continue
    const slotIds = node.segments
      .filter((segment): segment is Extract<typeof segment, { kind: 'slot' }> => segment.kind === 'slot')
      .map((segment) => segment.slotId)
    slotIds.slice(1).forEach((slotId) => aliases.set(slotId, slotIds[0]))
  }
  return aliases
}

export const translateCodeSteps = <T extends { code: string; depth: number }>(
  steps: T[],
  languageId: CodeLanguageId,
): T[] => {
  if (languageId !== 'python') {
    return steps.map((step) => ({
      ...step,
      code: translateJavaSource(step.code, languageId, { baseDepth: step.depth }),
    }))
  }

  const boundary = (index: number) => `__skill_programming_step_${index}`
  const markedSource = steps.map((step, index) => (
    index === 0 ? step.code : `int ${boundary(index)} = 0;\n${step.code}`
  )).join('\n')
  const translated = translateJavaSource(markedSource, languageId)
  const translatedSteps: string[] = []
  let current: string[] = []

  for (const line of translated.split('\n')) {
    const marker = line.trim().match(/^__skill_programming_step_(\d+)\s*=\s*0$/)
    if (!marker) {
      current.push(line)
      continue
    }
    translatedSteps.push(current.join('\n').replace(/\n+$/, ''))
    current = []
  }
  translatedSteps.push(current.join('\n').replace(/\n+$/, ''))

  return steps.map((step, index) => ({
    ...step,
    code: translatedSteps[index] ?? '',
  }))
}

const translateReferenceSteps = (
  steps: LogicCodeStep[],
  languageId: CodeLanguageId,
) => translateCodeSteps(steps, languageId)

const translateMappings = (
  mappings: CodeMappingEntry[],
  languageId: CodeLanguageId,
): CodeMappingEntry[] => mappings.map((mapping) => ({
  ...mapping,
  code: translateJavaSource(mapping.code, languageId).trim(),
}))

export const createLanguageChallenge = <
  ProgramAst,
  TInput,
  TOutput,
  TSkill extends ChallengeSkillDefinition,
  TBatch extends VerificationBatchBase,
  TScene extends { target: string },
>(
  challenge: AlgorithmChallenge<ProgramAst, TInput, TOutput, TSkill, TBatch, TScene>,
  languageId: CodeLanguageId,
): AlgorithmChallenge<ProgramAst, TInput, TOutput, TSkill, TBatch, TScene> => {
  if (languageId === 'java') return challenge
  const base = challenge.codePractice
  const normalize = (source: string) => normalizeLanguageSource(source, languageId, base.methodSignature)
  const runtime: CodePracticeRuntime<ProgramAst, TInput, TOutput> = {
    ...base.runtime,
    parse: (source) => base.runtime.parse(normalize(source)),
    run: (source, input, expected) => base.runtime.run(normalize(source), input, expected),
  }
  const label = codeLanguage(languageId).label
  const aliases = scaffoldSlotAliases(base.scaffold, languageId)
  const scaffold = translateScaffold(base.scaffold, base.methodSignature, languageId)
  return {
    ...challenge,
    languageId,
    codePractice: {
      ...base,
      methodSignature: translateMethodSignature(base.methodSignature, languageId),
      scaffold,
      referenceSteps: translateReferenceSteps(base.referenceSteps, languageId),
      mappings: translateMappings(base.mappings, languageId),
      runtime,
      presentation: {
        ...base.presentation,
        eyebrow: base.presentation.eyebrow.replace(/Java/g, label),
      },
      checkToSlot: Object.fromEntries(Object.entries(base.checkToSlot).map(([check, slotId]) => [
        check,
        aliases.get(slotId) ?? slotId,
      ])),
      draftStorage: undefined,
    },
  }
}
